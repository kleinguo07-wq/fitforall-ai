"""Render project-level navigation separately from each product's versions."""
from __future__ import annotations

import html
import json
import re
from pathlib import Path


def e(value: str) -> str:
    return html.escape(value, quote=True)


def load_projects(root: Path) -> list[dict[str, str]]:
    projects = json.loads((root / "projects" / "catalog.json").read_text(encoding="utf-8"))
    ids = [item["id"] for item in projects]
    if len(ids) != len(set(ids)) or any(not re.fullmatch(r"[a-z][a-z0-9-]*", key) for key in ids):
        raise ValueError("Project IDs must be unique lowercase URL segments")
    return projects


def page(title: str, content: str, back: str = "") -> str:
    nav = f'<a class="back" href="{e(back)}">← 项目总览</a>' if back else ""
    return f'''<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>{e(title)} · FitForAll</title><style>
:root{{color-scheme:light;--ink:#14243d;--muted:#6f809b;--line:#dce5f2;--blue:#1769f3}}
*{{box-sizing:border-box}}body{{margin:0;color:var(--ink);background:#f3f7fd;font:16px/1.7 "PingFang SC","Microsoft YaHei",sans-serif}}
main{{width:min(1120px,calc(100% - 48px));margin:auto;padding:38px 0 52px}}a{{color:var(--blue);text-underline-offset:4px}}
a:focus-visible{{outline:3px solid #1769f3;outline-offset:5px}}.brand{{font-size:20px;font-weight:700;margin-bottom:36px;display:flex;gap:24px;align-items:center}}.back{{font-size:14px;font-weight:400}}
h1{{font-size:38px;line-height:1.3;margin:0 0 16px}}h2{{font-size:25px;line-height:1.45;margin:17px 0 12px}}p{{margin:0}}.intro{{color:var(--muted);max-width:790px;margin-bottom:30px}}
.projects{{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:20px}}.project-card{{display:flex;flex-direction:column;padding:26px;min-height:290px;color:inherit;background:#fff;border:1px solid var(--line);border-radius:16px;text-decoration:none}}
.project-card:hover{{border-color:#8ab3fa}}.project-card p{{font-size:15px;color:var(--muted)}}.project-card strong{{color:var(--blue);font-size:16px;margin-top:auto;padding-top:28px}}
.meta{{display:flex;align-items:center;justify-content:space-between;gap:12px;color:var(--muted);font-size:13px}}.status{{font-size:13px;color:#17614a;background:#e6f4ed;border-radius:5px;padding:3px 9px}}.status.pending{{color:#7d6840;background:#f7f0e1}}
.panel{{padding:28px;background:#fff;border:1px solid var(--line);border-radius:14px;margin-top:24px}}.panel h2{{margin-top:0}}.panel p{{color:var(--muted)}}.button{{display:inline-flex;align-items:center;justify-content:center;padding:11px 20px;min-height:46px;background:var(--blue);color:#fff;text-decoration:none;border-radius:7px;margin-top:22px}}
.versions{{display:grid;gap:12px}}.version-row{{display:flex;justify-content:space-between;align-items:center;gap:20px;color:inherit;padding:22px;background:#fff;border:1px solid var(--line);border-radius:12px;text-decoration:none}}.version-row:hover{{border-color:#8ab3fa}}.version-row b{{font-size:21px}}.version-row small{{display:block;color:var(--muted)}}.version-row>span{{color:var(--blue)}}
.review-resources{{grid-column:1/-1;display:flex;align-items:center;gap:20px;flex-wrap:wrap;font-size:14px;padding:12px 4px;color:var(--muted)}}.review-resources b{{font-weight:500}}.review-entries{{grid-template-columns:repeat(2,minmax(0,1fr));gap:18px}}.review-entry{{display:flex;flex-direction:column;padding:24px;background:#fff;border:1px solid var(--line);border-radius:12px;min-height:244px}}.entry-meta{{display:flex;align-items:center;gap:12px;font-size:13px;color:var(--muted)}}.review-entry h2{{font-size:23px;margin:16px 0 9px}}.review-entry p{{font-size:15px;color:var(--muted);line-height:1.7}}.entry-actions{{display:flex;gap:18px;align-items:center;margin-top:auto;padding-top:22px;flex-wrap:wrap}}.entry-actions .button{{margin-top:0;font-size:15px;min-height:46px}}.entry-secondary{{font-size:14px}}@media(max-width:700px){{.review-entries{{grid-template-columns:1fr}}.review-entry{{min-height:230px}}}}
.empty{{min-height:210px;display:flex;align-items:flex-start;justify-content:center;flex-direction:column}}footer{{margin-top:38px;font-size:13px;color:var(--muted)}}
.background-link{{display:inline-block;margin-top:16px}}#background{{scroll-margin-top:24px}}.background-meta{{font-size:13px;color:var(--muted);margin-bottom:8px}}.background-summary{{color:var(--ink)!important;max-width:960px}}.background-grid{{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:22px 28px;margin:12px 0 28px}}.background-item h4,.background-thought h4{{font-size:18px;line-height:1.6;margin:0 0 7px}}.background-item p,.background-thought p{{font-size:15px;line-height:1.9}}.background-thought+.background-thought{{margin-top:22px}}.background-note{{margin-top:28px;padding:16px 18px;background:#f3f7fd;border-left:3px solid #9eb6da;font-size:14px}}
@media(max-width:800px){{.projects{{grid-template-columns:1fr}}.project-card{{min-height:230px}}main{{width:calc(100% - 32px);padding-top:25px}}h1{{font-size:30px}}.brand{{margin-bottom:26px}}.version-row{{align-items:flex-start}}}}
@media(max-width:600px){{.background-grid{{grid-template-columns:1fr;gap:20px}}#background{{padding:22px}}}}
</style></head><body><main><div class="brand"><span>FitForAll · 产品评审</span>{nav}</div>{content}<footer>按项目、按版本独立维护 · 评审原型不代表真实产品已交付</footer></main></body></html>'''


