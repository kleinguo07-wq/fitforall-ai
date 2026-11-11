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
  view: "public",
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
  return routes[state.route];
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

function publicScreen() {
  const info = conditions[state.condition];
  const warning = state.condition !== "online" ? " warning" : "";
  const header = `<div class="device-head"><strong>智慧步道</strong><span class="pole-status${warning}">${info.sign}</span></div>`;
  if (state.condition === "unbound") {
    return `<article class="device"><div class="pole-screen">${header}<div class="location"><p>设备正在调试</p><h2>待启用</h2></div><p>点位配置完成后开放运动记录。</p></div></article>`;
  }
  const { points, crossing, distances } = route();
  const index = points.indexOf(state.point);
  const track = points.map((point, position) => {
    const classes = [point === state.point ? "current" : "", crossing >= 0 && position === crossing + 1 ? "crossing" : ""];
    return `<li class="${classes.join(" ")}" ${point === state.point ? 'aria-current="location"' : ""}>${point}</li>`;
  }).join("");
  const directions = [-1, 1].map((direction) => {
    const next = points[index + direction];
    if (!next) return "";
    const arrow = direction < 0 ? "←" : "→";
    const segment = Math.min(index, index + direction);
    if (segment === crossing) {
      return `<div class="direction crossing-sign"><b>${arrow} 往 ${next} 点</b><span>前方过街，请按信号通行</span></div>`;
    }
    return `<div class="direction"><b>${arrow} 往 ${next} 点</b><span>${distances[segment]} 米</span></div>`;
  }).join("");
  const guide = state.condition === "fault" ? "可查询此前已同步的运动记录。" : "开通步道记录后，经过点位会自动记录。";
  return `<article class="device"><div class="pole-screen">
    ${header}
    <div class="location"><p>中城绿谷 · 当前位置</p><h2>${state.point} 点</h2></div>
    <ol class="route-map" aria-label="线路点位示意">${track}</ol>
    <div class="direction-list">${directions}</div>
    <div class="record-guide"><div class="qr-placeholder" aria-label="小程序码示意">小程序码<br>示意</div><div><strong>微信扫码查运动记录</strong><p>${guide}</p></div></div>
  </div></article>`;
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

function phoneScreen() {
  const segments = confirmedSegments().filter((segment) => segment.user === "演示用户");
  const exercise = segments.filter((segment) => !segment.crossing);
  const pending = state.passes.filter((pass) => pass.user === "演示用户" && !pass.synced).length;
  const distance = exercise.reduce((total, segment) => total + segment.distance, 0);
  const minutes = exercise.reduce((total, segment) => total + segment.duration, 0);
  const crossing = segments.filter((segment) => segment.crossing).reduce((total, segment) => total + segment.duration, 0);
  const rows = segments.map((segment) => `<li><span>${segment.label} ${segment.crossing ? "· 过街" : ""}</span><strong>${segment.crossing ? "" : segment.distance + " 米 · "}${segment.duration} 分</strong></li>`).join("");
  return `<article class="surface phone"><p class="eyebrow">微信小程序 · 演示账号</p><h2>我的步道记录</h2>
    <p class="muted">中城绿谷 · ${state.route === "four" ? "分段计时" : "全程计时"}</p>
    ${pending ? '<p class="feedback">有待同步事件，记录可能更新。</p>' : ""}
    ${exercise.length ? `<div class="stats"><div><span>有效里程</span><b>${distance} 米</b></div><div><span>运动用时</span><b>${minutes} 分</b></div></div>` : '<h3>暂无有效运动记录</h3><p class="muted">经过同一线路的有效相邻点位后生成记录。</p>'}
    ${crossing ? `<p class="muted">过街用时 ${crossing} 分钟，单独列示。</p>` : ""}
    ${rows ? `<h3>分段明细</h3><ul class="records">${rows}</ul>` : ""}
  </article>`;
}

function adminScreen() {
  const segments = confirmedSegments().filter((segment) => !segment.crossing);
  const pending = state.passes.filter((pass) => !pass.synced).length;
  const rows = state.passes.map((pass) => `<tr><td>${clockTime(pass.minute)}</td><td>${pass.point} 点</td><td>${pass.user}</td><td>${pass.synced ? "已同步" : "待同步"}</td></tr>`).join("");
  return `<article class="surface admin"><p class="eyebrow">智慧步道 · 管理后台</p><h2>中城绿谷</h2>
    <p class="muted">点位 ${route().points.join(" / ")} · ${conditions[state.condition].label}</p>
    <div class="stats"><div>已确认运动段<b>${segments.length}</b></div><div>待同步事件<b>${pending}</b></div></div>
    <h3>点位事件</h3>
    ${rows ? `<div class="table-wrap"><table aria-label="点位事件"><thead><tr><th>经过时间</th><th>点位</th><th>演示账号</th><th>状态</th></tr></thead><tbody>${rows}</tbody></table></div>` : '<p class="muted">暂无经过事件。使用场景模拟添加。</p>'}
  </article>`;
}

const views = { public: publicScreen, ops: deviceOps, phone: phoneScreen, admin: adminScreen };

function render() {
  for (const button of document.querySelectorAll("[data-view]")) {
    button.setAttribute("aria-pressed", String(button.dataset.view === state.view));
  }
  preview.innerHTML = views[state.view]();
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
  if (state.condition === "unbound") state.setup = "unbound";
  render();
});

conditionSelect.addEventListener("change", () => {
  state.condition = conditionSelect.value;
  if (state.condition === "unbound") state.setup = "unbound";
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
  render();
});

preview.addEventListener("click", (event) => {
  const button = event.target.closest("[data-action]");
  if (!button) return;
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
      break;
  }
  render();
  const replacement = preview.querySelector(`[data-action="${button.dataset.action}"]:not(:disabled)`)
    || preview.querySelector("[data-action]:not(:disabled)")
    || document.querySelector('[data-view="public"]');
  replacement.focus({ preventScroll: true });
});

setOptions(journeySelect, Object.entries(route().journeys).map(([id, item]) => [id, item.name]), state.journey);
setOptions(pointSelect, route().points.map((point) => [point, `${point} 点`]), state.point);
render();
