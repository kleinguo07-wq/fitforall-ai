"""Convert the reviewed, allowlisted aggregate snapshot to Data dashboard bindings."""
import json
import sys
from pathlib import Path

data = json.loads(Path(sys.argv[1]).read_text())
target = Path(sys.argv[2])
app_id = json.loads(target.read_text())["id"]
meta = data["meta"]
dates = data["dates"]
docs = "https://github.com/umeng/umeng-cli/blob/main/skills/umeng-cli/reference/openapi/uapp.md"
period = f"{meta['startDate']} 至 {meta['endDate']}，北京时间，自然日"
operations = {
    "event_days": (
        "友盟 U-App OpenAPI · 每日事件统计",
        "逐页获取事件清单，再以事件名称和该日期范围请求 event.getData、event.getUniqueUsers。",
        "事件清单与两类日序列按事件代码及日期关联。总触发次数取完整日序列的和，独立设备数保留事件×日粒度。",
        [
            {
                "label": "触发次数",
                "definition": meta["definitions"]["triggers"],
                "componentIds": ["um-trigger-count", "um-active-events", "um-active-days", "um-peak", "um-activity-trend", "um-event-rank"],
            },
            {
                "label": "独立触发设备数",
                "definition": meta["definitions"]["devices"],
                "componentIds": ["um-activity-trend"],
            },
        ],
    ),
    "attribute_values": (
        "友盟 U-App OpenAPI · 区间参数分布",
        "在同一日期范围请求 event.param.list、event.param.getValueList，读取人群入口、体能训练部位筛选。",
        "按指定事件、属性和值保留友盟区间计数。占比为该值次数除以所示属性全部取值的次数。",
        [
            {"label": "属性分布占比", "definition": "该取值的触发次数 / 同一属性发布的全部取值次数。", "componentIds": ["um-attribute-breakdown"]},
        ],
    ),
    "school_coverage": (
        "友盟 U-App OpenAPI · 学校属性对账",
        "在同一日期范围读取 event.getData 和 event.param.getValueList 的学校属性统计。",
        "按事件汇总有学校属性的取值计数，只保留事件总量、带学校属性次数和差额。差额为事件总次数减带学校属性次数。",
        [
            {"label": "学校属性差额", "definition": "事件区间总次数减去该事件学校属性各取值的计数之和。", "componentIds": ["um-school-coverage"]},
        ],
    ),
}

def query(query_id, rows):
    label, detail, method, definitions = operations[query_id]
    return {
        "rows": rows,
        "source": {
            "label": label,
            "filters": [period],
            "links": [{"label": "友盟接口文档", "url": docs}],
            "metricDefinitions": definitions,
            "evidenceFlow": [{"title": "友盟 U-App OpenAPI 查询", "detail": detail}],
        },
        "methods": [{"language": "text", "code": method}],
    }

days = [
    {
        "日期": day,
        "事件代码": event["code"],
        "事件": event["label"],
        "功能模块": event["category"],
        "触发次数": count,
        "独立触发设备数": devices,
    }
    for event in data["events"]
    for day, count, devices in zip(dates, event["counts"], event["devices"])
]
attributes = [
    {
        "事件代码": distribution["eventCode"],
        "事件": distribution["eventLabel"],
        "属性": distribution["attributeLabel"],
        "取值": item["label"],
        "触发次数": item["count"],
    }
    for distribution in data["distributions"]
    for item in distribution["items"]
]
schools = [
    {
        "事件代码": row["eventCode"],
        "事件": row["eventLabel"],
        "触发次数": row["total"],
        "带学校属性次数": row["covered"],
        "差额": row["gap"],
    }
    for row in data["schoolCoverage"]
]
assert len(days) == meta["eventCount"] * len(dates)
assert sum(row["触发次数"] for row in days) == meta["totalTriggers"]
assert all(row["触发次数"] - row["带学校属性次数"] == row["差额"] for row in schools)
target.write_text(
    json.dumps(
        {
            "surface": "dashboard",
            "id": app_id,
            "title": meta["title"],
            "buildStatus": "complete" if "--complete" in sys.argv[3:] else "creating",
            "status": "reviewed",
            "filters": [],
            "snapshotPeriod": {
                "start": meta["startDate"],
                "end": meta["endDate"],
                "asOf": meta["snapshotDate"],
            },
            "queries": {
                "event_days": query("event_days", days),
                "attribute_values": query("attribute_values", attributes),
                "school_coverage": query("school_coverage", schools),
            },
        },
        ensure_ascii=False,
        separators=(",", ":"),
    ) + "\n",
    encoding="utf-8",
)
