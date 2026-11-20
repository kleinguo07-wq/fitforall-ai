"use strict";

const parkPositions = { A: [16, 76], B: [38, 59], C: [59, 40], D: [83, 21] };
const pointNames = { A: "南段端点", B: "过街前点位", C: "过街后点位", D: "北段端点" };
function poleTrail() {
  return typeof activeTrail === "function" ? activeTrail() : { id: "main", project: "green", name: "中城绿谷主步道", enabled: true };
}

function poleEscape(value) {
  return typeof escapeDemo === "function" ? escapeDemo(value) : String(value ?? "").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character]));
}

function poleControl() {
  return state.trail?.control || { screenOn: true, collecting: true, content: "auto" };
}

function poleProjectName(project) {
  return state.trail?.projects?.[project] || "中城绿谷";
}

function poleRegistered(project = poleTrail()?.project) {
  return Boolean(state.trail?.registrations?.[project]);
}

function poleRanking(trail, period) {
  return typeof demoRanking === "function" && trail
    ? demoRanking({ trailId: trail.id, project: trail.project, period, metric: "distance" })
    : [];
}

function poleNotices(project = poleTrail()?.project) {
  return (state.trail?.notices || []).filter((notice) => notice.project === project &&
    (typeof isDemoNoticeVisible === "function" ? isDemoNoticeVisible(notice) : notice.status === "published"));
}

let idleTimer;

function parkMap() {
  const positions = state.park.positions || parkPositions;
  const points = route().points.map((point) => {
    const [x, y] = positions[point];
    return `<button type="button" data-action="map-point" data-value="${point}" style="left:${x}%;top:${y}%"
      class="map-pin${point === state.point ? " here" : ""}" aria-label="${point} 点${point === state.point ? "，当前杆" : ""}"
      aria-pressed="${point === state.mapPoint}">${point}</button>`;
  }).join("");
  return `<div class="park-map">
    ${state.park.map ? `<img class="map-background" src="${state.park.map}" alt="已上传的公园地图">` : '<canvas class="map-background" width="720" height="480" aria-label="中城绿谷点位示意图"></canvas>'}
    <span class="map-caption">${state.park.map ? "公园点位地图" : "公园点位示意"}</span>${points}
  </div>`;
}

function drawParkMap() {
  const canvas = preview.querySelector("canvas");
  if (!canvas) return;
  const context = canvas.getContext("2d");
  const draw = (color, points, width = 0) => {
    context.beginPath();
    context.moveTo(...points[0]);
    for (const point of points.slice(1)) context.lineTo(...point);
    if (width) {
      context.strokeStyle = color;
      context.lineWidth = width;
      context.lineJoin = "round";
      context.lineCap = "round";
      context.stroke();
    } else {
      context.fillStyle = color;
      context.fill();
    }
  };
  context.fillStyle = "#e9eedf";
  context.fillRect(0, 0, 720, 480);
  draw("#c4d9b0", [[14,382],[92,307],[245,230],[330,153],[450,63],[626,33],[700,90],[659,215],[502,321],[315,414],[171,467],[45,455]]);
  draw("#afcfae", [[0,327],[139,232],[249,205],[269,249],[137,311],[31,411],[0,406]]);
  draw("#b5d4bd", [[443,0],[582,0],[529,65],[456,83],[376,134],[338,105]]);
  draw("#d6d5c7", [[140,0],[284,144],[407,262],[544,377],[647,480]], 55);
  draw("#f9f5e8", [[140,0],[284,144],[407,262],[544,377],[647,480]], 36);
  const coordinates = Object.values(parkPositions).map(([x, y]) => [x * 7.2, y * 4.8]);
  draw("#f9ffef", coordinates, 24);
  draw("#337859", [coordinates[0], coordinates[1]], 10);
  draw("#337859", [coordinates[2], coordinates[3]], 10);
  context.setLineDash([9, 9]);
  draw("#956933", [coordinates[1], coordinates[2]], 7);
  context.setLineDash([]);
  context.fillStyle = "#476153";
  context.font = '22px "PingFang SC", sans-serif';
  context.fillText("南段绿地", 88, 443);
  context.fillText("北段绿地", 523, 164);
  context.fillText("过街区", 438, 307);
}

