#!/usr/bin/env python3
"""Build the static GitHub Pages site from every demos/v* directory."""

from __future__ import annotations

import html
import json
import re
import shutil
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "_site"
DEMOS = ROOT / "demos"
STATIC_EXTENSIONS = {".gif", ".jpeg", ".jpg", ".png", ".svg", ".webp"}


def version_key(path: Path) -> tuple[int, ...]:
    numbers = re.findall(r"\d+", path.name)
    return tuple(int(number) for number in numbers)


def load_version(version_dir: Path) -> dict[str, str]:
    defaults = {
        "name": version_dir.name,
        "title": f"{version_dir.name} 产品评审",
        "description": "交互原型与需求评审材料",
        "status": "评审中",
        "updated": "",
    }
    metadata_path = version_dir / "version.json"
    if metadata_path.exists():
        metadata = json.loads(metadata_path.read_text(encoding="utf-8"))
        for key in defaults:
            value = metadata.get(key)
            if isinstance(value, str) and value.strip():
                defaults[key] = value.strip()
    return defaults


def build_version_cards(versions: list[dict[str, str]]) -> str:
    cards = []
    for index, version in enumerate(versions):
        latest = '<span class="latest">最新版本</span>' if index == 0 else ""
        updated = (
            f'<time datetime="{html.escape(version["updated"])}">'
            f'更新于 {html.escape(version["updated"])}</time>'
            if version["updated"]
            else ""
        )
        cards.append(
            f"""
            <a class="version-card" href="./demos/{html.escape(version['name'])}/">
              <div class="card-top">
                <span class="version">{html.escape(version['name'].upper())}</span>
                {latest}
              </div>
              <h2>{html.escape(version['title'])}</h2>
              <p>{html.escape(version['description'])}</p>
              <div class="card-meta">
                <span>{html.escape(version['status'])}</span>
                {updated}
              </div>
              <strong>打开工作台 <span aria-hidden="true">→</span></strong>
            </a>
            """.strip()
        )
    return "\n".join(cards)


def render_index(versions: list[dict[str, str]]) -> str:
    cards = build_version_cards(versions)
    return f"""<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="description" content="FitForAll AI 产品需求、原型与版本评审入口">
  <title>FitForAll AI · 产品评审工作台</title>
  <style>
    :root {{ color-scheme: light; --ink:#14243d; --muted:#6f809b; --line:#dce5f2; --blue:#1769f3; --panel:#fff; }}
    * {{ box-sizing:border-box; }}
    body {{ margin:0; min-height:100vh; color:var(--ink); background:#f3f7fd; font-family:Inter,"PingFang SC","Microsoft YaHei",sans-serif; }}
    .shell {{ width:min(1080px,calc(100% - 40px)); margin:0 auto; padding:72px 0 80px; }}
    .brand {{ display:flex; align-items:center; gap:12px; margin-bottom:72px; font-weight:750; font-size:20px; }}
    .logo {{ display:grid; place-items:center; width:44px; height:44px; color:#fff; background:var(--blue); border-radius:13px; font-size:25px; }}
    .eyebrow {{ margin:0 0 14px; color:var(--blue); font-size:13px; font-weight:750; letter-spacing:.16em; }}
    h1 {{ max-width:760px; margin:0; font-size:clamp(38px,6vw,68px); line-height:1.12; letter-spacing:-.04em; }}
    .intro {{ max-width:660px; margin:24px 0 54px; color:var(--muted); font-size:18px; line-height:1.8; }}
    .versions {{ display:grid; grid-template-columns:repeat(auto-fit,minmax(290px,1fr)); gap:20px; }}
    .version-card {{ display:flex; min-height:330px; padding:30px; flex-direction:column; color:inherit; text-decoration:none; background:var(--panel); border:1px solid var(--line); border-radius:24px; box-shadow:0 14px 40px rgba(31,68,122,.08); transition:transform .18s ease,box-shadow .18s ease,border-color .18s ease; }}
    .version-card:hover {{ transform:translateY(-4px); border-color:#a9c7fb; box-shadow:0 20px 46px rgba(31,68,122,.14); }}
    .card-top,.card-meta {{ display:flex; align-items:center; justify-content:space-between; gap:12px; }}
    .version {{ color:var(--blue); font-size:14px; font-weight:800; letter-spacing:.1em; }}
    .latest {{ padding:7px 10px; color:#116741; background:#e6f7ef; border-radius:999px; font-size:12px; font-weight:700; }}
    h2 {{ margin:34px 0 12px; font-size:28px; }}
    .version-card p {{ margin:0; color:var(--muted); line-height:1.7; }}
    .card-meta {{ margin-top:auto; padding:22px 0; color:#8090a8; border-top:1px solid #edf1f7; font-size:13px; }}
    .version-card strong {{ color:var(--blue); font-size:16px; }}
    footer {{ margin-top:52px; color:#8b99ac; font-size:13px; }}
    @media (max-width:600px) {{ .shell {{ width:min(100% - 28px,1080px); padding-top:30px; }} .brand {{ margin-bottom:50px; }} .intro {{ margin-bottom:38px; }} }}
  </style>
</head>
<body>
  <main class="shell">
    <div class="brand"><span class="logo">F</span><span>FitForAll AI</span></div>
    <p class="eyebrow">PRODUCT REVIEW WORKSPACE</p>
    <h1>产品需求与交互原型<br>统一评审入口</h1>
    <p class="intro">按版本查看需求、交互演示与评审状态。每个版本使用独立地址，历史版本会持续保留，方便产品、开发和测试共同核对。</p>
    <section class="versions" aria-label="版本列表">
      {cards}
    </section>
    <footer>FitForAll AI · AI 全民健身机产品工作台</footer>
  </main>
</body>
</html>
"""


def main() -> None:
    version_dirs = sorted(
        (path for path in DEMOS.glob("v*") if path.is_dir() and (path / "index.html").exists()),
        key=version_key,
        reverse=True,
    )
    if not version_dirs:
        raise SystemExit("No publishable demos found under demos/v*/index.html")

    if OUTPUT.exists():
        shutil.rmtree(OUTPUT)
    OUTPUT.mkdir()

    shutil.copytree(DEMOS, OUTPUT / "demos")
    docs = ROOT / "docs"
    if docs.exists():
        shutil.copytree(docs, OUTPUT / "docs")
    for asset in ROOT.iterdir():
        if asset.is_file() and asset.suffix.lower() in STATIC_EXTENSIONS:
            shutil.copy2(asset, OUTPUT / asset.name)

    versions = [load_version(path) for path in version_dirs]
    (OUTPUT / "index.html").write_text(render_index(versions), encoding="utf-8")
    (OUTPUT / ".nojekyll").touch()
    print(f"Built {OUTPUT} with {len(versions)} version(s): {', '.join(item['name'] for item in versions)}")


if __name__ == "__main__":
    main()
