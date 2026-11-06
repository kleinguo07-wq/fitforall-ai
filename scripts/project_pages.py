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
.release-section{{padding:26px;background:#fff;border:1px solid var(--line);border-radius:16px}}.release-header{{display:flex;justify-content:space-between;gap:20px;align-items:center;padding-bottom:22px;margin-bottom:22px;border-bottom:1px solid var(--line)}}.release-label{{display:block;color:var(--muted);font-size:13px;margin-bottom:3px}}.release-title{{display:flex;align-items:center;gap:16px}}.release-title h2{{font-size:44px;letter-spacing:-.045em;line-height:1.2;color:var(--blue);margin:0;font-weight:750}}.release-updated{{font-size:13px;color:var(--muted);white-space:nowrap}}.review-entries{{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px}}.review-entry{{display:flex;flex-direction:column;align-items:flex-start;padding:22px;background:#f8faff;border:1px solid var(--line);border-radius:10px;min-height:230px;color:var(--ink);text-decoration:none;transition:border-color .15s,background .15s}}.review-entry:hover{{border-color:#8ab3fa;background:#f1f6ff}}.entry-icon{{display:grid;place-items:center;width:42px;height:42px;border-radius:8px;color:var(--blue);background:#eaf1ff;margin-bottom:15px}}.entry-icon svg{{width:25px;height:25px;stroke:currentColor;fill:none;stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round}}.review-entry h3{{font-size:21px;margin:0 0 9px;line-height:1.4}}.review-entry p{{font-size:14px;color:var(--muted);line-height:1.7}}.entry-action{{margin-top:auto;padding-top:22px;font-size:15px;color:var(--blue);font-weight:550}}@media(max-width:740px){{.release-section{{padding:20px}}.review-entries{{grid-template-columns:1fr}}.review-entry{{min-height:205px}}.release-header{{align-items:flex-start;flex-wrap:wrap;gap:10px}}.release-title h2{{font-size:38px}}}}
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
    current_dir = next((directory for directory in version_dirs if directory.name == project["current"]), None)
    if current_dir is None:
        raise ValueError("Current landscape review version is missing")
    metadata = json.loads((current_dir / "version.json").read_text(encoding="utf-8"))
    updated = e(metadata.get("updated", metadata.get("date", "")))
    version = e(metadata["version"])
    entries = [
        ("大屏端原型", "首页、运动内容、趣味互动与本站服务。", metadata["entry"], "打开原型", '<rect x="2" y="4" width="20" height="13" rx="2"/><path d="M8 21h8M12 17v4"/>'),
        ("管理后台原型", "视频按产品切换，配置全民运动站公告。", metadata["admin_entry"], "打开原型", '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>'),
        ("埋点需求", "采集事件、参数、触发时机与验收口径。", metadata["tracking_entry"], "查看需求", '<path d="M4 3v18h17M8 16v-4M13 16V8M18 16V5"/>'),
    ]
    cards = []
    for title, description, entry, action, icon in entries:
        cards.append(f'''<a class="review-entry" href="./{e(current_dir.name)}/{e(entry)}"><span class="entry-icon" aria-hidden="true"><svg viewBox="0 0 24 24">{icon}</svg></span><h3>{e(title)}</h3><p>{e(description)}</p><span class="entry-action">{e(action)} →</span></a>''')
    entry_section = f'''<section class="release-section" aria-labelledby="release-version"><header class="release-header"><div><span class="release-label">当前评审版本</span><div class="release-title"><h2 id="release-version">{version}</h2><span class="status">当前版本</span></div></div><span class="release-updated">更新于 {updated}</span></header><nav class="review-entries" aria-label="当前版本评审入口">{''.join(cards)}</nav></section>'''
    content = f'''<div class="meta"><span>横屏 · 独立项目</span><span class="status">交互原型</span></div>
<h1>{e(project['title'])}</h1><p class="intro">{e(project['description'])}<br><a class="background-link" href="#background">阅读项目背景与产品思考 ↓</a></p>{entry_section}
{render_landscape_background(background)}
<section class="panel"><h2>评审说明</h2><p>每页顶部点击“原型说明”，可对照编号查看功能用途、操作和规则。AI跟练和体能训练展示内容选择与详情，运动过程沿用原产品，仅保留文字说明。热身下一期、本期不展示；一期趣味仅单人切水果，保留站位、互动与结果演示，运动视频保留观看流程。摄像头、评分、计时、账号、二维码、媒体、环境及榜单均为模拟；原型不代表真实功能已交付。</p></section>'''
    return page(project["title"], content, "../../")


def render_pending(project: dict[str, str]) -> str:
    return page(project["title"], f'''<div class="meta"><span>{e(project['form'])} · 独立项目</span><span class="status pending">筹备中</span></div><h1>{e(project['title'])}</h1><p class="intro">{e(project['description'])}</p><section class="panel empty"><h2>暂无可查看的原型</h2><p>项目入口已预留，当前不代表需求已定稿或产品已开发。</p></section>''', "../../")
