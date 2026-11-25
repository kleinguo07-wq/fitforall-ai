"use strict";

const screen = document.querySelector("#screen");
const phone = document.querySelector("#phone");
const modal = document.querySelector("#modal");
const frame = document.querySelector("#frame");
const retestLogin = document.querySelector("#retest-login");
const loginResultTool = document.querySelector("#login-result-tool");
const phoneButton = document.querySelector("#phone-view");
const kioskButton = document.querySelector("#kiosk-view");

const SELF_GUIDED_STOP_SCORE = 8;
const LESSON_DURATION = 240;
const DEMO_MEMBER_ID = "demo-member";
const DEMO_OTHER_MEMBER_ID = "demo-other-member";
const urgentItems = [
  "严重事故或跌落后开始背痛，或同时胸痛",
  "两条腿新出现疼痛、麻木或无力",
  "会阴或肛周新出现麻木",
  "新出现排尿困难，或控制不住大小便"
];
const soonItems = [
  "疼痛突然变得很厉害，或很快加重",
  "伴随发热、发冷或明显不舒服"
];
const reviewItems = [
  "疼痛从腰背延伸到腿，或腿新出现麻木",
  "近期受伤或做过手术，或者医生限制过运动",
  "经常在夜里痛或休息时也痛，或体重无故下降",
  "有肿瘤病史，或有骨质疏松且近期跌倒或新出现疼痛"
];
const symptoms = [
  {id:"urgent", title:"可能需要立即就医", items:urgentItems},
  {id:"soon", title:"近期有明显变化", items:soonItems},
  {id:"health", title:"需要先咨询专业人员", items:reviewItems}
];
const resultLabels = {
  seated: "建议先咨询康复专业人员",
  urgent: "请立即就医",
  refer: "请先咨询专业人员"
};
const seatedResultReason = "你反馈日常活动明显费力。请先咨询康复专业人员，了解适合自己的活动。";
const trainingLabels = {
  complete: "本次跟练已完成",
  early: "本次跟练提前结束"
};
const comfortCourse = [
  [0, "坐稳，准备开始", "双脚踩实，放松肩膀。按你自己的速度。", "rest"],
  [30, "坐姿小幅活动", "骨盆轻轻向前、回中，再向后、回中。自然呼吸。", "tilt"],
  [75, "坐姿交替轻抬脚", "一只脚轻轻离地，再踩稳换另一边。", "march"],
  [115, "从椅子起身", "能独立站稳、无需搀扶时，慢慢站起再坐回。无法安全完成时，请坐稳休息。", "stand"],
  [165, "扶稳后轻轻提踵", "仅在能独立站稳时练习，双手扶在稳固支撑上。无法安全完成时，请坐稳休息。", "heel"],
  [210, "坐下休息", "坐稳，自然呼吸，留意现在的感受。", "rest"]
];
const upperBackCourse = [
  [0, "坐稳，放松肩膀", "双脚踩实，双手搭在大腿上，自然呼吸。", "upperRest"],
  [35, "肩膀轻轻向后绕", "两肩缓慢向后绕小圈，然后放下。保持头部朝前。", "shoulderRoll"],
  [90, "肩胛骨轻轻向后靠拢", "手臂自然下垂，肩胛骨轻轻向后靠拢，再放松。", "shoulderBlade"],
  [145, "坐姿上背小幅转动", "坐稳后，上背轻轻转向一侧，回到正中，再换一侧。", "upperTurn"],
  [210, "坐稳休息", "双手搭回大腿，放松肩膀，留意现在的感受。", "upperRest"]
];
const painArea = scope => scope==="upper" ? "上背" : "腰背";
const courseTitle = scope => scope==="upper" ? "上背舒缓" : "舒缓入门";
const ratingValue = value => value==null ? "未记录" : `${value}/10`;
const segmentsFor = report => report.scope==="upper" ? upperBackCourse : comfortCourse;
function blankSession(){
  return {page:"home", history:[], answers:{}, report:null, scenario:null, sessionLesson:null};
}
let session = blankSession();
let memberId = null;
let loginMethod = null;
let loginTrigger = null;
const completedReports = new Map();
const guestReports = new Map();
let nextReportId = 0;
let surface = "kiosk";
let speed = 12;
let animationId = 0;
let liveLessonTimer = 0;

const button = (label, action, kind="primary", other="") =>
  `<button type="button" class="${kind}" data-action="${action}" ${other}>${label}</button>`;
const choice = (label, value, isSelected=false) =>
  button(label, "answer", "choice" + (isSelected ? " chosen" : ""), `data-value="${value}" aria-label="${label}"`);
const header = (label, canBack=true) =>
  `<header class="screen-top">${canBack ? button("‹ 返回","back","") : "<span></span>"}<span>${label}</span>${button("首页","home","")}</header>`;
const track = (percent) =>
  `<div class="track" role="progressbar" aria-label="测评进度" aria-valuenow="${percent}"><i style="width:${percent}%"></i></div>`;
const art = (pose, animate=false) =>
  `<div class="lesson-art"><canvas width="480" height="246" data-pose="${pose}" data-animate="${animate}" role="img" aria-label="动作示意"></canvas><span class="art-label">动作示意</span></div>`;
const options = (items, key) =>
  `<div class="options">${items.map(([value,label])=>choice(label,value,session.answers[key]===value)).join("")}</div>`;
