#!/usr/bin/env python3
"""Build the product review site while retaining published prototype URLs."""

from __future__ import annotations

from hashlib import sha256
import json
from pathlib import Path
import re
import shutil

from project_pages import Entry, add_shell, load_projects, relative_url, render_hub, render_landscape_background, render_project

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "_site"
STATIC_EXTENSIONS = {".gif", ".jpeg", ".jpg", ".png", ".svg", ".webp"}


def add_internal_access(source: str, page: str, asset_versions: dict[str, str]) -> str:
    def asset(name: str) -> str:
        return relative_url(page, f"site-assets/{name}") + "?v=" + asset_versions[name]

    assets = (f'<link rel="stylesheet" href="{asset("internal-access.css")}">'
              f'<script src="{asset("internal-access.js")}"></script>')
    dialog = '''<dialog id="internal-access" aria-labelledby="internal-access-title" closedby="none" open>
<h1 id="internal-access-title">内部访问</h1>
<form>
<input type="password" aria-label="访问密码" aria-describedby="internal-access-hint internal-access-message" placeholder="请输入访问密码" autocomplete="current-password" required autofocus>
<p id="internal-access-hint">提示 <strong>dabai</strong></p>
<p id="internal-access-message" role="alert"></p>
<button type="submit">进入</button>
</form>
<noscript><p>请启用 JavaScript 后输入密码。</p></noscript>
</dialog>'''
    source, html_count = re.subn(r"<html\b", "<html data-internal-access-locked", source, count=1, flags=re.I)
    source, head_count = re.subn(r"</head>", lambda match: assets + match[0], source, count=1, flags=re.I)
    source, body_count = re.subn(r"<body\b[^>]*>", lambda match: match[0] + dialog, source, count=1, flags=re.I)
    if not (html_count and head_count and body_count):
        raise ValueError(f"Cannot add the internal access prompt to {page}")
    return source


