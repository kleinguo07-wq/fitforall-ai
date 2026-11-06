#!/usr/bin/env python3
"""Create the allowlisted public v1.0 snapshot without copying source materials."""

import argparse
import hashlib
from html.parser import HTMLParser
import json
from pathlib import Path
import re
import sys


ROOT = Path(__file__).resolve().parents[1]
DESTINATION = ROOT / "projects" / "landscape" / "v1.0"
VERSION_DATE = "2026-11-04"
DATA_KEYS = {"source", "itemId", "refs", "priority", "difficulty", "risks"}


def replace_once(text, old, new):
    if text.count(old) != 1:
        raise ValueError(f"Expected one source marker: {old[:70]}")
    return text.replace(old, new, 1)


def strip_metadata(value):
    if isinstance(value, dict):
        return {k: strip_metadata(v) for k, v in value.items() if k not in DATA_KEYS}
    if isinstance(value, list):
        return [strip_metadata(v) for v in value]
    return value


def sanitize_json_constant(text, name):
    marker = f"const {name}="
    if text.count(marker) != 1:
        raise ValueError(f"Missing or duplicate data constant: {name}")
    start = text.index(marker) + len(marker)
    value, size = json.JSONDecoder().raw_decode(text[start:])
    if text[start + size:start + size + 1] != ";":
        raise ValueError(f"Unexpected data constant format: {name}")
    return text[:start] + json.dumps(strip_metadata(value), ensure_ascii=False,
                                   separators=(",", ":")) + text[start + size:]


class DependencyAudit(HTMLParser):
    def __init__(self):
        super().__init__()
        self.links = []

    def handle_starttag(self, tag, attrs):
        for key, value in attrs:
            if key in {"href", "src", "srcset", "poster", "action", "data-src"}:
                if key == "href" and tag == "a" and (
                    value in {"../", "../../../"}
                    or re.fullmatch(r"#[A-Za-z][A-Za-z0-9_-]*", value or "")
                ):
                    self.links.append(value)
                    continue
                raise ValueError(f"Unapproved or missing dependency: {tag}.{key}")
        if tag in {"base", "iframe", "object", "embed"}:
            raise ValueError(f"Unexpected embedded dependency element: {tag}")


def audit(text):
    parser = DependencyAudit()
    parser.feed(text)
    if parser.links.count("../") != 1 or parser.links.count("../../../") != 1:
        raise ValueError("The two project navigation links are required")
    blocked = [
        r"/(?:Users|private|tmp|var|home)/",
        r"file://",
        r"[A-Za-z]:\\(?:Users|Documents)\\",
        r"https?://",
        r"@import\b",
        r"url\s*\(",
        r"\b(?:fetch|XMLHttpRequest|WebSocket|EventSource|sendBeacon|getUserMedia)\s*\(",
        r"\bimport\s*\(",
        r"\bimport\s+.+?\bfrom\s*['\"]",
        r"gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|sk-[A-Za-z0-9]{30,}",
        r"[\"']?(?:source|itemId|refs|priority|difficulty|risks)[\"']?\s*:",
        r"\.(?:source|itemId|refs|priority|difficulty|risks)\b",
        r"AI\s*跟练!|体能训练!|原始会议|只读源码指纹",
    ]
    for pattern in blocked:
        if re.search(pattern, text, re.I):
            raise ValueError(f"Publication audit rejected pattern: {pattern}")
    for marker in ["const HOME_ROTATION_MS=20000", "remaining<=5000",
                   "function movementThumbnail", "const views=", "function switchModule",
                   "function prototypeHelpItems", "function togglePrototypeHelp", 'data-ranking-metric="calories"',
                   "AI跟练和体能训练的运动过程沿用原产品，本原型展示到详情选择为止。"]:
        if marker not in text:
            raise ValueError(f"Required prototype behavior is missing: {marker}")
    for removed_view in ["prepare", "training", "results", "video", "resourcePrepare"]:
        if re.search(r"\bfunction\s+" + removed_view + r"\s*\(", text):
            raise ValueError(f"Reused process must not have a prototype view: {removed_view}")
    if text.count("<script>") != 1 or text.count("</script>") != 1:
        raise ValueError("Expected exactly one embedded script")