function score(key, left, right) {
  const previous = matchingPrevious();
  const buttons = Array.from({length:11}, (_, value) => {
    const history = previous?.[key] === value ? '<span class="score-history">上次</span>' : "";
    return button(`<span>${value}</span>${history}`,"score","",`data-key="${key}" data-value="${value}" aria-pressed="${session.answers[key]===value}"`);
  }).join("");
  const reference = `<div class="score-reference" role="status" aria-atomic="true" data-score-reference="${key}">${scoreReferenceText(key, session.answers[key])}</div>`;
  return `<div class="score" role="group" aria-label="选择零到十分">${buttons}</div><div class="scale-ends"><span>0 · ${left}</span><span>10 · ${right}</span></div>${reference}`;
}

function panel(title, main, actions="", canBack=true){
  return header(title,canBack) + `<div class="screen-body" tabindex="-1">${main}</div>` + (actions ? `<footer class="screen-bottom">${actions}</footer>` : "");
}
function showDialog(title, text, actions, body=""){
  modal.innerHTML = `<h2 id="modal-title">${title}</h2><p>${text}</p>${body}<div class="actions">${actions}</div>`;
  if (!modal.open) modal.showModal();
}
function setPage(page){
  session.history.push(session.page);
  session.page = page;
  paint();
}
function matchingPrevious(){
  return reportsFor(memberId,session.answers.scope).at(-1) ?? null;
}
function selectScope(scope){
  if (session.answers.scope !== scope) {
    for (const key of ["pain","difficulty","impact"]) {
      delete session.answers[key];
    }
  }
  session.answers.scope = scope;
  if (scope==="upper") {
    paint(false);
    return screen.querySelector("#upper-ready")?.focus();
  }
  if (scope==="lowerLong") return openRatings();
  if (scope==="lowerShort") return setReport("refer","下腰背自助跟练适用于腰带附近持续或反复 3 个月及以上的不适。请先咨询专业人员。");
  return setReport("refer","请先向专业人员确认不适的部位、持续时间和适合的活动。");
}
function openRatings(){
  const previous = matchingPrevious();
  session.answers.pain ??= previous?.pain;
  session.answers.difficulty ??= previous?.difficulty;
  setPage("ratings");
}
function continueAfterRatings(){
  const {pain, difficulty} = session.answers;
  if (pain==null || difficulty==null) return;
  const concerns = [];
  if (pain>=SELF_GUIDED_STOP_SCORE) concerns.push(`现在${painArea(session.answers.scope)}很不舒服`);
  if (difficulty>=SELF_GUIDED_STOP_SCORE) concerns.push("过去 7 天做日常活动很费力");
  if (concerns.length) {
    return setReport("refer",`你反馈${concerns.join("，")}。今天先暂停自助跟练。`);
  }
  if (!session.answers.impact) return;
  if (session.answers.impact==="help") return setReport("refer","日常活动需要协助时，请先让专业人员评估适合的活动。");
  if (session.answers.impact==="seated") {
    return setReport("seated",session.answers.scope==="upper"
      ? "上背不适已明显影响日常活动。请先咨询专业人员，再决定适合的活动。"
      : seatedResultReason);
  }
  setReport("light","","","course");
}
function startOver(){
  if (modal.open) modal.close();
  closeRetestLogin();
  session = blankSession();
  guestReports.clear();
  surface = "kiosk";
  phone.replaceChildren();
  paint();
}
function setReport(kind, reason, urgency="", page="report"){
  const earlySafety = session.page==="screening";
  const early = earlySafety || session.page==="scope";
  const {difficulty, pain} = early ? {} : session.answers;
  const scope = earlySafety ? null : session.answers.scope;
  const previousReport = matchingPrevious();
  const previous = previousReport && difficulty != null && pain != null
    ? {pain:previousReport.pain, difficulty:previousReport.difficulty, dateLabel:previousReport.dateLabel}
    : null;
  const dateLabel = new Intl.DateTimeFormat("zh-CN", {month:"long",day:"numeric",hour:"2-digit",minute:"2-digit",hour12:false,timeZone:"Asia/Shanghai"}).format(new Date());
  session.report = {id:++nextReportId, ownerId:memberId, dateLabel, kind, reason, urgency, scope, difficulty:difficulty ?? null, pain:pain ?? null, previous, training:null};
  phone.replaceChildren();
  setPage(page);
}
function canSaveReport(report){
  return report?.training==="complete";
}
function saveReport(report){
  if (!canSaveReport(report)) return;
  report.ownerId ??= DEMO_MEMBER_ID;
  completedReports.set(report.id, {...report});
}
function reportsFor(ownerId, scope){
  const history = ownerId ? completedReports : guestReports;
  return Array.from(history.values()).filter(report =>
    report.ownerId===ownerId && (!scope || report.scope===scope)).sort((a,b)=>a.id-b.id);
}
function latestReport(ownerId){
  return reportsFor(ownerId).at(-1);
}
function showAssessmentEntry(page, completed=null){
  const history = ["hub","intro","returning"].includes(session.page) ? [...session.history] : ["home"];
  if (modal.open) modal.close();
  closeRetestLogin();
  session = {...blankSession(), page, history, report:completed};
  surface = "kiosk";
  phone.replaceChildren();
  paint();
}
function enterAssessment(completed=null){
  showAssessmentEntry(latestReport(memberId)?"returning":"intro",completed);
}
function openRetest(){
  if (memberId) return enterAssessment();
  showRetestLogin("methods");
}
function showRetestLogin(step){
  loginMethod = step==="wechat" || step==="face" ? step : null;
  const screens = {
    methods:{title:"登录后复测",detail:"登录后查看自己的测评记录。",actions:
      button("微信扫码登录","wechatLogin") + button("人脸识别登录","faceLogin","secondary")},
    wechat:{title:"使用微信扫一扫登录",detail:"请用微信扫描二维码。",body:'<div class="qr-placeholder">微信扫一扫</div>',
      actions:button("选择其他方式","loginMethods","secondary")},
    face:{title:"人脸识别登录",detail:"请面向屏幕，按提示完成识别。",
      actions:button("选择其他方式","loginMethods","secondary")},
    failed:{title:"登录未完成",detail:"暂时无法登录，可以重试或返回测评。",actions:
      button("重新登录","loginMethods")}
  };
  const {title,detail,body="",actions} = screens[step];
  retestLogin.innerHTML = `<h2 id="login-title">${title}</h2><p>${detail}</p>${body}<div class="actions">${actions}${button("取消","cancelLogin","ordinary")}</div>`;
  if (!retestLogin.open) {
    loginTrigger = document.activeElement;
    frame.classList.add("login-open");
    screen.inert = true;
    phone.inert = true;
    retestLogin.show();
  }
  loginResultTool.hidden = !loginMethod;
  retestLogin.querySelector("button")?.focus();
}
function closeRetestLogin(restoreFocus=false){
  if (retestLogin.open) retestLogin.close();
  loginMethod = null;
  frame.classList.remove("login-open");
  screen.inert = false;
  phone.inert = false;
  loginResultTool.hidden = true;
  if (restoreFocus && loginTrigger?.isConnected) loginTrigger.focus();
  loginTrigger = null;
}
function finishLogin(){
  if (!loginMethod) return;
  guestReports.clear();
  memberId = DEMO_MEMBER_ID;
  const previous = latestReport(memberId);
  enterAssessment();
  if (!previous) {
    showDialog("还没有测评记录","完成一节跟练后，就可以在下次复测时对照。",
      button("开始首次测评","startFirst") + button("返回","close","secondary"));
  }
}
function clearPreviousReport(){
  session.report = null;
  session.sessionLesson = null;
  phone.replaceChildren();
}
function goBack(){
  if (session.page==="lesson") return requestStop();
  const previous = session.history.pop();
  if (!previous) return startOver();
  if (session.page==="report" || session.page==="course") clearPreviousReport();
  session.page = previous;
  paint();
}

