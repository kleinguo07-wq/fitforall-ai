"use strict";

function miniState() {
  if (!state.mini) {
    state.mini = { rankPeriod: "today", rankMetric: "distance", rankTrail: "all", historyProject: "all", historyFrom: "", historyTo: "", selectedRecord: null, selectedNotice: null, feedback: "", refreshed: "" };
  }
  if (!state.miniPage) state.miniPage = "today";
  return state.mini;
}

function miniParkName(project) {
  return state.trail.projects[project] || project;
}

function miniKilometers(distance) {
  return (distance / 1000).toFixed(2);
}

function miniDuration(minutes) {
  const seconds = Math.round(minutes * 60);
  return `${Math.floor(seconds / 60)}分${String(seconds % 60).padStart(2, "0")}秒`;
}

function miniPace(distance, minutes) {
  if (!(distance > 0 && minutes > 0)) return "—";
  const seconds = Math.round(minutes * 60 / (distance / 1000));
  return `${Math.floor(seconds / 60)}′${String(seconds % 60).padStart(2, "0")}″`;
}

function miniTotal(records) {
  return records.reduce((total, record) => {
    total.distance += record.distance;
    total.duration += record.duration;
    if (Number.isFinite(record.energy)) {
      total.energy += record.energy;
      total.estimated += 1;
    }
    return total;
  }, { distance: 0, duration: 0, energy: 0, estimated: 0 });
}

function miniEnergy(total) {
  return total.estimated ? Math.round(total.energy) : "—";
}

function miniRegistration() {
  return state.trail.registrations[activeTrail().project];
}

function miniStatus() {
  const message = miniState().feedback;
  return message ? `<p class="mini-status" role="status" aria-live="polite">${escapeDemo(message)}</p>` : "";
}

function miniMetrics(total, count, cumulative = false) {
  return `<div class="mini-stats">
    <div class="mini-stat"><span>${cumulative ? "累计时长" : "运动时长"}</span><strong>${total.duration.toFixed(1)}</strong><small>分钟</small></div>
    <div class="mini-stat"><span>${cumulative ? "累计热量 · 已估算" : "热量消耗 · 估算"}</span><strong>${miniEnergy(total)}</strong><small>千卡</small></div>
    <div class="mini-stat"><span>${cumulative ? "累计次数" : "完成运动"}</span><strong>${count}</strong><small>次</small></div>
    <div class="mini-stat"><span>平均配速</span><strong>${miniPace(total.distance, total.duration)}</strong><small>/公里</small></div>
  </div>`;
}

function miniPublishedNotices() {
  const project = activeTrail().project;
  return state.trail.notices.filter((notice) => notice.project === project && isDemoNoticeVisible(notice));
}

function miniNoticeList() {
  const notices = miniPublishedNotices();
  if (!notices.length) return '<p class="mini-copy">本公园暂未发布新信息。</p>';
  return notices.map((notice) => `<button type="button" class="mini-message" data-action="mini-notice" data-value="${escapeDemo(notice.id)}">
    <strong>${escapeDemo(notice.title)} <span aria-hidden="true">›</span></strong><span>${escapeDemo(miniParkName(notice.project))} · 公园信息</span>
  </button>`).join("");
}

function miniTodayScreen() {
  const current = activeTrail();
  const records = demoWorkoutRecords().filter((record) => record.date === demoDate() && record.project === current.project);
  const total = miniTotal(records);
  const pending = state.passes.filter((pass) => pass.user === "演示用户" && !pass.synced).length;
  return `<div class="mini-title-row"><div><p class="mini-kicker">${escapeDemo(miniParkName(current.project))} · 今日</p><h2 tabindex="-1">我的步道运动</h2></div><button type="button" class="mini-link" data-action="mini-refresh">刷新 ↻</button></div>
    ${miniStatus()}
    ${!miniRegistration() ? `<div class="mini-card"><h3>关联微信，开通步道记录</h3><p class="mini-copy">在一体机完成人脸登记后，用本人微信确认关联。</p><button type="button" class="mini-button" data-action="mini-page" data-value="profile">查看关联状态</button></div>` : ""}
    <section class="mini-hero" aria-label="今日运动里程"><p class="mini-kicker">今日有效里程</p><div class="mini-hero-value"><strong>${miniKilometers(total.distance)}</strong><span>公里</span></div><p class="mini-copy">${escapeDemo(demoDate())} · ${records.length} 次已确认运动</p></section>
    ${miniMetrics(total, records.length)}
    ${pending ? `<p class="mini-status mini-warning" style="margin-top:10px">${pending} 条经过事件待同步，确认后更新运动数据。</p>` : ""}
    ${!records.length ? '<div class="mini-empty"><strong>今天还没有已确认的运动</strong><p>开通后自然经过相邻点位，即可记录有效路段。</p></div>' : ""}
    <p class="mini-note">里程按已确认路段计算。${records.length && total.estimated < records.length ? "部分记录缺少热量估算所需资料。" : "热量为估算值。"}</p>
    <section class="mini-section mini-card"><h3>运动建议</h3><p class="mini-copy">${records.length ? `今天已记录 ${miniKilometers(total.distance)} 公里。继续活动时，可结合自身感受安排休息，过街时遵守信号。` : "从公园点位地图选择适合自己的路线，留意下一点的方向与距离，过街时遵守信号。"}</p></section>
    <section class="mini-section"><h3>公园信息</h3>${miniNoticeList()}</section>`;
}

