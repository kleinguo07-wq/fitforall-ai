"use strict";

const parkPositions = { A: [16, 76], B: [38, 59], C: [59, 40], D: [83, 21] };
const pointNames = { A: "南段端点", B: "过街前点位", C: "过街后点位", D: "北段端点" };
const rankingExamples = [
  { name: "晨跑者 · 林**", today: 6200, total: 42600 },
  { name: "步友 · 周**", today: 4800, total: 59100 },
  { name: "步友 · 陈**", today: 4800, total: 31200 },
  { name: "步友 · 徐**", today: 2100, total: 27300 },
];

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
  return `<div class="location"><p>你在这里</p><h2 tabindex="-1">${state.point} 点 <small>${pointNames[state.point]}</small></h2></div>
    ${parkMap()}
    <p class="map-details">${state.mapPoint} 点 · ${details}</p>
    <div class="recommend"><div><small>推荐下一个点位</small><strong>${recommended.point} 点 · ${pointNames[recommended.point]}</strong></div><b>${recommended.distance}<small> 米</small></b></div>
    <div class="direction-list">${directions}</div>
    ${state.route === "two" || suggestions.some((item) => item.crossing) ? '<p class="crossing-note">请按信号通行，过街注意安全。</p>' : ""}`;
}

function rankScreen() {
  const period = state.rankPeriod;
  const data = [...rankingExamples];
  const distance = confirmedSegments()
    .filter((segment) => segment.user === "演示用户" && !segment.crossing)
    .reduce((total, segment) => total + segment.distance, 0);
  if (state.ranked && distance > 0) data.push({ name: "演示用户 · 跑**", today: distance, total: distance });
  data.sort((first, second) => second[period] - first[period]);
  let rank = 0;
  const rows = data.map((item, index) => {
    if (index === 0 || item[period] !== data[index - 1][period]) rank = index + 1;
    return `<li><span class="rank-number">${rank}</span><span>${item.name}</span><strong>${(item[period] / 1000).toFixed(2)} 公里</strong></li>`;
  }).join("");
  return `<h2 class="pole-title" tabindex="-1">运动榜</h2><p class="pole-copy">中城绿谷本站 · 按有效里程排行</p>
    <div class="rank-tabs" aria-label="榜单时段">
      <button type="button" data-action="rank-period" data-value="today" aria-pressed="${period === "today"}">今日榜</button>
      <button type="button" data-action="rank-period" data-value="total" aria-pressed="${period === "total"}">本站总榜</button>
    </div>
    <ol class="ranking">${rows}</ol>
    ${state.condition === "offline" ? '<p class="pole-copy">网络离线，显示上次已同步的榜单。</p>' : ""}
    ${state.ranked && !distance ? '<p class="pole-copy">已授权上榜，产生有效运动里程后显示。</p>' : ""}
    <button class="pole-outline" type="button" data-action="pole-page" data-value="authorize">${state.ranked ? "管理上榜授权" : "人脸授权上榜"}</button>`;
}

function authorizationScreen() {
  return `<h2 class="pole-title" tabindex="-1">人脸授权上榜</h2>
    <p class="pole-copy">核验本人后，可以选择公开脱敏昵称和有效运动里程。</p>
    <div class="pole-panel">
      ${state.faceVerified
        ? `<strong>已核验本人（模拟）</strong><p>当前状态：${state.ranked ? "已授权上榜" : "未授权上榜"}</p>
          <button type="button" class="pole-action" data-action="rank-consent">${state.ranked ? "撤回上榜授权" : "同意公开上榜"}</button>`
        : `<strong>本人身份核验</strong><p>使用已开通步道记录的人脸身份核验。原型模拟核验结果。</p>
          <button type="button" class="pole-action" data-action="face-check" ${["fault", "offline"].includes(state.condition) ? "disabled" : ""}>同意并模拟人脸核验</button>`}
    </div>
    <button type="button" class="pole-outline" data-action="pole-page" data-value="records">小程序查个人数据</button>`;
}

