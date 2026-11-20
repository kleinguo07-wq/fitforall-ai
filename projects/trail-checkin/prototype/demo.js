"use strict";

const routes = {
  four: {
    points: ["A", "B", "C", "D"],
    distances: [320, 120, 440],
    crossing: 1,
    journeys: {
      through: { name: "全程通过 A → B → C → D", points: ["A", "B", "C", "D"], minutes: [0, 4, 6, 10] },
      return: { name: "同侧往返 A → B → A", points: ["A", "B", "A"], minutes: [0, 4, 8] },
      missed: { name: "漏点 A → C → D", points: ["A", "C", "D"], minutes: [0, 6, 10] },
      crossing: { name: "仅过街 B → C", points: ["B", "C"], minutes: [4, 6] },
      mixed: { name: "不同用户分别经过 A、B", points: ["A", "B"], minutes: [0, 4], users: ["演示用户", "另一用户"] },
    },
  },
  two: {
    points: ["A", "D"],
    distances: [880],
    crossing: -1,
    journeys: {
      through: { name: "全程通过 A → D", points: ["A", "D"], minutes: [0, 10] },
      return: { name: "全程往返 A → D → A", points: ["A", "D", "A"], minutes: [0, 10, 20] },
    },
  },
};

const conditions = {
  online: { label: "正常运行", sign: "可自动记录", camera: "正常", network: "在线" },
  offline: { label: "断网，可本地记录", sign: "记录稍后同步", camera: "正常", network: "离线" },
  fault: { label: "摄像头故障", sign: "本点位暂停记录", camera: "故障", network: "在线" },
  unbound: { label: "点位调试中", sign: "点位调试中", camera: "待自检", network: "在线" },
};

const initialView = new URLSearchParams(location.search).get("view");
const state = {
  view: ["public", "board", "ops", "admin", "mini"].includes(initialView) ? initialView : "public",
  trail: createDemoTrailState(),
  miniPage: "today",
  polePage: "map",
  mapPoint: "B",
  rankPeriod: "today",
  faceVerified: false,
  get ranked() { return Boolean(this.trail.rankedProjects[activeTrail().project]); },
  set ranked(value) { this.trail.rankedProjects[activeTrail().project] = value; },
  staff: false,
  settings: { network: "以太网", volume: 60, brightness: 85 },
  configuredDistances: {},
  configMessage: "",
  settingsMessage: "",
  settingsDraft: null,
  park: { map: null, ad: null, adEnabled: false, idleSeconds: 60 },
  route: "four",
  journey: "through",
  point: "B",
  condition: "online",
  passes: [],
  setup: "unbound",
  testCount: 0,
  notice: "选择场景后，模拟同一账号经过各点位。",
};

const preview = document.getElementById("preview");
const trailSelect = document.getElementById("demo-trail");
const routeSelect = document.getElementById("route");
const journeySelect = document.getElementById("journey");
const pointSelect = document.getElementById("point");
const conditionSelect = document.getElementById("condition");
const nextButton = document.getElementById("next");
const repeatButton = document.getElementById("repeat");
const feedback = document.getElementById("feedback");

function route() {
  const selected = routes[state.route];
  const distance = activeTrail().length || 880;
  const defaults = distance === 880 ? selected.distances : selected.distances.map((meters) => Math.max(1, Math.round(meters * distance / 880)));
  return { ...selected, distances: state.configuredDistances[state.route] || defaults };
}

function journey() {
  return route().journeys[state.journey];
}

function clockTime(minute) {
  const time = 480 + minute;
  return [Math.floor(time / 60), time % 60].map((number) => String(number).padStart(2, "0")).join(":");
}

function canRecord() {
  return activeTrail().enabled && state.trail.control.collecting && ["online", "offline"].includes(state.condition);
}

function setOptions(select, entries, value) {
  select.replaceChildren(...entries.map(([key, label]) => new Option(label, key)));
  select.value = value;
}