def render_hub(projects: list[dict[str, str]]) -> str:
    cards = []
    for item in projects:
        pending = not item["current"]
        current = e(item["current"]) if item["current"] else "暂无原型"
        cards.append(f'''<a class="project-card" href="./projects/{e(item['id'])}/">
<div class="meta"><span>{e(item['form'])}</span><span class="status{' pending' if pending else ''}">{e(item['status'])}</span></div>
<h2>{e(item['title'])}</h2><p>{e(item['description'])}</p><strong>{'查看项目' if pending else '进入项目'} →</strong><div class="meta"><span>{current}</span></div></a>''')
    return page("项目总览", '<h1>项目总览</h1><p class="intro">先选择产品项目，再查看对应版本的需求与原型。</p><section class="projects" aria-label="产品项目">' + "".join(cards) + "</section>")


def render_landscape_background(background: dict) -> str:
    highlights = "".join(
        f'<article class="background-item"><h4>{e(item["title"])}</h4><p>{e(item["body"])}</p></article>'
        for item in background["highlights"]
    )
    reflections = "".join(
        f'<article class="background-thought"><h4>{e(item["title"])}</h4><p>{e(item["body"])}</p></article>'
        for item in background["reflections"]
    )
    return f'''<section class="panel" id="background" aria-labelledby="background-title">
<div class="background-meta">项目组阅读 · 更新于 {e(background['updated'])}</div><h2 id="background-title">项目背景与产品思考</h2>
<h3>产品定位</h3><p class="background-summary">{e(background['summary'])}</p>
<h3>产品亮点</h3><div class="background-grid">{highlights}</div>
<h3>持续思考</h3><div class="background-reflections">{reflections}</div>
<p class="background-note">{e(background['status_note'])}</p></section>'''


def render_landscape(project: dict[str, str], version_dirs: list[Path], background: dict) -> str:
    rows = []
    # Keep historical URLs available; the landing only exposes the current review.
    for directory in version_dirs:
        if directory.name != project["current"]:
            continue
        metadata = json.loads((directory / "version.json").read_text(encoding="utf-8"))
        updated = e(metadata.get("updated", metadata.get("date", "")))
        version = e(metadata["version"])
        entries = [("屏端原型", "首页、运动内容、趣味互动与本站服务。", metadata["entry"], "")]
        if metadata.get("admin_entry"):
            entries.append(("管理后台原型", "视频按产品切换，配置全民运动站公告。", metadata["admin_entry"], metadata["admin_requirements"]))
        for title, description, entry, requirements in entries:
            secondary = f'<a class="entry-secondary" href="./{e(directory.name)}/{e(requirements)}">查看需求</a>' if requirements else ""
            rows.append(f'''<article class="review-entry"><div class="entry-meta"><span class="status">{version}</span><span>更新于 {updated}</span></div><h2>{e(title)}</h2><p>{e(description)}</p><div class="entry-actions"><a class="button" href="./{e(directory.name)}/{e(entry)}">打开原型 →</a>{secondary}</div></article>''')
        if metadata.get("tracking_entry"):
            rows.append(f'''<nav class="review-resources" aria-label="本期需求资料"><b>本期需求资料</b><a href="./{e(directory.name)}/{e(metadata['tracking_entry'])}">查看埋点需求 →</a></nav>''')
    content = f'''<div class="meta"><span>横屏 · 独立项目</span><span class="status">交互原型</span></div>
<h1>{e(project['title'])}</h1><p class="intro">{e(project['description'])}<br><a class="background-link" href="#background">阅读项目背景与产品思考 ↓</a></p><section class="versions review-entries" aria-label="当前版本评审入口">{''.join(rows)}</section>
{render_landscape_background(background)}
<section class="panel"><h2>评审说明</h2><p>每页顶部点击“原型说明”，可对照编号查看功能用途、操作和规则。AI跟练和体能训练展示内容选择与详情，运动过程沿用原产品，仅保留文字说明。热身下一期、本期不展示；一期趣味仅单人切水果，保留站位、互动与结果演示，运动视频保留观看流程。摄像头、评分、计时、账号、二维码、媒体、环境及榜单均为模拟；原型不代表真实功能已交付。</p></section>'''
    return page(project["title"], content, "../../")


def render_pending(project: dict[str, str]) -> str:
    return page(project["title"], f'''<div class="meta"><span>{e(project['form'])} · 独立项目</span><span class="status pending">筹备中</span></div><h1>{e(project['title'])}</h1><p class="intro">{e(project['description'])}</p><section class="panel empty"><h2>暂无可查看的原型</h2><p>项目入口已预留，当前不代表需求已定稿或产品已开发。</p></section>''', "../../")