function miniHistoryScreen() {
  const ui = miniState();
  const validDates = !ui.historyFrom || !ui.historyTo || ui.historyFrom <= ui.historyTo;
  const records = demoWorkoutRecords().filter((record) => validDates
    && (ui.historyProject === "all" || record.project === ui.historyProject)
    && (!ui.historyFrom || record.date >= ui.historyFrom)
    && (!ui.historyTo || record.date <= ui.historyTo))
    .sort((first, second) => second.date.localeCompare(first.date));
  const total = miniTotal(records);
  return `<div class="mini-title-row"><div><p class="mini-kicker">我的运动记录</p><h2 tabindex="-1">历史与累计</h2></div><button type="button" class="mini-link" data-action="mini-refresh">刷新 ↻</button></div>
    ${miniStatus()}
    <div class="mini-filters"><label for="mini-history-project">公园<select id="mini-history-project"><option value="all">全部公园</option>${Object.entries(state.trail.projects).map(([id, name]) => `<option value="${id}"${ui.historyProject === id ? " selected" : ""}>${escapeDemo(name)}</option>`).join("")}</select></label><div class="mini-form-pair"><label for="mini-history-from">开始日期<input id="mini-history-from" type="date" value="${ui.historyFrom}"></label><label for="mini-history-to">结束日期<input id="mini-history-to" type="date" value="${ui.historyTo}"></label></div></div>
    ${!validDates ? '<p class="mini-status mini-warning">开始日期晚于结束日期，请调整日期范围。</p>' : ""}
    <section class="mini-hero"><p class="mini-kicker">累计有效里程 · 当前筛选</p><div class="mini-hero-value"><strong>${miniKilometers(total.distance)}</strong><span>公里</span></div><p class="mini-copy">${records.length} 次已确认运动</p></section>
    ${miniMetrics(total, records.length, true)}
    <p class="mini-note">热量累计采用已估算的记录。${records.length > total.estimated ? `${records.length - total.estimated} 次记录暂未估算热量。` : ""}</p>
    <section class="mini-section"><h3>单次运动</h3>${records.length ? records.map((record) => `<button type="button" class="mini-record" data-action="mini-record" data-value="${escapeDemo(record.id)}">
      <span class="mini-record-top"><strong>${miniKilometers(record.distance)} <small>公里</small></strong><span>${escapeDemo(record.date)}　›</span></span>
      <span class="mini-record-bottom"><span>${escapeDemo(record.place || miniParkName(record.project))}</span><b>${miniDuration(record.duration)}</b></span>
    </button>`).join("") : '<div class="mini-empty"><strong>还没有运动记录</strong><p>完成有效路段后，可在这里查看每次运动。</p></div>'}</section>`;
}

function miniRecordScreen() {
  const record = demoWorkoutRecords().find((item) => String(item.id) === String(miniState().selectedRecord));
  if (!record) return `<button type="button" class="mini-link" data-action="mini-page" data-value="history">← 返回历史</button><div class="mini-empty"><strong>记录暂不可用</strong><p>请刷新历史列表后重试。</p></div>`;
  const total = miniTotal([record]);
  return `<div class="mini-title-row"><button type="button" class="mini-link" data-action="mini-page" data-value="history">← 历史</button><h2 tabindex="-1">单次运动</h2></div>
    <section class="mini-hero"><p class="mini-kicker">${escapeDemo(record.date)}</p><div class="mini-hero-value"><strong>${miniKilometers(record.distance)}</strong><span>公里</span></div><p class="mini-copy">智慧步道 · 已确认</p></section>
    ${miniMetrics(total, 1)}
    <div class="mini-card mini-section"><dl class="mini-detail-facts"><dt>运动地点</dt><dd>${escapeDemo(record.place || miniParkName(record.project))}</dd><dt>公园</dt><dd>${escapeDemo(miniParkName(record.project))}</dd><dt>运动用时</dt><dd>${miniDuration(record.duration)}</dd><dt>记录日期</dt><dd>${escapeDemo(record.date)}</dd><dt>记录来源</dt><dd>智慧步道点位识别</dd></dl></div>
    <p class="mini-note">里程来自标定路段，配速由同一批有效路段的里程和用时计算。${Number.isFinite(record.energy) ? "热量为估算值。" : "该记录暂未估算热量。"}</p>`;
}

