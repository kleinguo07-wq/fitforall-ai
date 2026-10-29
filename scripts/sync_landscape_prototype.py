#!/usr/bin/env python3
"""Create the allowlisted public v0.6 snapshot without copying source materials."""

import argparse
import hashlib
from html.parser import HTMLParser
import json
from pathlib import Path
import re
import sys


ROOT = Path(__file__).resolve().parents[1]
DESTINATION = ROOT / "projects" / "landscape" / "v0.6"
VERSION_DATE = "2026-10-29"
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
                   "function movementThumbnail", "const views=", "function switchModule"]:
        if marker not in text:
            raise ValueError(f"Required prototype behavior is missing: {marker}")
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
    text = replace_once(text,
        "${resource().source} · 计时和结果均为模拟，不是横屏迁移验收",
        "动作输入、计时和结果均为模拟；未接入真实相机与媒体")
    text = replace_once(text,
        "17门名称与分类来自内容清单；五禽戏/易筋经章节来自表格。片长缺失，流程按模拟时长运行；评分逐门核验。",
        "课程与分节用于交互演示；计时与评分均为模拟，未接入真实媒体和检测服务。")
    notes = ('<section class="review-notes" id="notes"><h2>原型说明</h2>'
        '<p>本页为公园横屏 v0.6 交互原型，不代表已部署产品。课程、动作图标和趣味玩法用于说明选择、站位与运动流程；未接入真实相机、评分、身份、小程序或媒体服务。</p>'
        '<ul><li>公园环境、开放安排、排行榜昵称与时长均为模拟；小程序码不可扫码。</li>'
        '<li>保留单人/多人站位、暂停、退出确认、逐人结果、拍摄同意和本组视频领取演示。</li>'
        '<li>首页推荐每20秒更新；交互时暂停，更新前5秒显示提示。课程支持分类、搜索和分页；体能按训练部位分类并分页。</li>'
        '<li>趣味运动为候选内容，模拟输入不代表真实识别；水果连击和中心切加分尚未接入判定。</li>'
        '<li>运动榜按本站今日有效运动时长展示，同秒并列；暂停、离区与纯观看不累计。</li></ul></section>')
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
            "title": "横屏v0.6交互原型", "version": "v0.6", "date": VERSION_DATE,
            "status": "交互原型", "entry": "index.html#home",
            "source_sha256": hashlib.sha256(source_bytes).hexdigest(),
        }
        DESTINATION.mkdir(parents=True, exist_ok=True)
        (DESTINATION / "index.html").write_text(public_html, encoding="utf-8")
        (DESTINATION / "version.json").write_text(
            json.dumps(version, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        print(json.dumps({"destination": "projects/landscape/v0.6/", **version,
            "public_sha256": hashlib.sha256(public_html.encode("utf-8")).hexdigest()},
            ensure_ascii=False))
    except (OSError, UnicodeError, ValueError) as exc:
        print(f"Landscape publication stopped: {exc}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