function routeSuggestions() {
  const { points, crossing, distances } = route();
  const position = points.indexOf(state.point);
  return [-1, 1].flatMap((direction) => {
    const point = points[position + direction];
    if (!point) return [];
    const segment = Math.min(position, position + direction);
    return [{ point, direction, distance: distances[segment], crossing: segment === crossing }];
  });
}

function mapScreen() {
  const suggestions = routeSuggestions();
  const recommended = suggestions.find((item) => !item.crossing) || suggestions[0];
  const selected = suggestions.find((item) => item.point === state.mapPoint);
  const details = state.mapPoint === state.point
    ? `当前杆 · ${pointNames[state.point]}`
    : selected ? `${pointNames[state.mapPoint]} · 距当前杆 ${selected.distance} 米` : `${pointNames[state.mapPoint]} · 见地图点位顺序`;
  const directions = suggestions.map((item) => {
    const arrow = item.direction < 0 ? "←" : "→";
    return `<div class="direction${item.crossing ? " crossing-sign" : ""}"><b>${arrow} 往 ${item.point} 点</b><span>${item.distance} 米${item.crossing ? " · 前方过街" : ""}</span></div>`;
  }).join("");
  const notices = poleNotices();
  return `<div class="location"><p>你在这里 · ${poleEscape(poleTrail()?.name || "智慧步道")}</p><h2 tabindex="-1">${state.point} 点 <small>${pointNames[state.point]}</small></h2></div>
    ${parkMap()}
    <p class="map-details">${state.mapPoint} 点 · ${details}</p>
    ${recommended ? `<div class="recommend"><div><small>推荐下一个点位</small><strong>${recommended.point} 点 · ${pointNames[recommended.point]}</strong></div><b>${recommended.distance}<small> 米</small></b></div>` : ""}
    <div class="direction-list">${directions}</div>
    ${state.route === "two" || suggestions.some((item) => item.crossing) ? '<p class="crossing-note">请按信号通行，过街注意安全。</p>' : ""}
    <button class="pole-entry" type="button" data-action="pole-page" data-value="${poleRegistered() ? "records" : "register"}"><span><strong>${poleRegistered() ? "已开通本公园步道记录" : "首次使用 · 开通步道记录"}</strong><small>${poleRegistered() ? "扫码查看自己的运动数据" : "杆屏采集人脸，小程序确认开通"}</small></span><span aria-hidden="true">↗</span></button>
    ${notices.length ? `<button class="pole-notice-link" type="button" data-action="pole-page" data-value="notice">公园公告 · ${poleEscape(notices[0].title)} <span aria-hidden="true">›</span></button>` : ""}`;
}

function rankScreen() {
  const period = state.rankPeriod;
  const trail = poleTrail();
  const data = poleRanking(trail, period);
  const rows = data.map((item) => `<li${item.self ? ' class="rank-self"' : ""}><span class="rank-number">${item.rank}</span><span>${poleEscape(item.name)}${item.self ? " <small>我</small>" : ""}</span><strong>${(item.distance / 1000).toFixed(2)} 公里</strong></li>`).join("");
  return `<h2 class="pole-title" tabindex="-1">运动榜</h2><p class="pole-copy">${poleEscape(poleProjectName(trail?.project))} · ${poleEscape(trail?.name || "当前步道")}<br>按有效运动距离排行</p>
    <div class="rank-tabs" aria-label="榜单时段">
      <button type="button" data-action="rank-period" data-value="today" aria-pressed="${period === "today"}">今日榜</button>
      <button type="button" data-action="rank-period" data-value="total" aria-pressed="${period === "total"}">本站总榜</button>
    </div>
    <ol class="ranking">${rows || '<li class="ranking-empty">暂无已授权的运动记录</li>'}</ol>
    <p class="pole-copy rank-rule">同距离并列，仅展示已同意上榜的用户。</p>
    ${state.condition === "offline" ? '<p class="pole-copy">网络离线，显示上次已同步的榜单。</p>' : ""}
    ${state.ranked && !data.some((item) => item.self) ? '<p class="pole-copy">已授权上榜，产生本步道有效运动里程后显示。</p>' : ""}
    <button class="pole-outline" type="button" data-action="pole-page" data-value="authorize">${state.ranked ? "管理上榜授权" : "人脸授权上榜"}</button>`;
}