function home(){
  return `<img class="home-art" alt="全民健身机设备首页" src="设备首页_参考.png"><button type="button" class="home-senior" data-action="senior" aria-label="康乐银发"></button><button type="button" class="home-link" data-action="hub"><span>运动测评</span><span aria-hidden="true">›</span></button>`;
}
function assessmentTabs(active){
  return `<nav class="assessment-tabs" aria-label="选择测评项目">
    ${button("体态检测","showPosture","assessment-tab",`aria-pressed="${active==="posture"}"`)}
    ${button("腰背痛测评与康复","enterAssessment","assessment-tab",`aria-pressed="${active==="back"}"`)}
  </nav>`;
}
function hub(){
  return panel("运动测评",`${assessmentTabs("posture")}
    <article class="posture-overview">
      <section class="posture-hero">
        <img src="体态检测_人体主视觉.png" alt="">
        <div class="posture-hero-copy">
          <h2>AI 智能体态检测</h2>
          <dl>
            <div><dt>无接触扫描</dt><dd>正面与侧面检测</dd></div>
            <div><dt><b>7</b> 大力线检测</dt><dd>了解当前站立体态</dd></div>
          </dl>
        </div>
      </section>
      <section class="posture-video">
        <h3>流程介绍</h3>
        <div class="posture-flow">正面站位 → 侧面扫描 → 查看报告</div>
      </section>
      <div class="posture-result-notes">
        <div><strong>体态健康评分</strong><span>查看各项体态结果</span></div>
        <div><strong>个性化改善建议</strong><span>了解适合的改善方向</span></div>
      </div>
    </article>`,
    button("开始检测","posture","primary posture-start"));
}
function chairSetupCard(){
  return `<section class="chair-setup-card">
    <h3>先准备一把椅子</h3>
    <div class="chair-video-cover">
      <canvas width="480" height="246" data-pose="chairSetup" role="img" aria-label="椅子摆在屏幕正前方，坐下后面向屏幕"></canvas>
      <span class="chair-video-caption">椅子摆放示范</span>
    </div>
    <p><strong>选一把稳固、无轮的椅子</strong>，坐下时双脚能踩实地面。</p>
    <p><strong>放在屏幕正前方</strong>，坐下时面向屏幕，周围留出起身空间。</p>
  </section>`;
}
function intro(){
  return panel("运动测评",`${assessmentTabs("back")}<h2>腰背痛测评与康复</h2><p>了解腰背不适对活动的影响，看看今天适合怎么练。</p>
    ${chairSetupCard()}
    <details class="source-card">
      <summary>了解测评依据</summary>
      <p>下腰背参考世界卫生组织（WHO）慢性腰痛指南。上背不适请先由专业人员评估，明确适合做哪些动作后，再选择跟练。</p>
      <ul class="bullets">
        <li><a href="https://www.who.int/publications/i/item/9789240081789" target="_blank" rel="noopener">WHO 慢性原发性腰痛指南 ↗</a></li>
        <li><a href="https://www.nhs.uk/conditions/back-pain/" target="_blank" rel="noopener">NHS 背痛就医提示 ↗</a></li>
        <li><a href="https://www.cuh.nhs.uk/patient-information/thoracic-spine-exercises/" target="_blank" rel="noopener">剑桥大学医院上背活动资料 ↗</a></li>
      </ul>
    </details>`,
    button("开始测评","screening") + (!memberId ? button("复测","retest","secondary") : ""));
}

