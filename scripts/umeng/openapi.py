"""Fetch the reviewed dashboard's aggregate inputs with the U-App OpenAPI."""

import csv
import errno
import hashlib
import hmac
import json
import os
import re
import socket
import time
from collections import Counter
from datetime import date, datetime, timedelta, timezone
from email.utils import parsedate_to_datetime
from http.client import IncompleteRead, RemoteDisconnected
from pathlib import Path
from tempfile import TemporaryDirectory
from urllib.error import HTTPError, URLError
from urllib.parse import quote, unquote, urlencode
from urllib.request import HTTPRedirectHandler, Request, build_opener

from build_dashboard_data import DISTRIBUTION_ALLOWLIST


HOST = "https://gateway.open.umeng.com"
ROUTE = "param2/1/com.umeng.uapp"
INTERVAL = 2.4
MAX_BYTES = 8 * 1024 * 1024
ID_PATTERN = re.compile(r"[A-Za-z0-9_+.-]{1,128}")
KEY_PATTERN = re.compile(r"[A-Za-z0-9_-]{1,128}")
TRANSIENT_HTTP = {408, 429, 500, 502, 503, 504}
TRANSIENT_NETWORK = {errno.ECONNRESET, errno.ECONNREFUSED, errno.ETIMEDOUT, socket.EAI_AGAIN}
RATE_LIMIT_CODES = {"gw.apiflowlimit", "gw.flowlimit", "gw.userflowlimit"}


class OpenAPIError(RuntimeError):
    """A failure safe to report without including credentials or upstream responses."""


class TemporaryAPIError(OpenAPIError):
    def __init__(self, reason, retry_after=0):
        super().__init__(reason)
        self.retry_after = retry_after


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def signature(path, params, api_security):
    message = path + "".join(key + str(params[key]) for key in sorted(params))
    return hmac.new(api_security.encode(), message.encode(), hashlib.sha1).hexdigest().upper()


def retry_seconds(value):
    if not value:
        return 0
    if value.isascii() and value.isdigit():
        return int(value)
    try:
        instant = parsedate_to_datetime(value)
        if instant.tzinfo is None:
            return 0
        return max(0, (instant - datetime.now(timezone.utc)).total_seconds())
    except (TypeError, ValueError, OverflowError):
        return 0


def response_json(response):
    raw = response.read(MAX_BYTES + 1)
    if len(raw) > MAX_BYTES:
        raise OpenAPIError("response exceeds the permitted size")
    try:
        payload = json.loads(raw)
    except ValueError:
        raise OpenAPIError("response is not valid JSON") from None
    if not isinstance(payload, dict):
        raise OpenAPIError("response is not an object")
    return payload


class OpenAPI:
    def __init__(self, appkey, api_key, api_security):
        if not KEY_PATTERN.fullmatch(appkey) or not KEY_PATTERN.fullmatch(api_key) or not api_security:
            raise OpenAPIError("invalid OpenAPI credentials or AppKey format")
        self.appkey = appkey
        self.api_key = api_key
        self.api_security = api_security
        self.opener = build_opener(NoRedirect())
        self.next_request = 0

    def _request(self, operation, params):
        path = f"{ROUTE}/umeng.uapp.event.{operation}/{self.api_key}"
        signed = {**params, "_aop_signature": signature(path, params, self.api_security)}
        url = f"{HOST}/openapi/{path}?{urlencode(signed, quote_via=quote)}"
        request = Request(url, headers={"Accept": "application/json", "User-Agent": "fitforall-uapp-refresh/1"})
        try:
            with self.opener.open(request, timeout=35) as response:
                payload = response_json(response)
        except HTTPError as error:
            with error:
                retry_after = retry_seconds(error.headers.get("Retry-After")) if error.headers else 0
                if error.code in TRANSIENT_HTTP:
                    raise TemporaryAPIError(f"gateway HTTP {error.code}", retry_after) from None
                if error.code == 403:
                    try:
                        payload = response_json(error)
                    except OpenAPIError:
                        payload = {}
                    if str(payload.get("error_code", "")).lower() in RATE_LIMIT_CODES:
                        raise TemporaryAPIError("gateway rate limit", retry_after) from None
                raise OpenAPIError(f"gateway HTTP {error.code}") from None
        except URLError as error:
            reason = error.reason
            if isinstance(reason, TimeoutError) or isinstance(reason, OSError) and reason.errno in TRANSIENT_NETWORK:
                raise TemporaryAPIError("temporary network failure") from None
            raise OpenAPIError("connection or TLS verification failed") from None
        except (TimeoutError, IncompleteRead, RemoteDisconnected, ConnectionResetError):
            raise TemporaryAPIError("temporary network failure") from None

        if "error_code" in payload:
            if str(payload["error_code"]).lower() in RATE_LIMIT_CODES:
                raise TemporaryAPIError("gateway rate limit")
            raise OpenAPIError("gateway rejected the OpenAPI request")
        return payload

    def query(self, operation, start, end, **filters):
        params = {"appkey": self.appkey, "startDate": start.isoformat(), "endDate": end.isoformat(), **filters}
        for attempt in range(3):
            time.sleep(max(0, self.next_request - time.monotonic()))
            self.next_request = time.monotonic() + INTERVAL
            try:
                return self._request(operation, params)
            except TemporaryAPIError as error:
                if attempt == 2 or error.retry_after > 60:
                    raise OpenAPIError(f"{operation}: {error}") from None
                time.sleep(max(3 * 2**attempt, error.retry_after))
            except OpenAPIError as error:
                raise OpenAPIError(f"{operation}: {error}") from None