function authorizationScreen() {
  return `<h2 class="pole-title" tabindex="-1">人脸授权上榜</h2>
    <p class="pole-copy">核验本人后，自主选择公开脱敏昵称与有效运动距离。</p>
    <div class="pole-panel">
      ${state.faceVerified
        ? `<strong>已核验本人（模拟）</strong><p>当前状态：${state.ranked ? "已授权上榜" : "未授权上榜"}</p>
          <button type="button" class="pole-action" data-action="rank-consent">${state.ranked ? "撤回上榜授权" : "同意公开上榜"}</button>`
        : `<strong>本人身份核验</strong><p>面向摄像头，在本设备核验已开通的步道身份。</p>
          <button type="button" class="pole-action" data-action="face-check" ${["fault", "offline"].includes(state.condition) ? "disabled" : ""}>同意并模拟人脸核验</button>`}
    </div>
    <p class="pole-copy consent-note">上榜授权可随时撤回，个人运动数据仍可在小程序查看。</p>
    <button type="button" class="pole-outline" data-action="pole-page" data-value="records">小程序查个人数据</button>`;
}

function registrationScreen() {
  const trail = poleTrail();
  const pending = state.trail?.pendingRegistration;
  const captured = pending?.project === trail?.project && pending?.trailId === trail?.id && pending?.from === "pole";
  const registered = poleRegistered(trail?.project);
  if (registered) {
    return `<h2 class="pole-title" tabindex="-1">步道记录已开通</h2><p class="pole-copy">已开通${poleEscape(poleProjectName(trail?.project))}，经过打卡点即可自动记录。</p><div class="pole-panel"><strong>去运动吧</strong><p>有效距离按相邻打卡点之间的配置距离计算。</p></div><button type="button" class="pole-action" data-action="pole-page" data-value="records">查看个人运动数据</button>`;
  }
  return `<h2 class="pole-title" tabindex="-1">开通步道记录</h2><p class="pole-copy">${poleEscape(poleProjectName(trail?.project))} · ${poleEscape(trail?.name || "当前步道")}</p>
    <ol class="registration-steps" aria-label="开通步骤"><li${captured ? ' class="complete"' : ""}>1 人脸采集</li><li>2 小程序确认</li></ol>
    ${captured
      ? `<div class="pole-panel registration-result"><span class="capture-success" aria-hidden="true">✓</span><strong>人脸已采集，请扫码确认</strong><p>使用本人微信打开小程序，确认本公园授权后完成开通。</p><div class="qr-placeholder registration-qr" aria-label="原型小程序码示意">小程序码<br>示意</div><button class="pole-action" type="button" data-action="registration-mini">模拟扫码，在小程序确认</button><p class="registration-hint">完成开通后，现场经过的记录会关联到本人账号。</p></div>`
      : `<div class="pole-panel face-capture"><div class="face-capture-frame" aria-hidden="true"><span></span></div><strong>请正对摄像头</strong><p>人脸用于本公园步道识别和运动记录；采集在本设备完成。</p><button class="pole-action" type="button" data-action="registration-capture" ${["fault", "offline", "unbound"].includes(state.condition) || trail?.enabled === false ? "disabled" : ""}>同意并模拟采集人脸</button><p class="registration-hint">原型仅模拟采集，不调用真实摄像头。</p></div>`}
    <button class="pole-outline" type="button" data-action="pole-page" data-value="map">返回点位地图</button>`;
}