function miniRankScreen() {
  const ui = miniState();
  const current = activeTrail();
  const trails = state.trail.trails.filter((trail) => trail.project === current.project);
  if (ui.rankTrail !== "all" && !trails.some((trail) => trail.id === ui.rankTrail)) ui.rankTrail = "all";
  const selected = trails.find((trail) => trail.id === ui.rankTrail);
  const rows = demoRanking({ trailId: selected?.id, project: current.project, period: ui.rankPeriod, metric: ui.rankMetric });
  const metrics = { distance: ["里程", "公里"], speed: ["速度", "km/h"], energy: ["热量", "千卡"] };
  const periods = { today: "日榜", week: "周榜", month: "月榜" };
  const renderValue = (row) => {
    if (ui.rankMetric === "distance") return miniKilometers(row.distance);
    if (ui.rankMetric === "speed") return Number(row.speed).toFixed(2);
    return Math.round(row.energy);
  };
  return `<div class="mini-title-row"><div><p class="mini-kicker">${escapeDemo(miniParkName(current.project))}</p><h2 tabindex="-1">步道排行榜</h2></div><button type="button" class="mini-link" data-action="mini-refresh">刷新 ↻</button></div>
    ${miniStatus()}
    <label class="mini-scope" for="mini-rank-scope">步道范围<select id="mini-rank-scope"><option value="all">本公园全部步道</option>${trails.map((trail) => `<option value="${trail.id}"${ui.rankTrail === trail.id ? " selected" : ""}>${escapeDemo(trail.name)}</option>`).join("")}</select></label>
    <div class="mini-tabs three" aria-label="排行榜指标">${Object.entries(metrics).map(([id, labels]) => `<button type="button" data-action="mini-metric" data-value="${id}" aria-pressed="${ui.rankMetric === id}">${labels[0]}榜</button>`).join("")}</div>
    <div class="mini-periods" aria-label="排行榜周期">${Object.entries(periods).map(([id, label]) => `<button type="button" data-action="mini-period" data-value="${id}" aria-pressed="${ui.rankPeriod === id}">${label}</button>`).join("")}</div>
    <p class="mini-copy">${escapeDemo(selected?.name || "本公园全部步道")} · ${ui.rankMetric === "speed" ? "按平均速度排行" : `按${metrics[ui.rankMetric][0]}排行`}</p>
    ${rows.length ? `<ol class="mini-ranking">${rows.map((row) => `<li${row.self ? ' class="mini-self"' : ""}><span class="mini-rank-number">${row.rank}</span><span class="mini-rank-name">${escapeDemo(row.name)}${row.self ? " · 我" : ""}</span><strong>${renderValue(row)}<small>${metrics[ui.rankMetric][1]}</small></strong></li>`).join("")}</ol>` : '<div class="mini-empty"><strong>本期暂没有符合条件的记录</strong><p>完成运动并授权上榜后参与排行。</p></div>'}
    <div class="mini-refreshed"><span>${ui.refreshed ? `更新于 ${escapeDemo(ui.refreshed)}` : "显示已确认的运动记录"}</span><button type="button" class="mini-link" data-action="mini-refresh">刷新</button></div>
    <p class="mini-note">下拉页面可刷新。同值并列。速度采用有效总里程与总用时计算，热量使用已估算的有效记录。授权后公开脱敏昵称和对应数据。</p>
    <button type="button" class="mini-button secondary" data-action="mini-page" data-value="profile">管理我的账号与上榜授权</button>`;
}

