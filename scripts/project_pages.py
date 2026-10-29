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
.empty{{min-height:210px;display:flex;align-items:flex-start;justify-content:center;flex-direction:column}}footer{{margin-top:38px;font-size:13px;color:var(--muted)}}
@media(max-width:800px){{.projects{{grid-template-columns:1fr}}.project-card{{min-height:230px}}main{{width:calc(100% - 32px);padding-top:25px}}h1{{font-size:30px}}.brand{{margin-bottom:26px}}.version-row{{align-items:flex-start}}}}
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


def render_landscape(project: dict[str, str], version_dirs: list[Path]) -> str:
    rows = []
    for directory in version_dirs:
        metadata = json.loads((directory / "version.json").read_text(encoding="utf-8"))
        rows.append(f'''<a class="version-row" href="./{e(directory.name)}/#home"><div><b>{e(metadata['title'])}</b><small>{e(metadata['status'])} · 更新于 {e(metadata.get('updated', metadata.get('date', '')))}</small></div><span>打开原型 →</span></a>''')
    content = f'''<div class="meta"><span>横屏 · 独立项目</span><span class="status">交互原型</span></div>
<h1>{e(project['title'])}</h1><p class="intro">{e(project['description'])}</p><section class="versions" aria-label="横屏原型版本">{''.join(rows)}</section>
<section class="panel"><h2>评审说明</h2><p>热身、AI跟练和体能训练展示内容选择与详情，运动过程沿用原产品，仅保留文字说明。趣味运动保留站位、互动与结果演示，运动视频保留观看流程。摄像头、评分、计时、账号、二维码、媒体、环境及榜单均为模拟；原型不代表真实功能已交付。</p></section>'''
    return page(project["title"], content, "../../")


def render_pending(project: dict[str, str]) -> str:
    return page(project["title"], f'''<div class="meta"><span>{e(project['form'])} · 独立项目</span><span class="status pending">筹备中</span></div><h1>{e(project['title'])}</h1><p class="intro">{e(project['description'])}</p><section class="panel empty"><h2>暂无可查看的原型</h2><p>项目入口已预留，当前不代表需求已定稿或产品已开发。</p></section>''', "../../")
