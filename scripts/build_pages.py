#!/usr/bin/env python3
"""Build the product review site while retaining published prototype URLs."""

from __future__ import annotations

from hashlib import sha256
import json
from pathlib import Path
import re
import shutil

from project_pages import Entry, add_shell, load_projects, render_hub, render_landscape_background, render_project

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "_site"
STATIC_EXTENSIONS = {".gif", ".jpeg", ".jpg", ".png", ".svg", ".webp"}


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
    landscape = f"projects/landscape/{versions['landscape']}"
    trail = "projects/trail-checkin/prototype/index.html"
    research = "projects/trail-checkin/research/index.html"
    backlog = "demos/backlog/index.html"
    backlog_entry = Entry("待开发需求池", backlog, "查看全民健身机尚未排期的需求与演示。")
    vertical_meta = json.loads((ROOT / fitness).with_name("version.json").read_text(encoding="utf-8"))
    landscape_meta = json.loads((ROOT / landscape / "version.json").read_text(encoding="utf-8"))
    landscape_screen = f"{landscape}/{landscape_meta['entry']}"
    landscape_admin = f"{landscape}/{landscape_meta['admin_entry']}"
    tracking = f"{landscape}/{landscape_meta['tracking_entry']}"
    resources = {
        "fitness": [
            Entry("屏端原型", fitness + "?view=device", "体验视频屏保、趣运动项目同步等本期内容。"),
            Entry("管理后台", fitness + "?view=admin", "评审全民健身机屏保管理。"),
            Entry("评审说明", fitness + "?view=spec", "查看本期范围和评审重点。"),
            Entry("需求文档", fitness + "?view=docs", "查看本期需求、业务规则与验收。"),
            Entry("埋点需求", fitness + "?view=tracking", "查阅采集事件与口径。"),
        ],
        "landscape": [
            Entry("屏端原型", landscape_screen, "体验横屏首页、运动内容、趣味互动与本站服务。"),
            Entry("管理后台", landscape_admin, "查看分产品视频管理、公告与智慧步道入口。"),
            Entry("埋点需求", tracking, "查阅事件、触发时机与验收口径。"),
        ],
        "trail-checkin": [
            Entry("屏端原型", trail, "体验点位地图、运动榜、设备设置和个人数据入口。"),
            Entry("管理后台", trail + "?view=admin", "上传地图、配置杆间距离和广告屏保。"),
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
            navigation = [*navigation, backlog_entry]
        target.write_text(add_shell(source, path, projects, project, navigation, surface, assets, guide, fullscreen), encoding="utf-8")

    write("index.html", "", render_hub(projects))
    background = json.loads((ROOT / "projects/landscape/background.json").read_text(encoding="utf-8"))
    for project in projects:
        key = project["id"]
        extra = ""
        if key == "landscape":
            extra = render_landscape_background(background) + (
                '<section class="site-note"><h2>评审说明</h2>'
                '<p>屏端可使用页面标注核对功能、操作和规则。AI 跟练和体能训练展示内容选择与详情，'
                '运动过程沿用原产品的评审说明。首期趣味运动演示单人切水果，运动视频保留观看流程。'
                '摄像头、评分、计时、账号、二维码、媒体、环境及榜单均为模拟。</p></section>'
            )
        updated = {"fitness": vertical_meta["updated"], "landscape": landscape_meta["updated"]}.get(key, "")
        overview = render_project(
            project, resources.get(key, []), extra, updated,
            backlog_entry=backlog_entry if key == "fitness" else None,
            change_summary=vertical_meta.get("change_summary", "") if key == "fitness" else "",
        )
        write(f"projects/{key}/index.html", key, overview)

    fitness_source = (OUTPUT / fitness).read_text(encoding="utf-8")
    fitness_source = fitness_source.replace('<p class="nav-label">评审空间</p>', '<p class="nav-label">页面目录</p>')
    write(fitness, "fitness", fitness_source, surface="fitness",
          guide="从评审目录切换交互大屏的功能，使用场景模拟调整时间、内容和状态，查看本页需求。管理后台、需求文档和埋点可从项目内导航直接打开。", fullscreen=True)
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
          guide="点按杆屏体验地图、运动榜与设置。使用场景模拟生成经过事件，或切到管理后台配置地图、距离和广告屏保。", fullscreen=True)
    write(research, "trail-checkin", surface="research")

    # Apply the shared shell to any other published versions that are reached by old URLs.
    current_pages = {fitness, backlog, landscape_screen.split("#")[0], admin_path, tracking, trail, research}
    for directory, project in (("demos", "fitness"), ("projects/landscape", "landscape")):
        for target in (OUTPUT / directory).glob("v*/index.html"):
            path = target.relative_to(OUTPUT).as_posix()
            if path not in current_pages:
                write(path, project, surface="archive")
    (OUTPUT / ".nojekyll").touch()
    print(f"Built {len(projects)} projects and their review pages")


if __name__ == "__main__":
    main()
