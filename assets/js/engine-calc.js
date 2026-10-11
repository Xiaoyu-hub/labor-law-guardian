/* ==========================================================================
   engine-calc.js —— 劳动权益计算引擎
   依据：
   - 月计薪天数 21.75（劳社部发〔2008〕3号）
   - 加班费 150% / 200% / 300%（劳动法 第44条）
   - 经济补偿 N（劳动合同法 第47条）、违法解除 2N（第87条）
   - 未签书面合同双倍工资（第82条，最多11个月）
   - 年休假 5/10/15 天（职工带薪年休假条例 第3条），未休按 300%（第5条）
   ========================================================================== */
window.LJ = window.LJ || {};

LJ.CALC = (function () {
  var R = {};

  R.round2 = function (n) { return Math.round(n * 100) / 100; };

  /* 日工资 / 小时工资 */
  R.dailyWage = function (monthly) { return monthly / 21.75; };
  R.hourlyWage = function (monthly) { return monthly / 21.75 / 8; };

  /* ---------- 加班费 ---------- */
  R.overtime = function (monthly, workdayH, restH, holidayH) {
    var hourly = R.hourlyWage(monthly);
    var parts = [
      { key: '工作日延长', hours: workdayH || 0, rate: 1.5, desc: '工作日延长工作时间 ×150%', law: '劳动法 第四十四条（一）' },
      { key: '休息日', hours: restH || 0, rate: 2, desc: '休息日工作且未安排补休 ×200%', law: '劳动法 第四十四条（二）' },
      { key: '法定节假日', hours: holidayH || 0, rate: 3, desc: '法定休假日工作 ×300%', law: '劳动法 第四十四条（三）' }
    ];
    var rows = parts.filter(function (p) { return p.hours > 0; }).map(function (p) {
      return {
        part: p,
        amount: R.round2(hourly * p.rate * p.hours),
        formula: p.hours + ' 小时 × ' + R.round2(hourly) + ' 元/小时 × ' + p.rate
      };
    });
    var total = R.round2(rows.reduce(function (s, r) { return s + r.amount; }, 0));
    return { hourly: R.round2(hourly), rows: rows, total: total };
  };

  /* ---------- 经济补偿 N 的月数 ---------- */
  R.compensationMonths = function (years, months) {
    var totalMonths = (years * 12) + months;
    var fullYears = Math.floor(totalMonths / 12);
    var rem = totalMonths % 12;
    var n = 0;
    if (fullYears >= 1) {
      n = fullYears;
      if (rem >= 1) n += (rem >= 6) ? 1 : 0.5;
    } else if (totalMonths >= 6) {
      n = 1;                      // 六个月以上不满一年 → 按一年计算
    } else if (totalMonths >= 1) {
      n = 0.5;                    // 不满六个月 → 半个月
    }
    return n;
  };

  /* ---------- 经济补偿 / 赔偿金 ----------
     reason: consult(协商一致·单位提出) / reason38(被迫离职) / noFault(无过失性辞退)
             / layoff(经济性裁员) / expire(合同到期单位不续) / illegal(违法解除)
             / resign(自己辞职) / fault(严重违纪被辞退)                          */
  R.termination = function (reason, monthly, years, months, avg3x) {
    var monthsN = R.compensationMonths(years, months);
    var capped = false;
    if (avg3x && monthly > avg3x) { monthly = avg3x; capped = true; }
    var nCap = monthsN;
    if (capped && monthsN > 12) { nCap = 12; }
    var base = R.round2(monthly);
    var nMoney = R.round2(base * nCap);
    var steps = [];
    steps.push('工作年限 ' + years + ' 年 ' + months + ' 个月 → 折算经济补偿 ' + nCap + ' 个月工资');
    if (capped) steps.push('月工资超过当地社平工资 3 倍（' + R.round2(avg3x) + ' 元），按 3 倍封顶计' + (monthsN > 12 ? '，且年限上限 12 年' : ''));
    steps.push('经济补偿 = ' + R.round2(base) + ' 元/月 × ' + nCap + ' = ' + nMoney + ' 元');

    var def = { label: reason, monthsN: nCap, nMoney: nMoney, base: base, steps: steps, law: '' };
    var map = {
      consult:  { label: '协商一致解除（由单位提出）', money: nMoney, steps: steps, law: '劳动合同法 第四十六条（二）、第四十七条' },
      reason38: { label: '被迫离职（单位违法在先，如欠薪/不缴社保）', money: nMoney, steps: steps, law: '劳动合同法 第三十八条、第四十六条（一）' },
      noFault:  { label: '无过失性辞退（医疗期满/不胜任/客观情况重大变化）', money: nMoney, steps: steps.concat(['未提前 30 日书面通知的，另加 1 个月工资代通知金（N+1）']), law: '劳动合同法 第四十条、第四十六条（三）' },
      layoff:   { label: '经济性裁员', money: nMoney, steps: steps, law: '劳动合同法 第四十一条、第四十六条（四）' },
      expire:   { label: '固定期限合同到期，单位不续（或降低条件续订）', money: nMoney, steps: steps, law: '劳动合同法 第四十六条（五）、第四十七条' },
      resign:   { label: '劳动者个人原因辞职', money: 0, steps: ['劳动者提前 30 日书面通知（试用期 3 日）辞职，单位无需支付经济补偿。'], law: '劳动合同法 第三十七条' },
      fault:    { label: '严重违纪被辞退', money: 0, steps: ['劳动者有严重违纪等法定过错时，单位可解除且无需支付补偿；但须有制度依据并履行告知工会程序。'], law: '劳动合同法 第三十九条、第四十三条' },
      illegal:  { label: '违法解除（赔偿金 2N）', money: R.round2(nMoney * 2), steps: steps.concat(['赔偿金为经济补偿标准的二倍：' + R.round2(nMoney) + ' × 2 = ' + R.round2(nMoney * 2) + ' 元']), law: '劳动合同法 第四十八条、第八十七条' }
    };
    var o = map[reason] || map.consult;
    o.base = base;
    return o;
  };

  /* ---------- 未签书面合同双倍工资（最多 11 个月） ---------- */
  R.doubleWage = function (monthly, months) {
    var m = Math.max(0, Math.min(months || 0, 11));
    return {
      months: m,
      extra: R.round2(monthly * m),
      total: R.round2(monthly * m * 2),
      steps: ['双倍工资自用工满 1 个月的次日起算，最长 11 个月',
              '额外部分 = ' + monthly + ' 元/月 × ' + m + ' 个月 = ' + R.round2(monthly * m) + ' 元']
    };
  };

  /* ---------- 年休假天数 ---------- */
  R.annualLeaveDays = function (workYears) {
    var y = workYears || 0;
    if (y >= 20) return 15;
    if (y >= 10) return 10;
    if (y >= 1) return 5;
    return 0;
  };

  /* ---------- 未休年假折现 ---------- */
  R.annualLeaveCash = function (monthly, leaveDays, unpaidDays) {
    var daily = R.round2(R.dailyWage(monthly));
    var d = Math.min(unpaidDays || 0, (leaveDays || 0));
    var amount = R.round2(R.dailyWage(monthly) * d * 3);
    return {
      daily: daily,
      unpaid: d,
      amount: amount,
      note: '注：300% 中含正常工作期间的工资；若当月工资已正常发放，可另行主张 200% 部分。',
      steps: ['日工资 = 月工资 ÷ 21.75 = ' + daily + ' 元/天',
              '未休年假 ' + d + ' 天 × ' + daily + ' 元/天 × 300% = ' + amount + ' 元']
    };
  };

  /* ---------- 试用期合法上限 ---------- */
  R.probationMax = function (termYears, termMonths) {
    var tM = termYears * 12 + termMonths;
    if (tM === 0) return null; // 未填
    if (tM < 3) return { max: 0, desc: '合同期限不满 3 个月或以完成一定工作任务为期限，不得约定试用期' };
    if (tM < 12) return { max: 1, desc: '合同期限 3 个月以上不满 1 年，试用期不得超过 1 个月' };
    if (tM < 36) return { max: 2, desc: '合同期限 1 年以上不满 3 年，试用期不得超过 2 个月' };
    return { max: 6, desc: '3 年以上固定期限或无固定期限劳动合同，试用期不得超过 6 个月' };
  };

  /* ---------- 工伤停工留薪期工资（S4 新增） ----------
     停工留薪期内原工资福利待遇不变，由单位按月支付，
     一般不超过 12 个月（伤情严重或特殊，经设区的市级劳动能力鉴定委员会确认可延长，不超过 12 个月）。 */
  R.suspensionWage = function (monthly, months) {
    var m = Math.max(0, months || 0);
    var amount = R.round2(monthly * m);
    return {
      months: m,
      amount: amount,
      note: '停工留薪期一般不超过 12 个月；伤情严重或情况特殊经劳动能力鉴定委员会确认可延长，延长不超过 12 个月（合计不超过 24 个月）。',
      steps: ['停工留薪期内原工资福利待遇不变，由用人单位按月支付',
              '停工留薪期工资 = ' + monthly + ' 元/月 × ' + m + ' 个月 = ' + amount + ' 元']
    };
  };

  /* ---------- 生育津贴（S4 新增） ----------
     生育津贴按职工所在用人单位上年度职工月平均工资计发：
     津贴 = 单位上年度职工月平均工资 ÷ 30 × 产假天数。
     未参加生育保险的，由用人单位按产假前工资标准支付。 */
  R.maternityAllowance = function (avgMonthly, days) {
    var d = Math.max(0, days || 0);
    var daily = R.round2((avgMonthly || 0) / 30);
    var amount = R.round2((avgMonthly || 0) / 30 * d);
    return {
      days: d,
      daily: daily,
      amount: amount,
      note: '法定产假 98 天（难产增加 15 天、多胞胎每多 1 婴增加 15 天），各地另有奖励假；津贴按单位上年度职工月平均工资 ÷ 30 × 产假天数计发。未参保的由单位按产假前工资支付。',
      steps: ['生育津贴 = 单位上年度职工月平均工资 ÷ 30 × 产假天数',
              '日津贴 = ' + (avgMonthly || 0) + ' ÷ 30 = ' + daily + ' 元/天',
              '津贴 = ' + daily + ' 元/天 × ' + d + ' 天 = ' + amount + ' 元']
    };
  };

  return R;
})();
