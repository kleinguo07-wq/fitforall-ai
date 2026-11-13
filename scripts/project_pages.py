"""Render the shared project catalogue and navigation for GitHub Pages."""
from __future__ import annotations

from dataclasses import dataclass
from html import escape
import json
import posixpath
import re
from pathlib import Path


@dataclass(frozen=True)
class Entry:
    title: str
    path: str
    description: str = ""


def load_projects(root: Path) -> list[dict[str, str]]:
    projects = json.loads((root / "projects" / "catalog.json").read_text(encoding="utf-8"))
    ids = [item["id"] for item in projects]
    if len(ids) != len(set(ids)) or any(not re.fullmatch(r"[a-z][a-z0-9-]*", key) for key in ids):
        raise ValueError("Project IDs must be unique lowercase URL segments")
    return projects


def relative_url(page: str, target: str) -> str:
    match = re.fullmatch(r"([^?#]+)(.*)", target)
    if not match:
        raise ValueError(f"Invalid navigation target: {target}")
    path, suffix = match.groups()
    relative = posixpath.relpath(path, posixpath.dirname(page) or ".")
    return relative + ("/" if path.endswith("/") else "") + suffix


def render_page(title: str, content: str) -> str:
    return f"""<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{escape(title)} · FitForAll</title></head>
<body><main class="site-main">{content}</main></body></html>
"""


def render_hub(projects: list[dict[str, str]]) -> str:
    cards = []
    for item in projects:
        cards.append(f"""<a class="site-card project-card" href="./projects/{escape(item['id'])}/">
<div class="site-card-meta"><span>{escape(item['form'])}</span><span class="site-tag">{escape(item['current'] or item['status'])}</span></div>
<h2>{escape(item['title'])}</h2><p>{escape(item['description'])}</p><span class="site-card-action">进入项目 <span aria-hidden="true">→</span></span></a>""")
    return render_page("项目总览", f"""<header class="site-heading">
<p class="site-kicker">产品评审</p><h1>项目总览</h1>
<p>选择产品，查看当前版本的原型、需求与调研资料。</p></header>
<section class="site-grid" aria-label="产品项目">{''.join(cards)}</section>""")


def render_project(
    project: dict[str, str], entries: list[Entry], extra: str = "", updated: str = "",
    *, backlog_entry: Entry | None = None, change_summary: str = "",
) -> str:
    path = f"projects/{project['id']}/index.html"
    cards = []
    for index, entry in enumerate(entries):
        primary = " site-card-primary" if index == 0 else ""
        cards.append(f"""<a class="site-card{primary}" href="{escape(relative_url(path, entry.path))}">
<h3>{escape(entry.title)}</h3><p>{escape(entry.description)}</p>
<span class="site-card-action">打开 <span aria-hidden="true">→</span></span></a>""")
    timestamp = f'<time datetime="{escape(updated)}">更新于 {escape(updated)}</time>' if updated else ""
    version_title = project["current"] or project["status"]
    if change_summary:
        version_title = f"{version_title} · {change_summary}"
    background_link = '<a class="site-heading-link" href="#background">项目背景与产品思考 ↓</a>' if extra else ""
    backlog_section = ""
    if backlog_entry:
        backlog_section = f"""<section class="site-note" aria-labelledby="project-backlog">
<p class="site-kicker">项目级</p><h2 id="project-backlog">{escape(backlog_entry.title)}</h2>
<p>{escape(backlog_entry.description)}</p>
<a class="site-heading-link" href="{escape(relative_url(path, backlog_entry.path))}">打开需求池 <span aria-hidden="true">→</span></a>
</section>"""
    return render_page(project["title"], f"""<header class="site-heading">
<p class="site-kicker">{escape(project['form'])}</p><h1>{escape(project['title'])}</h1>
<p>{escape(project['description'])}</p>{background_link}</header>
<section class="site-release" aria-labelledby="current-version">
<header class="site-section-heading"><div><p class="site-kicker">当前评审</p>
<h2 id="current-version">{escape(version_title)}</h2></div>{timestamp}</header>
<div class="site-grid">{''.join(cards)}</div></section>{backlog_section}{extra}""")