function miniBindingCard() {
  const pending = state.trail.pendingRegistration;
  if (pending) {
    return `<section class="mini-card"><h3>确认本次微信关联</h3><ol class="mini-steps"><li class="done"><strong>一体机完成人脸核验</strong><small>${escapeDemo(miniParkName(pending.project))} · ${escapeDemo(pending.from || "现场一体机")}</small></li><li><strong>微信登录并关联本人账号</strong><small>将本次核验关联到当前演示账号</small></li></ol><button type="button" class="mini-button" data-action="mini-confirm-registration">模拟微信登录并确认关联</button><p class="mini-note">仅确认本次本人关联，重复确认采用同一账号。</p></section>`;
  }
  const registration = miniRegistration();
  if (registration) {
    return `<section class="mini-card"><div class="mini-card-head"><h3>人脸与微信已关联</h3><span class="mini-tag">已开通</span></div><p class="mini-copy">${escapeDemo(miniParkName(registration.project))} · 已关联到当前演示账号，经过点位后自动记录。</p></section>`;
  }
  return `<section class="mini-card"><h3>开通智慧步道记录</h3><p class="mini-copy">到公园一体机选择注册，完成人脸核验后，扫码回到这里确认微信关联。</p><button type="button" class="mini-button secondary" data-action="mini-open-registration">前往一体机注册演示</button></section>`;
}

function miniProfileScreen() {
  const profile = state.trail.profile;
  return `<div class="mini-title-row"><div><p class="mini-kicker">我的账号</p><h2 tabindex="-1">个人资料</h2></div></div>
    ${miniStatus()}
    <div class="mini-profile-banner"><span class="mini-avatar" aria-hidden="true">${escapeDemo(profile.name.slice(0, 1) || "我")}</span><div><strong>${escapeDemo(profile.name)}</strong><small>${miniRegistration() ? "微信关联已完成" : "等待关联步道身份"}</small></div></div>
    ${miniBindingCard()}
    <form id="mini-profile" class="mini-profile-form mini-card"><h3>基本资料</h3>
      <label for="mini-name">昵称</label><input id="mini-name" name="name" maxlength="24" required value="${escapeDemo(profile.name)}" autocomplete="nickname">
      <div class="mini-form-pair"><div><label for="mini-gender">性别</label><select id="mini-gender" name="gender">${["未填写", "男", "女"].map((value) => `<option${profile.gender === value ? " selected" : ""}>${value}</option>`).join("")}</select></div><div><label for="mini-age">年龄 · 岁</label><input id="mini-age" name="age" type="number" min="0" step="1" inputmode="numeric" value="${escapeDemo(profile.age)}" placeholder="选填"></div></div>
      <div class="mini-form-pair"><div><label for="mini-weight">体重 · kg</label><input id="mini-weight" name="weight" type="number" min="0.1" step="0.1" inputmode="decimal" value="${escapeDemo(profile.weight)}" placeholder="选填"></div><div><label for="mini-height">身高 · cm</label><input id="mini-height" name="height" type="number" min="1" step="1" inputmode="numeric" value="${escapeDemo(profile.height)}" placeholder="选填"></div></div>
      <p class="mini-note">体重用于运动热量估算。请按实际情况填写。</p><button type="submit" class="mini-button">保存个人资料</button>
    </form>
    <section class="mini-card"><div class="mini-card-head"><h3>公开上榜</h3><span class="mini-tag">${state.ranked ? "已授权" : "未授权"}</span></div><p class="mini-copy">公开脱敏昵称、有效里程及相应的榜单指标。个人历史在本人账号中查询。</p><button type="button" class="mini-button secondary" data-action="mini-rank-consent" ${miniRegistration() ? "" : "disabled"}>${state.ranked ? "撤回上榜授权" : "同意公开上榜"}</button></section>`;
}

function miniNoticeScreen() {
  const notice = miniPublishedNotices().find((item) => String(item.id) === String(miniState().selectedNotice));
  return `<div class="mini-title-row"><button type="button" class="mini-link" data-action="mini-page" data-value="today">← 今日</button><h2 tabindex="-1">公园信息</h2></div>
    ${notice ? `<article class="mini-card"><h3>${escapeDemo(notice.title)}</h3><p class="mini-copy">${escapeDemo(miniParkName(notice.project))} · 已发布</p><p class="mini-article mini-section">${escapeDemo(notice.body)}</p></article>` : '<div class="mini-empty"><strong>这条信息暂未展示</strong><p>请返回今日页面查看最新公园信息。</p></div>'}`;
}

