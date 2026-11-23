#!/usr/bin/env python3
"""Build the shareable aggregate snapshot from validated Umeng exports."""
import argparse
import csv
import json
from collections import Counter
from datetime import date, timedelta
from pathlib import Path


DISPLAY_LABELS = {
    "PV_catgratepage": "人群页浏览",
    "click_finished_data_user_identity": "结算页身份上报",
    "click_game_item": "趣味游戏卡片点击",
    "PV_game_list": "趣味游戏列表浏览",
    "click_game_details_start": "趣味游戏开始流程",
    "click_face_flow_result": "人脸身份流程结果上报",
    "PV_face_flow": "进入身份识别流程",
    "click_game_finished_data": "趣味游戏结算页操作",
    "click_training_finished_data": "体能训练结算页操作",
    "click_coach_finished_data": "AI 跟练结算页操作",
    "click_ball_finished_data": "球类训练结算页操作",
}

DISTRIBUTION_ALLOWLIST = {
    ("PV_catgratepage", "category_name"): ("人群入口", {"跃动少年", "热力健将", "康乐银发"}),
    ("click_training_body_filter", "body_part"): ("体能训练部位筛选", {"全身", "下肢", "腰腹", "上肢", "全部"}),
}


def rows(path):
    with path.open(encoding="utf-8-sig", newline="") as source:
        yield from csv.DictReader(source)


def event_category(code):
    if code in {"PV_homepage", "PV_catgratepage", "click_homepage_function"}:
        return "首页与人群"
    if code in {"PV_face_flow", "click_face_flow_result", "click_finished_data_user_identity"}:
        return "身份流程"
    if "multiplayer" in code:
        return "多人互动"
    categories = {
        "game": "趣味游戏",
        "coach": "AI 跟练",
        "training": "体能训练",
        "ball": "球类训练",
        "quiz": "知识问答",
        "watch": "边看边学",
        "class": "活力课堂",
        "competition": "赛事活动",
        "ranking": "排行榜",
    }
    return categories.get(code.partition("_")[2].partition("_")[0], "其他")


def load_events(directory, dates):
    events = {}
    for row in rows(directory / "event_ranking.csv"):
        code = row["event_name"]
        if code in events or row["trigger_day_coverage"] != "complete":
            raise ValueError(f"Incomplete or repeated event: {code}")
        events[code] = {
            "code": code,
            "label": DISPLAY_LABELS.get(code, row["event_display_name"].removeprefix("PV_").removeprefix("click_")),
            "category": event_category(code),
            "total": int(row["period_trigger_count"]),
        }
    index = {}
    for row in rows(directory / "event_daily.csv"):
        key = (row["event_name"], row["date"])
        series_values = (int(row["trigger_count"]), int(row["unique_devices"]))
        if key in index or not 0 <= series_values[1] <= series_values[0]:
            raise ValueError(f"Invalid daily counts: {key}")
        index[key] = series_values
    expected = {(code, day) for code in events for day in dates}
    if set(index) != expected:
        raise ValueError("Export does not contain exactly one record for every event and date")
    for code, event in events.items():
        daily = [index[(code, day)] for day in dates]
        event["counts"] = [trigger for trigger, _ in daily]
        event["devices"] = [devices for _, devices in daily]
        if sum(event["counts"]) != event["total"]:
            raise ValueError(f"Daily trigger sum disagrees with export total: {code}")
    return events


def load_distributions(directory, events):
    counts = {key: Counter() for key in DISTRIBUTION_ALLOWLIST}
    for row in rows(directory / "attribute_values.csv"):
        key = (row["event_name"], row["attribute_name"])
        if key not in DISTRIBUTION_ALLOWLIST:
            continue
        _, allowlist = DISTRIBUTION_ALLOWLIST[key]
        label = row["value"] if row["value"] in allowlist else "其他"
        counts[key][label] += int(row["trigger_count"])
    distributions = []
    for (code, attr), values in counts.items():
        if sum(values.values()) != events[code]["total"]:
            raise ValueError(f"Selected distribution is not reconciled: {code}, {attr}")
        distributions.append({
            "eventCode": code,
            "eventLabel": events[code]["label"],
            "attributeLabel": DISTRIBUTION_ALLOWLIST[(code, attr)][0],
            "attributeCode": attr,
            "items": [{"label": label, "count": count} for label, count in values.most_common()],
        })
    return distributions


def load_coverage(directory, events):
    coverage = []
    attr_count = 0
    for row in rows(directory / "attribute_coverage.csv"):
        attr_count += 1
        if row["attribute_name"] != "school_id" or row["sum_of_returned_value_counts"] == "":
            continue
        code = row["event_name"]
        total = events[code]["total"]
        if not total:
            continue
        covered = int(row["sum_of_returned_value_counts"])
        gap = int(row["event_minus_returned_value_counts"])
        if total != int(row["event_period_trigger_count"]) or gap != total - covered:
            raise ValueError(f"Invalid school attribute coverage: {code}")
        coverage.append({"eventCode": code, "eventLabel": events[code]["label"], "total": total, "covered": covered, "gap": gap})
    return sorted(coverage, key=lambda row: (-row["gap"], -row["total"], row["eventCode"])), attr_count


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", type=Path)
    parser.add_argument("output", type=Path)
    parser.add_argument("--snapshot-date", required=True, type=date.fromisoformat)
    args = parser.parse_args()
    status = json.loads((args.source / "export_status.json").read_text())
    if status["status"] != "finished" or status["failures"] or status["event_filters"]:
        raise ValueError("Use a finished, unfiltered export with zero failed requests")
    start, end = map(date.fromisoformat, (status["startDate"], status["endDate"]))
    dates = [(start + timedelta(days=offset)).isoformat() for offset in range((end - start).days + 1)]
    if not dates or args.snapshot_date < end:
        raise ValueError("Invalid coverage or snapshot date")
    events = load_events(args.source, dates)
    if len(events) != status["event_count"]:
        raise ValueError("Export event count mismatch")
    coverage, returned_attribute_count = load_coverage(args.source, events)
    attribute_count = status.get("attribute_count", returned_attribute_count)
    if type(attribute_count) is not int or attribute_count < returned_attribute_count:
        raise ValueError("Attribute metadata count disagrees with the queried attributes")
    daily_total = [sum(event["counts"][offset] for event in events.values()) for offset in range(len(dates))]
    data = {
        "meta": {
            "title": "社体屏埋点分析",
            "source": "友盟 U-App OpenAPI",
            "startDate": start.isoformat(),
            "endDate": end.isoformat(),
            "snapshotDate": args.snapshot_date.isoformat(),
            "timezone": "Asia/Shanghai",
            "eventCount": len(events),
            "activeEventCount": sum(event["total"] > 0 for event in events.values()),
            "totalTriggers": sum(daily_total),
            "attributeCount": attribute_count,
            "activeDays": sum(count > 0 for count in daily_total),
            "definitions": {
                "triggers": "友盟按事件、自然日记录的上报次数，同一设备可多次上报。",
                "devices": "单事件单日的独立触发设备数。跨天、跨事件均需重新去重。",
                "attributes": "本快照仅发布选定属性的区间汇总，随完整区间显示。",
                "schoolCoverage": "根据学校属性计数与同事件全区间触发总数核对。",
            },
        },
        "dates": dates,
        "events": list(events.values()),
        "distributions": load_distributions(args.source, events),
        "schoolCoverage": coverage,
    }
    args.output.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    print(json.dumps({key: value for key, value in data["meta"].items() if key != "definitions"}, ensure_ascii=False))


if __name__ == "__main__":
    main()
