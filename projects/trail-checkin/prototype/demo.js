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

const state = {
  view: new URLSearchParams(location.search).get("view") === "admin" ? "admin" : "public",
  polePage: "map",
  mapPoint: "B",
  rankPeriod: "today",
  faceVerified: false,
  ranked: false,
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
const routeSelect = document.getElementById("route");
const journeySelect = document.getElementById("journey");
const pointSelect = document.getElementById("point");
const conditionSelect = document.getElementById("condition");
const nextButton = document.getElementById("next");
const repeatButton = document.getElementById("repeat");
const feedback = document.getElementById("feedback");

function route() {
  const selected = routes[state.route];
  return { ...selected, distances: state.configuredDistances[state.route] || selected.distances };
}

function journey() {
  return route().journeys[state.journey];
}

function clockTime(minute) {
  const time = 480 + minute;
  return [Math.floor(time / 60), time % 60].map((number) => String(number).padStart(2, "0")).join(":");
}

function canRecord() {
  return state.condition === "online" || state.condition === "offline";
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
      <dl class="facts"><dt>绑定目标</dt><dd>中城绿谷 · ${state.point} 点</dd><dt>摄像头</dt><dd>本地采集模块</dd><dt>当前进度</dt><dd>${{ unbound: "等待绑定", bound: "已绑定，等待自检", checked: "自检通过，等待启用" }[state.setup]}</dd></dl>
      <button type="button" class="button secondary" data-action="bind" ${state.setup !== "unbound" ? "disabled" : ""}>绑定并拉取配置</button>
      <button type="button" class="button secondary" data-action="check" ${state.setup !== "bound" ? "disabled" : ""}>设备自检</button>
      <button type="button" class="button primary" data-action="enable" ${state.setup !== "checked" ? "disabled" : ""}>启用并返回首页</button>
    </article>`;
  }
  return `<article class="surface"><p class="eyebrow">授权运维 · 演示</p><h2>${state.point} 点设备状态</h2>
    <dl class="facts"><dt>配置</dt><dd>中城绿谷 · ${state.route === "four" ? "四杆" : "两杆"} · 已加载</dd>
    <dt>摄像头</dt><dd>${info.camera}</dd><dt>网络</dt><dd>${info.network}</dd><dt>校时</dt><dd>正常（演示）</dd>
    <dt>最近已同步</dt><dd>${last ? clockTime(last.minute) : "暂无"}</dd><dt>待传事件</dt><dd>${pending} 条</dd>
    <dt>测试经过</dt><dd>${state.testCount} 次，仅用于调试</dd></dl>
    <button type="button" class="button secondary" data-action="test" ${state.condition === "fault" ? "disabled" : ""}>测试一次经过</button>
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
    if (Math.abs(from - to) !== 1) continue;
    const index = Math.min(from, to);
    segments.push({
      user: pass.user,
      label: `${previous.point} → ${pass.point}`,
      distance: distances[index],
      duration: pass.minute - previous.minute,
      crossing: index === crossing,
    });
  }
  return segments;
}

const views = { public: publicScreen, ops: deviceOps, admin: adminScreen };

function render() {
  for (const button of document.querySelectorAll("[data-view]")) {
    button.setAttribute("aria-pressed", String(button.dataset.view === state.view));
  }
  preview.innerHTML = views[state.view]();
  drawParkMap();
  refreshIdleTimer();
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
  state.testCount = 0;
  state.notice = "演示记录已重置。";
}

routeSelect.addEventListener("change", () => {
  state.route = routeSelect.value;
  state.journey = "through";
  state.point = route().points.includes("B") ? "B" : "A";
  state.mapPoint = state.point;
  state.setup = "unbound";
  setOptions(journeySelect, Object.entries(route().journeys).map(([id, item]) => [id, item.name]), state.journey);
  setOptions(pointSelect, route().points.map((point) => [point, `${point} 点`]), state.point);
  resetJourney();
  render();
});

journeySelect.addEventListener("change", () => {
  state.journey = journeySelect.value;
  resetJourney();
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
  state.notice = count ? `已补传 ${count} 条，按原经过时间计算。` : conditions[state.condition].label;
  render();
});

nextButton.addEventListener("click", () => {
  const position = state.passes.length;
  const example = journey();
  const point = example.points[position];
  if (!point || !canRecord()) return;
  const pass = {
    id: position,
    point,
    user: example.users?.[position] ?? "演示用户",
    minute: example.minutes[position],
    synced: state.condition === "online",
  };
  queuePass(pass);
  state.point = point;
  state.mapPoint = point;
  state.notice = pass.synced ? `${point} 点事件已同步，经过时间 ${clockTime(pass.minute)}。` : `${point} 点事件已保存在待传队列。`;
  render();
});

repeatButton.addEventListener("click", () => {
  const previous = state.passes.at(-1);
  if (!previous || !canRecord()) return;
  if (!queuePass(previous)) state.notice = `${previous.point} 点重复识别，保留原来的经过事件。`;
  render();
});

document.getElementById("reset").addEventListener("click", () => {
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
  const button = event.target.closest("[data-action]");
  if (!button) return;
  if (["place-marker", "apply-marker"].includes(button.dataset.action)) {
    setMapMarker(event, button);
    return;
  }
  if (handlePoleAction(button)) {
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

wirePoleForms();
setOptions(journeySelect, Object.entries(route().journeys).map(([id, item]) => [id, item.name]), state.journey);
setOptions(pointSelect, route().points.map((point) => [point, `${point} 点`]), state.point);
render();