function recordsScreen() {
  const trail = poleTrail();
  return `<h2 class="pole-title" tabindex="-1">查看个人运动数据</h2><p class="pole-copy">${poleEscape(poleProjectName(trail?.project))} · ${poleEscape(trail?.name || "当前步道")}</p>
    <div class="pole-panel personal-entry"><div class="qr-placeholder">小程序码<br>示意</div>
      <div><strong>微信扫码打开小程序</strong><p>进入「跑步」，查看自己的步道运动记录。</p></div>
    </div><button class="pole-action" type="button" data-action="records-mini">模拟扫码查看数据</button>
    ${poleRegistered(trail?.project) ? '<p class="pole-copy consent-note">已开通本公园步道记录。</p>' : '<button class="pole-outline" type="button" data-action="pole-page" data-value="register">首次使用，开通步道记录</button>'}`;
}

function noticeScreen() {
  const notices = poleNotices();
  return `<h2 class="pole-title" tabindex="-1">公园公告</h2><p class="pole-copy">${poleEscape(poleProjectName(poleTrail()?.project))}</p>
    <div class="pole-notices">${notices.map((notice) => `<article class="pole-panel"><h3>${poleEscape(notice.title)}</h3><p>${poleEscape(notice.body)}</p></article>`).join("") || '<div class="pole-panel"><strong>暂无生效公告</strong><p>公园暂未发布当前时段的公告。</p></div>'}</div>`;
}

function settingsScreen() {
  if (!state.staff) {
    return `<h2 class="pole-title" tabindex="-1">设备设置</h2><div class="pole-panel"><strong>施工和管理人员</strong><p>确认管理权限后进入设备设置。</p><button type="button" class="pole-action" data-action="staff-login">模拟管理员验证</button></div>`;
  }
  const { network, volume, brightness } = state.settingsDraft || state.settings;
  return `<h2 class="pole-title" tabindex="-1">设备设置</h2>
    <form id="pole-settings" class="pole-panel">
      <label for="network">联网方式</label>
      <select id="network" name="network"><option ${network === "以太网" ? "selected" : ""}>以太网</option><option ${network === "Wi-Fi" ? "selected" : ""}>Wi-Fi</option></select>
      <p>当前网络 · ${conditions[state.condition].network}</p>
      <label for="volume">音量 <output id="volume-value" for="volume">${volume}%</output></label>
      <input type="range" name="volume" id="volume" min="0" max="100" value="${volume}">
      <label for="brightness">屏幕亮度 <output id="brightness-value" for="brightness">${brightness}%</output></label>
      <input type="range" name="brightness" id="brightness" min="30" max="100" value="${brightness}">
      <button class="pole-action" type="submit">保存设备设置</button>
      <button class="pole-outline" type="button" data-action="connect">测试联网</button>
      <p id="settings-message" role="status">${state.settingsMessage}</p>
    </form>
    <div class="pole-panel voice-settings"><strong>语音播报 · ${state.trail?.voice?.enabled ? "已开启" : "已关闭"}</strong><p>${poleEscape(state.trail?.voice?.text || "暂无播报文案")}</p><button type="button" class="pole-outline" data-action="voice-preview" ${!state.trail?.voice?.enabled ? "disabled" : ""}>模拟语音播报</button></div>
    <button class="pole-outline" type="button" data-action="ops-from-settings">设备绑定与自检</button>`;
}

