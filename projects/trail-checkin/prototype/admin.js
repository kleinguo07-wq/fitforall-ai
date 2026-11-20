"use strict";

const trailAdmin = {
  tab: "overview",
  role: "管理员",
  selectedStation: "B",
  selectedRoute: "main",
  scriptTask: "TASK-01",
  routeFilter: "all",
  recordFilter: "all",
  search: "",
  logFilter: "all",
  message: "",
  noticeId: "",
  weather: { temperature: "18°C", condition: "多云", updated: "10:30" },
  stations: ["A", "B", "C", "D"].map((id, index) => ({
    id, name: `${id} 点采集站`, route: "main", serial: `POLE-2026-00${index + 1}`,
    ip: `192.168.10.${21 + index}`, cameras: `CAM-${id}-01, CAM-${id}-02`,
    screen: `S-0${index + 1}`, screenRoute: "main", powered: true, firmware: "1.0.0",
    temperature: 36 + index, lastSeen: "10:30:00", health: "正常",
    onTime: "06:00", offTime: "22:00", version: 1,
  })),
  people: [
    { id: "U-1001", name: "晨跑者 · 林**", project: "中城绿谷", face: "已开通", ranking: true, weight: "68", registered: "2026-11-02" },
    { id: "U-1002", name: "步友 · 周**", project: "中城绿谷", face: "已开通", ranking: true, weight: "", registered: "2026-11-05" },
    { id: "U-1003", name: "步友 · 陈**", project: "中城绿谷", face: "待采集", ranking: false, weight: "", registered: "2026-11-08" },
  ],
  accounts: [
    { id: "admin-01", name: "公园管理员", role: "管理员", scope: "中城绿谷", active: true },
    { id: "ops-01", name: "设备运维", role: "系统运维", scope: "中城绿谷", active: true },
  ],
  selectedPerson: "demo-user",
  tasks: [
    { id: "TASK-01", name: "每日设备巡检", time: "06:10", type: "状态巡检", active: true, last: "今日 06:10 · 成功", script: "return health.checkAllStations();" },
    { id: "TASK-02", name: "待传事件重试", time: "10:30", type: "记录补传", active: true, last: "今日 10:30 · 成功", script: "return events.retryPending();" },
  ],
};

const trailAdminTabs = [
  ["overview", "运行概览"], ["devices", "跑道与设备"], ["display", "地图与屏保"],
  ["records", "记录与统计"], ["people", "注册与权限"], ["notices", "信息发布"], ["remote", "远程与任务"], ["logs", "日志"],
];

function adminEscape(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character]));
}

function adminButton(label, action, value = "", secondary = true) {
  return `<button type="button" class="ta-button${secondary ? " ta-secondary" : ""}" data-admin-action="${action}" data-value="${adminEscape(value)}">${label}</button>`;
}

function adminOptions(items, selected) {
  return items.map(([value, label]) => `<option value="${adminEscape(value)}"${value === selected ? " selected" : ""}>${adminEscape(label)}</option>`).join("");
}

function adminRouteName(id) {
  return state.trail.trails.find((item) => item.id === id)?.name || "待绑定";
}

function adminTable(headers, rows, empty = "暂无记录") {
  return `<div class="ta-table-wrap"><table class="ta-table"><thead><tr>${headers.map((header) => `<th scope="col">${header}</th>`).join("")}</tr></thead><tbody>${rows.length ? rows.map((cells) => `<tr>${cells.map((cell) => `<td>${cell}</td>`).join("")}</tr>`).join("") : `<tr><td colspan="${headers.length}" class="ta-empty">${empty}</td></tr>`}</tbody></table></div>`;
}

function adminCard(title, content, extraClass = "") {
  return `<section class="ta-card ${extraClass}"><h3>${title}</h3>${content}</section>`;
}

function adminStatus(text, warning = false) {
  return `<span class="ta-status${warning ? " ta-warning" : ""}">${adminEscape(text)}</span>`;
}

function adminData() {
  const segments = confirmedSegments().filter((item) => !item.crossing);
  const distance = segments.reduce((total, item) => total + item.distance, 0);
  const minutes = segments.reduce((total, item) => total + item.duration, 0);
  const pending = state.passes.filter((item) => !item.synced).length;
  return { segments, distance, minutes, pending };
}