def derive(source_text):
    # Remove only data fields, never IDs or game behavior parameters.
    text = sanitize_json_constant(source_text, "catalogue")
    text = sanitize_json_constant(text, "gameDefinitions")
    # Resources use a mixed JSON/JS literal. Both source styles are scalar metadata.
    text = re.sub(r',"(?:source|itemId)":(?:"(?:\\.|[^"\\])*"|null)', "", text)
    text = re.sub(r",(?:source|itemId):(?:'(?:\\.|[^'\\])*'|null)", "", text)
    text = replace_once(text,
        '<a class="tool" href="index.html#brief">返回简版需求</a>',
        '<a class="tool" href="../">返回横屏项目</a>'
        '<a class="tool" href="../../../">项目总览</a>')
    text = replace_once(text,
        '<a class="tool" href="趣味运动-调研与候选项目-v0.4.html">玩法调研</a>', "")
    text = text.replace("本地评审稿", "公开评审原型")
    resource_start = source_text.index("const resources=[") + len("const resources=[")
    resource_end = source_text.index("\n{id:'warmup-demo'", resource_start)
    fitness = json.loads("[" + source_text[resource_start:resource_end].strip().rstrip(",") + "]")
    fitness_count = len(fitness)
    body_counts = "、".join(body + str(sum(x["body"] == body for x in fitness)) for body in ["全身", "上肢", "核心", "下肢"])
    deferred_count = 70 - fitness_count
    notes = ('<section class="review-notes" id="notes"><h2>整体说明</h2>'
        '<p>本页为公园横屏 v1.0 交互原型，不代表已部署产品。用户账号体系与横屏多人检测复用教学屏体验，共用过程不另行设计；教学屏参照版本、账号接口、横屏实际人数与场地能力需联调及实机验收。AI跟练和体能训练的运动过程沿用原产品，本原型展示到详情选择为止。每次运动逐人通过人脸登录或注册关联数据，结束自动上报，设备不保留登录态。人脸、注册、上报、相机、评分、小程序和媒体均未接入真实服务。</p>'
        f'<ul><li>体能以教学屏61项名称为基础，原表9项有ID补充记录单列；一期{fitness_count}项选型候选，{body_counts}，其余{deferred_count}项转后续，不新增或改编。JSON仅有名称，分类、朝向、强度、素材及判定需核对原示范。</li><li>公园环境、开放安排、排行榜昵称、时长与估算消耗均为模拟；小程序码不可扫码。</li>'
        '<li>点击“原型说明”可查看当前页面逐功能编号、用途、操作及规则；说明随页面和弹窗切换，阅读时暂停演示计时与首页轮换，关闭后继续。</li>'
        '<li>AI跟练和体能训练的站位、运动中、暂停、结果和领取按原产品执行，需求保留文字说明，原型不另作设计；详情开始按钮仅表示入口位置。</li>'
        '<li>趣味运动保留站位、互动、暂停、退出确认及结果演示；结束按用户自动上报，结果页直接展示通用微信小程序查询码，登录后查看自己的记录，无需主动清除信息，运动视频保留观看流程。</li>'
        '<li>导航默认右侧，可在本站服务的系统设置切换左右；进入大模块列表自动收起，首页默认展开。公告名称和显示开关可由后台配置，首页底部左侧仅一条只读公告，超长内容滚动，不提供公告列表或详情页；弱提示右置；榜单与查询采用图标加文字。</li><li>首页推荐每20秒更新；交互时暂停，更新前5秒显示提示。课程支持分类与分页，不提供搜索输入；体能按训练部位分类并分页。</li>'
        '<li>一期趣味运动聚焦单人切水果，其余候选后续迭代；热身移至下一期，本期隐藏入口；复用成熟内容完成0到1，社会体育统一账号跨横屏、竖屏及小程序通用，真实账号接口仍待联调。模拟输入不代表真实识别，水果连切和果心加分仍待真实判定。</li>'
        '<li>完整排行榜可切换本站今日运动时长榜与卡路里消耗榜，默认时长；两榜独立排序，同值并列。估算消耗以整千卡展示，正式算法与单位仍待核验；暂停、离区与纯观看不累计。</li></ul></section>')
    text, n = re.subn(r'<section class="review-notes" id="notes">.*?</section>',
                      lambda _: notes, text, count=1, flags=re.S)
    if n != 1:
        raise ValueError("Missing public explanation panel")
    audit(text)
    return text


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", required=True, type=Path,
                        help="Current local landscape HTML; never copied as source material")
    args = parser.parse_args()
    try:
        source_bytes = args.source.read_bytes()
        public_html = derive(source_bytes.decode("utf-8"))
        version = {
            "title": "横屏v1.0交互原型", "version": "v1.0", "date": VERSION_DATE,
            "status": "交互原型", "entry": "index.html#home",
            "updated": "2026-11-06",
            "admin_entry": "admin.html#videos",
            "admin_requirements": "admin-requirements.md",
            "tracking_entry": "tracking.html",
            "tracking_requirements": "tracking.md",
            "reuse_reference": "教学屏",
            "reuse_scope": ["用户账号体系", "横屏多人检测体验"],
            "implementation_status": "横屏接入与实机能力待联调验收",
            "fitness_content_count": len(re.findall(r'"category"\s*:\s*"fitness"', public_html)),
            "source_sha256": hashlib.sha256(source_bytes).hexdigest(),
        }
        DESTINATION.mkdir(parents=True, exist_ok=True)
        (DESTINATION / "index.html").write_text(public_html, encoding="utf-8")
        (DESTINATION / "version.json").write_text(
            json.dumps(version, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        print(json.dumps({"destination": "projects/landscape/v1.0/", **version,
            "public_sha256": hashlib.sha256(public_html.encode("utf-8")).hexdigest()},
            ensure_ascii=False))
    except (OSError, UnicodeError, ValueError) as exc:
        print(f"Landscape publication stopped: {exc}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