function publicScreen() {
  const control = poleControl();
  const trail = poleTrail();
  if (!control.screenOn) {
    return `<article class="device"><div class="pole-screen pole-power-off"><div><span aria-hidden="true">◯</span><p>屏幕已关闭</p><small>管理后台开屏后恢复展示</small></div></div></article>`;
  }
  let page = state.polePage;
  if (!["settings", "authorize", "register", "records"].includes(page) && ["map", "rank", "notice", "ad"].includes(control.content)) page = control.content;
  if (page === "ad" && (control.content === "ad" || state.park.adEnabled)) {
    return `<article class="device ad-device"><button type="button" class="advertisement" data-action="wake">${state.park.ad ? `<img src="${state.park.ad}" alt="打卡杆广告屏保">` : '<div class="ad-waiting"><strong>广告屏保待配置</strong><p>请在管理后台上传广告图片</p></div>'}<span>${control.content === "ad" ? "远程指定广告屏保" : "轻触返回步道地图"}</span></button></article>`;
  }
  const info = conditions[state.condition];
  const paused = !control.collecting || trail?.enabled === false;
  const status = `<span class="pole-status${state.condition === "online" && !paused ? "" : " warning"}">${paused ? "本点位暂停记录" : info.sign}</span>`;
  const gear = '<button class="gear-button" type="button" aria-label="设备设置" data-action="pole-page" data-value="settings">⚙</button>';
  const pages = { map: mapScreen, rank: rankScreen, authorize: authorizationScreen, register: registrationScreen, records: recordsScreen, settings: settingsScreen, notice: noticeScreen };
  const unbound = state.condition === "unbound";
  const content = unbound && page !== "settings"
    ? '<div class="location"><p>设备正在调试</p><h2 tabindex="-1">待启用</h2></div><p>点位配置完成后开放运动记录。</p>'
    : (pages[page] || mapScreen)();
  const voice = state.trail?.voice;
  return `<article class="device"><div class="pole-screen" style="--screen-brightness:${0.52 + (page === "settings" && state.settingsDraft ? state.settingsDraft.brightness : state.settings.brightness) * 0.0048}">
    <div class="device-head"><strong>${poleEscape(poleProjectName(trail?.project))}智慧步道</strong>${status}${gear}</div>
    <div class="pole-content">${content}</div>
    ${voice && state.trail.lastVoice ? `<p class="pole-voice" role="status"><span aria-hidden="true">♪</span> ${poleEscape(state.trail.lastVoice)}</p>` : ""}
    ${!unbound || page === "settings" ? `<nav class="pole-nav" aria-label="杆屏功能">
      <button type="button" data-action="pole-page" data-value="map" aria-pressed="${page === "map"}">点位地图</button>
      ${unbound ? "" : `<button type="button" data-action="pole-page" data-value="rank" aria-pressed="${page === "rank" || page === "authorize"}">运动榜</button>
      <button type="button" data-action="pole-page" data-value="records" aria-pressed="${page === "records" || page === "register"}">个人数据</button>`}
    </nav>` : ""}
  </div></article>`;
}

function rankingScreen() {
  const trailState = state.trail;
  const boards = trailState?.boards || [];
  const board = boards.find((item) => item.id === trailState.selectedScreen) || boards[0];
  const trail = trailState?.trails.find((item) => item.id === board?.trailId);
  const period = state.boardPeriod || "today";
  const ready = Boolean(trail && trail.enabled !== false);
  const data = ready ? poleRanking(trail, period) : [];
  const selected = boards.map((item) => `<button type="button" data-action="board-select" data-value="${poleEscape(item.id)}" aria-pressed="${item.id === board?.id}">${poleEscape(item.id)} · ${poleEscape(item.label)}</button>`).join("");
  const rows = data.map((item) => `<li${item.self ? ' class="rank-self"' : ""}><span class="board-rank-number">${item.rank}</span><span class="board-runner">${poleEscape(item.name)}${item.self ? '<small>我</small>' : ""}</span><strong>${(item.distance / 1000).toFixed(2)}<small>公里</small></strong></li>`).join("");
  const screenOn = board?.screenOn !== false;
  const registration = ready && !poleRegistered(trail.project) ? `<details class="board-registration"><summary>开通本项目步道记录</summary><p>同意在排行屏模拟人脸核验，随后用本人微信确认绑定到${poleEscape(poleProjectName(trail.project))}。</p><button class="pole-action" type="button" data-action="board-register" data-value="${poleEscape(board.id)}" ${state.condition !== "online" ? "disabled" : ""}>同意并模拟人脸核验</button></details>` : "";
  return `<section class="ranking-preview" aria-label="独立排行榜设备预览"><div class="ranking-console" aria-label="切换排行屏设备">${selected || "尚未配置排行屏"}</div>
    <article class="ranking-device${!screenOn ? " board-power-off" : ""}">
      ${!screenOn ? '<div class="board-waiting"><p>屏幕已关闭</p><small>管理后台开屏后恢复展示</small></div>' : `<header class="board-heading"><div><p>${poleEscape(trail ? poleProjectName(trail.project) : "待配置公园")} · 智慧步道</p><h2>${poleEscape(trail?.name || "待绑定步道")}运动榜</h2></div><span class="board-device-label">${poleEscape(board?.label || "独立排行屏")}</span></header>
      <div class="board-scope"><span>${ready ? "仅统计本步道有效运动距离" : "设备等待配置"}</span><div class="rank-tabs" aria-label="排行屏榜单时段"><button type="button" data-action="board-period" data-value="today" aria-pressed="${period === "today"}">今日榜</button><button type="button" data-action="board-period" data-value="total" aria-pressed="${period === "total"}">本站总榜</button></div></div>
      ${ready ? `<div class="board-table-head"><span>排名</span><span>运动者</span><span>运动距离</span></div><ol class="board-ranking">${rows || '<li class="board-empty">暂无已授权的有效运动记录</li>'}</ol>` : '<div class="board-waiting"><strong>等待绑定可用步道</strong><p>在管理后台为此排行屏绑定已启用的步道。</p></div>'}
      <footer class="board-footer"><span>${state.condition === "offline" ? "离线 · 显示上次同步榜单" : "同距离并列 · 昵称脱敏展示"}</span><span>${poleEscape(board?.id || "未绑定设备")} · ${period === "today" ? "今日累计" : "历史累计"}</span></footer>${registration}`}
    </article></section>`;
}