def main() -> None:
    if OUTPUT.exists():
        shutil.rmtree(OUTPUT)
    OUTPUT.mkdir()
    for name in ("demos", "docs", "projects", "site-assets"):
        ignored = (".DS_Store", "catalog.json", "README.md") if name == "projects" else (".DS_Store",)
        shutil.copytree(ROOT / name, OUTPUT / name, ignore=shutil.ignore_patterns(*ignored))
    for asset in ROOT.iterdir():
        if asset.is_file() and asset.suffix.lower() in STATIC_EXTENSIONS:
            shutil.copy2(asset, OUTPUT / asset.name)

    projects = load_projects(ROOT)
    project_by_id = {item["id"]: item for item in projects}
    versions = {key: project_by_id[key]["current"] for key in ("fitness", "landscape")}
    fitness = f"demos/{versions['fitness']}/index.html"
    fitness_v11 = "demos/v1.1/index.html"
    landscape = f"projects/landscape/{versions['landscape']}"
    trail = "projects/trail-checkin/prototype/index.html"
    research = "projects/trail-checkin/research/index.html"
    analytics = "projects/fitness/analytics/index.html"
    backlog = "demos/backlog/index.html"
    backlog_entry = Entry("待开发需求池", backlog, "查看全民健身机尚未排期的需求与演示。")
    vertical_meta = json.loads((ROOT / fitness).with_name("version.json").read_text(encoding="utf-8"))
    landscape_meta = json.loads((ROOT / landscape / "version.json").read_text(encoding="utf-8"))
    landscape_screen = f"{landscape}/{landscape_meta['entry']}"
    landscape_admin = f"{landscape}/{landscape_meta['admin_entry']}"
    tracking = f"{landscape}/{landscape_meta['tracking_entry']}"
    analytics_entry = Entry("埋点数据看板", analytics, "查看社体屏的每日趋势、事件排行和属性分布。")
    fitness_v11_entries = [
        Entry("屏端原型", fitness_v11 + "?view=device", "体验视频屏保、趣运动项目同步等本期内容。"),
        Entry("管理后台", fitness_v11 + "?view=admin", "评审全民健身机屏保管理。"),
        Entry("评审说明", fitness_v11 + "?view=spec", "查看本期范围和评审重点。"),
        Entry("需求文档", fitness_v11 + "?view=docs", "查看本期需求、业务规则与验收。"),
        Entry("埋点需求", fitness_v11 + "?view=tracking", "查阅采集事件与口径。"),
    ]
    fitness_entries = fitness_v11_entries
    if "entries" in vertical_meta:
        fitness_dir = Path(fitness).parent
        fitness_entries = [
            Entry(item["title"], (fitness_dir / item["path"]).as_posix(), item["description"])
            for item in vertical_meta["entries"]
        ]
    previous_fitness = Entry("v1.1 版本", fitness_v11 + "?view=docs#release-intro",
                             "查看视频屏保、一键跟练、趣运动同步与适老内容扩充。")
    current_fitness = Entry(f"{versions['fitness']} 版本", fitness)
    fitness_tools = [analytics_entry, backlog_entry]
    fitness_project_nav = [current_fitness]
    if fitness != fitness_v11:
        fitness_project_nav.append(previous_fitness)
    fitness_project_nav.extend(fitness_tools)
    resources = {
        "fitness": fitness_entries,
        "landscape": [
            Entry("屏端原型", landscape_screen, "体验横屏首页、运动内容、趣味互动与本站服务。"),
            Entry("管理后台", landscape_admin, "查看分产品视频管理、公告与智慧步道入口。"),
            Entry("埋点需求", tracking, "查阅事件、触发时机与验收口径。"),
        ],
        "trail-checkin": [
            Entry("屏端原型", trail, "体验点位地图、运动榜、现场核验、设备设置和语音提示。"),
            Entry("排行榜大屏", trail + "?view=board", "切换榜屏，验证步道榜单和项目注册归属。"),
            Entry("小程序", trail + "?view=mini", "体验微信账号绑定、项目公告、今日运动、历史记录及日周月榜。"),
            Entry("管理后台", trail + "?view=admin", "配置步道及设备，体验远控、升级、播报、发布、统计、监测和日志。"),
            Entry("设备运维", trail + "?view=ops", "预览首次绑定、设备自检与同步状态。"),
            Entry("采购调研", research, "对照采购范围、金额、采集杆参数和原始来源。"),
        ],
    }
    assets = {path.name: sha256(path.read_bytes()).hexdigest()[:10] for path in (OUTPUT / "site-assets").iterdir() if path.is_file()}

    def write(path: str, project: str, source: str | None = None, surface: str = "", guide: str = "", fullscreen: bool = False) -> None:
        target = OUTPUT / path
        target.parent.mkdir(parents=True, exist_ok=True)
        if source is None:
            source = target.read_text(encoding="utf-8")
        navigation = resources.get(project, [])
        if project == "fitness":
            if path == fitness_v11 and fitness != fitness_v11:
                navigation = [*fitness_v11_entries, *fitness_tools, current_fitness]
            elif Path(path).parent == Path(fitness).parent:
                navigation = [*fitness_entries, *fitness_tools]
            else:
                navigation = fitness_project_nav
        target.write_text(add_shell(source, path, projects, project, navigation, surface, assets, guide, fullscreen), encoding="utf-8")

    write("index.html", "", render_hub(projects))
    background = json.loads((ROOT / "projects/landscape/background.json").read_text(encoding="utf-8"))
    for project in projects:
        key = project["id"]
        extra = ""
        if key == "landscape":
            extra = render_landscape_background(background) + (
                '<section class="site-note"><h2>评审说明</h2>'
                '<p>屏端可使用页面标注核对功能、操作和规则。AI 跟练和体能训练展示内容选择、详情和结算示例，'
                '运动过程沿用原产品的评审说明。首期趣味运动演示单人切水果，运动视频保留观看流程。'
                '摄像头、评分、计时、账号、二维码、媒体、环境及榜单均为模拟。</p></section>'
            )
        updated = {"fitness": vertical_meta["updated"], "landscape": landscape_meta["updated"]}.get(key, "")
        entries = resources.get(key, [])
        if key == "fitness":
            entries = [*entries, analytics_entry]
            if fitness == fitness_v11:
                entries.append(Entry("发版简介", fitness + "?view=docs#release-intro", "查看本版本的主要更新。"))
        overview = render_project(
            project, entries, extra, updated,
            backlog_entry=backlog_entry if key == "fitness" else None,
            previous_version=previous_fitness if key == "fitness" and fitness != fitness_v11 else None,
            change_summary=vertical_meta.get("change_summary", "") if key == "fitness" else "",
        )
        write(f"projects/{key}/index.html", key, overview)

    fitness_source = (OUTPUT / fitness_v11).read_text(encoding="utf-8")
    fitness_source = fitness_source.replace('<p class="nav-label">评审空间</p>', '<p class="nav-label">页面目录</p>')
    write(fitness_v11, "fitness", fitness_source, surface="fitness",
          guide="从评审目录切换交互大屏的功能，使用场景模拟调整时间、内容和状态，查看本页需求。管理后台、需求文档和埋点可从项目内导航直接打开。", fullscreen=True)
    if fitness != fitness_v11:
        for page in (OUTPUT / fitness).parent.glob("*.html"):
            write(page.relative_to(OUTPUT).as_posix(), "fitness")
    analytics_source = (OUTPUT / analytics).read_text(encoding="utf-8")
    analytics_source = analytics_source.replace(
        '<div id="root"', '<h1 class="analytics-page-title">社体屏埋点分析</h1>\n<div id="root"', 1
    )
    write(analytics, "fitness", analytics_source, surface="analytics")
    write(backlog, "fitness", surface="backlog",
          guide="从左侧选择待开发需求，查看对应的屏端或小程序演示，再核对本页规则。", fullscreen=True)
    screen_path = landscape_screen.split("#")[0]
    screen_source = (OUTPUT / screen_path).read_text(encoding="utf-8")
    screen_source = screen_source.replace(
        'aria-controls="prototype-help-panel">原型说明</button>',
        'aria-controls="prototype-help-panel">页面标注</button>',
    )
    write(screen_path, "landscape", screen_source, surface="landscape",
          guide="直接点按设备画面，或用页面目录跳转。打开页面功能标注可对照组件和规则，场景模拟用于切换状态。", fullscreen=True)
    admin_path = landscape_admin.split("#")[0]
    admin_html = (OUTPUT / admin_path).read_text(encoding="utf-8")
    sidebar_section = '<div class="menu-label">已有功能参照</div>'
    trail_link = ('<a class="menu-static" style="display:block;color:inherit;text-decoration:none" '
                  'href="../../trail-checkin/prototype/?view=admin">智慧步道</a>')
    write(admin_path, "landscape", admin_html.replace(sidebar_section, trail_link + sidebar_section, 1), surface="admin",
          guide="从左侧选择内容管理功能。使用场景模拟验证空列表、加载或保存失败。")
    write(tracking, "landscape", surface="tracking")
    write(trail, "trail-checkin", surface="trail",
          guide="从项目导航切换杆屏、排行榜大屏、小程序、管理后台与设备运维。可在杆屏发起体验注册，在小程序确认绑定，再用场景模拟生成同一账号的运动。后台发布公告、配置榜屏及远控后，切换对应预览查看变化。", fullscreen=True)
    write(research, "trail-checkin", surface="research")

    # Apply the shared shell to any other published versions that are reached by old URLs.
    current_pages = {fitness, fitness_v11, backlog, landscape_screen.split("#")[0], admin_path, tracking, trail, research}
    for directory, project in (("demos", "fitness"), ("projects/landscape", "landscape")):
        for target in (OUTPUT / directory).glob("v*/index.html"):
            path = target.relative_to(OUTPUT).as_posix()
            if path not in current_pages:
                write(path, project, surface="archive")
    for target in OUTPUT.rglob("*.html"):
        path = target.relative_to(OUTPUT).as_posix()
        source = target.read_text(encoding="utf-8")
        target.write_text(add_internal_access(source, path, assets), encoding="utf-8")
    (OUTPUT / ".nojekyll").touch()
    print(f"Built {len(projects)} projects and their review pages")


if __name__ == "__main__":
    main()
