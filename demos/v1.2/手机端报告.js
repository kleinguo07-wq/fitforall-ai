/* 独立网页原型的小程序报告。交互状态存放在当前预览页面中。 */
(() => {
  const outcomeCopy = {
    light: { title: '舒缓入门', reason: '你完成了坐姿活动和一次起立，过程中没有报告不适加重。' },
    seated: { title: '建议先咨询康复专业人员', reason: '日常活动仍然比较费力，可以把测评结果带给康复专业人员。' },
    urgent: { title: '请立即寻求急诊帮助', reason: '根据你刚才的回答，请先处理当前不适。' },
    refer: { title: '建议先咨询专业人员', reason: '请向专业人员说明当前不适和日常活动情况，再确认运动安排。' },
  };
  const feedbackCopy = { better: '好一些', same: '差不多', worse: '更不舒服', new: '出现新的不适' };

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  function button(text, action, secondary = false) {
    const node = el('button', secondary ? 'mr-btn mr-secondary' : 'mr-btn', text);
    node.type = 'button';
    node.addEventListener('click', action);
    return node;
  }

  function block(title, body) {
    const node = el('section', 'mr-card');
    if (title) node.append(el('h3', '', title));
    node.append(...(Array.isArray(body) ? body : [body]));
    return node;
  }

  function valueLabel(value) {
    return value == null ? '未记录' : `${value} / 10`;
  }

  function measure(name, value, note = '') {
    const node = el('div', 'mr-measure');
    const description = el('div', '');
    description.append(el('strong', '', name));
    if (note) description.append(el('small', '', note));
    node.append(description, el('strong', 'mr-value', valueLabel(value)));
    return node;
  }

  function numberPicker(title, legend, key) {
    const field = el('fieldset', 'mr-scale');
    const choices = el('div', 'mr-numbers');
    const limits = el('div', 'mr-limits');
    let selected = null;
    field.append(el('legend', '', title), choices, limits);
    limits.append(el('span', '', legend[0]), el('span', '', legend[1]));
    const reference = el('div', 'score-reference', scoreReferenceText(key, null));
    reference.setAttribute('role', 'status');
    reference.setAttribute('aria-atomic', 'true');
    field.append(reference);
    for (let number = 0; number <= 10; number++) {
      const choice = button(String(number), () => {
        selected = number;
        reference.textContent = scoreReferenceText(key, number);
        for (const entry of choices.children) {
          entry.setAttribute('aria-pressed', String(entry === choice));
        }
      }, true);
      choice.setAttribute('aria-pressed', 'false');
      choices.append(choice);
    }
    return { field, read: () => selected };
  }

  const css = `
    .mr-root {box-sizing:border-box;width:100%;max-width:100%;min-width:0;min-height:100%;background:#f2f6f7;color:#162f37;font-size:14px;line-height:1.55;}
    .mr-root * {box-sizing:border-box;}
    .mr-root h2,.mr-root h3,.mr-root p {margin:0;}
    .mr-root h2 {font-size:25px;line-height:1.28;letter-spacing:-.02em;}
    .mr-root h3 {font-size:16px;line-height:1.35;}
    .mr-root p {color:#405964;font-size:14px;line-height:1.58;}
    .mr-top {display:flex;align-items:center;justify-content:space-between;gap:12px;padding:14px 16px;background:#fff;border-bottom:1px solid #d7e3e6;color:#183d49;font-size:14px;}
    .mr-sheet {display:grid;gap:12px;padding:16px;}
    .mr-lead {display:grid;gap:7px;padding:16px;border-radius:16px;background:#dff2ee;color:#164f48;}
    .mr-lead small {font-weight:700;color:#23665d;}
    .mr-card {display:grid;gap:9px;padding:14px;background:#fff;border:1px solid #d7e3e6;border-radius:14px;min-width:0;}
    .mr-card ul {display:grid;gap:6px;margin:0;padding-left:1.35em;color:#405964;}
    .mr-measure {display:flex;justify-content:space-between;align-items:center;gap:10px;padding:9px 0;border-top:1px solid #e4edef;font-size:14px;}
    .mr-measure:first-child {border-top:0;}
    .mr-measure small {display:block;margin-top:2px;color:#49626b;font-size:12px;}
    .mr-value {color:#14685a;white-space:nowrap;font-variant-numeric:tabular-nums;}
    .mr-btn {display:block;width:100%;min-height:44px;padding:8px 12px;border:1px solid transparent;border-radius:11px;background:#16695b;color:#fff;font:inherit;font-size:14px;font-weight:700;cursor:pointer;}
    .mr-btn:hover {filter:brightness(.95);}
    .mr-btn:focus-visible,.mr-toggle:focus-within {outline:3px solid #1f7466;outline-offset:2px;}
    .mr-secondary {background:#fff;border-color:#b9d0d4;color:#214c53;}
    .mr-toggle {display:flex;align-items:center;gap:10px;min-height:42px;font-weight:650;}
    .mr-toggle input {width:20px;height:20px;accent-color:#16695b;flex:none;}
    .mr-scale {display:grid;gap:6px;margin:0;min-width:0;border:0;padding:0;}
    .mr-scale legend {font-size:14px;font-weight:700;padding:0 0 7px;}
    .mr-numbers {display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:5px;}
    .mr-numbers .mr-btn {min-height:44px;padding-inline:0;}
    .mr-numbers [aria-pressed="true"] {background:#16695b;color:#fff;border-color:#16695b;}
    .mr-limits {display:flex;justify-content:space-between;gap:8px;font-size:12px;color:#49626b;}
    .mr-error {color:#912e14!important;font-weight:650;}
  `;

  window.createMobileReport = function createMobileReport(report, { onSave, onContinue } = {}) {
    const root = el('div', 'mr-root');
    const style = el('style', '', css);
    const header = el('div', 'mr-top');
    const body = el('div', 'mr-sheet');
    const upperBack = report.scope === 'upper';
    const region = upperBack ? '上背' : '腰背';
    const course = upperBack ? '上背舒缓' : outcomeCopy.light.title;
    const assessment = upperBack ? '腰背痛测评与康复 · 上背' : '腰背痛测评与康复';
    const canRetest = (report.kind === 'light' || report.kind === 'seated') && report.difficulty != null;
    const initial = { pain: report.pain ?? null, difficulty: report.difficulty ?? null };
    let reminder = false;
    let retest = null;
    let followupPaused = needsCheck();
    root.append(style, header, body);

    function needsCheck() {
      return report.feedback === 'worse' || report.feedback === 'new';
    }

    function result() {
      if (needsCheck()) return { title: '今天先暂停跟练', reason: '你反馈不适有变化，请先确认当前情况。' };
      const outcome = upperBack && report.kind === 'light'
        ? { title: course, reason: '你完成了上背坐姿试做，过程中没有报告不适加重。' }
        : outcomeCopy[report.kind];
      return { title: outcome.title, reason: report.reason || outcome.reason };
    }

    function show(title, label, heading, description, content) {
      header.replaceChildren(el('strong', '', title));
      const lead = el('div', 'mr-lead');
      const h2 = el('h2', '', heading);
      h2.tabIndex = -1;
      lead.append(el('small', '', label), h2, el('p', '', description));
      body.replaceChildren(lead, ...content);
      if (root.isConnected) {
        root.scrollTop = 0;
        h2.focus({ preventScroll: true });
        header.scrollIntoView({ block: 'nearest' });
      }
    }

    function trainingCard() {
      const states = { complete: '已完成本次跟练', early: '已提前结束本次跟练' };
      return block(`本次跟练 · ${course}`, [
        el('p', '', states[report.training] || '暂无跟练记录'),
        report.feedback
          ? el('p', '', `练后自评 · ${feedbackCopy[report.feedback]}`)
          : el('p', '', '练后自评 · 未记录'),
        ...(report.afterPain == null ? [] : [measure(`练后${region}不适`, report.afterPain)]),
      ]);
    }

    function baselineCard() {
      const repeated = Boolean(report.previous);
      const rows = [measure(`${repeated ? '测评' : '初测'}时${region}不适`, initial.pain)];
      if (initial.difficulty != null) {
        rows.push(measure('日常活动困难程度', initial.difficulty, repeated ? '测评前 7 天' : '初测前 7 天'));
      }
      return block(repeated ? '本次设备测评' : '第一次测评', rows);
    }

    const safetySteps = [
      {
        heading: '最近出现以下任何情况吗？',
        items: ['新出现排尿困难或大小便失控', '会阴或肛周麻木，或双腿新发疼痛、麻木或无力', '胸痛，或严重外伤后出现背痛'],
      },
      {
        heading: `${region}情况有明显变化吗？`,
        items: [
          ...(upperBack ? ['上背不适的位置和上次不一样'] : []),
          '疼痛突然很重、快速加重，或伴发热和明显不适',
          '腿出现新的放射痛或麻木，或持续夜间、静息痛',
          '近期受伤、手术、被限制运动，或不明原因体重下降',
          '有肿瘤史，或有骨质疏松且近期跌倒或新出现疼痛',
        ],
      },
    ];

    function showSafety(step = 0) {
      const check = safetySteps[step];
      const items = el('ul', '');
      for (const item of check.items) items.append(el('li', '', item));
      const stop = (uncertain) => {
        followupPaused = true;
        reminder = false;
        const urgent = step === 0 && !uncertain;
        show('活动复测', '先处理不适', urgent ? '请立即寻求急诊帮助' : '先确认身体情况',
          urgent
            ? '如需协助，可以请身边的人帮忙呼叫急救。'
            : '请先咨询医疗专业人员。若有急症，请立即寻求急诊帮助。',
          [button('返回我的测评', showSaved, true)]);
      };
      show('活动复测', `第 7 天 · 近况确认 ${step + 1} / ${safetySteps.length}`,
        check.heading, '请选择最符合你当前情况的一项。', [
          block('', items),
          button('没有', () => {
            if (step === 0) showSafety(1);
            else showQuestions();
          }),
          button('有', () => stop(false), true),
          button('不确定', () => stop(true), true),
          button('返回我的测评', showSaved, true),
        ]);
    }

    function showQuestions() {
      const difficulty = numberPicker('过去 7 天，做日常活动有多费力？', ['0 不费力', '10 做不了'], 'difficulty');
      const pain = numberPicker(`现在${region}有多不舒服？`, ['0 不痛', '10 能想象的最痛'], 'pain');
      const activities = upperBack ? '穿衣、抬手取物、做家务' : '起身、走路、做家务';
      const error = el('p', 'mr-error');
      error.setAttribute('role', 'status');
      show('活动复测', '第 7 天复测', '记录今天的感受',
        `做日常活动时的费力程度，可参考${activities}时的整体感受。`,
        [
          block('', difficulty.field),
          block('', pain.field),
          error,
          button('保存复测', () => {
            if (difficulty.read() == null || pain.read() == null) {
              error.textContent = '请为两项各选择一个分值。';
              return;
            }
            retest = { difficulty: difficulty.read(), pain: pain.read() };
            showSaved();
          }),
          button('返回我的测评', showSaved, true),
        ]);
    }

    function followupCard() {
      if (followupPaused) {
        const content = [el('p', '', '请先确认当前不适，再安排后续练习。')];
        if (needsCheck() && !retest) content.push(button('重新确认近况', () => showSafety(), true));
        return block('跟进暂缓', content);
      }
      const toggle = el('label', 'mr-toggle');
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.checked = reminder;
      input.addEventListener('change', () => { reminder = input.checked; });
      toggle.append(input, el('span', '', '第 7 天提醒我复测'));
      return block('下次来看看', [
        el('p', '', '下次继续记录过去 7 天做日常活动有多费力。'),
        toggle,
        button('开始复测', () => showSafety(), true),
      ]);
    }

    function comparison(name, before, after, note, missingBefore = '初测未记录') {
      const row = measure(name, after, note);
      row.querySelector('.mr-value').textContent = before == null
        ? `${missingBefore} → ${valueLabel(after)}`
        : `${before} → ${valueLabel(after)}`;
      return row;
    }

    function showSaved() {
      const outcome = result();
      const cards = [baselineCard()];
      if (report.previous) {
        const { pain, difficulty, dateLabel } = report.previous;
        cards.push(block('设备测评对照', [
          el('p', '', dateLabel ? `上次 ${dateLabel} → 本次` : '上次 → 本次'),
          comparison('日常活动困难程度', difficulty, initial.difficulty, '测评前 7 天的整体感受', '上次未记录'),
          comparison(`当下${region}不适`, pain, initial.pain, '两次设备测评时的感受', '上次未记录'),
        ]));
      }
      if (retest) {
        cards.push(block('第 7 天复测（手机自评）', [
          comparison('日常活动困难程度', initial.difficulty, retest.difficulty, '过去 7 天的整体感受'),
          comparison(`当下${region}不适`, initial.pain, retest.pain, '每次填答时的感受'),
          el('p', '', '这是两次自评记录，可在下次测评时继续对照。'),
        ]));
      }
      if (canRetest) cards.push(trainingCard());
      if (canRetest && !retest) cards.push(followupCard());
      if (canRetest && onContinue) cards.push(button('回设备继续测评', () => onContinue(), true));
      show('我的测评', `${assessment} · 已保存`, outcome.title, outcome.reason, cards);
    }

    function showClaim() {
      const outcome = result();
      show('领取测评结果', assessment, '把这次结果带走',
        '保存后，可在「我的测评」中查看本次结果和初测记录。', [
          block('本次结果', [el('strong', '', outcome.title), el('p', '', outcome.reason)]),
          button('保存到我的测评', () => {
            onSave?.(report);
            showSaved();
          }),
        ]);
    }
    showClaim();
    return root;
  };
})();