function miniScreen() {
  miniState();
  const pages = { today: miniTodayScreen, history: miniHistoryScreen, record: miniRecordScreen, rank: miniRankScreen, profile: miniProfileScreen, notice: miniNoticeScreen };
  const page = pages[state.miniPage] ? state.miniPage : "today";
  const active = { record: "history", notice: "today" }[page] || page;
  return `<article class="mini-device" aria-label="微信小程序交互预览"><div class="mini-screen"><header class="mini-top"><div><strong>社会体育 · 跑步</strong><small>　小程序</small></div><span class="mini-capsule" aria-hidden="true">···</span></header><div class="mini-content" id="mini-scroll" tabindex="0" aria-label="小程序页面内容">${pages[page]()}</div><nav class="mini-nav" aria-label="小程序导航">${[["today", "◉", "今日"], ["history", "◷", "历史"], ["rank", "▥", "排行榜"], ["profile", "♙", "我的"]].map(([id, icon, label]) => `<button type="button" data-action="mini-page" data-value="${id}" aria-pressed="${active === id}"><span aria-hidden="true">${icon}</span>${label}</button>`).join("")}</nav></div></article>`;
}

function handleMiniAction(button) {
  const action = button.dataset.action;
  if (!action.startsWith("mini-")) return false;
  const ui = miniState();
  ui.feedback = "";
  switch (action) {
    case "mini-page":
      state.miniPage = button.dataset.value;
      break;
    case "mini-record":
      ui.selectedRecord = button.dataset.value;
      state.miniPage = "record";
      break;
    case "mini-notice":
      ui.selectedNotice = button.dataset.value;
      state.miniPage = "notice";
      break;
    case "mini-metric":
      ui.rankMetric = button.dataset.value;
      break;
    case "mini-period":
      ui.rankPeriod = button.dataset.value;
      break;
    case "mini-refresh":
      ui.refreshed = new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Shanghai" });
      ui.feedback = "已刷新，显示最近确认的数据。";
      break;
    case "mini-confirm-registration":
      ui.feedback = confirmDemoRegistration() ? "微信关联成功，步道记录归属当前账号。" : "本次关联会话已结束，请在一体机重新发起。";
      break;
    case "mini-open-registration":
      state.view = "public";
      state.polePage = "register";
      state.notice = "请在一体机完成人脸核验，再回到小程序确认关联。";
      break;
    case "mini-rank-consent":
      if (!miniRegistration()) {
        ui.feedback = "请先完成人脸与微信关联。";
        break;
      }
      state.ranked = !state.ranked;
      ui.feedback = state.ranked ? "已授权在步道榜单公开脱敏昵称和运动指标。" : "已撤回公开上榜授权。";
      break;
    default:
      return false;
  }
  return true;
}

function handleMiniSubmit(event) {
  if (event.target.id !== "mini-profile") return false;
  event.preventDefault();
  const form = event.target;
  if (!form.reportValidity()) return true;
  const data = new FormData(form);
  const name = String(data.get("name") || "").trim();
  if (!name) {
    form.elements.name.setCustomValidity("请填写昵称");
    form.elements.name.reportValidity();
    form.elements.name.addEventListener("input", () => form.elements.name.setCustomValidity(""), { once: true });
    return true;
  }
  state.trail.profile = {
    name,
    gender: data.get("gender"),
    age: data.get("age") === "" ? "" : Number(data.get("age")),
    weight: data.get("weight") === "" ? "" : Number(data.get("weight")),
    height: data.get("height") === "" ? "" : Number(data.get("height")),
  };
  miniState().feedback = "个人资料已保存。";
  render();
  preview.querySelector('#mini-profile button[type="submit"]')?.focus({ preventScroll: true });
  return true;
}

function handleMiniChange(event) {
  const fields = { "mini-history-project": "historyProject", "mini-history-from": "historyFrom", "mini-history-to": "historyTo", "mini-rank-scope": "rankTrail" };
  const field = fields[event.target.id];
  if (!field) return false;
  miniState()[field] = event.target.value;
  miniState().feedback = "";
  const control = event.target.id;
  render();
  document.getElementById(control)?.focus({ preventScroll: true });
  return true;
}

let miniPullStart = null;
document.addEventListener("touchstart", (event) => {
  const content = event.target.closest(".mini-content");
  if (!content || content.scrollTop > 0 || event.touches.length !== 1 || event.target.closest("button, input, select")) return;
  miniPullStart = { y: event.touches[0].clientY };
}, { passive: true });
document.addEventListener("touchend", (event) => {
  if (!miniPullStart || !event.changedTouches.length) return;
  const distance = event.changedTouches[0].clientY - miniPullStart.y;
  miniPullStart = null;
  if (state.view !== "mini" || distance < 70) return;
  handleMiniAction({ dataset: { action: "mini-refresh" } });
  render();
}, { passive: true });
document.addEventListener("touchcancel", () => { miniPullStart = null; }, { passive: true });