function recordsScreen() {
  return `<h2 class="pole-title" tabindex="-1">查看个人运动数据</h2>
    <div class="pole-panel personal-entry"><div class="qr-placeholder">小程序码<br>示意</div>
      <div><strong>微信扫码打开现有小程序</strong><p>进入「跑步」，查看本人的步道运动记录。</p></div>
    </div>`;
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
    <button class="pole-outline" type="button" data-action="ops-from-settings">设备绑定与自检</button>`;
}

function publicScreen() {
  if (state.polePage === "ad" && state.park.adEnabled && state.park.ad) {
    return `<article class="device ad-device"><button type="button" class="advertisement" data-action="wake"><img src="${state.park.ad}" alt="打卡杆广告屏保"><span>轻触返回步道地图</span></button></article>`;
  }
  const info = conditions[state.condition];
  const status = `<span class="pole-status${state.condition === "online" ? "" : " warning"}">${info.sign}</span>`;
  const gear = '<button class="gear-button" type="button" aria-label="设备设置" data-action="pole-page" data-value="settings">⚙</button>';
  const pages = { map: mapScreen, rank: rankScreen, authorize: authorizationScreen, records: recordsScreen, settings: settingsScreen };
  const page = state.polePage;
  const unbound = state.condition === "unbound";
  const content = unbound && page !== "settings"
    ? '<div class="location"><p>设备正在调试</p><h2 tabindex="-1">待启用</h2></div><p>点位配置完成后开放运动记录。</p>'
    : pages[page]();
  return `<article class="device"><div class="pole-screen" style="--screen-brightness:${0.52 + (page === "settings" && state.settingsDraft ? state.settingsDraft.brightness : state.settings.brightness) * 0.0048}">
    <div class="device-head"><strong>中城绿谷智慧步道</strong>${status}${gear}</div>
    <div class="pole-content">${content}</div>
    ${!unbound || page === "settings" ? `<nav class="pole-nav" aria-label="杆屏功能">
      <button type="button" data-action="pole-page" data-value="map" aria-pressed="${page === "map"}">点位地图</button>
      ${unbound ? "" : `<button type="button" data-action="pole-page" data-value="rank" aria-pressed="${page === "rank" || page === "authorize"}">运动榜</button>
      <button type="button" data-action="pole-page" data-value="records" aria-pressed="${page === "records"}">个人数据</button>`}
    </nav>` : ""}
  </div></article>`;
}

function adminScreen() {
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
      state.polePage = "map";
      return true;
    default:
      return false;
  }
}

function showAdvertisement() {
  if (state.view !== "public" || state.polePage !== "map" ||
      !state.park.adEnabled || !state.park.ad || !canRecord()) return;
  state.polePage = "ad";
  render();
}

function refreshIdleTimer() {
  clearTimeout(idleTimer);
  if (state.view === "public" && state.polePage === "map" && state.park.adEnabled && canRecord()) {
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
      state.configuredDistances[state.route] = distances;
      resetJourney();
      state.configMessage = "已应用新距离，本次演示记录已重置。";
    } else {
      state.configMessage = "已应用到杆屏预览。";
    }
    setImage("map", map);
    if (map.size) state.park.positions = null;
    setImage("ad", ad);
    state.park.adEnabled = enabled;
    state.park.idleSeconds = Number(data.get("idleSeconds"));
    if (!enabled && state.polePage === "ad") state.polePage = "map";
    render();
    preview.querySelector("#config-message").focus({ preventScroll: true });
  });

  document.getElementById("idle").addEventListener("click", () => {
    if (state.park.adEnabled && state.park.ad && canRecord()) {
      state.view = "public";
      state.polePage = "map";
      showAdvertisement();
      preview.querySelector("[data-action='wake']").focus({ preventScroll: true });
    } else {
      state.notice = "请在管理后台上传广告图片并启用屏保，杆屏需处于可记录状态。";
      render();
    }
  });
  preview.addEventListener("pointerdown", refreshIdleTimer);
  preview.addEventListener("keydown", refreshIdleTimer);
}
