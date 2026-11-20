"use strict";

function createDemoTrailState() {
  return {
    activeTrail: "main",
    projects: { green: "中城绿谷", river: "滨水公园" },
    trails: [
      { id: "main", project: "green", name: "中城绿谷主步道", enabled: true, length: 880, lat: 31.1586, lon: 121.4371, icon: "跑步" },
      { id: "east", project: "green", name: "东侧健身步道", enabled: true, length: 640, lat: 31.1591, lon: 121.4382, icon: "健走" },
      { id: "river", project: "river", name: "滨水环线", enabled: true, length: 1200, lat: 31.1671, lon: 121.4512, icon: "跑步" },
    ],
    selectedScreen: "S-01",
    boards: [
      { id: "S-01", trailId: "main", label: "主步道排行屏" },
      { id: "S-02", trailId: "east", label: "东侧排行屏" },
      { id: "S-03", trailId: "river", label: "滨水排行屏" },
    ],
    pendingRegistration: null,
    registrations: {},
    rankedProjects: {},
    profile: { name: "演示用户", gender: "未填写", age: "", weight: 65, height: "" },
    notices: [
      { id: "welcome", project: "green", title: "中城绿谷步道开放提示", body: "步道各采集点位已开放。经过路口请按信号通行，运动后可在这里查看记录。", status: "published", start: "", end: "" },
    ],
    ...createDemoDeviceState(),
    logs: [],
    trailSettings: {},
    completed: [],
    passHistory: [],
    journeyId: 1,
  };
}

function createDemoDeviceState() {
  return {
    control: { screenOn: true, collecting: true, content: "auto", version: "1.0.0", schedule: "", receipt: "" },
    voice: { enabled: true, text: "前方点位，请注意通行。", event: "pass", start: "00:00", end: "23:59" },
    lastVoice: "",
  };
}

function escapeDemo(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character]));
}

function activeTrail() {
  return state.trail.trails.find((trail) => trail.id === state.trail.activeTrail);
}

function demoDate(offset = 0) {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, "0"), String(date.getDate()).padStart(2, "0")].join("-");
}

function isDemoNoticeVisible(notice) {
  const today = demoDate();
  const now = new Date();
  const localTime = `${today}T${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  return notice.status === "published"
    && (!notice.start || notice.start <= (notice.start.length <= 10 ? today : localTime))
    && (!notice.end || notice.end >= (notice.end.length <= 10 ? today : localTime));
}

function logDemo(category, action, target, result = "成功") {
  const time = new Date().toLocaleTimeString("zh-CN", { hour12: false });
  state.trail.logs.unshift({ time, category, action, target, result });
}

function beginDemoRegistration(trailId, from) {
  const trail = state.trail.trails.find((item) => item.id === trailId);
  if (!trail?.enabled || state.condition !== "online") return false;
  state.trail.pendingRegistration = { project: trail.project, trailId, from };
  return true;
}

function confirmDemoRegistration() {
  const registration = state.trail.pendingRegistration;
  if (!registration) return false;
  const trail = state.trail.trails.find((item) => item.id === registration.trailId);
  if (!trail?.enabled || trail.project !== registration.project) return false;
  if (registration.from.startsWith("排行屏 ") && !state.trail.boards.some((board) => `排行屏 ${board.id}` === registration.from && board.trailId === trail.id)) {
    state.trail.pendingRegistration = null;
    return false;
  }
  state.trail.registrations[registration.project] ??= registration;
  state.trail.pendingRegistration = null;
  logDemo("操作日志", "关联微信演示账号", state.trail.projects[registration.project]);
  return true;
}

function openDemoMini(page = "today") {
  state.view = "mini";
  state.miniPage = page;
}

function demoEnergy(distance, weight) {
  // Illustrative value for the prototype. Production uses a validated formula.
  return Number(weight) > 0 ? Math.round(distance * weight / 1000) : null;
}

function currentWorkout() {
  const segments = confirmedSegments().filter((segment) => segment.user === "演示用户" && !segment.crossing);
  if (!segments.length) return null;
  const trail = activeTrail();
  const distance = segments.reduce((sum, item) => sum + item.distance, 0);
  return {
    id: `try-${state.trail.journeyId}`, date: demoDate(), project: trail.project, trailId: trail.id,
    place: `${state.trail.projects[trail.project]} · ${trail.name}`, distance,
    duration: segments.reduce((sum, item) => sum + item.duration, 0), energy: demoEnergy(distance, state.trail.profile.weight),
  };
}

function demoWorkoutRecords() {
  const samples = [[-2, "main", 3520, 26, 229], [-9, "east", 1920, 15, 125], [-16, "river", 4800, 37, 312]];
  const seeded = samples.map(([offset, trailId, distance, duration, energy], index) => {
    const trail = state.trail.trails.find((item) => item.id === trailId);
    const place = `${state.trail.projects[trail.project]} · ${trail.name}`;
    return { id: `sample-${index}`, date: demoDate(offset), trailId, project: trail.project, place, distance, duration, energy };
  });
  return [currentWorkout(), ...[...state.trail.completed].reverse(), ...seeded].filter(Boolean);
}

const leaderboardSamples = [
  ["晨跑者 · 林**", "main", 6200, 39, 372, [0, -2, -8, -14]],
  ["步友 · 周**", "main", 4800, 31, 307, [0, -1, -5, -18]],
  ["步友 · 陈**", "east", 4800, 26, 288, [0, -3, -15]],
  ["步友 · 徐**", "east", 2100, 15, 137, [0, -6]],
  ["滨水跑友 · 余**", "river", 3600, 24, 238, [0, -1, -8]],
  ["滨水跑友 · 方**", "river", 2400, 19, null, [0, -10]],
];

function demoRanking({ trailId, project, period = "today", metric = "distance" } = {}) {
  const today = demoDate();
  const weekStart = demoDate(-((new Date().getDay() + 6) % 7));
  const monthStart = `${today.slice(0, 7)}-01`;
  const after = { today, week: weekStart, month: monthStart, total: "" }[period];
  const inScope = (record) => record.date >= after
    && (!project || record.project === project) && (!trailId || record.trailId === trailId);
  const grouped = leaderboardSamples.map(([name, id, distance, duration, energy, offsets]) => {
    const trail = state.trail.trails.find((item) => item.id === id);
    const records = offsets.map((offset) => ({ date: demoDate(offset), project: trail.project, trailId: id, distance, duration, energy }));
    return { name, records };
  });
  const authorized = demoWorkoutRecords().filter((record) => state.trail.rankedProjects[record.project]);
  if (authorized.length) grouped.push({ name: "我 · 演**", records: authorized, self: true });
  const ranked = grouped.flatMap(({ name, records, self = false }) => {
    const eligible = records.filter(inScope);
    const distance = eligible.reduce((sum, item) => sum + item.distance, 0);
    const duration = eligible.reduce((sum, item) => sum + item.duration, 0);
    const energy = eligible.some((item) => item.energy !== null) ? eligible.reduce((sum, item) => sum + (item.energy || 0), 0) : null;
    const speed = duration > 0 ? Math.round(distance * 60 / duration / 100) / 10 : null;
    const value = { distance, energy, speed }[metric];
    return value > 0 ? [{ name, distance, duration, energy, speed, value, self }] : [];
  }).sort((first, second) => second.value - first.value);
  let rank = 0;
  return ranked.map((row, index) => {
    if (!index || row.value !== ranked[index - 1].value) rank = index + 1;
    return { ...row, rank };
  });
}