function adminOverview() {
  const metrics = adminData();
  const online = trailAdmin.stations.filter((item) => item.powered && item.health === "正常").length;
  const cards = [["启用跑道", state.trail.trails.filter((item) => item.enabled).length, "条"], ["在线采集站", online, `/ ${trailAdmin.stations.length}`], ["本次有效里程", (metrics.distance / 1000).toFixed(2), "公里"], ["待传事件", metrics.pending, "条"]];
  const summary = `<div class="ta-metrics">${cards.map(([name, value, unit]) => `<div><span>${name}</span><strong>${value}<small>${unit}</small></strong></div>`).join("")}</div>`;
  const devices = trailAdmin.stations.map((item) => [adminEscape(item.name), adminEscape(adminRouteName(item.route)), adminStatus(item.powered ? item.health : "已关机", !item.powered || item.health !== "正常"), `${item.temperature}°C`, item.lastSeen, adminButton("检查", "inspect", item.id)]);
  return summary + adminCard("设备状态", adminTable(["采集站", "所属跑道", "运行状态", "设备温度", "最近心跳", "操作"], devices)) +
    `<div class="ta-columns">${adminCard("公园环境", `<dl class="ta-facts"><dt>天气</dt><dd>${trailAdmin.weather.condition}</dd><dt>室外温度</dt><dd>${trailAdmin.weather.temperature}</dd><dt>更新时间</dt><dd>${trailAdmin.weather.updated}</dd></dl><p class="ta-note">天气和设备温度为演示值，分别由天气服务及设备传感器提供。</p>${adminButton("刷新监测", "weather")}`)}${adminCard("接入监测", `<dl class="ta-facts"><dt>识别事件</dt><dd>${state.passes.length} 条</dd><dt>已确认运动段</dt><dd>${metrics.segments.length} 段</dd><dt>最近同步</dt><dd>${state.passes.some((item) => item.synced) ? "本次演示已同步" : "尚无演示事件"}</dd><dt>数据范围</dt><dd>中城绿谷 · 当前演示</dd></dl>${adminButton("查看记录", "tab", "records")}`)}</div>`;
}

function adminDevices() {
  const current = state.trail.trails.find((item) => item.id === trailAdmin.selectedRoute) || state.trail.trails[0];
  const station = trailAdmin.stations.find((item) => item.id === trailAdmin.selectedStation) || trailAdmin.stations[0];
  const screenRoute = state.trail.boards.find((item) => item.id === station.screen)?.trailId || station.screenRoute;
  const routes = state.trail.trails.map((item) => [adminEscape(item.name) + `<br><small>${adminEscape(state.trail.projects[item.project])}</small>`, `${item.length} 米`, `${adminEscape(item.lon)}, ${adminEscape(item.lat)}`, adminStatus(item.enabled ? "启用" : "停用", !item.enabled), `<div class="ta-actions">${adminButton("编辑", "route-edit", item.id)}${adminButton(item.enabled ? "停用" : "启用", "route-toggle", item.id)}</div>`]);
  const stations = trailAdmin.stations.map((item) => [adminEscape(item.name), adminEscape(adminRouteName(item.route)), `<span class="ta-code">${adminEscape(item.serial)}</span><br>${adminEscape(item.ip)}`, `${adminEscape(item.cameras)}<br><small>${adminEscape(item.screen)} → ${adminEscape(adminRouteName(item.screenRoute))}</small>`, adminButton("绑定设置", "station-edit", item.id)]);
  const routeForm = `<form data-admin-form="route" class="ta-form"><input type="hidden" name="id" value="${adminEscape(current.id)}"><div class="ta-form-grid"><label>跑道名称<input name="name" value="${adminEscape(current.name)}" required maxlength="40"></label><label>标定长度 / 米<input name="length" type="number" min="1" step="1" value="${current.length}" required></label><label>经度<input name="lng" type="number" min="-180" max="180" step="any" value="${adminEscape(current.lon)}" required></label><label>纬度<input name="lat" type="number" min="-90" max="90" step="any" value="${adminEscape(current.lat)}" required></label><label>跑道图标<select name="icon">${adminOptions([["跑步", "跑步"], ["健走", "健走"], ["滨水", "滨水"]], current.icon)}</select></label><label>所属公园<select name="project">${adminOptions(Object.entries(state.trail.projects), current.project)}</select></label></div><div class="ta-actions"><button class="ta-button" type="submit">保存跑道</button>${adminButton("新增跑道", "route-new")}</div><p class="ta-note">当前配置版本 ${current.version || 1}。变更记录保留生效时间，历史运动记录采用当时配置。</p></form>`;
  const routeChoices = state.trail.trails.map((item) => [item.id, `${state.trail.projects[item.project]} · ${item.name}`]);
  const stationForm = `<form data-admin-form="station" class="ta-form"><input name="id" type="hidden" value="${adminEscape(station.id)}"><div class="ta-form-grid"><label>采集站名称<input name="name" value="${adminEscape(station.name)}" required maxlength="30"></label><label>所属跑道<select name="route">${adminOptions(routeChoices, station.route)}</select></label><label>设备序列号<input name="serial" value="${adminEscape(station.serial)}" required></label><label>设备 IP<input name="ip" value="${adminEscape(station.ip)}" required></label><label class="ta-wide">摄像头编号（逗号分隔）<input name="cameras" value="${adminEscape(station.cameras)}" required></label><label>排行榜屏编号<input name="screen" value="${adminEscape(station.screen)}" required></label><label>该屏展示跑道<select name="screenRoute">${adminOptions(routeChoices, screenRoute)}</select></label></div><button class="ta-button" type="submit">保存设备绑定</button><p class="ta-note">同一杆含采集站与排行榜屏两个角色，采集身份和显示数据按各自绑定。绑定版本 ${station.version}。</p></form>`;
  const boards = state.trail.boards.map((item) => `<label>${adminEscape(item.id)} · ${adminEscape(item.label)}<select data-admin-change="board-trail" data-board="${adminEscape(item.id)}">${adminOptions(routeChoices, item.trailId)}</select></label><label>${adminEscape(item.id)} 屏幕电源<select data-admin-change="board-power" data-board="${adminEscape(item.id)}">${adminOptions([["on", "开启"], ["off", "关闭"]], item.screenOn === false ? "off" : "on")}</select></label>`).join("");
  return adminCard("跑道管理", adminTable(["名称", "长度", "定位坐标", "状态", "操作"], routes) + routeForm) + adminCard("采集站、摄像头与排行榜屏", adminTable(["采集站", "所属跑道", "设备标识", "摄像头 / 排行榜屏归属", "操作"], stations) + stationForm) + adminCard("排行榜屏数据范围", `<div class="ta-form ta-form-grid">${boards}</div><p class="ta-note">选择后立即应用到对应屏的演示绑定。切换右侧排行榜屏可检查其所属跑道。</p>`);
}

