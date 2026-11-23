#!/usr/bin/env python3
"""Refresh the published FitForAll dashboard without changing its compiled renderer."""

import argparse
from collections import Counter
from datetime import date, datetime, timedelta
from hashlib import sha256
import json
import os
from pathlib import Path
import re
import subprocess
import sys
from tempfile import NamedTemporaryFile, TemporaryDirectory
from zoneinfo import ZoneInfo

from build_dashboard_data import DISTRIBUTION_ALLOWLIST, event_category


SCRIPTS = Path(__file__).resolve().parent
ANALYTICS = Path("projects/fitness/analytics")
SIDE_CAR = re.compile(r"snapshot\.([a-f0-9]{64})\.json")
EVENT_CODE = re.compile(r"[A-Za-z][A-Za-z0-9_]{0,127}")
PRIVATE_FIELD = re.compile(r"\b[0-9a-f]{24}\b|\b(?:app_?key|device_id|school_id|access_token|api_security)\b", re.I)
SECRETS = {"UMENG_API_KEY", "UMENG_API_SECURITY", "UMENG_APPKEY"}
QUERY_FIELDS = {
    "event_days": {"日期", "事件代码", "事件", "功能模块", "触发次数", "独立触发设备数"},
    "attribute_values": {"事件代码", "事件", "属性", "取值", "触发次数"},
    "school_coverage": {"事件代码", "事件", "触发次数", "带学校属性次数", "差额"},
}


class RefreshError(Exception):
    """A local validation failure that can be reported without displaying the input."""


def digest(blob):
    return sha256(blob).hexdigest()


def encode_json(value):
    return (json.dumps(value, ensure_ascii=False, separators=(",", ":")) + "\n").encode("utf-8")


def period(as_of):
    end = as_of - timedelta(days=1)
    return end - timedelta(days=29), end


def parse_date(value):
    result = date.fromisoformat(value)
    if value != result.isoformat():
        raise ValueError("Expected YYYY-MM-DD")
    return result


def calendar_days(start, end):
    return {(start + timedelta(days=i)).isoformat() for i in range((end - start).days + 1)}


def load_approved_events():
    approved = json.loads((SCRIPTS / "approved_events.json").read_text(encoding="utf-8"))
    if not isinstance(approved, dict) or not approved or not all(
        EVENT_CODE.fullmatch(code) and isinstance(label, str) and label.strip() and not PRIVATE_FIELD.search(label)
        for code, label in approved.items()
    ):
        raise RefreshError("Invalid public event allowlist")
    return approved


def inspect_shell(html):
    head, marker, _ = html.partition(b"</head>")
    if not marker or b"<head>" not in head:
        raise RefreshError("Unsupported dashboard HTML head")
    tags = {}
    for name, pattern in (
        ("data-app-build-layout", rb"separate-data-v1"),
        ("data-app-bootstrap", rb"deferred-content-v1"),
        ("data-app-runtime-sha256", rb"[a-f0-9]{64}"),
        ("data-app-snapshot-sha256", rb"[a-f0-9]{64}"),
        ("data-app-local-snapshot", rb"snapshot\.[a-f0-9]{64}\.json"),
    ):
        tag_name = name.encode()
        key = rb'name="' + tag_name + rb'"'
        matches = list(re.finditer(rb'<meta ' + key + rb' content="(' + pattern + rb')">', head))
        if len(matches) != 1 or head.count(key) != 1:
            raise RefreshError("Unsupported dashboard snapshot metadata")
        tags[name] = matches[0]
    if b'name="data-app-snapshot-storage"' in head:
        raise RefreshError("Expected GitHub Pages local snapshot delivery")
    checksum = tags["data-app-snapshot-sha256"].group(1).decode()
    source = tags["data-app-local-snapshot"].group(1).decode()
    if source != f"snapshot.{checksum}.json":
        raise RefreshError("Dashboard HTML names a different snapshot SHA-256")
    markers = re.findall(rb'<script type="application/json" id="data-app-reviewed-snapshot">([^<]+)</script>', html)
    if len(markers) != 1:
        raise RefreshError("Dashboard snapshot bootstrap is absent or duplicated")
    identity = json.loads(markers[0])
    if set(identity) != {"id", "title", "surface", "queries"} or identity["queries"] != {} or identity["surface"] != "dashboard":
        raise RefreshError("Unsupported dashboard bootstrap identity")
    return source, checksum, identity, tags