def count(value):
    if type(value) is int and value >= 0:
        return value
    if isinstance(value, str) and re.fullmatch(r"[0-9]{1,20}", value):
        return int(value)
    raise OpenAPIError("missing or invalid aggregate count")


def rows(payload, field):
    items = payload.get(field)
    if not isinstance(items, list) or any(not isinstance(item, dict) for item in items):
        raise OpenAPIError(f"invalid {field} response")
    return items


def sequence(value):
    if isinstance(value, list):
        return value
    if isinstance(value, str):
        return [item.strip() for item in value.split(",")] if value else []
    raise OpenAPIError("invalid daily sequence")


def daily(payload, field, days):
    expected = set(days)
    samples = {}
    for row in rows(payload, field):
        dates = sequence(row.get("dates"))
        values = sequence(row.get("data"))
        if len(dates) != len(values):
            raise OpenAPIError(f"{field} has mismatched date and count lengths")
        for day, value in zip(dates, values):
            if not isinstance(day, str) or day not in expected or day in samples:
                raise OpenAPIError(f"{field} returned a duplicate or unexpected date")
            samples[day] = count(value)
    if set(samples) != expected:
        raise OpenAPIError(f"{field} did not contain a valid count for every requested date")
    return [samples[day] for day in days]


def catalog(query, approved_events):
    events, codes, ids = [], set(), set()
    page = 1
    total_pages = None
    excluded_count = 0
    while total_pages is None or page <= total_pages:
        payload = query("list", page=page, perPage=100)
        returned_pages = count(payload.get("totalPage"))
        items = rows(payload, "eventInfo")
        if total_pages is None:
            total_pages = returned_pages
        if (total_pages != returned_pages or count(payload.get("page")) != page
                or not items or page > total_pages or len(items) > 100):
            raise OpenAPIError("catalog returned an empty, inconsistent or invalid page")
        for item in items:
            code, raw_id = item.get("name"), item.get("id")
            event_id = str(raw_id) if type(raw_id) in (str, int) else ""
            if (not isinstance(code, str) or not code or not ID_PATTERN.fullmatch(event_id)
                    or code in codes or event_id in ids):
                raise OpenAPIError("catalog returned a missing or repeated event ID or code")
            codes.add(code)
            ids.add(event_id)
            if approved_events is not None and code not in approved_events:
                excluded_count += 1
                continue
            label = approved_events[code] if approved_events is not None else (item.get("displayName") or code)
            if not ID_PATTERN.fullmatch(code) or not isinstance(label, str) or len(label) > 200 or not label.isprintable():
                raise OpenAPIError("catalog returned an invalid approved event name")
            events.append((event_id, code, label))
        page += 1
    return events, excluded_count


def attributes(payload):
    names = set()
    for row in rows(payload, "paramInfos"):
        name = row.get("name")
        if not isinstance(name, str) or not name or name in names:
            raise OpenAPIError("attribute catalog returned a missing or repeated name")
        names.add(name)
    return names


def value_counts(payload, allowed_labels):
    values = Counter()
    raw_names = set()
    for row in rows(payload, "paramInfos"):
        raw = row.get("name")
        if not isinstance(raw, str) or raw in raw_names:
            raise OpenAPIError("attribute distribution returned a missing or repeated value label")
        raw_names.add(raw)
        label = unquote(raw) if allowed_labels else None
        values[label if label in allowed_labels else "其他"] += count(row.get("count"))
    return values