function adminDisplay() {
  const template = document.createElement("template");
  template.innerHTML = legacyAdminScreen();
  const content = template.content.querySelector(".admin-content");
  return `<fieldset class="ta-legacy" ${trailAdmin.role === "只读运营" ? "disabled" : ""}>${content ? content.innerHTML : ""}</fieldset>`;
}

function adminRecords() {
  const metrics = adminData();
  const events = [...state.trail.passHistory, ...state.passes];
  const filtered = events.filter((item) => trailAdmin.recordFilter === "all" || (trailAdmin.recordFilter === "pending" ? !item.synced : item.synced));
  const passes = filtered.map((item) => [adminEscape(item.id), adminEscape(item.user), `${adminEscape(adminRouteName(item.trailId))} · ${adminEscape(item.point)} 点`, clockTime(item.minute), adminStatus(item.synced ? "已同步" : "待同步", !item.synced)]);
  const workouts = demoWorkoutRecords();
  const today = workouts.filter((item) => item.trailId === activeTrail().id && item.date === demoDate());
  const turns = metrics.segments.filter((segment, index) => {
    const previous = metrics.segments[index - 1];
    return previous?.user === segment.user && previous.from === segment.to && previous.to === segment.from;
  }).length;
  const paths = metrics.segments.map((item) => item.label).join("、") || "暂无";
  const behavior = `<dl class="ta-facts"><dt>本次有效路段</dt><dd>${paths}</dd><dt>本次同段折返</dt><dd>${turns} 次</dd><dt>演示账号今日完成</dt><dd>${today.length} 趟（当前步道）</dd></dl>`;
  const segments = workouts.map((item) => [adminEscape(item.date), adminEscape(state.trail.projects[item.project]), adminEscape(item.place || adminRouteName(item.trailId)), `${item.distance} 米`, `${item.duration} 分钟`, item.distance > 0 ? `${(item.duration / item.distance * 1000).toFixed(2)} 分/公里` : "—", item.energy == null ? "—" : `${item.energy} 千卡（估算）`]);
  const filter = `<div class="ta-toolbar"><label>同步状态<select data-admin-change="record-filter">${adminOptions([["all", "全部"], ["synced", "已同步"], ["pending", "待同步"]], trailAdmin.recordFilter)}</select></label>${adminButton("重试待传", "sync")}${adminButton("导出当前事件", "export-events")}</div>`;
  const stats = `<div class="ta-metrics ta-three"><div><span>有效运动距离</span><strong>${metrics.distance}<small>米</small></strong></div><div><span>有效运动用时</span><strong>${metrics.minutes}<small>分钟</small></strong></div><div><span>完成运动段</span><strong>${metrics.segments.length}<small>段</small></strong></div></div>`;
  return adminCard("识别记录", filter + adminTable(["事件 ID", "脱敏身份", "采集点", "经过时间", "状态"], passes, "使用场景模拟产生经过事件，即可核对同步与结算。")) + adminCard("运动数据与统计分析", stats + behavior + adminTable(["日期", "公园", "跑道", "里程", "用时", "平均配速", "估算能量"], segments, "跨点形成有效路段后显示运动数据。") + `<p class="ta-note">上方统计为本次经过记录，明细包含演示账号各公园历史。过街段单列用于关联，能量值随个人资料和统一口径显示。</p>`);
}