function legacyAdminScreen() {
  const { points, crossing, distances } = route();
  const fields = distances.map((distance, index) => `<label>${points[index]} — ${points[index + 1]} ${index === crossing ? "（过街段）" : ""}
    <span class="field-unit"><input name="distance-${index}" type="number" min="1" step="1" required value="${distance}"> 米</span></label>`).join("");
  return `<article class="shared-admin">
    <aside class="admin-menu"><strong>社会体育管理后台</strong>
      <small>内容管理</small>
      <a href="../../landscape/v1.0/admin.html#videos">运动视频</a>
      <a href="../../landscape/v1.0/admin.html#notice">公告设置</a>
      <span aria-current="page">智慧步道</span>
    </aside>
    <div class="admin-content"><div class="admin-top"><h2>智慧步道</h2><span>中城绿谷 · 管理员</span></div>
      <form id="trail-config">
        <section class="admin-card">
          <h3>公园地图</h3>
          <label for="park-map-file">上传地图图片</label><input id="park-map-file" name="map" type="file" accept="image/png,image/jpeg,image/webp">
          ${state.park.map ? "" : '<div class="admin-image">当前使用示意地图</div>'}
          ${state.park.map ? `<label for="map-marker">标注点位</label><select id="map-marker">${points.map((point) => `<option value="${point}">${point} 点</option>`).join("")}</select>
            <button type="button" class="admin-map-target" aria-label="在地图上选择当前标记位置" data-action="place-marker">
              <img src="${state.park.map}" alt="">
              ${points.map((point) => {
                const [x, y] = (state.park.positions || parkPositions)[point];
                return `<span style="left:${x}%;top:${y}%">${point}</span>`;
              }).join("")}
            </button>
            <p class="muted">在图上点按放置标记，键盘可在下方输入横纵位置。</p>
            <div class="marker-position"><label>横向 % <input id="marker-x" type="number" min="0" max="100" value="${(state.park.positions || parkPositions)[points[0]][0]}"></label>
              <label>纵向 % <input id="marker-y" type="number" min="0" max="100" value="${(state.park.positions || parkPositions)[points[0]][1]}"></label>
              <button class="button secondary" type="button" data-action="apply-marker">保存点位</button></div>` : ""}
        </section>
        <section class="admin-card"><h3>杆间距离</h3><p class="muted">${state.route === "four" ? "四杆方案" : "两杆方案"} · 填现场标定距离</p><div class="distance-fields">${fields}</div></section>
        <section class="admin-card">
          <h3>打卡杆广告屏保</h3>
          <label class="checkbox"><input type="checkbox" name="adEnabled" ${state.park.adEnabled ? "checked" : ""}> 启用广告屏保</label>
          <label for="ad-file">上传广告图片</label><input id="ad-file" name="ad" type="file" accept="image/png,image/jpeg,image/webp">
          ${state.park.ad ? `<div class="admin-image"><img src="${state.park.ad}" alt="已保存的广告图"></div>` : ""}
          <label>无操作后播放 <span class="field-unit"><input type="number" name="idleSeconds" min="1" max="600" required value="${state.park.idleSeconds}"> 秒</span></label>
        </section>
        <button class="button admin-save" type="submit">保存并应用到杆屏</button>
        <p id="config-message" tabindex="-1" role="status">${state.configMessage}</p>
      </form>
    </div>
  </article>`;
}

