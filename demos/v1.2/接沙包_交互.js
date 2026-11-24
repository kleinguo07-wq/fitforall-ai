"use strict";

(() => {
  const ROUND_MS = 60000;
  const READY_MS = 3000;
  const GO_MS = 1000;
  const RESULT_MS = 10000;
  const LEVEL_STEP_MS = 12000;
  const SPRINT_START_MS = 48000;
  const HITS_PER_LEVEL = 2;
  const TIMELY_WINDOW_RATIO = .40;
  const MAX_REACTION_BONUS = 6;
  const STREAK_BONUS_STEP = 4;
  const timingLabels = { timely: "及时", normal: "接住", rescue: "补接" };
  const levels = [
    { gap: 550, windup: 300, preview: 1030, catchWindow: 1500, rescueWindow: 560, fall: 550, scale: 1,
      points: { timely: 10, normal: 7, rescue: 3 } },
    { gap: 440, windup: 280, preview: 900, catchWindow: 1380, rescueWindow: 560, fall: 520, scale: .94,
      points: { timely: 13, normal: 9, rescue: 4 } },
    { gap: 330, windup: 250, preview: 770, catchWindow: 1210, rescueWindow: 560, fall: 500, scale: .88,
      points: { timely: 16, normal: 11, rescue: 5 } },
    { gap: 235, windup: 215, preview: 650, catchWindow: 1040, rescueWindow: 560, fall: 475, scale: .81,
      points: { timely: 19, normal: 13, rescue: 6 } },
    { gap: 155, windup: 185, preview: 540, catchWindow: 900, rescueWindow: 560, fall: 450, scale: .75,
      points: { timely: 22, normal: 15, rescue: 7 } },
    { gap: 85, windup: 160, preview: 460, catchWindow: 760, rescueWindow: 560, fall: 440, scale: .70,
      points: { timely: 25, normal: 17, rescue: 8 } }
  ];
  const RECOVERY_MS = 10000;
  const demoPose = {
    shoulderWidth: .24,
    torsoHeight: .30,
    hipY: .66,
    hips: [{ x: .415 }, { x: .585 }],
    arms: [{ shoulder: { x: .38, y: .36 } }, { shoulder: { x: .62, y: .36 } }],
    face: [{ x: .50, y: .27 }]
  };
  const $ = id => document.getElementById(id);
  const device = $("device");
  const arena = $("arena");
  const target = $("target");
  const thrower = $("thrower");
  const airBag = $("air-bag");
  const actions = $("actions");
  const handDots = [$("left-hand"), $("right-hand")];
  const feedback = $("feedback");
  const flight = $("flight");
  const clamp = (n, min, max) => Math.min(max, Math.max(min, n));
  const position = (node, point) => {
    node.style.left = `${point.x * 100}%`;
    node.style.top = `${point.y * 100}%`;
  };

  let mode = "mouse";
  let simulation = "single";
  let phase = "intro";
  let resumePhase = null;
  let demoIdentity = "visitor";
  let identity = null;
  let phaseTime = 0;
  let elapsed = 0;
  let score = 0;
  let catches = 0;
  let streak = 0;
  let bestStreak = 0;
  let unlockedLevel = 0;
  let lastSide = 0;
  let sideRepeats = 0;
  let lastHeight = null;
  let heightRepeats = 0;
  let spaceRequired = 0;
  let activeTarget = null;
  let gapElapsed = 0;
  let feedbackUntil = 0;
  let flightAnimation = null;
  let lastTick = performance.now();
  let lastPoseAt = 0;
  let checkedPoseAt = 0;
  let latestPeople = [];
  let cameraState = "off";
  let cameraAttempt = 0;
  let player = null;
  let standStable = 0;
  let blockedFor = 0;
  let blockReason = "missing";
  let resultReason = "";
  let sound = false;
  let audioContext;

  function levelIndex() {
    if (elapsed >= SPRINT_START_MS) return levels.length - 1;
    const timeLevel = Math.floor(elapsed / LEVEL_STEP_MS);
    return Math.max(timeLevel, unlockedLevel);
  }
  const isPlaying = () => phase === "play";
  const isCatchable = stage => stage === "catch" || stage === "rescue";

  function makeButton(text, action, style = "primary") {
    const button = document.createElement("button");
    button.type = "button";
    button.className = style;
    button.dataset.action = action;
    button.textContent = text;
    return button;
  }

  const views = {
    home: ["趣味运动", "选择一个项目开始运动。", []],
    intro: ["接沙包", "一局 60 秒。沙包亮起就伸手，接得快、连得久，分数更高。", [["开始运动", "start"]]],
    screensaver: ["接沙包", "沙包亮起就伸手接，越及时分越高。", [["一键跟练", "start"], ["返回介绍", "exit", "secondary"]]],
    stand: ["请站进框内", "面向屏幕，双脚站稳。", [["返回", "exit", "icon-back"]]],
    face: ["正在识别", "请面向屏幕。", [["返回", "exit", "icon-back"]]],
    ready: ["准备开始", "", [["返回", "exit", "icon-back"]]],
    play: ["接沙包", "", [["返回", "stop", "icon-back"]]],
    pause: ["暂停一下", "", []],
    result: ["本局成绩", "", []]
  };

  function updateHud() {
    const remaining = Math.ceil(Math.max(0, ROUND_MS - elapsed) / 1000);
    const digits = value => String(value).padStart(2, "0");
    const shownLevel = activeTarget?.level ?? levelIndex();
    $("score").textContent = score;
    $("streak").textContent = streak;
    $("level").textContent = shownLevel + 1;
    $("sprint").hidden = shownLevel !== levels.length - 1;
    $("time").textContent = `${digits(Math.floor(remaining / 60))}:${digits(remaining % 60)}`;
  }

  function renderIdentity() {
    const member = identity === "member";
    $("hud-name").textContent = $("result-name").textContent = member ? "体验用户" : "游客";
    $("hud-avatar").textContent = $("result-avatar").textContent = member ? "体" : "访";
  }

  function renderResult() {
    $("result-score").textContent = score;
    $("result-catches").textContent = catches;
    $("result-best-streak").textContent = bestStreak;
    $("result-duration").textContent = Math.floor(elapsed / 1000);
    $("result-status").textContent = resultReason === "different" ? "检测到换人，本局已结束" : "本局已提前结束";
    $("result-status").hidden = resultReason === "complete";
    $("result-countdown").textContent = "10s";
  }

  function setPhase(next) {
    phase = next;
    phaseTime = 0;
    device.dataset.phase = next;
    const [heading, hint, buttons] = views[next];
    $("heading").textContent = heading;
    $("hint").textContent = hint;
    $("stage-title").textContent = heading;
    $("stage-hint").textContent = hint;
    $("stage-cue").hidden = !["stand", "face", "pause"].includes(next);
    $("hud").hidden = !identity || !["ready", "play", "pause"].includes(next);
    $("combo").hidden = next !== "play" && !(next === "pause" && resumePhase === "play");
    $("countdown").hidden = next !== "ready";
    if (next === "ready") $("countdown-number").textContent = "3";
    $("home-entry").hidden = next !== "home";
    $("result").hidden = next !== "result";
    $("quit").hidden = true;
    if (next === "result") renderResult();
    renderIdentity();
    actions.replaceChildren(...buttons.map(item => makeButton(...item)));
    renderThrow();
    if (!isPlaying()) handDots.forEach(dot => { dot.hidden = true; });
    if (next === "pause") {
      actions.replaceChildren(makeButton("返回", resumePhase === "play" ? "stop" : "exit", "icon-back"));
    }
    updateHud();
  }

  function renderTracking(status) {
    if (phase !== "stand" && phase !== "pause") return;
    const text = {
      single: phase === "stand" ? "正在确认站位…" : "站位已恢复，准备继续。",
      multiple: "请只留一位参与者在框内。",
      missing: "请回到框内，双手放在身侧。",
      space: "请回到站位框中间，给双手留出空间。",
      different: "请让刚才的参与者回到站位框。",
      loading: "正在启动摄像头和姿态识别…",
      error: "可以重试摄像头，或切换到鼠标体验。"
    }[status];
    $("stage-hint").textContent = text;
  }

  function stopCamera() {
    cameraAttempt += 1;
    camera?.stop();
    cameraState = "off";
    latestPeople = [];
    $("video").hidden = true;
    handDots.forEach(dot => { dot.hidden = true; });
  }

  function cameraFailure(message) {
    stopCamera();
    cameraState = "error";
    $("camera-notice").textContent = message;
    if (["play", "ready"].includes(phase)) pauseGame();
    if (phase === "face") {
      standStable = 0;
      player = null;
      setPhase("stand");
    }
    if (phase === "stand") actions.replaceChildren(makeButton("重试摄像头", "camera"), makeButton("返回", "exit", "icon-back"));
  }

  const camera = window.createSandbagCamera?.({
    video: $("video"),
    arena,
    onFrame(frame) {
      latestPeople = frame.people;
      lastPoseAt = performance.now();
    },
    onError(error) {
      cameraFailure(error.message || "摄像头暂时不可用。");
    }
  });

  async function startCamera() {
    if (!camera) return cameraFailure("姿态识别模块未加载。");
    if (cameraState === "loading" || cameraState === "on") return;
    const attempt = ++cameraAttempt;
    cameraState = "loading";
    $("camera-notice").textContent = "正在启动姿态识别…";
    renderTracking("loading");
    try {
      await camera.start();
      if (attempt !== cameraAttempt) return;
      cameraState = "on";
      $("video").hidden = false;
      $("camera-notice").textContent = "摄像头已打开，动作在本机识别。";
    } catch (error) {
      if (attempt === cameraAttempt) cameraFailure(error.message || "摄像头启动失败。");
    }
  }

  function clearFeedback() {
    feedback.hidden = true;
    flight.hidden = true;
    flightAnimation?.cancel();
    flightAnimation = null;
  }

  function resetRound() {
    elapsed = 0;
    score = 0;
    catches = 0;
    streak = 0;
    bestStreak = 0;
    unlockedLevel = 0;
    lastSide = 0;
    sideRepeats = 0;
    lastHeight = null;
    heightRepeats = 0;
    spaceRequired = 0;
    activeTarget = null;
    gapElapsed = 0;
    resumePhase = null;
    player = null;
    standStable = 0;
    blockedFor = 0;
    resultReason = "";
    identity = null;
    clearFeedback();
  }

  function startStand() {
    stopCamera();
    resetRound();
    simulation = "single";
    updateControls();
    setPhase("stand");
    if (mode === "camera") startCamera();
  }

  function showIntro(destination = "intro") {
    stopCamera();
    resetRound();
    simulation = "single";
    setPhase(destination);
    updateControls();
  }

  function updateControls() {
    device.dataset.mode = mode;
    $("input-mode").querySelectorAll("[data-mode]").forEach(control => {
      control.setAttribute("aria-pressed", String(control.dataset.mode === mode));
    });
    $("simulate").hidden = mode !== "mouse";
    $("simulate").querySelectorAll("[data-sim]").forEach(control => {
      control.setAttribute("aria-pressed", String(control.dataset.sim === simulation));
    });
    $("camera-notice").textContent = mode === "mouse"
      ? "用鼠标或手指点亮起的沙包。"
      : "点「开始运动」后，浏览器会请求摄像头权限。";
  }

  function startReady() {
    activeTarget = null;
    setPhase("ready");
  }

  function startPlay() {
    elapsed = 0;
    score = 0;
    catches = 0;
    streak = 0;
    bestStreak = 0;
    unlockedLevel = 0;
    gapElapsed = 0;
    clearFeedback();
    setPhase("play");
    beginThrow();
  }

  function endRound(reason) {
    if (phase === "result" || phase === "intro") return;
    resultReason = reason;
    activeTarget = null;
    clearFeedback();
    stopCamera();
    setPhase("result");
    if (mode === "camera") $("camera-notice").textContent = "本局结束，摄像头已关闭。";
  }

  function bodyEdge(pose, side) {
    const torsoPoints = [...pose.arms.map(arm => arm.shoulder), ...pose.hips, ...pose.face];
    return torsoPoints.reduce((edge, point) => Math.max(edge, side * point.x), -Infinity) * side;
  }

  function headLineY(pose, shoulderY, torso, fieldHeight) {
    const faceY = pose.face.map(point => point.y * fieldHeight).filter(Number.isFinite);
    return Math.min(shoulderY - torso * .22, ...faceY);
  }

  function targetLanes(pose, field, radius, side) {
    const arm = pose.arms[side < 0 ? 0 : 1];
    const shoulderX = arm.shoulder.x * field.width;
    const shoulderY = arm.shoulder.y * field.height;
    const torso = pose.torsoHeight * field.height;
    const shoulderWidth = pose.shoulderWidth * field.width;
    const estimate = Math.max(shoulderWidth * .94, torso * .92);
    const distance = (a, b) => Math.hypot((a.x - b.x) * field.width, (a.y - b.y) * field.height);
    const armLength = arm.elbow && arm.wrist
      ? clamp(distance(arm.shoulder, arm.elbow) + distance(arm.elbow, arm.wrist), estimate * .78, estimate * 1.42)
      : estimate;
    const reach = armLength * .84 + radius * .25;
    const insideX = bodyEdge(pose, side) * field.width + side * (radius + Math.max(9, shoulderWidth * .07));
    const edgeX = side > 0 ? field.width - radius - 8 : radius + 8;
    const xDistance = Math.abs(insideX - shoulderX);
    if (side * (edgeX - insideX) < 3 || xDistance >= reach) return [];

    const verticalReach = Math.sqrt(reach ** 2 - xDistance ** 2);
    const floor = Math.min(
      pose.hipY * field.height - radius - 4,
      field.height - radius - 8,
      shoulderY + verticalReach
    );
    const highRoof = Math.max(
      field.height * .14 + radius,
      headLineY(pose, shoulderY, torso, field.height),
      shoulderY - verticalReach
    );
    const bands = [
      { height: "low", roof: Math.max(radius + 6, shoulderY + radius + 1), floor },
      { height: "high", roof: highRoof, floor: Math.min(floor, shoulderY - Math.max(5, torso * .07)) }
    ];
    return bands.filter(band => band.floor - band.roof >= 10).map(band => (
      { ...band, side, reach, shoulderX, shoulderY, edgeX, insideX, torso }
    ));
  }

  function locateLanes(pose, field, nominalRadius) {
    const largest = Math.min(nominalRadius, pose.torsoHeight * field.height * .29);
    for (const scale of [1, .82, .66]) {
      const radius = largest * scale;
      if (radius < 16) return null;
      const lanes = [-1, 1].flatMap(side => targetLanes(pose, field, radius, side));
      if (lanes.length) return { radius, lanes };
    }
    return null;
  }

  function choosePath(lanes, field) {
    const otherSide = sideRepeats >= 2 ? lanes.filter(lane => lane.side !== lastSide) : [];
    const usable = otherSide.length ? otherSide : lanes;
    const otherHeight = heightRepeats >= 2 ? usable.filter(lane => lane.height !== lastHeight) : [];
    const candidates = otherHeight.length ? otherHeight : usable;
    const lane = candidates[Math.floor(Math.random() * candidates.length)];
    const { side, height, roof, floor, reach, shoulderX, shoulderY, edgeX, insideX, torso } = lane;
    const sweepY = Math.min((floor - roof) * .34, torso * .132);
    // Keep the complete movement inside the reach envelope, including at the end of the rescue window.
    const startY = roof + (floor - roof - sweepY) * (.08 + .78 * Math.random());
    const farthestY = Math.max(Math.abs(startY - shoulderY), Math.abs(startY + sweepY - shoulderY));
    const reachX = shoulderX + side * Math.sqrt(Math.max(0, reach ** 2 - farthestY ** 2));
    const outsideX = side > 0 ? Math.min(edgeX, reachX) : Math.max(edgeX, reachX);
    const availableX = Math.max(0, side * (outsideX - insideX));
    const sweepX = Math.min(availableX * .28, torso * .07);
    const startX = insideX + side * (availableX - sweepX) * (.15 + .78 * Math.random());
    sideRepeats = lastSide === side ? sideRepeats + 1 : 1;
    heightRepeats = lastHeight === height ? heightRepeats + 1 : 1;
    lastSide = side;
    lastHeight = height;
    return {
      side,
      height,
      startX: startX / field.width,
      startY: startY / field.height,
      sweepX: side * sweepX / field.width,
      sweepY: sweepY / field.height,
      exitX: (outsideX - startX - side * sweepX) / field.width
    };
  }

  function hasPlayingSpace(pose) {
    if (!activeTarget && !spaceRequired) return true;
    const field = arena.getBoundingClientRect();
    if (spaceRequired && !locateLanes(pose, field, spaceRequired)) return false;
    if (!activeTarget || activeTarget.stage === "fall") return true;
    const { path, point, radius } = activeTarget;
    const x = point?.x ?? path.startX;
    const y = point?.y ?? path.startY;
    const yPx = y * field.height;
    const shoulderY = pose.arms[path.side < 0 ? 0 : 1].shoulder.y * field.height;
    const heightSlack = 12;
    const fitsHeight = path.height === "high"
      ? yPx + heightSlack >= headLineY(pose, shoulderY, pose.torsoHeight * field.height, field.height)
        && yPx - heightSlack <= shoulderY
      : yPx - shoulderY + heightSlack >= radius;
    return path.side * (x - bodyEdge(pose, path.side)) * field.width >= radius
      && fitsHeight
      && (pose.hipY - y) * field.height + heightSlack >= radius;
  }

  function isInside(point, center) {
    if (!point) return false;
    const area = arena.getBoundingClientRect();
    const radius = target.getBoundingClientRect().width / 2;
    return Math.hypot((point.x - center.x) * area.width, (point.y - center.y) * area.height) <= radius;
  }

  function beginThrow() {
    const level = levelIndex();
    const pace = levels[level];
    const field = arena.getBoundingClientRect();
    target.style.setProperty("--bag-scale", pace.scale);
    target.hidden = false;
    const nominalRadius = target.offsetWidth / 2;
    target.hidden = true;
    const fit = locateLanes(mode === "camera" && player ? player : demoPose, field, nominalRadius);
    if (!fit) {
      spaceRequired = nominalRadius;
      return;
    }
    spaceRequired = 0;
    const path = choosePath(fit.lanes, field);
    const mascot = thrower.getBoundingClientRect();
    activeTarget = {
      age: 0,
      stage: "windup",
      level,
      pace,
      path,
      radius: fit.radius,
      bottom: 1 + (fit.radius + 10) / field.height,
      origin: {
        x: (mascot.left + mascot.width * (path.side < 0 ? .14 : .86) - field.left) / field.width,
        y: (mascot.top + mascot.height * .70 - field.top) / field.height
      },
      point: null,
      armed: [false, false],
      contacts: [null, null]
    };
    target.style.setProperty("--bag-scale", pace.scale * fit.radius / nominalRadius);
    renderThrow();
  }

  function approachPoint(bag, progress) {
    const { path } = bag;
    return {
      x: path.startX + path.sweepX * progress,
      y: path.startY + path.sweepY * (.38 * progress + .62 * progress ** 2)
    };
  }

  function throwPoint(bag) {
    const { path, pace } = bag;
    const trajectoryMs = pace.preview + pace.catchWindow + pace.rescueWindow;
    const airAge = bag.age - pace.windup;
    if (airAge <= trajectoryMs) return approachPoint(bag, airAge / trajectoryMs);
    const fall = (airAge - trajectoryMs) / pace.fall;
    const end = approachPoint(bag, 1);
    const fallingDistance = bag.bottom - end.y;
    const downwardMomentum = Math.min(fallingDistance, 1.62 * path.sweepY * pace.fall / trajectoryMs);
    return {
      x: end.x + path.side * Math.min(Math.abs(path.exitX), Math.abs(path.sweepX * (airAge - trajectoryMs) / trajectoryMs)),
      y: end.y + downwardMomentum * fall + (fallingDistance - downwardMomentum) * fall ** 2
    };
  }

  function renderThrow() {
    const bag = isPlaying() ? activeTarget : null;
    const stage = bag?.stage ?? "gap";
    if (arena.dataset.throwStage !== stage) arena.dataset.throwStage = stage;
    const flightAge = bag ? bag.age - bag.pace.windup : 0;
    let pose = "idle";
    if (stage === "windup") pose = "windup";
    if (stage === "preview" && flightAge < 160) pose = "release";
    else if (stage === "preview" && flightAge < 410) pose = "follow";
    if (thrower.dataset.pose !== pose) thrower.dataset.pose = pose;
    if (bag) thrower.dataset.side = bag.path.side < 0 ? "left" : "right";

    target.hidden = !bag || stage === "windup";
    target.disabled = !isCatchable(stage);
    target.classList.toggle("timely", stage === "catch" && hitTiming(bag.pace, bag.age) === "timely");
    if (!target.hidden) {
      if (target.dataset.catch !== stage) target.dataset.catch = stage;
      position(target, bag.point);
    }
    airBag.hidden = stage !== "preview";
    if (!airBag.hidden) {
      const t = flightAge / bag.pace.preview;
      const flash = approachPoint(bag, bag.pace.preview / (bag.pace.preview + bag.pace.catchWindow + bag.pace.rescueWindow));
      const drop = flash.y - bag.origin.y;
      position(airBag, {
        x: bag.origin.x + (flash.x - bag.origin.x) * t,
        y: bag.origin.y + drop * t - Math.max(.65, drop + .22) * t * (1 - t)
      });
      airBag.style.setProperty("--air-spin", `${-22 + t * bag.path.side * 152}deg`);
    }
  }

  function armHands(hands) {
    if (isCatchable(activeTarget.stage)) {
      activeTarget.armed = [0, 1].map(i => Boolean(hands[i]) && !isInside(hands[i], activeTarget.point));
      activeTarget.contacts = [null, null];
    }
  }

  function stepThrow(dt, hands) {
    if (!activeTarget) {
      gapElapsed += dt;
      if (gapElapsed >= levels[levelIndex()].gap) beginThrow();
      return;
    }

    const bag = activeTarget;
    const { windup, preview, catchWindow, rescueWindow, fall } = bag.pace;
    bag.age += dt;
    const sinceFlash = bag.age - windup - preview;
    const sinceRescue = sinceFlash - catchWindow;
    if (bag.age < windup) return;
    if (sinceRescue >= rescueWindow + fall) {
      streak = 0;
      retireTarget();
      return;
    }

    const wasCatchable = isCatchable(bag.stage);
    if (sinceFlash < 0) bag.stage = "preview";
    else if (sinceRescue < 0) bag.stage = "catch";
    else if (sinceRescue < rescueWindow) bag.stage = "rescue";
    else bag.stage = "fall";
    bag.point = throwPoint(bag);
    renderThrow();
    if (!wasCatchable && isCatchable(bag.stage)) armHands(hands);
    checkHands(hands);
  }

  function retireTarget() {
    activeTarget = null;
    gapElapsed = 0;
    renderThrow();
  }

  function playCue() {
    if (!sound || !audioContext || audioContext.state !== "running") return;
    const note = audioContext.createOscillator();
    const gain = audioContext.createGain();
    const time = audioContext.currentTime;
    note.frequency.setValueAtTime(520, time);
    note.frequency.exponentialRampToValueAtTime(740, time + .1);
    gain.gain.setValueAtTime(.07, time);
    gain.gain.exponentialRampToValueAtTime(.001, time + .18);
    note.connect(gain).connect(audioContext.destination);
    note.start();
    note.stop(time + .19);
  }

  function feedbackAt(point, timing, points, reactionBonus, streakBonus) {
    $("feedback-points").textContent = `${timingLabels[timing]} +${points}`;
    const bonuses = [];
    if (reactionBonus) bonuses.push(`反应 +${reactionBonus}`);
    if (streakBonus) bonuses.push(`连击 +${streakBonus}`);
    $("feedback-bonus").textContent = bonuses.join(" · ");
    $("feedback-bonus").hidden = !bonuses.length;
    feedback.dataset.timing = timing;
    feedback.hidden = false;
    feedbackUntil = performance.now() + 650;
    flightAnimation?.cancel();
    const start = { left: `${point.x * 100}%`, top: `${point.y * 100}%` };
    flight.hidden = false;
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 1 : 460;
    const destination = $("basket").getBoundingClientRect();
    const field = arena.getBoundingClientRect();
    const end = {
      left: `${(destination.left + destination.width / 2 - field.left) / field.width * 100}%`,
      top: `${(destination.top + destination.height / 2 - field.top) / field.height * 100}%`
    };
    flightAnimation = flight.animate([start, end], { duration: motion, easing: "ease-in", fill: "both" });
    playCue();
  }

  function hitTiming(pace, age) {
    const reactionMs = age - pace.windup - pace.preview;
    if (reactionMs < pace.catchWindow * TIMELY_WINDOW_RATIO) return "timely";
    if (reactionMs < pace.catchWindow) return "normal";
    return "rescue";
  }

  function hit(contactAge = activeTarget?.age) {
    if (!isPlaying() || !$("quit").hidden || !isCatchable(activeTarget?.stage) || elapsed >= ROUND_MS) return;
    const { point, pace } = activeTarget;
    const timing = hitTiming(pace, contactAge);
    catches += 1;
    streak += 1;
    bestStreak = Math.max(bestStreak, streak);
    const reactionMs = contactAge - pace.windup - pace.preview;
    const timelyMs = pace.catchWindow * TIMELY_WINDOW_RATIO;
    const reactionBonus = timing === "timely"
      ? Math.round(MAX_REACTION_BONUS * clamp(1 - reactionMs / timelyMs, 0, 1))
      : 0;
    const streakBonus = timing === "rescue" ? 0 : Math.floor(streak / STREAK_BONUS_STEP);
    const points = pace.points[timing] + reactionBonus + streakBonus;
    score += points;
    if (elapsed < SPRINT_START_MS && streak % HITS_PER_LEVEL === 0) {
      unlockedLevel = Math.min(levelIndex() + 1, levels.length - 2);
    }
    retireTarget();
    feedbackAt(point, timing, points, reactionBonus, streakBonus);
    updateHud();
  }

  function checkHands(hands) {
    if (mode !== "camera" || !isCatchable(activeTarget.stage) || checkedPoseAt === lastPoseAt) return;
    checkedPoseAt = lastPoseAt;
    let earliestContact = Infinity;
    for (let i = 0; i < 2; i++) {
      const wrist = hands[i];
      if (!wrist) {
        activeTarget.armed[i] = false;
        activeTarget.contacts[i] = null;
        continue;
      }
      if (!isInside(wrist, activeTarget.point)) {
        activeTarget.armed[i] = true;
        activeTarget.contacts[i] = null;
      } else if (activeTarget.armed[i]) {
        const contact = activeTarget.contacts[i] ??= { at: lastPoseAt, age: activeTarget.age };
        const holdMs = activeTarget.stage === "rescue" ? 50 : 85;
        if (lastPoseAt - contact.at >= holdMs) {
          earliestContact = Math.min(earliestContact, contact.age);
        }
      }
    }
    if (Number.isFinite(earliestContact)) hit(earliestContact);
  }

  function getTracking(now) {
    if (mode === "mouse") return { status: simulation, pose: null };
    if (cameraState !== "on") return { status: cameraState === "error" ? "error" : "loading" };
    if (now - lastPoseAt > 450) return { status: "missing" };
    const people = latestPeople.filter(({ center }) => center.x >= .13 && center.x <= .87 && center.y >= .18 && center.y <= .86);
    if (people.length > 1) return { status: "multiple" };
    const pose = people[0];
    if (!pose || !pose.hands.some(Boolean)) return { status: "missing" };
    if (player) {
      const moved = Math.hypot(pose.center.x - player.center.x, pose.center.y - player.center.y);
      const ratio = pose.shoulderWidth / player.shoulderWidth;
      if (moved > .24 || ratio < .57 || ratio > 1.75) return { status: "different" };
      if (phase !== "pause") player = pose;
    }
    if (!hasPlayingSpace(pose)) return { status: "space" };
    return { status: "single", pose };
  }

  function pauseGame() {
    resumePhase = phase;
    standStable = 0;
    setPhase("pause");
    clearFeedback();
  }

  function resumeGame(hands) {
    const previous = resumePhase;
    setPhase(previous);
    if (activeTarget) armHands(hands);
    resumePhase = null;
  }

  function handleTracking(tracking, dt) {
    const { status, pose } = tracking;
    const hands = pose?.hands || [];
    if (mode === "camera") handDots.forEach((dot, index) => {
      const hand = hands[index];
      dot.hidden = !hand || !isPlaying();
      if (hand) position(dot, hand);
    });
    if (phase === "stand") {
      renderTracking(status);
      standStable = status === "single" ? standStable + dt : 0;
      if (standStable < 530) return;
      player = pose;
      setPhase("face");
      return;
    }
    if (phase === "face") {
      if (status !== "single") {
        player = null;
        standStable = 0;
        setPhase("stand");
      } else if (phaseTime >= (demoIdentity === "member" ? 1600 : 3000)) {
        identity = demoIdentity;
        startReady();
      }
      return;
    }
    if (phase === "pause") {
      renderTracking(status);
      if (status === "different" || phaseTime >= RECOVERY_MS) {
        if (resumePhase === "play") endRound(status === "different" ? "different" : "lost");
        else startStand();
        return;
      }
      standStable = status === "single" ? standStable + dt : 0;
      if (standStable >= 350) {
        if (pose) player = pose;
        resumeGame(hands);
      }
      return;
    }
    if (status !== "single") {
      blockedFor = status === blockReason ? blockedFor + dt : dt;
      blockReason = status;
      if (activeTarget) activeTarget.contacts = [null, null];
      if (status === "space" || blockedFor >= 270) {
        pauseGame();
        renderTracking(status);
      }
      return;
    }
    blockedFor = 0;
    if (phase === "ready") {
      const label = phaseTime < READY_MS ? String(Math.ceil((READY_MS - phaseTime) / 1000)) : "GO";
      if ($("countdown-number").textContent !== label) $("countdown-number").textContent = label;
      if (phaseTime >= READY_MS + GO_MS) startPlay();
    } else if (phase === "play") {
      elapsed += dt;
      if (elapsed >= ROUND_MS) {
        elapsed = ROUND_MS;
        endRound("complete");
        return;
      }
      stepThrow(dt, hands);
      updateHud();
    }
  }

  function tick(now) {
    const dt = clamp(now - lastTick, 0, 150);
    lastTick = now;
    if ($("quit").hidden) {
      phaseTime += dt;
      if (phase === "result") {
        if (phaseTime >= RESULT_MS) showIntro("home");
        else {
          const label = `${Math.ceil((RESULT_MS - phaseTime) / 1000)}s`;
          if ($("result-countdown").textContent !== label) $("result-countdown").textContent = label;
        }
      } else if (!["intro", "home", "screensaver"].includes(phase)) handleTracking(getTracking(now), dt);
    }
    if (now >= feedbackUntil && !feedback.hidden) clearFeedback();
    requestAnimationFrame(tick);
  }

  device.addEventListener("click", ({ target: element }) => {
    switch (element.closest("button")?.dataset.action) {
      case "start":
      case "replay": startStand(); break;
      case "details":
      case "exit": showIntro(); break;
      case "home": showIntro("home"); break;
      case "stop":
        $("quit").hidden = false;
        $("quit").querySelector('[data-action="continue"]').focus();
        break;
      case "finish": endRound("exit"); break;
      case "continue":
        $("quit").hidden = true;
        if (activeTarget) armHands(player?.hands || []);
        actions.querySelector('[data-action="stop"]')?.focus();
        break;
      case "camera": startCamera(); break;
    }
  });
  target.addEventListener("click", () => {
    if (mode === "mouse" && simulation === "single") hit();
  });
  arena.addEventListener("pointermove", event => {
    if (mode !== "mouse" || simulation !== "single" || !isPlaying() || !$("quit").hidden) return;
    const rect = arena.getBoundingClientRect();
    position(handDots[0], { x: (event.clientX - rect.left) / rect.width, y: (event.clientY - rect.top) / rect.height });
    handDots[0].hidden = false;
  });
  arena.addEventListener("pointerleave", () => { if (mode === "mouse") handDots[0].hidden = true; });
  $("input-mode").addEventListener("click", ({ target: element }) => {
    const selected = element.closest("[data-mode]")?.dataset.mode;
    if (selected && selected !== mode) {
      mode = selected;
      showIntro();
    }
  });
  $("simulate").addEventListener("click", ({ target: element }) => {
    const status = element.closest("[data-sim]")?.dataset.sim;
    if (!status || mode !== "mouse") return;
    simulation = status;
    if (status !== "single") handDots[0].hidden = true;
    updateControls();
  });
  $("identity-options").addEventListener("click", ({ target: element, currentTarget }) => {
    const selected = element.closest("[data-identity]")?.dataset.identity;
    if (!selected) return;
    demoIdentity = selected;
    currentTarget.querySelectorAll("[data-identity]").forEach(button => {
      button.setAttribute("aria-pressed", String(button.dataset.identity === demoIdentity));
    });
  });
  $("reset-demo").addEventListener("click", () => showIntro());
  $("preview-screensaver").addEventListener("click", () => {
    showIntro();
    setPhase("screensaver");
  });
  $("sound-toggle")?.addEventListener("click", async event => {
    const button = event.currentTarget;
    sound = !sound;
    if (sound) {
      const Audio = window.AudioContext || window.webkitAudioContext;
      if (!Audio) { sound = false; return; }
      audioContext ||= new Audio();
      try {
        await audioContext.resume();
      } catch {
        sound = false;
      }
    }
    button.setAttribute("aria-pressed", String(sound));
    button.textContent = sound ? "音效已开" : "音效关闭";
  });
  window.addEventListener("pagehide", stopCamera);
  showIntro();
  requestAnimationFrame(tick);
})();