function returning(){
  const last = latestReport(memberId);
  const completed = canSaveReport(session.report);
  return panel("运动测评",`${assessmentTabs("back")}<h2>腰背痛测评与康复</h2>
    ${completed ? `<div class="tile"><strong>本次跟练已完成</strong>${courseTitle(last.scope)} · ${last.dateLabel}</div>` : "<p>从上次记录继续。</p>"}
    <h3>${completed?"本次记录":"上次记录"}</h3><p class="caption">${last.dateLabel} · ${last.scope==="upper"?"上背":"下腰背"}</p>
    <div class="metrics">
      <div>当时的不适<strong>${ratingValue(last.pain)}</strong></div>
      <div>过去 7 天的活动困难<strong>${ratingValue(last.difficulty)}</strong></div>
    </div><p>这次先确认安全情况，再记录今天的感受。</p>`,
    button("开始复测","screening") + (completed ? button("扫码保存到手机","save","secondary") : ""));
}
function screening(){
  return panel("腰背痛测评与康复", `${track(25)}<div class="overline">第 1 步 · 初筛</div><h2>你有以下情况吗？</h2>
    <p class="caption">有哪类情况就点哪类。如果符合多组，选最靠上的一组。</p>
    ${symptoms.map(({id,title,items})=>`<section class="screening-group">
      <div class="screening-group-head"><h3>${title}</h3>
        ${button("有这类情况","safetyConcern","secondary",`data-value="${id}" aria-label="有这类情况，${title}"`)}
      </div><ul>${items.map(item=>`<li>${item}</li>`).join("")}</ul>
    </section>`).join("")}`,
    button("以上都没有","screeningClear") + button("不确定","safetyConcern","secondary",'data-value="unsure"'));
}
function screeningConcern(value){
  if (value==="urgent") return setReport("urgent","你选择了一项可能需要紧急处理的情况。请立即寻求急诊帮助。","urgent");
  if (value==="soon") return setReport("refer","你反馈了近期明显的变化。请尽快就医，再决定是否开始锻炼。","soon");
  if (value==="health") return setReport("refer","请让专业人员了解你的情况，再选择适合的活动。");
  if (value==="unsure") return setReport("refer","请先咨询医疗专业人员。若出现胸痛、双腿新发麻木或无力、排尿排便异常等所列情况，请立即就医。");
}
function profile(){
  return panel("腰背痛测评与康复", `${track(50)}<div class="overline">第 1 步 · 初筛</div><h2>哪里不舒服？</h2>
    <p class="caption">选出最符合你现在情况的一项。</p>
    ${options([
      ["lowerLong","下腰背（腰带附近）· 反复或持续至少 3 个月"],
      ["lowerShort","下腰背（腰带附近）· 还不到 3 个月"],
      ["upper","上背（两侧肩胛骨之间）"],
      ["other","其他部位、多处不适，或说不清"]
    ],"scope")}
    ${session.answers.scope==="upper" ? `<section class="tile" id="upper-ready" tabindex="-1">
      <h3>上背已经过专业评估吗？</h3>
      <p>请确认医生或康复专业人员已评估、同意你做轻柔的上背坐姿活动，且症状没有变化。</p>
      <div class="actions">${button("以上都确认","confirmUpper")}${button("未确认，或情况有变化","declineUpper","secondary")}</div>
    </section>`:""}`);
}
const impactOptions = [
  ["light","基本不影响，或只有一点影响"],
  ["seated","明显费力，但能独立完成"],
  ["help","需要别人帮助，或做不了"]
];
function historyScores(){
  const history = reportsFor(memberId,session.answers.scope);
  if (!history.length) return "<p class=\"caption\">首次记录 · 请按现在的感受选分。</p>";
  const first = history[0];
  const last = history.at(-1);
  const rows = first===last ? [["首次 · 上次",last]] : [["首次",first],["上次",last]];
  return `<div class="status-history" aria-label="同部位历史记录">
    ${rows.map(([label,r])=>`<div><strong>${label}</strong><small>${r.dateLabel}</small><span>不适 ${ratingValue(r.pain)} · 活动困难 ${ratingValue(r.difficulty)}</span></div>`).join("")}
  </div><p class="caption">下方是本次记录，已带入上次分数，请按今天的感受确认或修改。</p>`;
}
function ratingsReady(){
  const {pain,difficulty,impact} = session.answers;
  return pain!=null && difficulty!=null && Boolean(impact);
}
function ratings(){
  const upper = session.answers.scope==="upper";
  return panel("腰背痛测评与康复", `${track(100)}<div class="overline">第 2 步 · 状态记录</div><h2>记录今天的感受</h2>
    ${historyScores()}
    <section class="rating-block"><h3>现在${painArea(session.answers.scope)}有多不舒服？</h3>${score("pain","不痛","能想象的最痛")}</section>
    <section class="rating-block"><h3>过去 7 天，做日常活动有多费力？</h3>
      <p class="caption">${upper?"例如穿衣、取物、做家务。":"例如起身、走路、做家务。"}</p>
      ${score("difficulty","不费力","做不了")}
    </section>
    <section class="rating-block"><h3>现在能独立完成这些日常活动吗？</h3>
      <div class="options" role="group" aria-label="日常活动影响">
        ${impactOptions.map(([value,label])=>button(label,"impact","choice"+(session.answers.impact===value?" chosen":""),`data-value="${value}" aria-pressed="${session.answers.impact===value}"`)).join("")}
      </div>
    </section>`, button("确认本次记录","reviewRatings","primary",`data-ratings-next ${ratingsReady()?"":"disabled"}`));
}
function courseDetail(){
  const r = session.report;
  const upper = r.scope==="upper";
  return panel("AI 跟练", `<div class="course-cover">${art(upper?"shoulderBlade":"tilt")}</div>
    <h2>${courseTitle(r.scope)}</h2>
    <ul class="course-tags"><li>约 4 分钟</li><li>${upper?"全程坐姿":"坐站结合"}</li><li>需要稳固座椅</li></ul>
    <p>${upper?"坐着活动肩部和上背，按舒服的幅度练。":"从轻柔坐姿活动开始，再练习起身和扶稳提踵。"} </p>
    <div class="course-safety"><strong>练习提示</strong>
      <p>用稳固、没有轮子的椅子，坐稳后双脚踩实地面。${upper?"":"近期有跌倒、站不稳或需要搀扶时，请保持坐姿。"}</p>
      <p>不适加重或出现新症状时，选择「结束跟练」。</p>
    </div>
    <h3>跟练内容</h3>
    <ol class="course-segments">${segmentsFor(r).map(([,title])=>`<li>${title}</li>`).join("")}</ol>`,
    button("开始跟练","start"));
}
function canStartLesson(){
  return session.report?.kind==="light" && !session.report.training;
}

