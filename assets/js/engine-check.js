/* ==========================================================================
   engine-check.js —— 劳动合同智能体检规则引擎
   --------------------------------------------------------------------------
   管线：原文 → 逐规则扫描（正则 + verify 二次判定）→ 命中排序/重叠去重
        → 风险评分 → 原文高亮渲染
   评分：100 分制，high -22 / medium -10 / low -4（下限 5）
   ========================================================================== */
window.LJ = window.LJ || {};

/* ---------- 中文数字解析工具 ---------- */
LJ.cnToNum = function (s) {
  if (s == null) return NaN;
  var t = String(s).trim();
  if (/^\d+$/.test(t)) return parseInt(t, 10);
  var map = { '零': 0, '一': 1, '二': 2, '三': 3, '四': 4, '五': 5, '六': 6, '七': 7, '八': 8, '九': 9 };
  t = t.replace(/十/g, '10').split('').map(function (c) {
    return Object.prototype.hasOwnProperty.call(map, c) ? String(map[c]) : c;
  }).join('');
  if (!/^\d+$/.test(t)) return NaN;
  return parseInt(t, 10);
};

/* ---------- 上下文辅助判定 ---------- */
/* 从合同文段的上下文里推断合同期限（月数）：优先读「共 N 年 / 期限 N 年」，
   读不到再尝试两段日期区间。推断不到返回 null（该规则不误报） */
LJ.termMonthsFromContext = function (ctx) {
  var m;
  m = /(?:合同期限|期限|共|为|合计)\s*([一二三四五六七八九十\d零]+)\s*年(?:零|另)?\s*(\d+)?\s*个月?/.exec(ctx);
  if (m) {
    var years = LJ.cnToNum(m[1]);
    if (!isNaN(years)) return years * 12 + (m[2] ? parseInt(m[2], 10) : 0);
  }
  m = /自?\s*(\d{4})\s*年\s*(\d{1,2})\s*月[\s\S]{0,24}?至\s*(\d{4})\s*年\s*(\d{1,2})\s*月/.exec(ctx);
  if (m) {
    var t1 = parseInt(m[1], 10) * 12 + parseInt(m[2], 10);
    var t2 = parseInt(m[3], 10) * 12 + parseInt(m[4], 10);
    if (t2 >= t1) return t2 - t1;
  }
  return null;
};

/* 判断上下文中是否存在「肯定式」的经济补偿表述（排除 无需/不予/未 支付补偿 等否定句） */
LJ.hasAffirmativeCompensation = function (ctx) {
  var re = /(?:支付|给予|发放)(?:经济|离职)?补偿|按月\s*(?:给予|支付)|每月\s*(?:给予|支付)/g;
  var m;
  while ((m = re.exec(ctx)) !== null) {
    var pre = ctx.slice(Math.max(0, m.index - 8), m.index);
    if (!/(?:无需|不予|不再|未|没|拒绝)/.test(pre)) return true;
  }
  return false;
};

/* ---------- 规则库（40+ 条） ---------- */
/* 每条：id / category 类别 / severity 严重度 / re 正则(g) / verify(m,text,ctx) 二次判定
        / title 标题 / advice 整改建议 / laws 法条依据 */