function adminPeople() {
  const profile = state.trail.profile;
  const registeredProjects = Object.keys(state.trail.registrations);
  const currentUser = {
    id: "demo-user", name: profile.name, weight: profile.weight,
    project: registeredProjects.map((id) => state.trail.projects[id]).join("、") || "尚未注册",
    face: registeredProjects.length ? "已开通" : "待采集",
    ranking: registeredProjects.some((id) => state.trail.rankedProjects[id]),
  };
  const allPeople = [currentUser, ...trailAdmin.people];
  const person = allPeople.find((item) => item.id === trailAdmin.selectedPerson) || currentUser;
  const people = allPeople.filter((item) => `${item.id} ${item.name}`.includes(trailAdmin.search)).map((item) => [adminEscape(item.id), adminEscape(item.name), adminEscape(item.project), adminStatus(item.face, item.face !== "已开通"), item.ranking ? "已授权" : "未授权", adminButton("查看资料", "person-edit", item.id)]);
  const peopleForm = `<form data-admin-form="person" class="ta-form"><input name="id" type="hidden" value="${person.id}"><div class="ta-form-grid"><label>脱敏昵称<input name="name" value="${adminEscape(person.name)}" required maxlength="30"></label><label>体重 / 公斤<input name="weight" type="number" min="10" max="300" step="0.1" value="${person.weight}" placeholder="用户自愿提供"></label><label>人脸记录状态<input value="${person.face}" readonly></label><label>上榜状态<input value="${person.ranking ? "用户已授权" : "用户未授权"}" readonly></label></div><button class="ta-button" type="submit">保存基础资料</button><p class="ta-note">所属项目由注册来源记录。人脸和上榜授权由本人操作，管理账号查看状态。</p></form>`;
  const accounts = trailAdmin.accounts.map((item) => [adminEscape(item.name), adminEscape(item.role), adminEscape(item.scope), adminStatus(item.active ? "启用" : "停用", !item.active), adminButton(item.active ? "停用账号" : "启用账号", "account-toggle", item.id)]);
  const permissions = `<form data-admin-form="account" class="ta-form"><div class="ta-form-grid"><label>账号名称<input name="name" required maxlength="30" placeholder="新增工作人员"></label><label>角色<select name="role">${adminOptions([["管理员", "管理员 · 配置和数据"], ["只读运营", "只读运营 · 数据查询"], ["系统运维", "系统运维 · 设备与任务"]], "只读运营")}</select></label><label>管理范围<input value="中城绿谷" readonly></label></div><button class="ta-button" type="submit">新增管理账号</button></form>`;
  const registrations = Object.values(state.trail.registrations).map((item) => [adminEscape(state.trail.profile.name), adminEscape(state.trail.projects[item.project]), adminEscape(adminRouteName(item.trailId)), adminEscape(({ pole: "打卡杆", board: "排行榜屏" }[item.from] || item.from || "杆屏注册")), adminStatus("已注册")]);
  const pending = state.trail.pendingRegistration;
  const registerState = pending ? `<p class="ta-note">当前待注册来源为 ${adminEscape(state.trail.projects[pending.project])} · ${adminEscape(adminRouteName(pending.trailId))}。</p>` : "";
  return adminCard("当前用户的项目注册归属", adminTable(["账号", "所属项目", "来源跑道", "注册入口", "状态"], registrations, "当前演示用户尚未完成项目注册。可从杆屏注册入口完成模拟。") + registerState) + adminCard("注册信息管理", `<div class="ta-toolbar"><label>搜索身份或昵称<input data-admin-change="people-search" value="${adminEscape(trailAdmin.search)}" placeholder="输入后按回车或移开焦点"></label></div>` + adminTable(["用户标识", "昵称", "所属项目", "人脸记录", "公开排行", "操作"], people) + peopleForm) + adminCard("管理账号与权限", adminTable(["账号", "角色", "公园范围", "状态", "操作"], accounts) + permissions);
}

function adminNotices() {
  const notices = state.trail.notices;
  const labels = { published: "已发布", draft: "草稿", off: "已停用" };
  const rows = notices.map((item) => [adminEscape(item.title), adminEscape(state.trail.projects[item.project]), adminStatus(labels[item.status] || "待发布", item.status !== "published"), `${adminEscape(item.start || "即刻")}<br>${adminEscape(item.end || "长期")}`, `<div class="ta-actions">${adminButton(item.status === "published" ? "停用" : "发布", "notice-toggle", item.id)}${adminButton("编辑", "notice-edit", item.id)}</div>`]);
  const current = notices.find((item) => item.id === trailAdmin.noticeId);
  const form = `<form data-admin-form="notice" class="ta-form"><input name="id" type="hidden" value="${current ? adminEscape(current.id) : ""}"><div class="ta-form-grid"><label>信息标题<input name="title" value="${current ? adminEscape(current.title) : ""}" maxlength="40" required></label><label>所属项目<select name="project">${adminOptions(Object.entries(state.trail.projects), current?.project || activeTrail().project)}</select></label><label>开始时间<input type="datetime-local" name="start" value="${current ? adminEscape(current.start) : ""}"></label><label>结束时间<input type="datetime-local" name="end" value="${current ? adminEscape(current.end) : ""}"></label></div><label>发布内容<textarea name="body" rows="3" maxlength="500" required>${current ? adminEscape(current.body) : ""}</textarea></label><div class="ta-actions"><button class="ta-button" name="status" value="published" type="submit">保存并发布</button><button class="ta-button ta-secondary" name="status" value="draft" type="submit">保存草稿</button>${adminButton("新增信息", "notice-new")}</div></form>`;
  return adminCard("信息发布与监测", adminTable(["标题", "公园", "发布状态", "展示时段", "操作"], rows) + form + `<p class="ta-note">发布后按所属公园和展示时段提供给杆屏及小程序。停用即时结束公开展示。</p>`);
}