function reportPage(){
  const r = session.report;
  const urgent = r.kind==="urgent";
  const scores = r.pain!=null || r.difficulty!=null ? `<div class="metrics">
    <div>现在的${painArea(r.scope)}不适<strong>${r.pain==null?"未测":r.pain+"/10"}</strong>${r.previous?.pain!=null?`上次 ${r.previous.pain}/10`:""}</div>
    <div>日常活动困难程度<strong>${r.difficulty==null?"未测":r.difficulty+"/10"}</strong>过去 7 天${r.previous?.difficulty!=null?` · 上次 ${r.previous.difficulty}/10`:""}</div>
  </div>` : "";
  return panel("本次测评结果",`<div class="result-block ${urgent?"urgent":"warn"}"><div class="overline">今日建议</div><h2>${resultLabels[r.kind]}</h2><p>${r.reason}</p></div>
    ${scores}${r.previous?`<p class="caption">上次记录于 ${r.previous.dateLabel}。两项分数都来自你自己的感受。</p>`:""}`,
    urgent ? button("返回首页","home","secondary") : "", !session.scenario);
}
function lessonResult(){
  const r = session.report;
  const complete = canSaveReport(r);
  const upper = r.scope==="upper";
  return panel("AI 跟练结算",`<section class="lesson-result">
    <div class="result-user"><span aria-hidden="true">${r.userName.slice(0,1)}</span><strong>${r.userName}</strong></div>
    <h2>${courseTitle(r.scope)}</h2>
    <p class="caption">${upper?"上背跟练":"腰部舒缓跟练"} · ${trainingLabels[r.training]}</p>
    <div class="metrics">
      <div>跟练得分<strong>${r.lessonScore==null?"—":r.lessonScore+" 分"}</strong></div>
      <div>实际运动时长<strong>${timerText(r.lessonSeconds)}</strong></div>
    </div>
  </section>
  ${complete ? `<p class="lesson-advice">${upper?"后续请按专业人员确认的安排练习。":"状态稳定、练后不适没有加重时，建议每天跟练 1 次。"}</p>` : ""}`,
    button("返回腰背痛测评与康复","returnFromLesson") + (complete ? button("扫码保存到手机","save","secondary") : ""),false);
}
function timerText(value){
  return Math.floor(value / 60) + ":" + String(Math.floor(value % 60)).padStart(2,"0");
}
function training(){
  const lesson = session.sessionLesson;
  const segments = segmentsFor(session.report);
  const segment = segments[lesson.segment];
  return panel(session.report.scope==="upper"?"上背舒缓":"舒缓入门",`
    <div class="lesson-time"><span>第 ${lesson.segment+1} 段 / ${segments.length} 段</span><span id="lesson-time">${timerText(lesson.elapsed)} / ${timerText(LESSON_DURATION)}</span></div>
    <progress id="lesson-progress" class="lesson-progress" max="${LESSON_DURATION}" value="${lesson.elapsed}" aria-label="跟练进度"></progress>
    ${art(segment[3],true)}<h2>${segment[1]}</h2><p>${segment[2]}</p>
    <p class="caption">不适加重或出现新的不适时，选「结束跟练」。</p>`,`
    ${button("结束跟练","stop","danger")}`,false);
}
function reactionCard(fromSenior = false){
  return `<a class="open-card demo-game-link" href="reaction.html${fromSenior?"?from=senior":""}"><span class="card-icon" aria-hidden="true">◉</span><span><strong>选择反应时</strong><small>国民体测 · 双手复位，按亮靶提示触靶</small></span><span aria-hidden="true">›</span></a>`;
}
const pages = {
  home, hub, intro, returning,
  senior:()=>panel("全民健身机",`<h2>康乐银发</h2><div class="open-cards">
    <button type="button" class="open-card" data-action="hub"><span class="card-icon" aria-hidden="true">◎</span><span><strong>运动测评</strong><small>了解体态，看看今天适合怎么活动</small></span><span aria-hidden="true">›</span></button>
    </div>
    <section class="senior-games" aria-labelledby="senior-games-title">
      <h3 id="senior-games-title">趣味运动</h3>
      <div class="open-cards">
        <a class="open-card demo-game-link" href="sandbag.html"><span class="card-icon" aria-hidden="true">◈</span><span><strong>接沙包</strong><small>等沙包亮起来，伸手接住</small></span><span aria-hidden="true">›</span></a>
        ${reactionCard(true)}
      </div>
    </section>`),
  games:()=>panel("全民健身机",`<section aria-labelledby="games-title"><h2 id="games-title">趣味运动</h2>
    <div class="open-cards">${reactionCard()}</div></section>`),
  posture:()=>panel("体态检测",`<h2>请站到检测框内</h2><p>正对屏幕，双脚站稳。站到指定位置后，按提示完成检测。</p>
    <div class="posture-position" aria-hidden="true"><img src="体态检测_人体主视觉.png" alt=""><i></i></div>`,
    button("返回介绍","back","secondary")),
  screening, scope:profile, ratings, course:courseDetail,
  report:reportPage,
  lesson:training,
  lessonResult
};