LJ.RULES = [

  /* ======================= 试用期 ======================= */
  {
    id: 'probation_over_6m', category: '试用期', severity: 'high',
    re: /试用期[^。；\n]{0,12}?(?:为|不超过|不得超过|期限)?\s*(\d+|[一二三四五六七八九十]+)\s*个?\s*月/g,
    verify: function (m, text, ctx) {
      var months = LJ.cnToNum(m[1]);
      if (months > 6) return true;                    // 无论如何都超上限
      var term = LJ.termMonthsFromContext(ctx);       // 结合合同期限判断
      if (term === null) return false;                // 无期限信息 → 不误报
      var max = term < 3 ? 0 : term < 12 ? 1 : term < 36 ? 2 : 6;
      return months > max;
    },
    title: '试用期超过法定上限（6 个月）',
    advice: '三年以上固定期限或无固定期限劳动合同，试用期最长不得超过 6 个月；请核对合同期限与试用期的对应关系，超期部分无效且少发部分可主张补足。',
    laws: ['劳动合同法 第十九条']
  },
  {
    id: 'probation_repeat', category: '试用期', severity: 'high',
    re: /(?:再次|重新|二次|第二个|延长)[^。；\n]{0,6}试用期|试用期[^。；\n]{0,10}(?:延长|顺延)/g,
    title: '重复约定 / 延长试用期',
    advice: '同一用人单位与同一劳动者只能约定一次试用期，不得以任何理由延长或再次约定。',
    laws: ['劳动合同法 第十九条']
  },
  {
    id: 'probation_low_pay', category: '试用期', severity: 'high',
    re: /试用期[^。；\n]{0,40}?(?:工资|薪资|报酬)[^。；\n]{0,20}?(?:百分之\s*([五六四三二一十\d]+)|\b(\d{1,2})\s*%)/g,
    verify: function (m) { return LJ.cnToNum(m[1] || m[2]) < 80; },
    title: '试用期工资低于约定工资的 80%',
    advice: '试用期工资不得低于本单位相同岗位最低档工资或劳动合同约定工资的 80%，且不得低于当地最低工资标准。',
    laws: ['劳动合同法 第二十条']
  },
  {
    id: 'probation_no_pay', category: '试用期', severity: 'high',
    re: /试用期[^。；\n]{0,30}?(?:不(?:予)?(?:支付|发放|计发)工资|无(?:工资|薪)|不享有(?:工资|报酬)|工资[为是]?\s*0)/g,
    title: '试用期不支付工资',
    advice: '试用期包含在劳动合同期限内，劳动者已提供劳动，用人单位必须支付不低于法定标准的劳动报酬。',
    laws: ['劳动合同法 第二十条', '劳动合同法 第二十八条']
  },
  {
    id: 'probation_not_in_term', category: '试用期', severity: 'medium',
    re: /试用期[^。；\n]{0,12}?(?:不(?:包含|计入|计算)在?劳动合同期限内|(?:不(?:计入|算入))(?:劳动)?合同期)/g,
    title: '试用期不计入劳动合同期限',
    advice: '试用期必须包含在劳动合同期限内，单独计算的约定无效。',
    laws: ['劳动合同法 第十九条']
  },
  {
    id: 'probation_resign_30d', category: '试用期', severity: 'medium',
    re: /试用期[^。；\n]{0,25}?提前\s*(?:三十|30)\s*日/g,
    title: '试用期离职被要求提前 30 日通知',
    advice: '劳动者在试用期内提前 3 日通知即可解除劳动合同，约定 30 日加重了劳动者义务。',
    laws: ['劳动合同法 第三十七条']
  },

  /* ======================= 社会保险 ======================= */
  {
    id: 'si_waiver', category: '社会保险', severity: 'high',
    re: /(?:自愿|本人|乙方|员工)?\s*(?:放弃|不予|不缴|无需|不再|免除)[^。；\n]{0,10}?(?:社会保险|社保|五险)|不(?:为|给|替)[^。；\n]{0,6}(?:缴纳|办理|购买)[^。；\n]{0,4}(?:社会保险|社保|五险)/g,
    title: '约定不缴 / 放弃缴纳社会保险',
    advice: '依法缴纳社会保险是强制性法定义务，劳动者自愿放弃的承诺无效；单位不缴将面临补缴、滞纳金与罚款。',
    laws: ['社会保险法 第五十八条', '劳动合同法 第三十八条', '社会保险法 第八十六条']
  },
  {
    id: 'si_cash_substitute', category: '社会保险', severity: 'high',
    re: /(?:以)?(?:现金|补贴|补助|津贴)[^。；\n]{0,10}?(?:代替|替代|充抵|折抵)[^。；\n]{0,6}?(?:社会保险|社保)|(?:社会保险|社保)[^。；\n]{0,10}?(?:以|通过)?(?:现金|补贴|补助)[^。；\n]{0,6}?(?:代替|替代|发放)/g,
    title: '以现金补贴代替缴纳社保',
    advice: '社保不能用现金、补贴替代，社保费用由单位与个人依法分担并计入个人账户。',
    laws: ['社会保险法 第六十条', '社会保险法 第八十四条']
  },
  {
    id: 'si_self_pay', category: '社会保险', severity: 'high',
    re: /(?:社会保险|社保)[^。；\n]{0,10}(?:自行|自己|本人)[^。；\n]{0,6}(?:承担|缴纳)|(?:社会保险费|社保费)[^。；\n]{0,10}(?:由|由乙方|由劳动者|由员工)[^。；\n]{0,8}(?:乙方|劳动者|员工|本人|个人)?(?:自行)?(?:承担|缴纳)/g,
    title: '社保费用约定由劳动者全部承担',
    advice: '社保费由用人单位与职工按国家规定共同缴纳，单位不得将单位应缴部分转嫁给劳动者。',
    laws: ['社会保险法 第六十条', '劳动法 第七十二条']
  },
  {
    id: 'si_delayed', category: '社会保险', severity: 'medium',
    re: /(?:转正|试用期满|入职满|工作满)[^。；\n]{0,10}?(?:后|之后|起)?[^。；\n]{0,6}?(?:方|才|再|开始|予以)?(?:为)?[^。；\n]{0,6}?(?:办理|缴纳|购买)[^。；\n]{0,4}?(?:社会保险|社保)/g,
    title: '转正后才缴纳社保',
    advice: '单位应当自用工之日起 30 日内办理社保登记，试用期也应正常缴纳，「转正后才缴」违法。',
    laws: ['社会保险法 第五十八条', '劳动合同法 第十九条']
  },
  {
    id: 'si_min_base', category: '社会保险', severity: 'medium',
    re: /(?:社会保险|社保)[^。；\n]{0,15}?按(?:当地)?(?:最低工资|最低基数|最低标准)(?:标准)?[^。；\n]{0,6}(?:缴纳|计缴|核定)/g,
    title: '按最低基数缴纳社保',
    advice: '社保缴费基数应按职工实际工资核定，不足额缴纳将被责令补缴并加收滞纳金。',
    laws: ['社会保险法 第六十条', '社会保险法 第八十六条']
  },

  /* ======================= 加班与工时 ======================= */
  {
    id: 'overtime_no_pay', category: '加班与工时', severity: 'high',
    re: /(?:加班|延长工作时间)[^。；\n]{0,18}?(?:不(?:予|再)?支付|不予计发|不另计|无)(?:加班费|加班工资|加班报酬)|(?:公司|甲方)[^。；\n]{0,10}?(?:无需|不用|不)(?:支付|发放)(?:加班费|加班工资)/g,
    title: '安排加班但不支付加班费',
    advice: '安排加班应依法支付加班费：工作日 150%、休息日 200%（或补休）、法定节假日 300%。',
    laws: ['劳动法 第四十四条', '劳动合同法 第三十一条', '劳动合同法 第八十五条']
  },
  {
    id: 'overtime_included_in_salary', category: '加班与工时', severity: 'medium',
    re: /(?:工资|月薪|薪资|报酬)[^。；\n]{0,15}?(?:已|均)?(?:包含|包括|内含|含)[^。；\n]{0,6}?(?:加班费|加班工资|全部加班)/g,
    title: '约定工资已包含加班费',
    advice: '以固定工资「打包」覆盖加班费的做法常见于争议焦点：加班费应按实际加班时长单独核算，包薪条款需结算时足额覆盖，否则仍属未足额支付。',
    laws: ['劳动法 第四十四条', '劳动合同法 第八十五条']
  },
  {
    id: 'overtime_must_obey', category: '加班与工时', severity: 'high',
    re: /(?:加班|延长工作时间)[^。；\n]{0,20}?(?:不得(?:无故)?拒绝|无条件服从|应无条件|必须服从)|(?:公司|甲方)(?:有权)?(?:根据(?:工作|业务|经营)需要)?[^。；\n]{0,8}(?:强令|强行|强迫)(?:员工|乙方|劳动者)?[^。；\n]{0,6}?加班/g,
    title: '强迫加班且不得拒绝',
    advice: '延长工作时间须经与工会和劳动者协商，且每日不超过 1 小时（特殊原因 3 小时）、每月不超过 36 小时，不得强迫或变相强迫加班。',
    laws: ['劳动法 第四十一条', '劳动合同法 第三十一条']
  },
  {
    id: 'overtime_waiver', category: '加班与工时', severity: 'high',
    re: /(?:员工|乙方|劳动者)[^。；\n]{0,12}?(?:自愿)?(?:放弃|不再主张|不主张)[^。；\n]{0,8}?(?:加班费|加班工资|加班报酬)/g,
    title: '约定劳动者放弃加班费',
    advice: '加班费属于法定强制性报酬，事前放弃的约定无效。',
    laws: ['劳动法 第四十四条', '劳动合同法 第二十六条']
  },
  {
    id: 'weekly_six_days', category: '加班与工时', severity: 'medium',
    re: /每周[^。；\n]{0,10}?(?:工作|上班|出勤)[^。；\n]{0,4}?(?:六|6)\s*天|单休|做六休一/g,
    title: '每周工作 6 天（单休）',
    advice: '每周至少休息 1 日并不当然违法，但须确保每日不超过 8 小时、每周总工时合规，且休息日工作应支付 200% 加班费或安排补休。',
    laws: ['劳动法 第三十六条', '劳动法 第三十八条', '劳动法 第四十四条']
  },
  {
    id: 'standby_unpaid', category: '加班与工时', severity: 'medium',
    re: /(?:下班后|非工作时间|周末|休息日|节假日)[^。；\n]{0,20}?(?:应当|需|须|要)[^。；\n]{0,10}?(?:保持|处于)?(?:在线|待命|可联系|响应|接听)/g,
    title: '非工作时间随时待命',
    advice: '休息时间随时响应可能被认定为事实加班，若约定不支付任何加班费用则涉嫌违法。',
    laws: ['劳动法 第三十九条', '劳动法 第四十四条']
  },
  {
    id: 'flexible_hours', category: '加班与工时', severity: 'medium',
    re: /(?:实行|采用|按)(?:综合计算工时制|不定时工作制|综合工时制)/g,
    title: '实行特殊工时制',
    advice: '综合计算工时、不定时工作制须经劳动行政部门批准并向劳动者公示，未经审批的约定不产生排除加班费的法律效力。',
    laws: ['劳动法 第三十九条', '劳动法 第四十四条']
  },

  /* ======================= 工资支付 ======================= */
  {
    id: 'below_min_wage', category: '工资支付', severity: 'high',
    re: /(?:月工资|月薪|月基本工资|基本工资|月收入|工资标准)[^。；\n]{0,10}(?:为|不低于|：|:)?\s*(\d{3,5})\s*元(?!\/)/g,
    verify: function (m) { return LJ.cnToNum(m[1]) < 1800; },
    title: '约定工资疑似低于最低工资标准',
    advice: '月工资低于 1800 元，明显低于全国绝大多数省市现行月最低工资标准（多数地区 1800–2690 元），请按工作地最新标准核对，低于部分应补足。',
    laws: ['劳动合同法 第八十五条', '最低工资规定 第三条']
  },
  {
    id: 'deposit', category: '工资支付', severity: 'high',
    re: /(?:押金|保证金|风险金|诚信金|担保金|抵押金)|(?:押|压|扣)[^。；\n]{0,4}(\d+|[一二三四五六七八九十]+)?\s*个月工资/g,
    title: '收取押金 / 保证金 / 押扣工资',
    advice: '用人单位不得以任何名义向劳动者收取财物或抵押金，已收取的应责令退还并按每人 500–2000 元罚款。',
    laws: ['劳动合同法 第九条', '劳动合同法 第八十四条']
  },
  {
    id: 'withhold_id', category: '工资支付', severity: 'high',
    re: /(?:扣押|暂扣|上交|代为保管|交由(?:公司|甲方)?(?:保管)?)[^。；\n]{0,8}(?:身份证|居民身份证|毕业证|学位证|证件|资格证书)/g,
    title: '扣押身份证 / 学历证书',
    advice: '扣押劳动者居民身份证等证件属违法行为，应责令限期退还并按法律规定给予处罚。',
    laws: ['劳动合同法 第九条', '劳动合同法 第八十四条']
  },
  {
    id: 'salary_delay', category: '工资支付', severity: 'low',
    re: /(?:工资|薪资)[^。；\n]{0,15}(?:次月|下(?:个)?月|每(?:两|2)个月|两个月后|(?:押|压)[^。；\n]{0,4}个月)[^。；\n]{0,8}(?:发放|支付|结算)/g,
    title: '工资发放周期较长',
    advice: '工资须以货币形式按月支付，不得克扣或无故拖欠；按月结算即可，跨月累计发放存在拖欠风险。',
    laws: ['劳动法 第五十条', '劳动合同法 第八十五条']
  },
  {
    id: 'unilateral_salary_change', category: '工资支付', severity: 'high',
    re: /(?:公司|甲方)(?:有权)?[^。；\n]{0,15}(?:单方|自行|自主)?(?:调整|降低|下调|变更)[^。；\n]{0,8}(?:工资|薪资|待遇|岗位工资|薪酬)/g,
    title: '单位单方调整 / 降低工资',
    advice: '变更劳动报酬须双方协商一致并采用书面形式，单方降薪条款无效。',
    laws: ['劳动合同法 第三十五条', '劳动合同法 第二十六条']
  },
  {
    id: 'deduct_on_resign', category: '工资支付', severity: 'medium',
    re: /(?:离职|解约|辞职|解除劳动合同)[^。；\n]{0,20}(?:扣除|扣发|不予发放|不予结算|没收)[^。；\n]{0,10}(?:工资|培训费|费用|报酬|补偿)/g,
    title: '离职时克扣工资 / 培训费',
    advice: '劳动者离职时工资应正常结算；除劳动者依法承担赔偿责任外，不得任意扣款。',
    laws: ['劳动法 第五十条', '劳动合同法 第八十五条']
  },

  /* ======================= 违约金与赔偿 ======================= */
  {
    id: 'illegal_penalty', category: '违约金与赔偿', severity: 'high',
    re: /违约金/g,
    verify: function (m, text, ctx) {
      return !/(服务期|专项培训|竞业限制|保密)/.test(ctx);
    },
    title: '约定劳动者承担违约金',
    advice: '除「专项培训服务期」和「竞业限制」两种法定情形外，不得约定由劳动者承担违约金；本条款与上下文未见相应情形，涉嫌违法。',
    laws: ['劳动合同法 第二十五条', '劳动合同法 第二十二条']
  },
  {
    id: 'resign_penalty', category: '违约金与赔偿', severity: 'high',
    re: /(?:提前(?:离职|离岗|辞职)|擅自(?:离职|离岗)|未满(?:合同期|[一二三四五\d]+年))[^。；\n]{0,25}(?:赔偿|违约金|扣发|不予结算)/g,
    title: '提前离职须赔偿公司',
    advice: '劳动者提前 30 日书面通知即可解除劳动合同，无需向公司支付违约金；此类条款加重劳动者义务，无效。',
    laws: ['劳动合同法 第三十七条', '劳动合同法 第二十五条']
  },
  {
    id: 'high_damages', category: '违约金与赔偿', severity: 'medium',
    re: /(?:赔偿|赔偿金|违约金)[^。；\n]{0,15}?(\d+)\s*(?:万元|万)/g,
    verify: function (m) { return LJ.cnToNum(m[1]) >= 3; },
    title: '约定高额赔偿 / 违约金',
    advice: '对劳动者约定高额赔偿缺乏法律依据，超出实际损失部分难以得到支持；注意核对是否落入服务期/竞业限制两种法定情形。',
    laws: ['劳动合同法 第二十五条', '劳动合同法 第九十条']
  },

  /* ======================= 竞业限制 ======================= */
  {
    id: 'noncompete_no_comp', category: '竞业限制', severity: 'high',
    re: /竞业限制/g,
    verify: function (m, text, ctx) {
      return !LJ.hasAffirmativeCompensation(ctx);
    },
    title: '约定竞业限制但未约定补偿',
    advice: '负有保密义务的劳动者，单位须在竞业限制期内按月给予经济补偿；只约定义务不给补偿的条款无效。',
    laws: ['劳动合同法 第二十三条', '劳动合同法 第二十四条']
  },
  {
    id: 'noncompete_over_2y', category: '竞业限制', severity: 'high',
    re: /竞业限制[^。；\n]{0,25}?(\d+|[一二三四五六七八九十]+)\s*(年|个月)/g,
    verify: function (m) { return (m[2] === '年') ? (LJ.cnToNum(m[1]) * 12 > 24) : (LJ.cnToNum(m[1]) > 24); },
    title: '竞业限制期限超过 2 年',
    advice: '竞业限制期限不得超过 2 年，超期部分无效。',
    laws: ['劳动合同法 第二十四条']
  },
  {
    id: 'noncompete_all_staff', category: '竞业限制', severity: 'medium',
    re: /(?:全体|所有|全部|任何)(?:员工|劳动者|人员)[^。；\n]{0,12}?竞业限制|竞业限制[^。；\n]{0,12}?(?:适用于)?(?:全体|所有|全部)(?:员工|劳动者)/g,
    title: '竞业限制适用于全体员工',
    advice: '竞业限制仅适用于高级管理人员、高级技术人员和其他负有保密义务的人员，普通员工不受此限。',
    laws: ['劳动合同法 第二十四条']
  },

  /* ======================= 解除与终止 ======================= */
  {
    id: 'terminate_no_comp', category: '解除与终止', severity: 'high',
    re: /(?:甲方|公司|用人单位)(?:有权)?[^。；\n]{0,25}(?:解除|终止)[^。；\n]{0,20}(?:不(?:予|再)?(?:支付|给予|承担)?(?:经济)?补偿|无需(?:支付|给予)(?:经济)?补偿|不承担(?:任何)?(?:经济)?补偿)/g,
    title: '解除合同却不支付经济补偿',
    advice: '协商解除、无过失性辞退、经济性裁员等情形单位须支付经济补偿（N）；预先免除该义务的条款无效。',
    laws: ['劳动合同法 第四十六条', '劳动合同法 第四十七条', '劳动合同法 第八十五条']
  },
  {
    id: 'terminate_anytime', category: '解除与终止', severity: 'high',
    re: /(?:甲方|公司|用人单位)(?:有权)?[^。；\n]{0,8}(?:随时|无条件|任意)[^。；\n]{0,8}(?:解除|辞退|终止)/g,
    title: '单位可随时 / 无条件解除合同',
    advice: '单位单方解除必须符合法定情形（严重违纪等）或提前 30 日书面通知（或支付代通知金），「随时解除」条款无效，劳动者可主张 2N 赔偿金。',
    laws: ['劳动合同法 第三十九条', '劳动合同法 第四十条', '劳动合同法 第八十七条']
  },
  {
    id: 'resign_need_approval', category: '解除与终止', severity: 'high',
    re: /(?:辞职|离职|解除劳动合同|离岗)[^。；\n]{0,20}(?:须|需|应当|必须)[^。；\n]{0,8}(?:经)?[^。；\n]{0,6}(?:公司|甲方|部门|领导)(?:同意|批准|审批)/g,
    title: '辞职须经公司同意',
    advice: '劳动者提前 30 日（试用期 3 日）书面通知即可解除，属形成权，不需要公司批准；约定需批准的条款无效。',
    laws: ['劳动合同法 第三十七条']
  },
  {
    id: 'auto_resign', category: '解除与终止', severity: 'high',
    re: /(?:旷工|缺勤|未到岗)[^。；\n]{0,15}(?:视为|按|作为)?[^。；\n]{0,6}(?:自动离职|自动解除|自动放弃)/g,
    title: '旷工即视为自动离职',
    advice: '即使旷工也应履行法定程序（规章制度民主程序 + 告知工会 + 送达解除通知），「自动离职」约定不能免除单位结清工资等义务。',
    laws: ['劳动合同法 第三十九条', '劳动合同法 第四十三条']
  },
  {
    id: 'abandon_wages', category: '解除与终止', severity: 'high',
    re: /(?:放弃|视为放弃|不再主张)[^。；\n]{0,12}(?:工资|劳动报酬|加班费|经济补偿|赔偿金)/g,
    title: '约定放弃工资 / 补偿权益',
    advice: '工资、加班费、经济补偿属法定强制性权益，事前放弃条款无效。',
    laws: ['劳动合同法 第二十六条', '劳动法 第五十条']
  },
  {
    id: 'no_contract_copy', category: '解除与终止', severity: 'medium',
    re: /(?:劳动合同|合同)(?:文本|书)?[^。；\n]{0,15}(?:由(?:公司|甲方)(?:统一)?(?:保存|保管|留存)|一份[^。；\n]{0,6}?由(?:公司|甲方)(?:保存|保管|留存))/g,
    title: '合同文本由公司统一保管',
    advice: '劳动合同文本应由用人单位和劳动者各执一份，公司独占全部文本将损害劳动者举证能力。',
    laws: ['劳动合同法 第十六条', '劳动合同法 第八十一条']
  },

  /* ======================= 工伤与劳动保护 ======================= */
  {
    id: 'waive_injury', category: '工伤与劳动保护', severity: 'high',
    re: /(?:工伤|意外|伤害|伤亡)[^。；\n]{0,20}(?:由(?:乙方|员工|劳动者)(?:自行|本人)?承担|(?:公司|甲方)(?:概)?不(?:承担|负责)|自负)/g,
    title: '约定工伤责任自负',
    advice: '工伤保险是强制保险，工伤认定不以合同约定为前提，约定「工伤自负」条款无效；单位未参保的，由单位按工伤保险待遇标准支付。',
    laws: ['工伤保险条例 第十七条', '社会保险法 第三十三条']
  },
  {
    id: 'safety_self', category: '工伤与劳动保护', severity: 'medium',
    re: /(?:劳动保护|安全(?:防护)?(?:措施|用品)?|防护用品)[^。；\n]{0,15}(?:由(?:乙方|员工)(?:自行)?(?:负责|承担|提供|自理)|自备)/g,
    title: '劳动防护用品由员工自备',
    advice: '用人单位必须提供符合国家标准的劳动防护用品与劳动保护条件，费用不得转嫁给劳动者。',
    laws: ['劳动合同法 第十七条', '劳动合同法 第三十八条']
  },

  /* ======================= 女职工保护 ======================= */
  {
    id: 'preg_limit', category: '女职工保护', severity: 'high',
    re: /(?:不得|禁止|不许|暂不)[^。；\n]{0,4}(?:结婚|生育|怀孕)|(?:入职|工作|任职)[^。；\n]{0,12}(?:不得|禁止|承诺不)(?:生育|怀孕|结婚)|已婚已育|已生育/g,
    title: '限制女职工结婚生育',
    advice: '不得以结婚、怀孕、产假、哺乳为由限制录用或解除合同；孕、产、哺乳期内单位不得依据无过失性辞退或裁员解除合同。',
    laws: ['劳动合同法 第四十二条', '妇女权益保障法 第四十八条']
  },

  /* ======================= 争议解决与兜底 ======================= */
  {
    id: 'waive_litigation', category: '争议解决', severity: 'high',
    re: /(?:放弃|不得|承诺不)[^。；\n]{0,12}(?:申请仲裁|申请劳动仲裁|提起诉讼|起诉|申诉)/g,
    title: '约定放弃仲裁 / 诉讼权利',
    advice: '劳动争议仲裁与诉讼是法律赋予的救济权利，不得通过约定预先放弃，此类条款无效。',
    laws: ['劳动争议调解仲裁法 第五条', '劳动合同法 第二十六条']
  },
  {
    id: 'waive_all_rights', category: '争议解决', severity: 'high',
    re: /(?:放弃)[^。；\n]{0,8}(?:一切|所有|任何)(?:权利|权益|主张)/g,
    title: '约定放弃一切权利',
    advice: '概括性放弃权利的条款免除单位法定责任、排除劳动者权利，属于无效条款。',
    laws: ['劳动合同法 第二十六条']
  },
  {
    id: 'unilateral_rules', category: '争议解决', severity: 'medium',
    re: /(?:公司|甲方)(?:有权)?[^。；\n]{0,15}(?:单方|自行|随时)?[^。；\n]{0,6}(?:修改|变更|调整|制定)[^。；\n]{0,10}(?:规章制度|员工手册|合同(?:条款)?|岗位|工作地点|工作内容)/g,
    title: '规章制度 / 合同条款可单方变更',
    advice: '直接涉及劳动者切身利益的规章制度须经民主程序并公示告知；岗位、地点、报酬变更须协商一致，单方变更无效。',
    laws: ['劳动合同法 第四条', '劳动合同法 第三十五条']
  },
  {
    id: 'oral_only', category: '争议解决', severity: 'medium',
    re: /(?:口头|微信|电话)(?:约定|协商|通知)(?:即可|为准|有效)|(?:无需|不用|不必)(?:签订|订立)(?:书面)?(?:劳动合同|协议)/g,
    title: '以口头约定代替书面合同',
    advice: '建立劳动关系应订立书面劳动合同，未签书面合同超过一个月，单位须支付双倍工资（最多 11 个月）。',
    laws: ['劳动合同法 第十条', '劳动合同法 第八十二条']
  }
];