function handlePoleAction(button) {
  const { action, value } = button.dataset;
  switch (action) {
    case "board-select":
      if (state.trail?.boards.some((board) => board.id === value)) state.trail.selectedScreen = value;
      return true;
    case "board-period":
      if (["today", "total"].includes(value)) state.boardPeriod = value;
      return true;
    case "board-register": {
      const board = state.trail.boards.find((item) => item.id === value && item.screenOn !== false);
      if (board && beginDemoRegistration(board.trailId, `排行屏 ${board.id}`)) {
        selectDemoTrail(board.trailId);
        openDemoMini("profile");
      }
      return true;
    }
    case "registration-capture": {
      if (["fault", "offline", "unbound"].includes(state.condition) || poleTrail()?.enabled === false) return true;
      if (typeof beginDemoRegistration === "function") beginDemoRegistration(poleTrail().id, "pole");
      state.faceVerified = true;
      return true;
    }
    case "registration-mini":
      if (typeof openDemoMini === "function") openDemoMini("profile");
      state.faceVerified = false;
      return true;
    case "records-mini":
      if (typeof openDemoMini === "function") openDemoMini("today");
      return true;
    case "voice-preview":
      if (state.trail?.voice?.enabled) {
        state.trail.lastVoice = state.trail.voice.text;
        state.settingsMessage = "已模拟语音播报。";
      }
      return true;
    case "map-point":
      state.mapPoint = value;
      return true;
    case "pole-page":
      state.polePage = value;
      state.faceVerified = false;
      state.staff = false;
      state.settingsMessage = "";
      state.settingsDraft = null;
      return true;
    case "rank-period":
      state.rankPeriod = value;
      return true;
    case "face-check":
      state.faceVerified = true;
      return true;
    case "rank-consent":
      if (state.faceVerified) state.ranked = !state.ranked;
      state.faceVerified = false;
      state.polePage = "rank";
      return true;
    case "staff-login":
      state.staff = true;
      return true;
    case "connect":
      state.settingsDraft = readDeviceSettings(new FormData(button.form));
      if (state.condition === "offline") state.condition = "online";
      sync();
      state.settingsMessage = `${state.settingsDraft.network}联网测试完成，${conditions[state.condition].network}（模拟）。`;
      return true;
    case "ops-from-settings":
      state.view = "ops";
      state.staff = false;
      state.polePage = "map";
      return true;
    case "wake":
      if (poleControl().content === "ad") state.notice = "当前广告屏保由管理后台远程指定，请在设备控制中切回自动展示。";
      state.polePage = "map";
      return true;
    default:
      return false;
  }
}

function showAdvertisement() {
  if (state.view !== "public" || state.polePage !== "map" ||
      !state.park.adEnabled || !state.park.ad || !canRecord() || !poleControl().screenOn || poleControl().content !== "auto") return;
  state.polePage = "ad";
  render();
}

function refreshIdleTimer() {
  clearTimeout(idleTimer);
  if (state.view === "public" && state.polePage === "map" && state.park.adEnabled && canRecord() && poleControl().screenOn && poleControl().content === "auto") {
    idleTimer = setTimeout(showAdvertisement, state.park.idleSeconds * 1000);
  }
}