function startLesson(){
  const userName = memberId===DEMO_MEMBER_ID ? "体验用户" : memberId ? "体验用户 B" : "游客";
  session.sessionLesson = {elapsed:0,segment:0,userName};
  setPage("lesson");
}
function requestStop(){
  showDialog("结束这次跟练？","确认结束，或继续跟练。",
    button("结束跟练","confirmStop","danger") + button("继续跟练","close","secondary"));
}
function finishLesson(complete){
  const {elapsed,userName} = session.sessionLesson;
  session.sessionLesson = null;
  // 演示沿用现有整节训练达到课程时长 20% 才显示结算的规则。
  if (!complete && elapsed<Math.ceil(LESSON_DURATION * 0.2)) return goBackToCourse();
  const r = session.report;
  r.training = complete ? "complete" : "early";
  r.userName = userName;
  r.lessonSeconds = Math.floor(elapsed);
  r.lessonScore = complete ? 86 : null; // 示例成绩。正式设备读取 AI 课程结算得分。
  if (complete) {
    if (memberId) saveReport(r);
    else guestReports.set(r.id, {...r});
  }
  setPage("lessonResult");
}
function goBackToCourse(){
  session.history.pop();
  session.page = "course";
  paint();
}
function allowPhone(){
  if (!canSaveReport(session.report)) return;
  surface = "phone";
  if (!phone.firstChild) {
    if (typeof window.createMobileReport==="function") phone.append(window.createMobileReport(session.report,{
      onSave:saveReport,
      onContinue:openRetest
    }));
    else phone.textContent = "报告暂时无法打开，请稍后重试。";
  }
  paint();
}

function scenario(name){
  startOver();
  session.scenario = name;
  if (name==="upper") {
    session.answers.scope = "upper";
    return setPage("scope");
  }
  if (name==="light" || name==="seated") {
    session.answers = {scope:"lowerLong", difficulty:name==="light"?4:6, pain:name==="light"?3:5, impact:name==="light"?"light":"seated"};
  }
  const reasons = {
    light:"",
    seated:seatedResultReason,
    urgent:"你选择了一项可能需要紧急处理的情况。请立即寻求急诊帮助。"
  };
  setReport(name,reasons[name],name==="urgent"?"urgent":"",name==="light"?"course":"report");
}
function lessonTick(){
  const l = session.sessionLesson;
  if (modal.open) return;
  l.elapsed = Math.min(LESSON_DURATION,l.elapsed + speed/4);
  if (l.elapsed>=LESSON_DURATION) return finishLesson(true);
  const index = segmentsFor(session.report).findLastIndex(item=>item[0]<=l.elapsed);
  if (l.segment!==index){
    l.segment = index;
    return paint(false);
  }
  document.querySelector("#lesson-time").textContent = `${timerText(l.elapsed)} / ${timerText(LESSON_DURATION)}`;
  document.querySelector("#lesson-progress").value = l.elapsed;
}

function phaseFor(page){
  if (surface==="phone") return "phone";
  if (["home","senior","games","hub","intro","returning","posture"].includes(page)) return "entry";
  if (["course","report"].includes(page)) return "result";
  if (["lesson","lessonResult"].includes(page)) return "lesson";
  return "questions";
}
function paint(focus=true){
  clearInterval(liveLessonTimer);
  cancelAnimationFrame(animationId);
  const { page, report } = session;
  const active = surface==="phone";
  screen.hidden = active;
  phone.hidden = !active;
  kioskButton.setAttribute("aria-pressed",!active);
  phoneButton.setAttribute("aria-pressed",active);
  phoneButton.disabled = !canSaveReport(report);
  document.querySelector("#pace-tool").hidden = active || page!=="lesson";
  document.querySelector("#posture-reference").hidden = active || !(page==="hub" || page==="posture");
  document.querySelector("#device-account").textContent = memberId ? "设备已登录" : "设备未登录";
  document.querySelector("#logout-sample").hidden = !memberId;
  document.querySelectorAll("[data-phase]").forEach(item=>item.classList.toggle("active",item.dataset.phase===phaseFor(page)));
  document.querySelectorAll("[data-scenario]").forEach(item=>item.setAttribute("aria-pressed",item.dataset.scenario===session.scenario));
  if (active) return;
  screen.classList.toggle("home",page==="home");
  const oldScroll = !focus ? screen.querySelector(".screen-body")?.scrollTop : 0;
  screen.innerHTML = pages[page]();
  if (focus) screen.querySelector(".screen-body")?.focus({preventScroll:true});
  else if (oldScroll) screen.querySelector(".screen-body").scrollTop = oldScroll;
  screen.querySelectorAll("canvas").forEach(drawSample);
  if (page==="lesson") liveLessonTimer = setInterval(lessonTick,250);
}

function beginScreening(){
  const fromEntry = ["intro","returning"].includes(session.page);
  clearPreviousReport();
  session.answers = {};
  if (!fromEntry) showAssessmentEntry(latestReport(memberId)?"returning":"intro");
  setPage("screening");
}

