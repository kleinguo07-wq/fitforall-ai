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
TRAINING_MEDIA_SOURCE = "设计参考/训练演示/"
TRAINING_MEDIA_DESTINATION = "training-media/"
TRAINING_MEDIA = {
    "训练画面示意.jpg": "camera-preview.jpg",
    "举右手示意.jpg": "raise-hand-preview.jpg",
    "八段锦-示范片段.mp4": "baduanjin-preview.mp4",
}


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
                   "function prototypeHelpItems", "function togglePrototypeHelp",
                   "function fitnessReport", "function followReport", "function fruitSettlement",
                   'data-ranking-metric="calories"']:
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
    if TRAINING_MEDIA_SOURCE in text:
        text = replace_once(text,
            f"const exerciseMedia='{TRAINING_MEDIA_SOURCE}';",
            f"const exerciseMedia='{TRAINING_MEDIA_DESTINATION}';")
        for local_name, public_name in TRAINING_MEDIA.items():
            text = replace_once(text,
                f'${{exerciseMedia}}{local_name}',
                f'${{exerciseMedia}}{public_name}')
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
        training_assets = {}
        if TRAINING_MEDIA_DESTINATION in public_html:
            training_assets = {
                public_name: (args.source.parent / TRAINING_MEDIA_SOURCE / local_name).read_bytes()
                for local_name, public_name in TRAINING_MEDIA.items()
            }
        version = {
            "title": "横屏v1.0交互原型", "version": "v1.0", "date": VERSION_DATE,
            "status": "交互原型", "entry": "index.html#home",
            "updated": "2026-11-27",
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
        if training_assets:
            media_destination = DESTINATION / TRAINING_MEDIA_DESTINATION
            media_destination.mkdir(exist_ok=True)
            for name, contents in training_assets.items():
                (media_destination / name).write_bytes(contents)
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