function adminRemote() {
  const selected = trailAdmin.stations.find((item) => item.id === trailAdmin.selectedStation) || trailAdmin.stations[0];
  const devices = trailAdmin.stations.map((item) => [adminEscape(item.name), adminStatus(item.powered ? "开机" : "关机", !item.powered), item.firmware, `<div class="ta-actions">${adminButton(item.powered ? "关机" : "开机", "power", item.id)}${adminButton("重启", "reboot", item.id)}${adminButton("升级", "upgrade", item.id)}</div>`]);
  const sharedControl = state.trail.control;
  const voiceConfig = state.trail.voice;
  const switches = `<div class="ta-toolbar">${adminButton(sharedControl.screenOn ? "关闭预览屏幕" : "开启预览屏幕", "screen-toggle")}${adminButton(sharedControl.collecting ? "暂停采集" : "恢复采集", "collection-toggle")}<span>${adminEscape(sharedControl.receipt || "控制当前预览设备，屏幕和采集可分别设置")}</span></div>`;
  const control = `<div class="ta-toolbar"><label>控制设备<select data-admin-change="station">${adminOptions(trailAdmin.stations.map((item) => [item.id, item.name]), selected.id)}</select></label></div><form data-admin-form="remote" class="ta-form"><input name="id" type="hidden" value="${selected.id}"><div class="ta-form-grid"><label>每日开机<input name="on" type="time" value="${selected.onTime}" required></label><label>每日关机<input name="off" type="time" value="${selected.offTime}" required></label><label>屏幕显示内容<select name="page">${adminOptions([["auto", "自动展示"], ["map", "点位地图"], ["rank", "运动榜"], ["notice", "公园公告"], ["ad", "广告屏保"]], sharedControl.content)}</select></label></div><button class="ta-button" type="submit">下发定时与显示配置</button></form>`;
  const voice = `<form data-admin-form="voice" class="ta-form"><label class="ta-check"><input type="checkbox" name="enabled" ${voiceConfig.enabled ? "checked" : ""}> 启用通用语音播报</label><div class="ta-form-grid"><label>开始时间<input name="start" type="time" value="${voiceConfig.start}" required></label><label>结束时间<input name="end" type="time" value="${voiceConfig.end}" required></label><label>播报触发<select name="event">${adminOptions([["pass", "经过点位"], ["arrival", "到达提醒"], ["manual", "手动试播"]], voiceConfig.event)}</select></label><label>音量 / %<input name="volume" type="number" min="0" max="100" value="${state.settings.volume}" required></label></div><label>播报内容<textarea name="content" rows="2" maxlength="160" required>${adminEscape(voiceConfig.text)}</textarea></label><div class="ta-actions"><button class="ta-button" type="submit">保存语音配置</button>${adminButton("演示试播", "voice-test")}</div></form>`;
  const tasks = trailAdmin.tasks.map((item) => [adminEscape(item.name), `${adminEscape(item.type)} · 每日 ${item.time}`, adminStatus(item.active ? "启用" : "停用", !item.active), adminEscape(item.last), `<div class="ta-actions">${adminButton("执行一次", "task-run", item.id)}${adminButton(item.active ? "停用" : "启用", "task-toggle", item.id)}</div>`]);
  const taskForm = `<form data-admin-form="task" class="ta-form"><div class="ta-form-grid"><label>任务名称<input name="name" maxlength="30" required></label><label>每日执行时间<input name="time" type="time" value="06:10" required></label><label>任务类型<select name="type">${adminOptions([["状态巡检", "状态巡检"], ["记录补传", "记录补传"], ["配置同步", "配置同步"]], "状态巡检")}</select></label></div><button class="ta-button" type="submit">新增定时任务</button></form>`;
  const selectedTask = trailAdmin.tasks.find((item) => item.id === trailAdmin.scriptTask) || trailAdmin.tasks[0];
  const script = `<details class="ta-script"><summary>服务端脚本设置</summary><p class="ta-note">由系统运维角色编辑。保存脚本文本、版本和操作日志后，可模拟执行结果。</p><form data-admin-form="script" class="ta-form"><label>任务<select name="task" data-admin-change="script-task">${adminOptions(trailAdmin.tasks.map((item) => [item.id, item.name]), selectedTask.id)}</select></label><label>脚本<textarea name="script" rows="4" ${trailAdmin.role !== "系统运维" ? "disabled" : ""}>${adminEscape(selectedTask.script)}</textarea></label><button class="ta-button" type="submit" ${trailAdmin.role !== "系统运维" ? "disabled" : ""}>保存任务脚本</button></form></details>`;
  return adminCard("设备远程控制与升级", adminTable(["设备", "电源", "App 版本", "操作"], devices) + switches + control) + adminCard("语音播报管理", voice) + adminCard("定时任务", adminTable(["任务", "执行设置", "状态", "最近结果", "操作"], tasks) + taskForm + script);
}

function adminLogs() {
  const rows = state.trail.logs.filter((item) => trailAdmin.logFilter === "all" || item.category.replace(/日志$/, "") === trailAdmin.logFilter).map((item) => [adminEscape(item.time), adminEscape(item.category.replace(/日志$/, "")), adminEscape(item.target), adminEscape(item.action), adminStatus(item.result, item.result !== "成功")]);
  return adminCard("登录、操作与系统日志", `<div class="ta-toolbar"><label>日志类型<select data-admin-change="log-filter">${adminOptions([["all", "全部"], ["登录", "登录日志"], ["操作", "操作日志"], ["系统", "系统日志"]], trailAdmin.logFilter)}</select></label>${adminButton("导出日志", "export-logs")}</div>` + adminTable(["发生时间", "类型", "操作人 / 服务", "内容", "结果"], rows));
}