function act(target){
  const {action,value,key} = target.dataset;
  switch(action){
    case "home":
      if (session.page==="lesson") return requestStop();
      return startOver();
    case "back": return goBack();
    case "showPosture": if (session.page!=="hub") return showAssessmentEntry("hub"); return;
    case "enterAssessment": if (session.page==="hub") return enterAssessment(); return;
    case "retest": return openRetest();
    case "wechatLogin": return showRetestLogin("wechat");
    case "faceLogin": return showRetestLogin("face");
    case "loginMethods": return showRetestLogin("methods");
    case "cancelLogin": return closeRetestLogin(true);

    case "startFirst":
      modal.close();
      return beginScreening();
    case "screening": return beginScreening();
    case "screeningClear": return setPage("scope");
    case "safetyConcern": return screeningConcern(value);
    case "confirmUpper":
      if (session.page==="scope" && session.answers.scope==="upper") return openRatings();
      return;
    case "declineUpper": return setReport("refer","请先让医生或康复专业人员评估上背不适，并确认哪些动作适合现在的情况。");
    case "impact": {
      session.answers.impact = value;
      target.closest(".options").querySelectorAll("button").forEach(entry=>{
        entry.classList.toggle("chosen",entry===target);
        entry.setAttribute("aria-pressed",String(entry===target));
      });
      screen.querySelector("[data-ratings-next]").disabled = !ratingsReady();
      return;
    }
    case "answer": return selectScope(value);
    case "reviewRatings": return continueAfterRatings();
    case "score": {
      session.answers[key] = Number(value);
      target.closest(".score").querySelectorAll("button").forEach(entry =>
        entry.setAttribute("aria-pressed", String(entry === target))
      );
      const reference = screen.querySelector(`[data-score-reference="${key}"]`);
      if (reference) reference.textContent = scoreReferenceText(key, session.answers[key]);
      const next = screen.querySelector("[data-ratings-next]");
      if (next) next.disabled = !ratingsReady();
      return;
    }
    case "start":
      return session.page==="course" && canStartLesson() ? startLesson() : undefined;
    case "stop": return requestStop();
    case "confirmStop": modal.close(); return finishLesson(false);
    case "returnFromLesson": return enterAssessment(canSaveReport(session.report) ? session.report : null);
    case "save":
      if (!canSaveReport(session.report)) return;
      return showDialog("保存本次测评","用微信扫一扫，即可保存本次测评结果。",
        button("查看手机报告","phone") + button("返回结果","close","secondary"),
        '<div class="qr-placeholder">微信扫一扫</div>');
    case "phone": modal.close(); return allowPhone();
    case "close": return modal.close();
    default: if (Object.hasOwn(pages,action)) return setPage(action);
  }
}

screen.addEventListener("click",event=>{
  const target = event.target.closest("[data-action]");
  if (target) act(target);
});
modal.addEventListener("click",event=>{
  const target = event.target.closest("[data-action]");
  if (target) act(target);
});
retestLogin.addEventListener("click",event=>{
  const target = event.target.closest("[data-action]");
  if (target) act(target);
});
retestLogin.addEventListener("keydown",event=>{
  if (event.key==="Escape") closeRetestLogin(true);
});
document.querySelector("#presets").addEventListener("click",event=>{
  const target = event.target.closest("[data-scenario]");
  if (target) scenario(target.dataset.scenario);
});
document.querySelector("#reset").addEventListener("click",startOver);
document.querySelector("#return-sample").addEventListener("click",()=>{
  guestReports.clear();
  memberId = DEMO_MEMBER_ID;
  if (!latestReport(memberId)) saveReport({
    id:0, ownerId:memberId, dateLabel:"11 月 9 日", kind:"light", scope:"lowerLong", pain:3, difficulty:4, training:"complete"
  });
  enterAssessment();
});
document.querySelector("#empty-account-sample").addEventListener("click",()=>{
  memberId = DEMO_OTHER_MEMBER_ID;
  startOver();
});
document.querySelector("#logout-sample").addEventListener("click",()=>{
  memberId = null;
  startOver();
});
document.querySelector("#login-success").addEventListener("click",finishLogin);
document.querySelector("#login-failure").addEventListener("click",()=>{
  if (loginMethod) showRetestLogin("failed");
});
phoneButton.addEventListener("click",allowPhone);
kioskButton.addEventListener("click",()=>{surface="kiosk";paint();});
document.querySelector("#speed").addEventListener("click",event=>{
  speed = speed===12 ? 1:12;
  event.currentTarget.textContent = speed===12?"演示加速 ×12":"正常速度 ×1";
  event.currentTarget.setAttribute("aria-pressed",speed===12);
});