function deviceOps() {
  const info = conditions[state.condition];
  const sent = state.passes.filter((pass) => pass.synced);
  const pending = state.passes.length - sent.length;
  const last = sent.at(-1);
  if (state.condition === "unbound") {
    return `<article class="surface"><p class="eyebrow">授权运维 · 演示</p><h2>首次安装</h2>
      <dl class="facts"><dt>绑定目标</dt><dd>${escapeDemo(activeTrail().name)} · ${state.point} 点</dd><dt>摄像头</dt><dd>本地采集模块</dd><dt>当前进度</dt><dd>${{ unbound: "等待绑定", bound: "已绑定，等待自检", checked: "自检通过，等待启用" }[state.setup]}</dd></dl>
      <button type="button" class="button secondary" data-action="bind" ${state.setup !== "unbound" ? "disabled" : ""}>绑定并拉取配置</button>
      <button type="button" class="button secondary" data-action="check" ${state.setup !== "bound" ? "disabled" : ""}>设备自检</button>
      <button type="button" class="button primary" data-action="enable" ${state.setup !== "checked" ? "disabled" : ""}>启用并返回首页</button>
    </article>`;
  }
  return `<article class="surface"><p class="eyebrow">授权运维 · 演示</p><h2>${state.point} 点设备状态</h2>
    <dl class="facts"><dt>配置</dt><dd>${escapeDemo(activeTrail().name)} · ${state.route === "four" ? "四杆" : "两杆"} · 已加载</dd>
    <dt>摄像头</dt><dd>${info.camera}</dd><dt>网络</dt><dd>${info.network}</dd><dt>校时</dt><dd>正常（演示）</dd>
    <dt>设备箱体</dt><dd>${state.condition === "offline" ? "上次上报 39 ℃" : "39 ℃（模拟）"}</dd>
    <dt>园区天气</dt><dd>多云 · 17 ℃（模拟天气源）</dd>
    <dt>运行版本</dt><dd>${escapeDemo(state.trail.control.version)}</dd>
    <dt>最近已同步</dt><dd>${last ? clockTime(last.minute) : "暂无"}</dd><dt>待传事件</dt><dd>${pending} 条</dd>
    <dt>测试经过</dt><dd>${state.testCount} 次，仅用于调试</dd></dl>
    <button type="button" class="button secondary" data-action="test" ${canRecord() ? "" : "disabled"}>测试一次经过</button>
    <button type="button" class="button secondary" data-action="retry">重试同步</button>
    <button type="button" class="button primary" data-action="home">返回市民首页</button>
  </article>`;
}

function confirmedSegments() {
  const { points, crossing, distances } = route();
  const previousByUser = new Map();
  const segments = [];
  const ordered = state.passes.filter((pass) => pass.synced).sort((a, b) => a.minute - b.minute);
  for (const pass of ordered) {
    const previous = previousByUser.get(pass.user);
    previousByUser.set(pass.user, pass);
    if (!previous) continue;
    const from = points.indexOf(previous.point);
    const to = points.indexOf(pass.point);
    if (Math.abs(from - to) !== 1 || pass.minute <= previous.minute) continue;
    const index = Math.min(from, to);
    segments.push({
      user: pass.user,
      from: previous.point,
      to: pass.point,
      label: `${previous.point} → ${pass.point}`,
      distance: distances[index],
      duration: pass.minute - previous.minute,
      crossing: index === crossing,
    });
  }
  return segments;
}

const views = { public: publicScreen, board: rankingScreen, ops: deviceOps, admin: adminScreen, mini: miniScreen };

function render() {
  document.querySelector(".workbench").dataset.surface = state.view;
  for (const button of document.querySelectorAll("[data-view]")) {
    button.setAttribute("aria-pressed", String(button.dataset.view === state.view));
  }
  preview.innerHTML = views[state.view]();
  drawParkMap();
  refreshIdleTimer();
  setOptions(trailSelect, state.trail.trails.map((trail) => [trail.id, `${state.trail.projects[trail.project]} · ${trail.name}`]), activeTrail().id);
  const next = journey().points[state.passes.length];
  nextButton.textContent = next ? `模拟经过 ${next} 点` : "本次演示已走完";
  nextButton.disabled = !next || !canRecord();
  repeatButton.disabled = !state.passes.length || !canRecord();
  pointSelect.value = state.point;
  conditionSelect.value = state.condition;
  feedback.textContent = state.notice;
}