def validate_snapshot(blob, identity, approved, expected=None):
    snapshot = json.loads(blob)
    fields = {"surface", "id", "title", "buildStatus", "status", "filters", "snapshotPeriod", "queries"}
    if set(snapshot) != fields or any(snapshot[key] != identity[key] for key in ("id", "title", "surface")):
        raise RefreshError("Snapshot identity or public fields changed")
    if snapshot["buildStatus"] != "complete" or snapshot["status"] != "reviewed" or snapshot["filters"] != []:
        raise RefreshError("The snapshot is not complete and reviewed")
    stamp = snapshot["snapshotPeriod"]
    if set(stamp) != {"start", "end", "asOf"}:
        raise RefreshError("Unexpected snapshot period fields")
    start, end, as_of = (parse_date(stamp[field]) for field in ("start", "end", "asOf"))
    if not start <= end < as_of or (expected is not None and (start, end, as_of) != expected):
        raise RefreshError("Snapshot dates disagree with the refresh window")
    if set(snapshot["queries"]) != set(QUERY_FIELDS):
        raise RefreshError("Unexpected public query in dashboard snapshot")

    day_keys = set()
    totals = Counter()
    expected_days = calendar_days(start, end)
    distributions = {
        (code, label): values | {"其他"}
        for (code, _), (label, values) in DISTRIBUTION_ALLOWLIST.items()
    }
    breakdown = Counter()
    seen_attributes, seen_schools = set(), set()
    for query_id, row_fields in QUERY_FIELDS.items():
        query = snapshot["queries"][query_id]
        if set(query) != {"rows", "source", "methods"} or not isinstance(query["rows"], list):
            raise RefreshError("Unexpected public query shape")
        for row in query["rows"]:
            if set(row) != row_fields:
                raise RefreshError("Unexpected public row fields")
            code = row["事件代码"]
            if code not in approved or row["事件"] != approved[code]:
                raise RefreshError("The dashboard contains an unapproved event code or label")
            count = row["触发次数"]
            if type(count) is not int or count < 0:
                raise RefreshError("Missing or invalid trigger count")
            if query_id == "event_days":
                key = code, row["日期"]
                devices = row["独立触发设备数"]
                if (key in day_keys or key[1] not in expected_days or row["功能模块"] != event_category(code)
                    or type(devices) is not int or not 0 <= devices <= count):
                    raise RefreshError("Duplicate or incomplete event × day observations")
                day_keys.add(key)
                totals[code] += count
            elif query_id == "attribute_values":
                key = code, row["属性"]
                item = *key, row["取值"]
                if key not in distributions or item[2] not in distributions[key] or item in seen_attributes:
                    raise RefreshError("Unapproved or duplicate attribute breakdown")
                seen_attributes.add(item)
                breakdown[key] += count
            else:
                covered, gap = row["带学校属性次数"], row["差额"]
                if code in seen_schools or totals.get(code) != count or type(covered) is not int or covered < 0 or type(gap) is not int or count - covered != gap:
                    raise RefreshError("Invalid school attribute coverage row")
                seen_schools.add(code)
    if not totals or day_keys != {(code, day) for code in totals for day in expected_days}:
        raise RefreshError("The dashboard has incomplete event × day coverage")
    if any(breakdown[key] != totals.get(key[0]) for key in distributions):
        raise RefreshError("Allowlisted breakdown totals do not reconcile")
    if PRIVATE_FIELD.search(blob.decode("utf-8")):
        raise RefreshError("Private identifier or field marker found in public snapshot")
    return snapshot


def expect_export(export_dir, start, end):
    status = json.loads((export_dir / "export_status.json").read_text(encoding="utf-8"))
    if (status["status"] != "finished" or status["failures"] or status["event_filters"]
        or status.get("events_with_incomplete_daily_counts", 0) != 0
        or (status["startDate"], status["endDate"]) != (start.isoformat(), end.isoformat())):
        raise RefreshError("Umeng export is incomplete or covers a different date range")
    excluded = status.get("excluded_event_count", 0)
    if type(excluded) is not int or excluded < 0:
        raise RefreshError("Invalid excluded-event count")
    return excluded


def run_builder(name, *args):
    env = {key: value for key, value in os.environ.items() if key not in SECRETS}
    result = subprocess.run([sys.executable, str(SCRIPTS / name), *map(str, args)],
                            env=env, capture_output=True, check=False)
    if result.returncode:
        raise RefreshError(f"{name} rejected the staging data")


def build_snapshot(stage, current, approved, as_of):
    aggregate_path = stage / "reviewed.json"
    run_builder("build_dashboard_data.py", stage / "export", aggregate_path, "--snapshot-date", as_of.isoformat())
    aggregate = json.loads(aggregate_path.read_text(encoding="utf-8"))
    for event in aggregate["events"]:
        event["label"] = approved[event["code"]]
    aggregate["events"].sort(key=lambda event: (-event["total"], event["code"]))
    for distribution in aggregate["distributions"]:
        distribution["eventLabel"] = approved[distribution["eventCode"]]
        distribution["items"].sort(key=lambda row: (-row["count"], row["label"]))
    for row in aggregate["schoolCoverage"]:
        row["eventLabel"] = approved[row["eventCode"]]
    aggregate_path.write_bytes(encode_json(aggregate))
    binding = stage / "bound.json"
    binding.write_bytes(current)
    run_builder("make_snapshot.py", aggregate_path, binding, "--complete")
    return binding.read_bytes()


