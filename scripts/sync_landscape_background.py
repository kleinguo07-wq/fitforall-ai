"""Export only the approved landscape project background for the public page."""
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", type=Path, required=True, help="Local requirement JSON")
    args = parser.parse_args()
    source = json.loads(args.source.read_text(encoding="utf-8"))["brief"]["product_background"]
    background = {}
    for key in ("title", "updated", "summary", "status_note"):
        value = source[key]
        if not isinstance(value, str) or not value.strip():
            raise ValueError(f"Background {key} must be non-empty text")
        background[key] = value
    for key in ("highlights", "reflections"):
        items = source[key]
        if not isinstance(items, list) or not items:
            raise ValueError(f"Background {key} must be a non-empty list")
        background[key] = []
        for item in items:
            if any(not isinstance(item[field], str) or not item[field].strip() for field in ("title", "body")):
                raise ValueError(f"Background {key} items need a title and body")
            background[key].append({field: item[field] for field in ("title", "body")})
    content = json.dumps(background, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    background["content_sha256"] = hashlib.sha256(content.encode("utf-8")).hexdigest()
    target = ROOT / "projects" / "landscape" / "background.json"
    target.write_text(json.dumps(background, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Exported {len(background['highlights'])} highlights and {len(background['reflections'])} reflections")


if __name__ == "__main__":
    main()
