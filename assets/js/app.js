/* ==========================================================================
   app.js —— 《劳动法治护航》应用层：hash 路由 / SVG 图表 / 各模块交互
   依赖（按加载顺序）：data-law.js, sample-contract.js, engine-check.js,
                      engine-calc.js, engine-quiz.js, roadmap-data.js
   ========================================================================== */
window.LJ = window.LJ || {};
(function () {
  var $ = function (id) { return document.getElementById(id); };

  /* ---------------- 工具 ---------------- */
  function fmt(n) {
    if (n == null || isNaN(n)) return '—';
    return Number(n).toLocaleString('zh-CN', { maximumFractionDigits: 2 });
  }
  function num(v) { var n = parseFloat(v); return isNaN(n) ? 0 : n; }
  function esc(s) { return LJ.escapeHtml(s); }
  function lawChips(refs) {
    return (refs || []).map(function (r) {
      return '<span class="badge badge-law">⚖ ' + esc(r) + '</span>';
    }).join(' ');
  }
  function levelBadge(level) {
    var map = { high: ['badge-high', '高风险'], medium: ['badge-medium', '中风险'], low: ['badge-low', '低风险'] };
    var m = map[level] || map.medium;
    return '<span class="badge ' + m[0] + '">' + m[1] + '</span>';
  }

  /* ---------------- SVG 图表 ---------------- */
  /* 半环形评分仪表盘 */
  function scoreGauge(score, level) {
    var W = 220, H = 132, R = 88, cx = W / 2, cy = H - 6;
    var color = level === 'high' ? '#f0524d' : (level === 'medium' ? '#f59e0b' : '#2ecc8f');
    var circ = 2 * Math.PI * R;
    var filled = (score / 100) * (circ / 2);
    return (
      '<svg class="svg-chart" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="风险评分 ' + score + ' 分">' +
      '<path d="M ' + (cx - R) + ' ' + cy + ' A ' + R + ' ' + R + ' 0 0 1 ' + (cx + R) + ' ' + cy +
      '" fill="none" stroke="#1b2b41" stroke-width="16" stroke-linecap="round"/>' +
      '<path d="M ' + (cx - R) + ' ' + cy + ' A ' + R + ' ' + R + ' 0 0 1 ' + (cx + R) + ' ' + cy +
      '" fill="none" stroke="' + color + '" stroke-width="16" stroke-linecap="round"' +
      ' stroke-dasharray="' + filled + ' ' + circ + '" transform="rotate(180 ' + cx + ' ' + cy + ')"/>' +
      '<text x="' + cx + '" y="' + (cy - 22) + '" text-anchor="middle" fill="#e9eff8"' +
      ' font-size="40" font-weight="700">' + score + '</text>' +
      '<text x="' + cx + '" y="' + (cy - 2) + '" text-anchor="middle" fill="#93a6c0"' +
      ' font-size="11">合规评分 / 100</text>' +
      '</svg>'
    );
  }

  /* 柱状图：items = [{label, value, color}] */
  function barChart(items, maxValue) {
    var W = 640, H = 240, padL = 90, padR = 16, padT = 22, padB = 56;
    var plotW = W - padL - padR, plotH = H - padT - padB;
    var max = maxValue || Math.max.apply(null, items.map(function (i) { return i.value; }).concat([1]));
    var n = items.length, bw = Math.min(78, (plotW / n) * 0.62);
    var svg = '<svg class="svg-chart" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="金额对比柱状图">';
    /* 网格线 */
    for (var g = 0; g <= 4; g++) {
      var gy = padT + plotH - (plotH * g / 4);
      svg += '<line x1="' + padL + '" y1="' + gy + '" x2="' + (W - padR) + '" y2="' + gy + '" stroke="#1b2b41" stroke-width="1"/>';
      svg += '<text x="' + (padL - 8) + '" y="' + (gy + 4) + '" text-anchor="end" fill="#6b7f99" font-size="10">' +
        fmt(max * g / 4) + '</text>';
    }
    items.forEach(function (it, i) {
      var x = padL + (plotW / n) * i + (plotW / n - bw) / 2;
      var h = Math.max(it.value / max * plotH, it.value > 0 ? 3 : 0);
      var y = padT + plotH - h;
      svg += '<rect x="' + x + '" y="' + y + '" width="' + bw + '" height="' + h + '" rx="6" fill="' +
        (it.color || '#f0b429') + '" opacity="0.92"><title>' + esc(it.label) + '：' + fmt(it.value) + ' 元</title></rect>';
      svg += '<text x="' + (x + bw / 2) + '" y="' + (y - 6) + '" text-anchor="middle" fill="#f6ecd0" font-size="12" font-weight="600">' +
        fmt(it.value) + '</text>';
      svg += '<text x="' + (x + bw / 2) + '" y="' + (H - padB + 18) + '" text-anchor="middle" fill="#93a6c0" font-size="11">' +
        esc(it.label) + '</text>';
    });
    svg += '</svg>';
    return svg;
  }

  /* ---------------- Hash 路由 ---------------- */
  var VIEWS = ['home', 'check', 'calc', 'roadmap', 'quiz', 'law', 'qa', 'profile'];
  function showView(id) {
    VIEWS.forEach(function (v) {
      $('view-' + v).classList.toggle('active', v === id);
    });
    document.querySelectorAll('#mainNav a').forEach(function (a) {
      a.classList.toggle('active', a.getAttribute('data-view') === id);
    });
    if (id === 'check') setTimeout(function () { autoCheckOnce(); }, 60);
    if (id === 'qa') renderQa();
    if (id === 'profile') renderProfile();
  }
  function onHash() {
    var h = (location.hash || '#home').replace('#', '');
    if (VIEWS.indexOf(h) < 0) h = 'home';
    showView(h);
  }
  window.addEventListener('hashchange', onHash);

  /* ---------------- 首页 ---------------- */
  function renderHome() {
    $('statLaws').textContent = LJ.LAWS.length + ' 条';
    var stats = [
      { k: LJ.RULES.length + '+', v: '条违法条款识别规则', c: 'var(--gold)' },
      { k: '6 类', v: '权益自动计算（加班费/N/2N/双倍工资/年假/试用期）', c: 'var(--cyan)' },
      { k: LJ.ROADMAP.length + ' 类', v: '纠纷维权路径导航', c: 'var(--green)' },
      { k: LJ.LAWS.length + ' 条', v: '核心法条速查', c: 'var(--violet)' }
    ];
    $('homeChart').innerHTML = stats.map(function (s) {
      return '<div class="metric alt"><span class="k">' + s.v + '</span><span class="v small" style="color:' + s.c + '">' + s.k + '</span></div>';
    }).join('');
  }

  /* ---------------- 合同体检 ---------------- */
  function autoCheckOnce() { /* 预留：进入视图时的提示 */ }

  $('btnSample').addEventListener('click', function () {
    $('contractInput').value = LJ.SAMPLE_CONTRACT;
    $('checkHint').textContent = '已载入示例合同（' + LJ.SAMPLE_CONTRACT.length + ' 字，内置 20+ 处典型违法条款），点击「开始体检」。';
  });

  $('btnClearCheck').addEventListener('click', function () {
    $('contractInput').value = '';
    $('checkHint').textContent = '';
    $('checkResult').innerHTML = '';
  });

  $('btnCheck').addEventListener('click', function () { runCheck(); });

  function runCheck() {
    var text = $('contractInput').value;
    var res = LJ.checkContract(text);
    var box = $('checkResult');
    if (!res.findings.length) {
      box.innerHTML =
        '<div class="card"><h3 class="card-title"><span class="ico">✅</span>未命中风险规则</h3>' +
        '<p class="card-sub">该文本未命中内置风险规则。注意：本工具只能提示常见风险点，不代替专业审查；建议核对必备条款是否齐全（法条速查 → 劳动合同法 第十七条）。</p></div>';
      return;
    }
    var s = res.stats;
    var levelText = { high: '高风险合同', medium: '中风险合同', low: '低风险合同' }[res.level];

    /* 命中原文（高亮） */
    var hl = LJ.highlightContract(text, res.hits);

    /* 类别分布柱状图 */
    var cats = Object.keys(s.byCategory).sort(function (a, b) { return s.byCategory[b] - s.byCategory[a]; })
      .map(function (c) { return { label: c, value: s.byCategory[c], color: '#45b7f5' }; });
    var catBar = cats.length ? barChart(cats.slice(0, 6), null) : '';

    var findingsHtml = res.findings.map(function (f) {
      return '<div class="finding ' + f.rule.severity + '">' +
        '<h4>' + levelBadge(f.rule.severity) +
        '<span>' + esc(f.rule.title) + '</span>' +
        (f.count > 1 ? '<span class="badge badge-info">命中 ' + f.count + ' 处</span>' : '') +
        '</h4>' +
        '<div class="quote">「' + esc(f.first) + '」</div>' +
        '<p class="advice">💡 ' + esc(f.rule.advice) + '</p>' +
        '<div class="laws">' + lawChips(f.rule.laws) + '</div>' +
        '</div>';
    }).join('');

    box.innerHTML =
      '<div class="card">' +
      '<div class="grid grid-2" style="align-items:center">' +
      '<div class="center" style="max-width:260px;margin:0 auto">' + scoreGauge(res.score, res.level) +
      '<div style="margin-top:6px">' + levelBadge(res.level) + ' <span class="hint">' + levelText + '</span></div></div>' +
      '<div><h3 class="card-title mb0"><span class="ico">📄</span>体检结论</h3>' +
      '<p class="card-sub">扫描文本 ' + text.length + ' 字 · 命中 ' + s.total + ' 类问题（' +
      '<span style="color:#f0524d">高危 ' + s.high + '</span> / ' +
      '<span style="color:#f59e0b">中危 ' + s.medium + '</span> / ' +
      '<span style="color:#2ecc8f">低危 ' + s.low + '</span>）</p>' +
      '<div class="notice">发现的问题条款按「法条依据」逐条定位，点击速查可对照原文。高风险建议：先不签字，向单位书面要求修改，或咨询当地劳动保障监察部门（12333）。</div>' +
      '</div></div></div>' +

      '<div class="card"><h3 class="card-title"><span class="ico">🏷</span>问题条款分布</h3>' + catBar + '</div>' +

      '<div class="card"><h3 class="card-title"><span class="ico">🔍</span>风险报告（' + s.total + ' 类，按严重度排序）</h3>' +
      '<div id="findingList">' + findingsHtml + '</div></div>' +

      '<div class="card"><h3 class="card-title"><span class="ico">📌</span>原文命中标注</h3>' +
      '<p class="card-sub">鼠标悬停高亮片段可查看对应风险名称。</p>' +
      '<div class="contract-box">' + hl + '</div></div>';

    box.scrollIntoView({ behavior: 'smooth', block: 'start' });

    /* M8：已登录时自动保存体检记录（历史列表见「我的」档案页） */
    if (LJ.API.state.backend && LJ.API.state.user) {
      LJ.API.saveCheck({
        title: '合同体检：' + levelText,
        text: text,
        hit_count: s.total,
        score: res.score,
        level: res.level,
        findings: res.findings.map(function (f) {
          return { title: f.rule.title, severity: f.rule.severity, count: f.count, first: f.first };
        })
      }).catch(function () { /* 静默：网络/会话异常不影响本地演示 */ });
    }
  }

  /* ---------------- 权益计算 ---------------- */
  function collectCalc() {
    var monthly = num($('calcMonthly').value);
    var years = num($('calcYears').value);
    var months = num($('calcMonths').value);
    var reason = $('calcReason').value;
    var avg3x = num($('calcAvg3x').value) || null;
    var otWork = num($('otWork').value), otRest = num($('otRest').value), otHoliday = num($('otHoliday').value);
    var dw = num($('dwMonths').value);
    var alYears = num($('alWorkYears').value), alDays = num($('alUnpaid').value);
    var tYears = num($('termYears').value), tMonths = num($('termMonths').value);
    return { monthly: monthly, years: years, months: months, reason: reason, avg3x: avg3x,
      ot: [otWork, otRest, otHoliday], dw: dw, alYears: alYears, alDays: alDays,
      tYears: tYears, tMonths: tMonths };
  }

  $('btnCalcDemo').addEventListener('click', function () {
    $('calcMonthly').value = '8000';
    $('calcYears').value = '2'; $('calcMonths').value = '7';
    $('calcReason').value = 'illegal';
    $('calcAvg3x').value = '';
    $('otWork').value = '20'; $('otRest').value = '32'; $('otHoliday').value = '8';
    $('dwMonths').value = '5';
    $('alWorkYears').value = '2'; $('alUnpaid').value = '5';
    $('termYears').value = '1'; $('termMonths').value = '0';
    $('calcHint').textContent = '已载入演示数据：月薪 8000，工作 2 年 7 个月，被违法解除，存在加班与未签合同超期情形。';
    $('btnCalc').click();
  });

  $('btnClearCalc').addEventListener('click', function () {
    ['calcMonthly', 'calcYears', 'calcMonths', 'calcAvg3x', 'otWork', 'otRest', 'otHoliday',
      'dwMonths', 'alUnpaid', 'termMonths'].forEach(function (i) { $(i).value = ''; });
    $('calcReason').value = 'consult';
    $('alWorkYears').value = '2'; $('termYears').value = '1';
    $('calcHint').textContent = ''; $('calcResult').innerHTML = '';
  });

  $('btnCalc').addEventListener('click', function () { runCalc(); });

  function runCalc() {
    var d = collectCalc();
    var hint = $('calcHint'), box = $('calcResult');
    if (!d.monthly) { hint.textContent = '请先填写月工资。'; box.innerHTML = ''; return; }
    hint.textContent = '';

    var parts = [];   // 结果卡片数组
    var chartItems = [];

    /* 1. 加班费 */
    if (d.ot[0] || d.ot[1] || d.ot[2]) {
      var ot = LJ.CALC.overtime(d.monthly, d.ot[0], d.ot[1], d.ot[2]);
      var otRows = ot.rows.map(function (r) {
        return '<tr><td>' + r.part.desc + '</td><td>' + r.part.hours + ' 小时</td><td>' + r.formula + '</td><td><b style="color:var(--gold)">' + fmt(r.amount) + ' 元</b></td></tr>';
      }).join('');
      parts.push({
        icon: '🕒', title: '加班费', law: ['劳动法 第四十四条'],
        body: '<table class="data"><tr><th>项目</th><th>时长</th><th>计算过程</th><th>金额</th></tr>' + otRows +
        '</table><p style="margin:10px 0 0"><b>小计：' + fmt(ot.total) + ' 元</b>　<span class="hint">（小时工资 = 月工资 ÷ 21.75 ÷ 8 = ' + fmt(ot.hourly) + ' 元）</span></p>'
      });
      chartItems.push({ label: '加班费', value: ot.total, color: '#45b7f5' });
    }

    /* 2. 经济补偿 / 赔偿金 */
    var term = LJ.CALC.termination(d.reason, d.monthly, d.years, d.months, d.avg3x);
    chartItems.push({ label: term.label.split('（')[0], value: term.money, color: '#f0b429' });
    parts.push({
      icon: '💼', title: '解除/终止补偿（' + term.label + '）', law: [term.law],
      body: '<ul class="clean">' + term.steps.map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('') + '</ul>' +
      '<p style="margin:10px 0 0"><b>应得金额：' + fmt(term.money) + ' 元</b></p>'
    });

    /* 3. 双倍工资 */
    if (d.dw > 0) {
      var dw = LJ.CALC.doubleWage(d.monthly, d.dw);
      chartItems.push({ label: '双倍工资差额', value: dw.extra, color: '#2ecc8f' });
      parts.push({
        icon: '📄', title: '未签书面合同双倍工资差额', law: ['劳动合同法 第八十二条'],
        body: '<ul class="clean">' + dw.steps.map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('') + '</ul>' +
        '<p style="margin:10px 0 0"><b>可另行主张差额：' + fmt(dw.extra) + ' 元</b>（含应得部分总计 ' + fmt(dw.total) + ' 元）</p>'
      });
    }

    /* 4. 未休年假折现 */
    var leaveDays = LJ.CALC.annualLeaveDays(d.alYears);
    if (d.alDays > 0 && leaveDays > 0) {
      var al = LJ.CALC.annualLeaveCash(d.monthly, leaveDays, d.alDays);
      chartItems.push({ label: '未休年假折现', value: al.amount, color: '#9d7bf5' });
      parts.push({
        icon: '🌴', title: '未休年假折现（应休 ' + leaveDays + ' 天 × 未休 ' + al.unpaid + ' 天）', law: ['职工带薪年休假条例 第五条'],
        body: '<ul class="clean">' + al.steps.map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('') + '</ul>' +
        '<p style="margin:10px 0 0"><b>' + fmt(al.amount) + ' 元</b>　<span class="hint">' + esc(al.note) + '</span></p>'
      });
    }

    /* 5. 试用期校验 */
    if (d.tYears || d.tMonths) {
      var pm = LJ.CALC.probationMax(d.tYears, d.tMonths);
      parts.push({
        icon: '⏱', title: '拟签合同试用期上限校验', law: ['劳动合同法 第十九条'],
        body: '<p style="margin:0"><b>合同期限 ' + d.tYears + ' 年 ' + d.tMonths + ' 个月：</b>' + esc(pm.desc) + '</p>'
      });
    }

    var total = chartItems.reduce(function (s, i) { return s + i.value; }, 0);
    var bar = chartItems.length ? '<div class="card"><h3 class="card-title"><span class="ico">📊</span>各项金额对比</h3>' + barChart(chartItems, null) + '</div>' : '';

    var summary = chartItems.map(function (i) {
      return '<div class="metric" style="color:' + i.color + '"><span class="k">' + esc(i.label) + '</span><span class="v" style="color:' + i.color + '">' + fmt(i.value) + '<span class="u">元</span></span></div>';
    }).join('') +
      '<div class="metric alt2"><span class="k">预估合计</span><span class="v">' + fmt(total) + '<span class="u">元</span></span></div>';

    box.innerHTML =
      '<div class="card"><h3 class="card-title mb0"><span class="ico">🧾</span>计算结果</h3>' +
      '<p class="card-sub">按法定公式逐步计算，各分项可独立主张；合计仅为各分项加总，实际以证据与认定为准。</p>' +
      '<div class="grid grid-4">' + summary + '</div></div>' +
      bar +
      parts.map(function (p) {
        return '<div class="card"><h3 class="card-title"><span class="ico">' + p.icon + '</span>' + esc(p.title) + '</h3>' +
          p.body + '<div class="divider"></div><div class="laws">' + lawChips(p.law) + '</div></div>';
      }).join('');

    box.scrollIntoView({ behavior: 'smooth', block: 'start' });

    /* M8：已登录时自动保存计算记录（保留输入与分项摘要，供档案页重放） */
    if (LJ.API.state.backend && LJ.API.state.user) {
      LJ.API.saveCalc({
        title: '权益计算：预估合计 ' + fmt(total) + ' 元',
        inputs: d,
        result: { items: chartItems, total: total }
      }).catch(function () { /* 静默 */ });
    }
  }

  /* ---------------- 维权导航 ---------------- */
  function renderRoadmapTypes() {
    $('roadmapTypes').innerHTML = LJ.ROADMAP.map(function (r) {
      return '<button class="btn" data-rid="' + r.id + '">' + esc(r.name) + '</button>';
    }).join('') + '<button class="btn btn-ghost" data-rid="__all">📚 查看通用五步流程</button>';
  }

  $('roadmapTypes').addEventListener('click', function (e) {
    var btn = e.target.closest('button[data-rid]');
    if (!btn) return;
    renderRoadmap(btn.getAttribute('data-rid'));
    document.querySelectorAll('#roadmapTypes .btn').forEach(function (b) { b.classList.remove('btn-primary'); });
    btn.classList.add('btn-primary');
  });

  function renderRoadmap(id) {
    var type = id === '__all' ? null : LJ.ROADMAP.filter(function (r) { return r.id === id; })[0];
    var box = $('roadmapResult');
    var steps = LJ.ROADMAP_COMMON.steps;

    var stepsHtml = steps.map(function (s) {
      return '<div class="tl-item"><h4>' + esc(s.title) + '</h4>' +
        '<div class="tl-meta">⏱ ' + esc(s.meta) + '</div>' +
        '<ul>' + s.points.map(function (p) { return '<li>' + esc(p) + '</li>'; }).join('') + '</ul></div>';
    }).join('');

    var extraHtml = type && type.extra ? '<div class="card"><h3 class="card-title"><span class="ico">⚠️</span>' +
      esc(type.extra.title) + '</h3><ul class="clean">' +
      type.extra.points.map(function (p) { return '<li>' + esc(p) + '</li>'; }).join('') + '</ul></div>' : '';

    var materialsHtml = (type ? type : LJ.ROADMAP[0]).materials.map(function (m) {
      return '<span class="badge badge-info">📎 ' + esc(m) + '</span>';
    }).join('&nbsp;');

    var burdenHtml = (type ? type.burden : ['发生劳动争议时，尽量留存劳动关系证明、工资支付与考勤记录等证据。']);

    var tipsHtml = type ? type.tips : ['维权应当「先协商、留证据、守时效」；对结论有争议时优先咨询专业法律人士。'];

    box.innerHTML =
      '<div class="card"><h3 class="card-title mb0"><span class="ico">🛡</span>' +
      (type ? esc(type.name) + ' · 维权路线图' : '通用维权五步流程') + '</h3>' +
      (type ? '<p class="card-sub">' + esc(type.desc) + '</p>' : '<p class="card-sub">无论何种劳动争议，法定救济框架均为以下五步；具体类型各有重点。</p>') +
      '<div class="timeline">' + stepsHtml + '</div></div>' +
      extraHtml +
      '<div class="grid grid-2">' +
      '<div class="card"><h3 class="card-title"><span class="ico">📎</span>建议准备的材料</h3>' + materialsHtml + '</div>' +
      '<div class="card"><h3 class="card-title"><span class="ico">🧭</span>举证责任提示</h3><ul class="clean">' +
      burdenHtml.map(function (b) { return '<li>' + esc(b) + '</li>'; }).join('') + '</ul></div>' +
      '</div>' +
      '<div class="card"><h3 class="card-title"><span class="ico">💡</span>避坑提醒</h3><ul class="clean">' +
      tipsHtml.map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('') + '</ul>' +
      '<div class="divider"></div><div class="laws">' +
      lawChips(['劳动争议调解仲裁法 第五条', '劳动争议调解仲裁法 第二十七条', '劳动争议调解仲裁法 第四十三条']) + '</div></div>';

    box.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  /* ---------------- 情景闯关 ---------------- */
  var quizState = null;
  function resetQuiz() {
    quizState = { i: 0, score: 0, done: false };
    renderQuiz();
  }
  function renderQuiz() {
    var box = $('quizBox');
    var prog = $('quizProgress').querySelector('i');
    if (quizState.done) {
      var total = LJ.QUIZ.length, pct = Math.round(quizState.score / total * 100);
      var grade = pct === 100 ? '满分！劳动法小达人 🏆' : pct >= 80 ? '优秀，基本不会踩坑 👍' : pct >= 60 ? '良好，还有几个盲区要补' : pct >= 40 ? '及格线边缘，建议回看法条速查' : '需要恶补！建议先过一遍法条速查';
      prog.style.width = '100%';
      box.innerHTML =
        '<div class="center" style="padding:18px 0">' +
        '<div style="font-size:52px">' + (pct >= 80 ? '🎉' : pct >= 60 ? '😊' : '💪') + '</div>' +
        '<h2 style="margin:8px 0 4px">' + quizState.score + ' / ' + total + '</h2>' +
        '<p class="hint">得分率 ' + pct + '% · ' + esc(grade) + '</p>' +
        '<p class="hint" id="quizBest"></p>' +
        '<div class="row-inline center" style="justify-content:center">' +
        '<button class="btn btn-primary" id="btnQuizAgain">🔄 再来一轮</button>' +
        '<a class="btn" href="#law">📖 查法条补盲区</a></div></div>';
      $('btnQuizAgain').addEventListener('click', resetQuiz);

      /* M8：已登录时提交本轮成绩并显示我的最佳 */
      if (LJ.API.state.backend && LJ.API.state.user) {
        LJ.API.submitQuizScore(quizState.score, LJ.QUIZ.length).then(function (d) {
          var el = $('quizBest');
          if (el && d.best != null) {
            el.textContent = '🏅 我的最佳 ' + d.best + ' / ' + LJ.QUIZ.length + ' · 累计完成 ' + d.games + ' 场（排行榜见「我的」页）';
          }
        }).catch(function () { /* 静默 */ });
      }
      return;
    }
    var q = LJ.QUIZ[quizState.i];
    quizState.answered = false;   // 复位答题状态（否则上一题的 answered 会拦截本题目点击）
    prog.style.width = (quizState.i / LJ.QUIZ.length * 100) + '%';
    box.innerHTML =
      '<div class="kv">第 ' + (quizState.i + 1) + ' / ' + LJ.QUIZ.length + ' 题　·　当前得分 ' + quizState.score + '</div>' +
      '<h3 style="margin:10px 0 14px;line-height:1.6">' + esc(q.q) + '</h3>' +
      '<div id="quizOpts">' + q.opts.map(function (o, i) {
        return '<button class="quiz-opt" data-i="' + i + '"><span class="tag">' + String.fromCharCode(65 + i) + '</span>' + esc(o) + '</button>';
      }).join('') + '</div>' +
      '<div id="quizExplain"></div>' +
      '<div class="row-inline" style="margin-top:8px"><button class="btn btn-sm" id="btnQuizNext" style="display:none">下一题 →</button></div>';
    document.querySelectorAll('#quizOpts .quiz-opt').forEach(function (b) {
      b.addEventListener('click', function () { answerQuiz(parseInt(b.getAttribute('data-i'), 10)); });
    });
    $('btnQuizNext').addEventListener('click', function () {
      quizState.i++;
      if (quizState.i >= LJ.QUIZ.length) quizState.done = true;
      renderQuiz();
    });
  }
  function answerQuiz(choice) {
    if (quizState.answered) return;
    quizState.answered = true;
    var q = LJ.QUIZ[quizState.i];
    var correct = choice === q.ans;
    if (correct) quizState.score++;
    document.querySelectorAll('#quizOpts .quiz-opt').forEach(function (b) {
      var i = parseInt(b.getAttribute('data-i'), 10);
      b.disabled = true;
      if (i === q.ans) b.classList.add('correct');
      else if (i === choice) b.classList.add('wrong');
    });
    $('quizExplain').innerHTML =
      '<div class="explain"><b>' + (correct ? '✅ 回答正确！' : '❌ 回答错误') + '</b>　' + esc(q.explain) +
      '<div style="margin-top:8px">' + lawChips([q.law]) + '</div></div>';
    $('btnQuizNext').style.display = 'inline-flex';
  }

  /* ---------------- 法条速查 ---------------- */
  function renderLaw(query) {
    var list = LJ.searchLaw(query);
    var box = $('lawResult');
    if (!list.length) {
      box.innerHTML = '<div class="card"><p class="hint">未命中，换个关键词试试，如「试用期」「加班费」「竞业限制」「仲裁时效」。</p></div>';
      return;
    }
    var groups = {};
    list.forEach(function (a) {
      (groups[a.law] = groups[a.law] || []).push(a);
    });
    box.innerHTML = Object.keys(groups).map(function (law) {
      return '<div class="card"><h3 class="card-title mb0"><span class="ico">📖</span>' + esc(law) +
        ' <span class="badge badge-info">' + groups[law].length + ' 条</span></h3>' +
        '<p class="card-sub">命中 ' + (list.length) + ' 条（当前显示）</p>' +
        groups[law].map(function (a) {
          return '<div class="law-item"><span class="no">' + esc(a.no) + '</span>' +
            '<span class="src">' + esc(a.title) + '</span><p>' + esc(a.text) + '</p></div>';
        }).join('') + '</div>';
    }).join('');
  }
  $('lawSearch').addEventListener('input', function () { renderLaw(this.value); });

  var QUICK_TERMS = ['试用期', '加班费', '竞业限制', '经济补偿', '社保', '仲裁时效', '工伤', '年休假', '双倍工资'];
  $('lawQuick').innerHTML = QUICK_TERMS.map(function (t) {
    return '<button class="btn btn-sm" data-q="' + t + '">' + t + '</button>';
  }).join('');
  $('lawQuick').addEventListener('click', function (e) {
    var b = e.target.closest('button[data-q]');
    if (!b) return;
    $('lawSearch').value = b.getAttribute('data-q');
    renderLaw(b.getAttribute('data-q'));
  });

  /* ---------------- 学习问答板（M9：仅后端在线可用） ---------------- */
  function renderQa() {
    var box = $('qaBox');
    if (!LJ.API.state.backend) {
      box.innerHTML = '<div class="card"><h3 class="card-title"><span class="ico">💬</span>学习问答板</h3>' +
        '<p class="card-sub">同学互答的劳动法学习问答板。需要后端在线：运行 <b>python -m server.server</b> 后访问 <b>http://127.0.0.1:5000</b> 刷新本页。</p></div>';
      return;
    }
    box.innerHTML = '<div class="card center"><p class="hint">加载问答板…</p></div>';
    LJ.API.listQa().then(function (d) {
      renderQaList(box, d.posts || []);
    }).catch(function (err) {
      box.innerHTML = '<div class="card"><p class="hint">问答板加载失败：' + esc((err && err.message) || '未知错误') + '</p></div>';
    });
  }

  function renderQaList(box, posts) {
    var logged = !!LJ.API.state.user;
    var formHtml = logged
      ? '<form id="qaForm">' +
        '<label class="field"><span>标题（1-60 字）</span><input type="text" id="qaTitle" maxlength="60" required placeholder="一句话概括你的问题"></label>' +
        '<label class="field"><span>内容（1-2000 字）</span><textarea id="qaContent" maxlength="2000" required rows="3" placeholder="描述具体场景/法条疑问，尽量给出关键细节"></textarea></label>' +
        '<div class="row-inline"><button class="btn btn-primary" type="submit">📮 发布提问</button> <span class="hint" id="qaMsg"></span></div></form>'
      : '<div class="notice">浏览问答无需登录；要<b>发帖/回复</b>请先<a href="#profile">登录学习账号</a>。</div>';

    var listHtml = posts.length
      ? posts.map(function (po, i) {
        var replies = (po.replies || []).map(function (r) {
          return '<div class="qa-reply">' +
            '<div class="qa-meta"><b>' + esc(r.nickname || r.username) + '</b> · ' + esc((r.created_at || '').replace('T', ' ').slice(0, 16)) + '</div>' +
            '<div>' + esc(r.content) + '</div></div>';
        }).join('');
        return '<div class="card qa-post">' +
          '<h3 class="card-title mb0">' + esc(po.title) + '</h3>' +
          '<div class="qa-meta"><b>' + esc(po.nickname || po.username) + '</b> · ' +
          esc((po.created_at || '').replace('T', ' ').slice(0, 16)) + ' · 💬 ' + (po.reply_count || 0) + ' 回复</div>' +
          '<p class="qa-body">' + esc(po.content) + '</p>' +
          '<div class="qa-replies">' + replies + '</div>' +
          '<div class="row-inline">' +
          (logged
            ? '<button class="btn btn-ghost btn-sm" data-reply-toggle="' + po.id + '">↩ 回复</button>'
            : '<span class="hint">登录后可回复</span>') +
          '</div>' +
          '<div class="qa-replybox" id="qaReplies' + po.id + '" style="display:none">' +
          '<form class="qaReplyForm" data-pid="' + po.id + '">' +
          '<textarea class="qaReplyText" maxlength="1000" required rows="2" placeholder="友善交流，理性讨论"></textarea>' +
          '<div class="row-inline" style="margin-top:6px"><button class="btn btn-sm" type="submit">提交回复</button></div></form></div></div>';
      }).join('')
      : '<p class="hint">还没有提问，来发第一个问题吧～</p>';

    box.innerHTML =
      '<div class="card"><h3 class="card-title mb0"><span class="ico">💬</span>学习问答板</h3>' +
      '<p class="card-sub">学劳动法遇到疑问？发帖提问，同学互答；每帖最多展示最近 20 条回复。</p>' + formHtml + '</div>' +
      listHtml;

    var form = $('qaForm');
    if (form) form.addEventListener('submit', function (e) {
      e.preventDefault();
      var title = $('qaTitle').value.trim(), content = $('qaContent').value.trim();
      var msg = $('qaMsg');
      if (!title || !content) return;
      LJ.API.postQa(title, content).then(function () {
        if (msg) { msg.textContent = '✅ 已发布，刷新中…'; }
        renderQa();
      }).catch(function (err) {
        if (msg) msg.textContent = '发布失败：' + ((err && err.message) || '未知错误');
      });
    });

    box.querySelectorAll('[data-reply-toggle]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var id = btn.getAttribute('data-reply-toggle');
        var boxEl = $('qaReplies' + id);
        boxEl.style.display = boxEl.style.display === 'none' ? 'block' : 'none';
      });
    });
    box.querySelectorAll('.qaReplyForm').forEach(function (f) {
      f.addEventListener('submit', function (e) {
        e.preventDefault();
        var pid = f.getAttribute('data-pid');
        var text = f.querySelector('.qaReplyText').value.trim();
        var btn = f.querySelector('button');
        if (!text) return;
        btn.disabled = true;
        LJ.API.replyQa(parseInt(pid, 10), text).then(function () {
          renderQa();
        }).catch(function (err) {
          btn.disabled = false;
          alert('回复失败：' + ((err && err.message) || '未知错误'));
        });
      });
    });
  }

  /* ---------------- 我的 / 登录档案（M7：认证 + 基本信息） ---------------- */
  function authFormHtml(mode) {
    var isLogin = mode === 'login';
    return '<div class="card" style="max-width:520px;margin:0 auto">' +
      '<h3 class="card-title"><span class="ico">🔐</span>' + (isLogin ? '登录' : '注册') + '学习账号</h3>' +
      '<p class="card-sub">登录后解锁：体检/计算历史、闯关排行榜、每日打卡、问答板、学习统计。</p>' +
      '<div class="row-inline" style="margin-bottom:14px">' +
      '<button class="btn ' + (isLogin ? 'btn-primary' : 'btn-ghost') + '" data-auth-tab="login">登录</button>' +
      '<button class="btn ' + (isLogin ? 'btn-ghost' : 'btn-primary') + '" data-auth-tab="register">注册</button>' +
      '</div>' +
      '<form id="authForm" data-mode="' + mode + '">' +
      (isLogin ? '' : '<label class="field"><span>昵称（可选）</span><input type="text" id="auNick" maxlength="20" placeholder="展示名"></label>') +
      '<label class="field"><span>用户名（3-20 位字母/数字/下划线）</span><input type="text" id="auUser" required autocomplete="username"></label>' +
      '<label class="field"><span>密码（至少 6 位）</span><input type="password" id="auPass" required autocomplete="current-password"></label>' +
      '<div id="authMsg" class="notice" style="display:none"></div>' +
      '<div class="row-inline" style="margin-top:6px"><button class="btn btn-primary" type="submit">' +
      (isLogin ? '登 录' : '注册并登录') + '</button></div>' +
      '</form></div>';
  }

  function renderAuthForm(box) {
    box.innerHTML = authFormHtml('login');
    bindAuthTabs(box);
    var form = $('authForm');
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var mode = form.getAttribute('data-mode');
      var username = $('auUser').value.trim();
      var password = $('auPass').value;
      var msg = $('authMsg');
      msg.style.display = 'none';
      var p = (mode === 'register')
        ? LJ.API.register(username, password, $('auNick') ? $('auNick').value.trim() : '')
        : LJ.API.login(username, password);
      p.then(function () {
        msg.style.display = 'block';
        msg.className = 'notice';
        msg.textContent = (mode === 'register' ? '注册成功：' : '欢迎回来：') + username;
        renderProfile();
      }).catch(function (err) {
        msg.style.display = 'block';
        msg.className = 'notice';
        msg.textContent = (err && err.message) ? err.message : '操作失败，请重试';
      });
    });
  }

  function bindAuthTabs(box) {
    box.querySelectorAll('[data-auth-tab]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        box.innerHTML = authFormHtml(btn.getAttribute('data-auth-tab') === 'register' ? 'register' : 'login');
        bindAuthTabs(box);
        var form = $('authForm');
        form.addEventListener('submit', function (e) {
          e.preventDefault();
          var mode = form.getAttribute('data-mode');
          var username = $('auUser').value.trim();
          var password = $('auPass').value;
          var msg = $('authMsg');
          msg.style.display = 'none';
          var p = (mode === 'register')
            ? LJ.API.register(username, password, $('auNick') ? $('auNick').value.trim() : '')
            : LJ.API.login(username, password);
          p.then(function () {
            msg.style.display = 'block';
            msg.className = 'notice';
            msg.textContent = (mode === 'register' ? '注册成功：' : '欢迎回来：') + username;
            renderProfile();
          }).catch(function (err) {
            msg.style.display = 'block';
            msg.className = 'notice';
            msg.textContent = (err && err.message) ? err.message : '操作失败，请重试';
          });
        });
      });
    });
  }

  /* M8：档案页数据（打卡/闯关统计/历史/排行榜）并行加载 */
  function loadProfileData() {
    var box = $('profileBox');
    Promise.all([
      LJ.API.myCheckins().catch(function () { return { streak: 0, total: 0, days: [] }; }),
      LJ.API.myScores().catch(function () { return { best: null, games: 0, records: [] }; }),
      LJ.API.listChecks().catch(function () { return { records: [] }; }),
      LJ.API.listCalcs().catch(function () { return { records: [] }; }),
      LJ.API.leaderboard().catch(function () { return { leaderboard: [] }; })
    ]).then(function (r) {
      var checkins = r[0], mine = r[1], checks = r[2].records, calcs = r[3].records, board = r[4].leaderboard;
      var today = new Date();
      var todayIso = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0');
      var doneToday = checkins.days.indexOf(todayIso) >= 0;

      var statsHtml =
        '<div class="metric"><span class="k">📅 连续打卡</span><span class="v">' + checkins.streak + ' 天</span></div>' +
        '<div class="metric"><span class="k">累计打卡</span><span class="v">' + checkins.total + ' 次</span></div>' +
        '<div class="metric"><span class="k">🏅 闯关最佳</span><span class="v">' + (mine.best == null ? '-' : mine.best + ' / 12') + '</span></div>' +
        '<div class="metric"><span class="k">累计场次</span><span class="v">' + mine.games + ' 场</span></div>' +
        '<div class="metric"><span class="k">📄 体检记录</span><span class="v">' + checks.length + ' 条</span></div>' +
        '<div class="metric"><span class="k">🧮 计算记录</span><span class="v">' + calcs.length + ' 条</span></div>';

      var checkList = checks.length
        ? checks.map(function (c) {
          var lv = { high: '高危', medium: '中危', low: '低危' }[c.level] || c.level;
          return '<div class="hist-row"><div><b>' + esc(c.title) + '</b>' +
            '<div class="hint">' + esc((c.created_at || '').replace('T', ' ').slice(0, 16)) + ' · ' + c.hit_count + ' 类 · <b>' + c.score + '</b> 分 ' +
            '<span class="badge ' + (c.level === 'high' ? 'badge-danger' : c.level === 'medium' ? 'badge-warn' : 'badge-info') + '">' + lv + '</span></div></div>' +
            '<div class="row-inline"><button class="btn btn-ghost btn-sm" data-replay-check="' + c.id + '">↩ 重放</button>' +
            '<button class="btn btn-ghost btn-sm" data-del-check="' + c.id + '">🗑</button></div></div>';
        }).join('')
        : '<p class="hint">还没有体检记录：去「合同体检」载入示例合同跑一次，结果会自动保存到这里。</p>';

      var calcList = calcs.length
        ? calcs.map(function (c) {
          return '<div class="hist-row"><div><b>' + esc(c.title) + '</b>' +
            '<div class="hint">' + esc((c.created_at || '').replace('T', ' ').slice(0, 16)) + '</div></div>' +
            '<div class="row-inline"><button class="btn btn-ghost btn-sm" data-replay-calc="' + c.id + '">↩ 重放</button>' +
            '<button class="btn btn-ghost btn-sm" data-del-calc="' + c.id + '">🗑</button></div></div>';
        }).join('')
        : '<p class="hint">还没有计算记录：去「权益计算」填月薪等数据算一次，结果会自动保存到这里。</p>';

      var u = LJ.API.state.user;
      var boardRows = board.length
        ? '<table class="data"><tr><th>名次</th><th>用户</th><th>最佳</th><th>场次</th><th>最近</th></tr>' +
          board.map(function (b, i) {
            var me = u && (b.username === u.username);
            return '<tr' + (me ? ' style="background:rgba(69,183,245,.12)"' : '') + '><td>' + (i + 1) + '</td>' +
              '<td>' + esc((b.nickname || '') + (me ? '（我）' : '')) + '</td>' +
              '<td><b>' + b.best + '</b> / 12</td><td>' + b.games + '</td>' +
              '<td class="hint">' + esc((b.last_at || '').replace('T', ' ').slice(0, 10)) + '</td></tr>';
          }).join('') + '</table>'
        : '<p class="hint">暂无成绩上榜：完成一轮「情景闯关」后自动计入排行榜。</p>';

      box.innerHTML =
        '<div class="card">' +
        '<h3 class="card-title mb0"><span class="ico">👤</span>' + esc(u.nickname || u.username) + '</h3>' +
        '<p class="card-sub">@' + esc(u.username) + ' · 注册于 ' + esc((u.created_at || '').slice(0, 10)) + '</p>' +
        '<div class="row-inline">' +
        '<button class="btn btn-ghost btn-sm" id="btnLogout">退出登录</button>' +
        '<button class="btn btn-sm ' + (doneToday ? 'btn-ghost' : 'btn-primary') + '" id="btnCheckin">' +
        (doneToday ? '✅ 今日已打卡' : '📅 今日学法打卡') + '</button>' +
        ' <span class="hint" id="checkinMsg"></span>' +
        '</div></div>' +

        '<div class="card"><h3 class="card-title"><span class="ico">📊</span>学习统计</h3>' +
        '<div class="grid grid-3">' + statsHtml + '</div></div>' +

        '<div class="card"><h3 class="card-title"><span class="ico">📄</span>体检历史</h3>' + checkList + '</div>' +
        '<div class="card"><h3 class="card-title"><span class="ico">🧮</span>计算历史</h3>' + calcList + '</div>' +
        '<div class="card"><h3 class="card-title"><span class="ico">🏆</span>闯关排行榜（TOP 10）</h3>' + boardRows + '</div>';

      /* 事件绑定 */
      $('btnLogout').addEventListener('click', function () {
        LJ.API.logout().then(renderProfile).catch(function () { renderProfile(); });
      });
      var ciBtn = $('btnCheckin');
      if (!doneToday) {
        ciBtn.addEventListener('click', function () {
          LJ.API.checkin().then(function (d) {
            var m = $('checkinMsg');
            if (m) m.textContent = '✅ 打卡成功，连续 ' + d.streak + ' 天！';
            loadProfileData();
          }).catch(function (err) {
            var m = $('checkinMsg');
            if (m) m.textContent = '打卡失败：' + ((err && err.message) || '未知错误');
          });
        });
      }
      box.querySelectorAll('[data-del-check]').forEach(function (b) {
        b.addEventListener('click', function () {
          LJ.API.deleteCheck(parseInt(b.getAttribute('data-del-check'), 10)).then(loadProfileData).catch(function () { });
        });
      });
      box.querySelectorAll('[data-del-calc]').forEach(function (b) {
        b.addEventListener('click', function () {
          LJ.API.deleteCalc(parseInt(b.getAttribute('data-del-calc'), 10)).then(loadProfileData).catch(function () { });
        });
      });
      box.querySelectorAll('[data-replay-check]').forEach(function (b) {
        b.addEventListener('click', function () {
          var id = parseInt(b.getAttribute('data-replay-check'), 10);
          LJ.API.getCheck(id).then(function (d) {
            $('contractInput').value = d.record.text;
            $('checkHint').textContent = '已载入历史记录（点击「开始体检」重跑）';
            location.hash = '#check';
            onHash();
            $('btnCheck').click();
          }).catch(function () { });
        });
      });
      box.querySelectorAll('[data-replay-calc]').forEach(function (b) {
        b.addEventListener('click', function () {
          var id = parseInt(b.getAttribute('data-replay-calc'), 10);
          LJ.API.getCalc(id).then(function (d) {
            var i = d.record.inputs;
            $('calcMonthly').value = i.monthly || '';
            $('calcYears').value = i.years || '';
            $('calcMonths').value = i.months || '';
            $('calcReason').value = i.reason || 'consult';
            $('calcAvg3x').value = i.avg3x || '';
            $('otWork').value = (i.ot && i.ot[0]) || '';
            $('otRest').value = (i.ot && i.ot[1]) || '';
            $('otHoliday').value = (i.ot && i.ot[2]) || '';
            $('dwMonths').value = i.dw || '';
            $('alWorkYears').value = i.alYears != null ? i.alYears : 2;
            $('alUnpaid').value = i.alDays || '';
            $('termYears').value = i.tYears != null ? i.tYears : 1;
            $('termMonths').value = i.tMonths || '';
            $('calcHint').textContent = '已载入历史记录（自动重算）';
            location.hash = '#calc';
            onHash();
            $('btnCalc').click();
          }).catch(function () { });
        });
      });
    });
  }

  function renderProfileCard(box) {
    var u = LJ.API.state.user;
    if (!u) { renderAuthForm(box); return; }
    box.innerHTML =
      '<div class="card center"><p class="hint">正在加载学习统计与历史…</p></div>';
    loadProfileData();
  }

  function renderProfile() {
    var box = $('profileBox');
    var s = LJ.API.state;
    if (!s.ready) { box.innerHTML = '<div class="card center"><p class="hint">正在连接后端服务…</p></div>'; return; }
    if (!s.backend) {
      box.innerHTML =
        '<div class="card"><h3 class="card-title"><span class="ico">🔌</span>未连接后端服务</h3>' +
        '<p class="card-sub">当前为纯前端「本地引擎模式」，五大模块均可正常演示。要解锁账号/历史/打卡/问答等在线功能：</p>' +
        '<div class="notice">在项目根目录运行：<b>python -m server.server</b>，然后访问 <b>http://127.0.0.1:5000</b> 并刷新本页。</div>' +
        '<p class="kv" style="margin-top:12px">在线功能一览：注册登录 / 体检与计算历史 / 闯关成绩与排行榜 / 每日学法打卡（连续天数）/ 学习问答板。</p>' +
        '</div>';
      return;
    }
    if (!s.user) { renderAuthForm(box); return; }
    renderProfileCard(box);
  }

  /* ---------------- 启动 ---------------- */
  renderHome();
  renderRoadmapTypes();
  onHash();
  resetQuiz();
  renderLaw('');

  /* 后端连接与登录态（file:// 下自动降级为本地引擎模式） */
  LJ.API.onChange(function () {
    LJ.renderBackendBadge();
    if (document.getElementById('view-profile').classList.contains('active')) renderProfile();
  });
  LJ.API.init();
})();