def render_landscape_background(background: dict) -> str:
    def items(key: str) -> str:
        return "".join(
            f'<article><h4>{escape(item["title"])}</h4><p>{escape(item["body"])}</p></article>'
            for item in background[key]
        )
    return f"""<section id="background" class="site-note" aria-labelledby="background-title">
<h2 id="background-title">项目背景与产品思考</h2>
<p class="site-kicker">更新于 {escape(background['updated'])}</p>
<h3>产品定位</h3><p>{escape(background['summary'])}</p>
<h3>产品亮点</h3><div class="site-note-grid">{items("highlights")}</div>
<h3>持续思考</h3><div class="site-note-grid">{items("reflections")}</div>
<p class="site-callout">{escape(background['status_note'])}</p></section>"""


def add_shell(
    source: str, page: str, projects: list[dict[str, str]], project_id: str,
    entries: list[Entry], surface: str, assets: dict[str, str], guide: str = "",
    fullscreen: bool = False,
) -> str:
    def asset(name: str) -> str:
        return escape(relative_url(page, f"site-assets/{name}")) + "?v=" + assets[name]

    def link(title: str, target: str, active: str = "") -> str:
        current = f' aria-current="{active}"' if active else ""
        return f'<a href="{escape(relative_url(page, target))}"{current}>{escape(title)}</a>'

    project_path = f"projects/{project_id}/"
    project_nav = "".join(
        link(item["title"], f"projects/{item['id']}/", "location" if project_id == item["id"] else "")
        for item in projects
    )
    tools = ""
    if guide:
        tools += '<button type="button" id="site-guide-open">使用说明</button>'
    if fullscreen:
        tools += '<button type="button" id="site-fullscreen">全屏预览</button>'
    local_nav = ""
    if project_id:
        overview = link("项目主页", project_path, "page" if page == project_path + "index.html" else "")
        shortcuts = "".join(
            link(entry.title, entry.path, "page" if page == entry.path.split("#")[0].split("?")[0] and "?" not in entry.path else "")
            for entry in entries
        )
        local_nav = f"""<div class="site-context">
<nav class="site-local" aria-label="项目内导航">{overview}{shortcuts}</nav>
<div class="site-tools">{tools}</div></div>"""
    dialog = (
        f'<dialog id="site-guide" aria-labelledby="site-guide-title"><h2 id="site-guide-title">使用说明</h2>'
        f'<p>{escape(guide)}</p><form method="dialog"><button type="submit" autofocus>关闭</button></form></dialog>'
        if guide else ""
    )
    header = f"""<header class="site-header" data-surface="{escape(surface)}">
<div class="site-header-row"><a class="site-brand" href="{escape(relative_url(page, './'))}"><span aria-hidden="true">F</span> FitForAll AI</a>
<nav class="site-global" aria-label="产品导航">{link('项目总览', './', 'page' if not project_id else '')}{project_nav}</nav></div>
{local_nav}</header>{dialog}"""
    style = f'<link rel="stylesheet" href="{asset("site.css")}">'
    if surface:
        style += f'<link rel="stylesheet" href="{asset("review-surfaces.css")}">'
    script = f'<script defer src="{asset("site.js")}"></script>'
    head = re.compile(r"</head>", re.I)
    body = re.compile(r"<body\b([^>]*)>", re.I)
    classes = f"review-site review-page review-{surface}" if surface else "review-site site-index"
    source = head.sub(lambda _: f"{style}{script}</head>", source, count=1)
    def body_with_shell(match: re.Match[str]) -> str:
        attributes = match[1]
        if re.search(r'\bclass="[^"]*"', attributes):
            attributes = re.sub(r'\bclass="([^"]*)"', lambda item: f'class="{item[1]} {classes}"', attributes, count=1)
        else:
            attributes += f' class="{classes}"'
        return f"<body{attributes}>{header}"

    return body.sub(body_with_shell, source, count=1)