function setMapMarker(event, button) {
  const marker = preview.querySelector("#map-marker");
  if (!marker) return;
  const xField = preview.querySelector("#marker-x");
  const yField = preview.querySelector("#marker-y");
  const target = preview.querySelector(".admin-map-target");
  if (button === target && event.detail !== 0) {
    const bounds = target.getBoundingClientRect();
    xField.value = Math.max(0, Math.min(100, Math.round((event.clientX - bounds.left) / bounds.width * 100)));
    yField.value = Math.max(0, Math.min(100, Math.round((event.clientY - bounds.top) / bounds.height * 100)));
  }
  if (!xField.value || !yField.value || !xField.reportValidity() || !yField.reportValidity()) return;
  const point = marker.value;
  const position = [Number(xField.value), Number(yField.value)];
  state.park.positions = { ...(state.park.positions || parkPositions), [point]: position };
  const pin = [...target.querySelectorAll("span")].find((span) => span.textContent === point);
  pin.style.left = position[0] + "%";
  pin.style.top = position[1] + "%";
  preview.querySelector("#config-message").textContent = `${point} 点标记已应用。`;
}

function setImage(key, file) {
  if (!file.size) return;
  if (state.park[key]) URL.revokeObjectURL(state.park[key]);
  state.park[key] = URL.createObjectURL(file);
}

function readDeviceSettings(data) {
  return { network: data.get("network"), volume: Number(data.get("volume")), brightness: Number(data.get("brightness")) };
}

function wirePoleForms() {
  preview.addEventListener("input", (event) => {
    const { id, value } = event.target;
    if (id === "volume" || id === "brightness") {
      preview.querySelector("#" + id + "-value").value = value + "%";
    }
    if (id === "brightness") preview.querySelector(".pole-screen").style.setProperty("--screen-brightness", 0.52 + Number(value) * 0.0048);
    if (id === "map-marker") {
      const [x, y] = (state.park.positions || parkPositions)[value];
      preview.querySelector("#marker-x").value = x;
      preview.querySelector("#marker-y").value = y;
    }
  });

  preview.addEventListener("submit", (event) => {
    event.preventDefault();
    const form = event.target;
    const data = new FormData(form);
    if (form.id === "pole-settings") {
      state.settings = readDeviceSettings(data);
      state.settingsDraft = null;
      state.settingsMessage = "设备设置已保存（模拟）。";
      preview.querySelector("#settings-message").textContent = state.settingsMessage;
      return;
    }
    if (form.id !== "trail-config") return;
    if (!adminCanEdit()) return;
    const ad = data.get("ad");
    const map = data.get("map");
    const enabled = data.has("adEnabled");
    const feedback = preview.querySelector("#config-message");
    if (enabled && !state.park.ad && !ad.size) {
      feedback.textContent = "启用屏保前，请先上传广告图片。";
      return;
    }
    if ([ad, map].some((file) => file.size && !["image/jpeg", "image/png", "image/webp"].includes(file.type))) {
      feedback.textContent = "请选择 JPG、PNG 或 WebP 图片。";
      return;
    }
    const oldDistances = route().distances;
    const distances = oldDistances.map((_, index) => Number(data.get("distance-" + index)));
    if (distances.some((distance, index) => distance !== oldDistances[index])) {
      archiveDemoJourney();
      state.configuredDistances[state.route] = distances;
      state.configMessage = "新距离已生效，已结算记录保留原距离。";
    } else {
      state.configMessage = "已应用到杆屏预览。";
    }
    setImage("map", map);
    if (map.size) state.park.positions = null;
    setImage("ad", ad);
    state.park.adEnabled = enabled;
    state.park.idleSeconds = Number(data.get("idleSeconds"));
    if (!enabled && state.polePage === "ad") state.polePage = "map";
    logDemo("操作日志", "保存地图、距离及屏保配置", activeTrail().name);
    render();
    preview.querySelector("#config-message").focus({ preventScroll: true });
  });

  document.getElementById("idle").addEventListener("click", () => {
    if (state.park.adEnabled && state.park.ad && canRecord() && poleControl().screenOn && poleControl().content === "auto") {
      state.view = "public";
      state.polePage = "map";
      showAdvertisement();
      preview.querySelector("[data-action='wake']")?.focus({ preventScroll: true });
    } else {
      state.notice = "模拟屏保需要上传广告图、启用屏保，并让杆屏处于自动展示、可记录状态。";
      render();
    }
  });
  preview.addEventListener("pointerdown", refreshIdleTimer);
  preview.addEventListener("keydown", refreshIdleTimer);
}