function drawSample(canvas){
  const context = canvas.getContext("2d");
  if (!context) return;
  const pose = canvas.dataset.pose;
  const animated = canvas.dataset.animate==="true" && !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const starts = performance.now();
  function line(points,color,width){
    context.beginPath();
    context.moveTo(...points[0]);
    for (const point of points.slice(1)) context.lineTo(...point);
    context.strokeStyle=color;
    context.lineWidth=width;
    context.lineCap="round";
    context.lineJoin="round";
    context.stroke();
  }
  function dot(x,y,r,color){
    context.beginPath();
    context.arc(x,y,r,0,Math.PI*2);
    context.fillStyle=color;
    context.fill();
  }
  function draw(now){
    context.clearRect(0,0,480,246);
    if (pose==="chairSetup"){
      line([[52,195],[427,195]],"#aacbc4",2);
      line([[117,190],[125,134],[183,134],[189,190]],"#335756",8);
      line([[125,134],[115,75]],"#335756",8);
      line([[114,71],[115,101]],"#116f65",16);
      line([[125,132],[186,132]],"#116f65",13);
      line([[216,122],[284,122]],"#25877a",5);
      line([[274,112],[284,122],[274,132]],"#25877a",5);
      context.fillStyle="#244653";
      context.fillRect(319,41,64,119);
      context.fillStyle="#4ca69e";
      context.fillRect(326,49,50,94);
      line([[351,163],[351,190]],"#244653",10);
      line([[323,192],[380,192]],"#244653",7);
      context.font = "600 18px sans-serif";
      context.fillStyle="#285753";
      context.textAlign="center";
      context.fillText("面向屏幕",250,102);
      context.fillText("椅子",150,221);
      context.fillText("屏幕",351,221);
      return;
    }
    if (pose==="body"){
      dot(214,46,24,"#84a7a4");
      line([[214,57],[214,191]],"#84a7a4",40);
      line([[171,93],[202,82],[226,82],[258,93]],"#84a7a4",23);
      line([[169,98],[154,135],[150,168]],"#84a7a4",16);
      line([[260,98],[272,135],[278,168]],"#84a7a4",16);
      line([[204,186],[199,223]],"#84a7a4",18);
      line([[225,186],[228,223]],"#84a7a4",18);
      line([[197,114],[231,114]],"#396b73",28);
      line([[198,160],[231,160]],"#167365",27);
      line([[230,114],[282,114]],"#396b73",2);
      line([[231,160],[282,160]],"#167365",2);
      context.font = "600 22px sans-serif";
      context.fillStyle="#254958";
      context.fillText("上背",294,121);
      context.fillText("下腰背",294,167);
      return;
    }
    context.fillStyle="#74918744";
    context.beginPath();
    context.ellipse(246,215,123,12,0,0,Math.PI*2);
    context.fill();
    const motion = animated ? (1-Math.cos((now-starts)/680))/2 : .15;
    if (["upperRest","shoulderRoll","shoulderBlade","upperTurn"].includes(pose)){
      const turn = pose==="upperTurn" && animated ? Math.sin((now-starts)/680) : 0;
      const rolling = pose==="shoulderRoll";
      const closing = pose==="shoulderBlade";
      const shoulderY = 81 - (rolling ? motion*8 : 0);
      const shoulderShift = rolling && animated ? Math.sin((now-starts)/680)*4 : 0;
      const center = 240 + turn*13 + shoulderShift;
      const bladeWidth = 21 - (closing ? motion*7 : 0);
      line([[194,209],[194,153],[285,153],[285,209]],"#47665e",7);
      line([[211,152],[206,179],[202,211],[217,211]],"#243b49",12);
      line([[269,152],[273,179],[277,211],[262,211]],"#243b49",12);
      line([[240,147],[center,shoulderY+3]],"#168071",47);
      line([[center-36,shoulderY],[center,shoulderY-4],[center+36,shoulderY]],"#168071",19);
      line([[center-36,shoulderY+7],[center-44,111],[218,pose==="upperRest"?150:154]],"#b06e54",8);
      line([[center+36,shoulderY+7],[center+44,111],[262,pose==="upperRest"?150:154]],"#b06e54",8);
      line([[center,shoulderY+6],[240,132]],"#116f65",2);
      if (closing) {
        line([[center-bladeWidth-4,shoulderY+12],[center-bladeWidth,shoulderY+30]],"#c0ebe2",4);
        line([[center+bladeWidth+4,shoulderY+12],[center+bladeWidth,shoulderY+30]],"#c0ebe2",4);
        line([[center-64,94],[center-50,94],[center-56,89]],"#237a72",3);
        line([[center+64,94],[center+50,94],[center+56,89]],"#237a72",3);
      }
      dot(center,shoulderY-31,16,"#c99175");
      dot(center,shoulderY-36,14,"#465049");
      if (animated) animationId = requestAnimationFrame(draw);
      return;
    }
    const stand = pose==="stand"?motion:0;
    const heel = pose==="heel";
    const march = pose==="march"?Math.sin((now-starts)/390):0;
    const tilt = pose==="tilt"?(motion-.5)*13:0;
    line([[174,209],[174,145],[255,145],[255,209]],"#47665e",7);
    line([[175,147],[158,85],[172,85]],"#47665e",7);
    const hip = heel ? [279,118-motion*4] : [203+stand*52,134-stand*29];
    const shoulder = heel ? [272,68-motion*4] : [191+stand*65+tilt,75-stand*33];
    const neck = [shoulder[0]-1,shoulder[1]-18];
    const rearKnee = heel ? [278,162] : [259+stand*1,147+stand*9];
    const frontKnee = heel ? [290,163] : [274-stand*1,148+stand*8-(march>0?7*march:0)];
    const rearFoot = heel ? [275,201-motion*5] : [263,203+(march<0?9*march:0)];
    const frontFoot = heel ? [289,204-motion*5] : [277,207-(march>0?8*march:0)];
    line([hip,rearKnee,rearFoot],"#243b49",13);
    line([hip,frontKnee,frontFoot],"#2c4b5d",14);
    line([rearFoot,[rearFoot[0]+17,208]],"#193441",8);
    line([frontFoot,[frontFoot[0]+17,211]],"#193441",8);
    line([hip,shoulder],"#168071",25);
    if (heel) line([shoulder,[252,87],[176,89]],"#b06e54",8);
    else line([shoulder,[shoulder[0]+13,shoulder[1]+25],[hip[0]+(pose==="stand"?24:43),hip[1]-3]],"#b06e54",8);
    dot(neck[0],neck[1],16,"#c99175");
    context.beginPath();
    context.arc(neck[0]-3,neck[1]-1,15,Math.PI*.65,Math.PI*1.85);
    context.fillStyle="#465049";
    context.fill();
    if (animated) animationId = requestAnimationFrame(draw);
  }
  draw(starts);
}

const view = new URLSearchParams(location.search).get("view");
if (view==="games" || view==="senior") setPage(view);
else paint();