function adminScreen() {
  const screens = { overview: adminOverview, devices: adminDevices, display: adminDisplay, records: adminRecords, people: adminPeople, notices: adminNotices, remote: adminRemote, logs: adminLogs };
  return `<article class="shared-admin trail-admin"><aside class="admin-menu"><strong>社会体育管理后台</strong><small>内容管理</small><a href="../../landscape/v1.0/admin.html#videos">运动视频</a><a href="../../landscape/v1.0/admin.html#notice">公告设置</a><span aria-current="page">智慧步道</span><small class="ta-menu-label">智慧步道管理</small>${trailAdminTabs.map(([id, label]) => `<button type="button" data-admin-action="tab" data-value="${id}" aria-current="${trailAdmin.tab === id ? "page" : "false"}">${label}</button>`).join("")}</aside><div class="admin-content ta-content"><header class="ta-header"><div><p>智慧步道</p><h2>${trailAdminTabs.find(([id]) => id === trailAdmin.tab)[1]}</h2></div><label>当前角色<select data-admin-change="role">${adminOptions([["管理员", "管理员"], ["只读运营", "只读运营"], ["系统运维", "系统运维"]], trailAdmin.role)}</select></label></header><div class="ta-scope"><label>管理跑道<select data-admin-change="active-trail">${adminOptions(state.trail.trails.map((item) => [item.id, `${state.trail.projects[item.project]} · ${item.name}`]), state.trail.activeTrail)}</select></label></div><p class="ta-demo-note">评审原型 · 配置、命令和监测均为浏览器内模拟。</p><div class="ta-feedback" role="status">${adminEscape(trailAdmin.message)}</div>${screens[trailAdmin.tab]()}</div></article>`;
}

function adminLog(content, type = "操作", result = "成功") {
  logDemo(type.endsWith("日志") ? type : `${type}日志`, content, trailAdmin.role, result);
}

function adminDone(message, log = true) {
  trailAdmin.message = message;
  if (log) adminLog(message);
  render();
}

function adminCanEdit() {
  if (trailAdmin.role !== "只读运营") return true;
  adminDone("当前角色可查看数据，请切换为管理员或系统运维评审配置操作。", false);
  return false;
}