function queuePass(pass) {
  if (state.passes.some((item) => item.id === pass.id)) return false;
  state.passes.push(pass);
  return true;
}

function sync() {
  if (state.condition !== "online") return 0;
  const pending = state.passes.filter((pass) => !pass.synced);
  pending.forEach((pass) => { pass.synced = true; });
  return pending.length;
}

function resetJourney() {
  state.passes = [];
  state.trail.journeyId += 1;
  state.testCount = 0;
  state.notice = "演示记录已重置。";
}

function archiveDemoJourney() {
  const completed = currentWorkout();
  if (completed) state.trail.completed.push(completed);
  state.trail.passHistory.push(...state.passes.filter((pass) => pass.synced));
  resetJourney();
}

function refreshChoices() {
  setOptions(journeySelect, Object.entries(route().journeys).map(([id, item]) => [id, item.name]), state.journey);
  setOptions(pointSelect, route().points.map((point) => [point, `${point} 点`]), state.point);
}

function selectDemoTrail(id) {
  if (id === activeTrail().id || !state.trail.trails.some((trail) => trail.id === id)) return;
  archiveDemoJourney();
  const { control, voice, lastVoice } = state.trail;
  state.trail.trailSettings[activeTrail().id] = {
    park: state.park, distances: state.configuredDistances, settings: state.settings, device: { control, voice, lastVoice },
  };
  state.trail.activeTrail = id;
  const saved = state.trail.trailSettings[id];
  state.park = saved?.park || { map: null, ad: null, adEnabled: false, idleSeconds: 60 };
  state.configuredDistances = saved?.distances || {};
  state.settings = saved?.settings || { network: "以太网", volume: 60, brightness: 85 };
  Object.assign(state.trail, saved?.device || createDemoDeviceState());
  state.settingsDraft = null;
  state.configMessage = "";
  state.mapPoint = state.point;
  if (state.polePage === "ad") state.polePage = "map";
  state.notice = `当前模拟步道为${activeTrail().name}。`;
}

trailSelect.addEventListener("change", () => {
  selectDemoTrail(trailSelect.value);
  render();
});

routeSelect.addEventListener("change", () => {
  archiveDemoJourney();
  state.route = routeSelect.value;
  state.journey = "through";
  state.point = route().points.includes("B") ? "B" : "A";
  state.mapPoint = state.point;
  state.setup = "unbound";
  refreshChoices();
  render();
});

journeySelect.addEventListener("change", () => {
  archiveDemoJourney();
  state.journey = journeySelect.value;
  render();
});

pointSelect.addEventListener("change", () => {
  state.point = pointSelect.value;
  state.mapPoint = state.point;
  if (state.condition === "unbound") state.setup = "unbound";
  render();
});

conditionSelect.addEventListener("change", () => {
  state.condition = conditionSelect.value;
  if (!canRecord() && state.polePage === "ad") state.polePage = "map";
  if (state.condition === "unbound") {
    state.setup = "unbound";
    state.polePage = "map";
  }
  const count = sync();
  if (count) logDemo("系统日志", `补传 ${count} 条点位事件`, activeTrail().name);
  state.notice = count ? `已补传 ${count} 条，按原经过时间计算。` : conditions[state.condition].label;
  render();
});