def semantic_snapshot(snapshot):
    # As-of describes the data capture, not a reason on its own to redeploy equal rows.
    stable = {key: val for key, val in snapshot.items() if key != "snapshotPeriod"}
    stable["snapshotPeriod"] = {key: val for key, val in snapshot["snapshotPeriod"].items() if key != "asOf"}
    stable["queries"] = {
        key: {**query, "rows": sorted(query["rows"], key=lambda row: json.dumps(row, sort_keys=True, ensure_ascii=False))}
        for key, query in stable["queries"].items()
    }
    return stable


def replace_meta_values(html, tags, path, checksum):
    replacements = {
        "data-app-local-snapshot": path.encode(),
        "data-app-snapshot-sha256": checksum.encode(),
    }
    for key in sorted(replacements, key=lambda key: tags[key].start(1), reverse=True):
        lower, upper = tags[key].span(1)
        html = html[:lower] + replacements[key] + html[upper:]
    return html


def write_atomic(path, data):
    temporary = None
    try:
        with NamedTemporaryFile(dir=path.parent, prefix=f".{path.name}.", delete=False) as output:
            temporary = Path(output.name)
            output.write(data)
        temporary.chmod(0o644)
        temporary.replace(path)
    finally:
        if temporary is not None:
            temporary.unlink(missing_ok=True)


def retired_sidecars(folder, current_name, current_end, identity, approved):
    for path in sorted(folder.glob("snapshot.*.json")):
        match = SIDE_CAR.fullmatch(path.name)
        if path.name == current_name or not match or path.is_symlink() or not path.is_file():
            continue
        content = path.read_bytes()
        if digest(content) != match.group(1):
            continue
        try:
            old = validate_snapshot(content, identity, approved)
        except (RefreshError, ValueError, TypeError, KeyError):
            continue
        if parse_date(old["snapshotPeriod"]["end"]) < current_end:
            yield path


def refresh(repository, as_of, fetch):
    folder = repository / ANALYTICS
    index = folder / "index.html"
    if index.is_symlink() or not index.is_file() or folder.resolve() != repository / ANALYTICS:
        raise RefreshError("Run the refresh from the FitForAll repository root")
    html = index.read_bytes()
    filename, checksum, identity, tags = inspect_shell(html)
    source = folder / filename
    if source.is_symlink() or not source.is_file():
        raise RefreshError("The active dashboard snapshot is missing")
    current_bytes = source.read_bytes()
    if digest(current_bytes) != checksum:
        raise RefreshError("The active dashboard snapshot failed its SHA-256 check")
    approved = load_approved_events()
    current = validate_snapshot(current_bytes, identity, approved)
    start, end = period(as_of)
    current_end = parse_date(current["snapshotPeriod"]["end"])
    if end < current_end:
        raise RefreshError("The requested refresh would put an older date on the public dashboard")

    with TemporaryDirectory(prefix="fitforall-umeng-") as workspace:
        stage = Path(workspace)
        output = stage / "export"
        output.mkdir()
        fetch(output, start, end, approved_events=approved)
        excluded = expect_export(output, start, end)
        new_bytes = build_snapshot(stage, current_bytes, approved, as_of)
        new = validate_snapshot(new_bytes, identity, approved, expected=(start, end, as_of))

    if excluded:
        print(f"Excluded {excluded} unapproved vendor events from public data")
    if semantic_snapshot(current) == semantic_snapshot(new):
        print(f"Dashboard already current for {start}–{end}")
        return False
    checksum = digest(new_bytes)
    filename = f"snapshot.{checksum}.json"
    new_html = replace_meta_values(html, tags, filename, checksum)
    new_ref, new_hash, new_id, _ = inspect_shell(new_html)
    if (new_ref, new_hash, new_id) != (filename, checksum, identity):
        raise RefreshError("New snapshot binding did not pass validation")
    legacy = list(retired_sidecars(folder, source.name, current_end, identity, approved))
    destination = folder / filename
    if index.read_bytes() != html or source.read_bytes() != current_bytes:
        raise RefreshError("Dashboard files changed during refresh")
    if destination.is_symlink() or (destination.exists() and destination.read_bytes() != new_bytes):
        raise RefreshError("New snapshot path is occupied by different data")
    if not destination.exists():
        write_atomic(destination, new_bytes)
    write_atomic(index, new_html)
    for path in legacy:
        if path != destination:
            path.unlink()
    print(f"Refreshed dashboard for {start}–{end} ({len(new['queries']['event_days']['rows'])} event-day rows)")
    return True


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.parse_args()
    import openapi

    try:
        refresh(Path.cwd().resolve(), datetime.now(ZoneInfo("Asia/Shanghai")).date(), openapi.fetch_dashboard)
    except (RefreshError, openapi.OpenAPIError) as exc:
        print(f"Dashboard refresh stopped: {exc}", file=sys.stderr)
        return 1
    except (OSError, ValueError, TypeError, KeyError):
        print("Dashboard refresh stopped: invalid or unavailable input", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