function adminExport(filename, headers, rows) {
  const content = "\uFEFF" + [headers, ...rows].map((row) => row.map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`).join(",")).join("\r\n");
  const url = URL.createObjectURL(new Blob([content], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function handleAdminAction(button) {
  const action = button.dataset.adminAction;
  if (!action) return false;
  const value = button.dataset.value;
  if (action === "tab") {
    trailAdmin.tab = value;
    trailAdmin.message = "";
    render();
    return true;
  }
  const item = trailAdmin.stations.find((station) => station.id === value);
  const task = trailAdmin.tasks.find((entry) => entry.id === value);
  const editable = !["inspect", "weather", "route-edit", "station-edit", "person-edit", "export-events", "export-logs"].includes(action);
  if (editable && !adminCanEdit()) return true;
  switch (action) {
    case "inspect":
      item.lastSeen = new Date().toLocaleTimeString("zh-CN", { hour12: false });
      adminDone(`${item.name}检查完成，${item.powered ? "运行正常" : "设备已关机"}。`);
      break;
    case "weather":
      trailAdmin.weather.updated = new Date().toLocaleTimeString("zh-CN", { hour12: false });
      adminDone("天气和设备状态已刷新，当前为演示数据。", false);
      break;
    case "route-edit":
      trailAdmin.selectedRoute = value;
      render();
      break;
    case "route-toggle": {
      const current = state.trail.trails.find((entry) => entry.id === value);
      current.enabled = !current.enabled;
      current.version = (current.version || 1) + 1;
      adminDone(`${current.name}已${current.enabled ? "启用" : "停用"}，配置版本 ${current.version}。`);
      break;
    }
    case "route-new": {
      const id = `route-${Date.now()}`;
      state.trail.trails.push({ id, project: activeTrail().project, name: "新建跑道", length: 1000, lon: 121.435, lat: 31.172, icon: "跑步", enabled: false, version: 1 });
      trailAdmin.selectedRoute = id;
      adminDone("已新增跑道，请完善名称、位置和长度后保存。", false);
      break;
    }
    case "station-edit":
      trailAdmin.selectedStation = value;
      render();
      break;
    case "person-edit":
      trailAdmin.selectedPerson = value;
      render();
      break;
    case "account-toggle": {
      const account = trailAdmin.accounts.find((entry) => entry.id === value);
      account.active = !account.active;
      adminDone(`${account.name}已${account.active ? "启用" : "停用"}。`);
      break;
    }
    case "power":
      item.powered = !item.powered;
      if (route().points.includes(item.id)) { state.point = item.id; state.mapPoint = item.id; }
      if (item.id === state.point) {
        state.trail.control.screenOn = item.powered;
        state.trail.control.collecting = item.powered;
      }
      adminDone(`${item.name}${item.powered ? "开机" : "关机"}命令已完成（模拟）。`);
      break;
    case "reboot":
      item.powered = true;
      if (route().points.includes(item.id)) { state.point = item.id; state.mapPoint = item.id; }
      if (item.id === state.point) {
        state.trail.control.screenOn = true;
        state.trail.control.collecting = true;
      }
      adminDone(`${item.name}已重启并重新上报（模拟）。`);
      break;
    case "upgrade":
      item.firmware = "1.0.1";
      if (route().points.includes(item.id)) { state.point = item.id; state.mapPoint = item.id; }
      if (item.id === state.point) state.trail.control.version = item.firmware;
      adminDone(`${item.name}升级至 1.0.1（模拟），操作结果已归档。`);
      break;
    case "sync": {
      const count = sync();
      adminDone(`已同步 ${count} 条事件${state.condition === "offline" ? "，设备离线，请恢复网络后重试" : ""}。`);
      break;
    }
    case "voice-test":
      state.trail.lastVoice = state.trail.voice.enabled ? state.trail.voice.text : "语音播报已关闭";
      adminDone(`试播结果：${state.trail.lastVoice}（模拟）。`);
      break;
    case "task-run":
      if (task.type === "记录补传") sync();
      task.last = "刚刚 · 成功";
      if (task.type === "记录补传" && state.condition !== "online") {
        task.last = "刚刚 · 待网络恢复";
        adminLog(`${task.name}等待网络恢复`, "系统", "待执行");
        adminDone(`${task.name}已保留待传事件，请恢复网络后重试。`, false);
        break;
      }
      adminDone(`${task.name}执行成功（模拟）。`, false);
      adminLog(`${task.name}执行完成`, "系统");
      break;
    case "task-toggle":
      task.active = !task.active;
      adminDone(`${task.name}已${task.active ? "启用" : "停用"}。`);
      break;
    case "screen-toggle":
      state.trail.control.screenOn = !state.trail.control.screenOn;
      state.trail.control.receipt = `屏幕已${state.trail.control.screenOn ? "开启" : "关闭"}`;
      adminDone(`${state.trail.control.receipt}（模拟）。`);
      break;
    case "collection-toggle":
      state.trail.control.collecting = !state.trail.control.collecting;
      state.trail.control.receipt = `采集已${state.trail.control.collecting ? "开启" : "暂停"}`;
      adminDone(`${state.trail.control.receipt}（模拟）。`);
      break;
    case "notice-new":
      trailAdmin.noticeId = "";
      render();
      break;
    case "notice-edit":
      trailAdmin.noticeId = value;
      render();
      break;
    case "notice-toggle": {
      const notice = state.trail.notices.find((entry) => entry.id === value);
      notice.status = notice.status === "published" ? "off" : "published";
      adminDone(`${notice.title}已${notice.status === "published" ? "发布" : "停用"}。`);
      break;
    }
    case "export-events":
      adminExport("智慧步道演示事件.csv", ["事件ID", "用户", "点位", "经过时间", "同步状态"], state.passes.map((entry) => [entry.id, entry.user, entry.point, clockTime(entry.minute), entry.synced ? "已同步" : "待同步"]));
      adminDone("当前演示事件已导出。", false);
      break;
    case "export-logs":
      adminExport("智慧步道演示日志.csv", ["时间", "类型", "操作人", "内容", "结果"], state.trail.logs.map((entry) => [entry.time, entry.category, entry.target, entry.action, entry.result]));
      adminDone("当前演示日志已导出。", false);
      break;
    default:
      return false;
  }
  return true;
}

function handleAdminSubmit(form, submitter) {
  const name = form.dataset.adminForm;
  if (!name) return false;
  if (!adminCanEdit() || !form.reportValidity()) return true;
  const data = new FormData(form);
  const read = (key) => String(data.get(key) ?? "").trim();
  switch (name) {
    case "route": {
      const item = state.trail.trails.find((entry) => entry.id === read("id"));
      const routeName = read("name");
      if (!routeName) { adminDone("请填写跑道名称。", false); break; }
      const nextLength = Number(read("length"));
      if (!Number.isFinite(nextLength) || nextLength < 1 || !state.trail.projects[read("project")]) { adminDone("请填写有效的距离和所属公园。", false); break; }
      if (item.id === state.trail.activeTrail && (item.length !== nextLength || item.project !== read("project"))) {
        archiveDemoJourney();
        state.configuredDistances = {};
      }
      Object.assign(item, { name: routeName, length: Number(read("length")), lon: Number(read("lng")), lat: Number(read("lat")), project: read("project"), icon: read("icon"), version: (item.version || 1) + 1 });
      adminDone(`${item.name}已保存，配置版本 ${item.version}。`);
      break;
    }
    case "station": {
      const item = trailAdmin.stations.find((entry) => entry.id === read("id"));
      if (["name", "serial", "ip", "cameras", "screen"].some((key) => !read(key))) { adminDone("请补齐设备和摄像头标识。", false); break; }
      if (trailAdmin.stations.some((entry) => entry.id !== item.id && (entry.serial === read("serial") || entry.screen === read("screen")))) { adminDone("设备序列号或排行榜屏编号已被其他采集站使用。", false); break; }
      Object.assign(item, { name: read("name"), route: read("route"), serial: read("serial"), ip: read("ip"), cameras: read("cameras"), screen: read("screen"), screenRoute: read("screenRoute"), version: item.version + 1 });
      const board = state.trail.boards.find((entry) => entry.id === item.screen);
      if (board) Object.assign(board, { trailId: item.screenRoute, label: `${item.name}排行榜屏` });
      else state.trail.boards.push({ id: item.screen, trailId: item.screenRoute, label: `${item.name}排行榜屏` });
      adminDone(`${item.name}绑定已保存，采集与排行榜屏分别使用其配置跑道。`);
      break;
    }
    case "person": {
      const item = trailAdmin.people.find((entry) => entry.id === read("id"));
      if (!read("name")) { adminDone("请填写昵称。", false); break; }
      if (read("id") === "demo-user") {
        state.trail.profile.name = read("name");
        state.trail.profile.weight = read("weight");
      } else Object.assign(item, { name: read("name"), weight: read("weight") });
      adminDone(`${read("id")}基础资料已保存。`);
      break;
    }
    case "account":
      if (!read("name")) { adminDone("请填写账号名称。", false); break; }
      trailAdmin.accounts.push({ id: `staff-${Date.now()}`, name: read("name"), role: read("role"), scope: "中城绿谷", active: true });
      adminDone(`${read("name")}已加入中城绿谷管理范围。`);
      break;
    case "remote": {
      if (read("on") === read("off")) { adminDone("每日开机与关机时间需不同。", false); break; }
      const item = trailAdmin.stations.find((entry) => entry.id === read("id"));
      item.onTime = read("on");
      item.offTime = read("off");
      state.trail.control.content = read("page");
      state.trail.control.schedule = `${item.onTime}–${item.offTime}`;
      state.trail.control.receipt = `已保存 ${item.name} 定时与显示配置`;
      adminDone(`${item.name}每日 ${item.onTime} 开机、${item.offTime} 关机，显示配置已下发（模拟）。`);
      break;
    }
    case "voice":
      if (!read("content")) { adminDone("请填写播报内容。", false); break; }
      state.trail.voice = { ...state.trail.voice, enabled: data.has("enabled"), start: read("start"), end: read("end"), event: read("event"), text: read("content") };
      state.settings.volume = Number(read("volume"));
      adminDone("语音播报配置已保存，经过点位时按配置时段播报通用提示。");
      break;
    case "notice": {
      if (!read("title") || !read("body")) { adminDone("请填写信息标题和发布内容。", false); break; }
      if (read("start") && read("end") && read("end") <= read("start")) { adminDone("结束时间须晚于开始时间。", false); break; }
      const existing = state.trail.notices.find((entry) => entry.id === read("id"));
      const notice = { id: existing?.id || `notice-${Date.now()}`, title: read("title"), body: read("body"), project: read("project"), start: read("start"), end: read("end"), status: submitter?.value === "draft" ? "draft" : "published" };
      if (existing) Object.assign(existing, notice);
      else state.trail.notices.push(notice);
      trailAdmin.noticeId = notice.id;
      adminDone(`${notice.title}已${notice.status === "published" ? "保存并发布" : "保存为草稿"}。`);
      break;
    }
    case "task":
      if (!read("name")) { adminDone("请填写任务名称。", false); break; }
      trailAdmin.tasks.push({ id: `TASK-${Date.now()}`, name: read("name"), time: read("time"), type: read("type"), active: true, last: "尚未执行", script: "return tasks.run();" });
      adminDone(`${read("name")}已保存为每日 ${read("time")} 执行。`);
      break;
    case "script": {
      if (trailAdmin.role !== "系统运维") return true;
      const item = trailAdmin.tasks.find((entry) => entry.id === read("task"));
      item.script = read("script");
      adminDone(`${item.name}的服务端脚本文本已保存（模拟）。`);
      break;
    }
    default:
      return false;
  }
  return true;
}

function handleAdminChange(event) {
  const kind = event.target.dataset.adminChange;
  if (!kind) return false;
  const value = event.target.value;
  const fields = { "record-filter": "recordFilter", "people-search": "search", "log-filter": "logFilter", station: "selectedStation" };
  if (kind === "role") {
    trailAdmin.role = value;
    trailAdmin.message = `已切换为${value}评审权限。`;
    adminLog(`以${value}进入后台`, "登录");
  } else if (kind === "active-trail") {
    selectDemoTrail(value);
    trailAdmin.selectedRoute = value;
  } else if (kind === "board-trail") {
    if (!adminCanEdit()) return true;
    const board = state.trail.boards.find((item) => item.id === event.target.dataset.board);
    board.trailId = value;
    trailAdmin.stations.filter((item) => item.screen === board.id).forEach((item) => { item.screenRoute = value; });
    adminLog(`${board.label}已绑定${adminRouteName(value)}`);
  } else if (kind === "board-power") {
    if (!adminCanEdit()) return true;
    const board = state.trail.boards.find((item) => item.id === event.target.dataset.board);
    board.screenOn = value === "on";
    adminLog(`${board.label}已${board.screenOn ? "开屏" : "关屏"}`);
  } else if (kind === "station") {
    trailAdmin.selectedStation = value;
    if (route().points.includes(value)) {
      state.point = value;
      state.mapPoint = value;
    }
  } else if (kind === "script-task") {
    trailAdmin.scriptTask = value;
  } else if (fields[kind]) {
    trailAdmin[fields[kind]] = value;
  }
  render();
  return true;
}