def fetch_dashboard(output_dir: Path, start: date, end: date, *, approved_events=None):
    """Write only validated, publication-approved aggregates to the intermediate directory."""
    if start > end:
        raise OpenAPIError("start date is after end date")
    credentials = [os.environ.get(name, "").strip() for name in ("UMENG_APPKEY", "UMENG_API_KEY", "UMENG_API_SECURITY")]
    if not all(credentials):
        raise OpenAPIError("required environment variables: UMENG_APPKEY, UMENG_API_KEY, UMENG_API_SECURITY")
    client = OpenAPI(*credentials)

    def query(operation, **filters):
        return client.query(operation, start, end, **filters)

    days = [(start + timedelta(days=offset)).isoformat() for offset in range((end - start).days + 1)]
    events, excluded_count = catalog(query, approved_events)
    approved_by_event = {code: (attr, labels) for (code, attr), (_, labels) in DISTRIBUTION_ALLOWLIST.items()}
    if approved_by_event.keys() - {code for _, code, _ in events}:
        raise OpenAPIError("catalog did not return every event used in the dashboard distributions")

    ranking_rows, daily_rows, coverage_rows, distribution_rows = [], [], [], []
    attr_count = 0
    for event_id, code, label in events:
        hits = daily(query("getData", eventName=code), "eventData", days)
        devices = daily(query("getUniqueUsers", eventName=code), "uniqueUsers", days)
        if any(uv > triggers for triggers, uv in zip(hits, devices)):
            raise OpenAPIError(f"independent device count exceeds trigger count: {code}")
        total = sum(hits)
        ranking_rows.append((code, label, "complete", total))
        daily_rows.extend((code, day, triggers, uv) for day, triggers, uv in zip(days, hits, devices))

        reported_attrs = attributes(query("param.list", eventId=event_id))
        attr_count += len(reported_attrs)
        if "school_id" in reported_attrs and total:
            school_values = value_counts(query("param.getValueList", eventName=code, eventParamName="school_id"), ())
            if school_values:
                covered = school_values["其他"]
                if covered > total:
                    raise OpenAPIError(f"school attribute count exceeds event trigger count: {code}")
                coverage_rows.append((code, "school_id", total, covered, total - covered))

        if code in approved_by_event:
            attr, labels = approved_by_event[code]
            if attr not in reported_attrs:
                raise OpenAPIError(f"missing approved distribution attribute: {code}")
            values = value_counts(query("param.getValueList", eventName=code, eventParamName=attr), labels)
            if sum(values.values()) != total:
                raise OpenAPIError(f"approved distribution does not reconcile with trigger counts: {code}")
            distribution_rows.extend((code, attr, name, number) for name, number in values.items())

    status = {
        "status": "finished", "startDate": start.isoformat(), "endDate": end.isoformat(),
        "event_count": len(events), "excluded_event_count": excluded_count,
        "attribute_count": attr_count, "event_filters": [], "failures": [],
    }
    output_dir.mkdir(mode=0o700, parents=True, exist_ok=True)
    with TemporaryDirectory(dir=output_dir) as staging_dir:
        staging = Path(staging_dir)
        csv_files = (
            ("event_ranking.csv", ("event_name", "event_display_name", "trigger_day_coverage", "period_trigger_count"),
             sorted(ranking_rows, key=lambda row: (-row[3], row[0]))),
            ("event_daily.csv", ("event_name", "date", "trigger_count", "unique_devices"), daily_rows),
            ("attribute_coverage.csv", ("event_name", "attribute_name", "event_period_trigger_count",
              "sum_of_returned_value_counts", "event_minus_returned_value_counts"), coverage_rows),
            ("attribute_values.csv", ("event_name", "attribute_name", "value", "trigger_count"), distribution_rows),
        )
        for filename, columns, values in csv_files:
            with (staging / filename).open("w", encoding="utf-8-sig", newline="") as handle:
                writer = csv.writer(handle)
                writer.writerow(columns)
                writer.writerows(values)
        status_filename = "export_status.json"
        (staging / status_filename).write_text(json.dumps(status) + "\n", encoding="utf-8")
        for filename, _, _ in csv_files:
            (staging / filename).replace(output_dir / filename)
        (staging / status_filename).replace(output_dir / status_filename)