/* ---------- 权重 ---------- */
LJ.SEVERITY_WEIGHT = { high: 22, medium: 10, low: 4 };

/* ---------- 主检查函数 ---------- */
LJ.checkContract = function (text) {
  if (!text || !text.trim()) {
    return { findings: [], score: null, level: null, stats: { high: 0, medium: 0, low: 0, total: 0, byCategory: {} } };
  }

  var hits = [];   // {rule, index, length}
  var findings = [];
  var seen = {};

  LJ.RULES.forEach(function (rule) {
    var m;
    rule.re.lastIndex = 0;
    var ruleHits = [];
    while ((m = rule.re.exec(text)) !== null) {
      if (m[0].length === 0) { rule.re.lastIndex++; continue; }
      var ctx = text.slice(Math.max(0, m.index - 160), Math.min(text.length, m.index + m[0].length + 160));
      if (rule.verify && !rule.verify(m, text, ctx)) continue;
      ruleHits.push({ index: m.index, length: m[0].length });
      if (m.index === rule.re.lastIndex) rule.re.lastIndex++; // 防零宽死循环
    }
    if (ruleHits.length) {
      findings.push({
        rule: rule,
        count: ruleHits.length,
        first: text.slice(ruleHits[0].index, ruleHits[0].index + ruleHits[0].length)
      });
      hits = hits.concat(ruleHits.map(function (h) { return { rule: rule, index: h.index, length: h.length }; }));
    }
  });

  /* 排序：高危优先，其次按出现位置 */
  var sevRank = { high: 0, medium: 1, low: 2 };
  findings.sort(function (a, b) {
    if (sevRank[a.rule.severity] !== sevRank[b.rule.severity]) return sevRank[a.rule.severity] - sevRank[b.rule.severity];
    return a.rule.id.localeCompare(b.rule.id);
  });

  /* 统计 */
  var stats = { high: 0, medium: 0, low: 0, total: findings.length, byCategory: {} };
  var score = 100;
  findings.forEach(function (f) {
    stats[f.rule.severity]++;
    stats.byCategory[f.rule.category] = (stats.byCategory[f.rule.category] || 0) + 1;
    score -= LJ.SEVERITY_WEIGHT[f.rule.severity];
  });
  score = Math.max(5, score);

  var level;
  if (stats.high >= 3 || score < 60) level = 'high';
  else if (stats.high > 0 || score < 85) level = 'medium';
  else level = 'low';

  return { findings: findings, hits: hits, score: score, level: level, stats: stats };
};