nextButton.addEventListener("click", () => {
  const position = state.passes.length;
  const example = journey();
  const point = example.points[position];
  if (!point || !canRecord()) return;
  const pass = {
    id: `${state.trail.journeyId}-${position + 1}`,
    point,
    project: activeTrail().project,
    trailId: activeTrail().id,
    user: example.users?.[position] ?? "演示用户",
    minute: example.minutes[position],
    synced: state.condition === "online",
  };
  queuePass(pass);
  state.point = point;
  state.mapPoint = point;
  state.notice = pass.synced ? `${point} 点事件已同步，经过时间 ${clockTime(pass.minute)}。` : `${point} 点事件已保存在待传队列。`;
  if (pass.synced) logDemo("系统日志", `收到过点事件 ${pass.id}`, `${activeTrail().name} · ${point} 点`);
  const voice = state.trail.voice;
  const time = clockTime(pass.minute);
  if (voice.enabled && ["pass", "arrival"].includes(voice.event) && (voice.start <= voice.end ? time >= voice.start && time <= voice.end : time >= voice.start || time <= voice.end)) {
    state.trail.lastVoice = voice.text;
  }
  render();
});

repeatButton.addEventListener("click", () => {
  const previous = state.passes.at(-1);
  if (!previous || !canRecord()) return;
  if (!queuePass(previous)) state.notice = `${previous.point} 点重复识别，保留原来的经过事件。`;
  render();
});

document.getElementById("reset").addEventListener("click", () => {
  state.trail.completed = [];
  state.trail.passHistory = [];
  resetJourney();
  render();
});

document.querySelector(".view-nav").addEventListener("click", (event) => {
  const button = event.target.closest("[data-view]");
  if (!button) return;
  state.view = button.dataset.view;
  state.faceVerified = false;
  state.staff = false;
  state.settingsDraft = null;
  render();
});

preview.addEventListener("click", (event) => {
  const adminButton = event.target.closest("[data-admin-action]");
  if (adminButton && handleAdminAction(adminButton)) {
    const replacement = Array.from(preview.querySelectorAll("[data-admin-action]")).find((control) =>
      control.dataset.adminAction === adminButton.dataset.adminAction && control.dataset.value === adminButton.dataset.value
    );
    replacement?.focus({ preventScroll: true });
    return;
  }
  const button = event.target.closest("[data-action]");
  if (!button) return;
  if (["place-marker", "apply-marker"].includes(button.dataset.action)) {
    if (adminCanEdit()) setMapMarker(event, button);
    return;
  }
  if (handleMiniAction(button) || handlePoleAction(button)) {
    render();
    const sameControl = Array.from(preview.querySelectorAll("[data-action]")).find((control) =>
      control.dataset.action === button.dataset.action && control.dataset.value === button.dataset.value && !control.disabled
    );
    (sameControl || preview.querySelector("h2[tabindex]") || preview.querySelector("[data-action]"))?.focus({ preventScroll: true });
    return;
  }
  switch (button.dataset.action) {
    case "bind":
      state.setup = "bound";
      state.notice = `已载入 ${state.point} 点的示例配置。`;
      break;
    case "check":
      state.setup = "checked";
      state.notice = "摄像头、网络、校时和存储自检通过（模拟）。";
      break;
    case "enable":
      state.condition = "online";
      state.view = "public";
      state.polePage = "map";
      sync();
      state.notice = "已启用，返回市民杆屏。";
      break;
    case "test":
      state.testCount += 1;
      state.notice = "收到一次测试经过。";
      break;
    case "retry": {
      const count = sync();
      state.notice = state.condition === "offline" ? "网络离线，继续保留待传事件。" : count ? `已补传 ${count} 条。` : "暂无待传事件。";
      break;
    }
    case "home":
      state.view = "public";
      state.polePage = "map";
      break;
  }
  render();
  const replacement = preview.querySelector(`[data-action="${button.dataset.action}"]:not(:disabled)`)
    || preview.querySelector("[data-action]:not(:disabled)")
    || document.querySelector('[data-view="public"]');
  replacement.focus({ preventScroll: true });
});

preview.addEventListener("submit", (event) => {
  if (handleAdminSubmit(event.target, event.submitter) || handleMiniSubmit(event)) event.preventDefault();
});
preview.addEventListener("change", (event) => {
  handleAdminChange(event);
  if (typeof handleMiniChange === "function") handleMiniChange(event);
});
wirePoleForms();
refreshChoices();
logDemo("登录日志", "登录后台演示账号", "社会体育管理后台");
render();