/* ---------- 原文高亮渲染（重叠去重后生成 <mark>） ---------- */
LJ.highlightContract = function (text, hits) {
  if (!hits || !hits.length) return LJ.escapeHtml(text);

  var sorted = hits.slice().sort(function (a, b) {
    return a.index - b.index || b.length - a.length;
  });

  /* 贪心合并重叠区间，取最长覆盖 */
  var merged = [];
  sorted.forEach(function (h) {
    var last = merged[merged.length - 1];
    if (last && h.index < last.index + last.length) {
      var end = Math.max(last.index + last.length, h.index + h.length);
      if (end > last.index + last.length) last.length = end - last.index;
      if (LJ.SEVERITY_WEIGHT[h.rule.severity] > LJ.SEVERITY_WEIGHT[last.rule.severity]) last.rule = h.rule;
      return;
    }
    merged.push({ index: h.index, length: h.length, rule: h.rule });
  });

  var out = '';
  var pos = 0;
  merged.forEach(function (h) {
    out += LJ.escapeHtml(text.slice(pos, h.index));
    out += '<mark class="risk-' + h.rule.severity + '" title="' + LJ.escapeHtml(h.rule.title) + '">';
    out += LJ.escapeHtml(text.slice(h.index, h.index + h.length));
    out += '</mark>';
    pos = h.index + h.length;
  });
  out += LJ.escapeHtml(text.slice(pos));
  return out;
};

/* ---------- HTML 转义 ---------- */
LJ.escapeHtml = function (s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
};
