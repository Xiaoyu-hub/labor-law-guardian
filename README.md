# 劳动法治护航 · 劳动者权益守护平台

劳动法治教育课程大作业演示系统：把《劳动合同法》《劳动法》《社会保险法》《工伤保险条例》等
现行法律条文，变成「会看条款、会算权益、会走维权」的可交互平台，适合高校学生与新就业劳动者。

**双模式架构**：纯静态前端（零依赖，双击 `index.html` 即可演示）+ 可选 Flask/SQLite 后端
（解锁账号、历史记录、排行榜、每日打卡、问答板等在线功能）。主演示流程**全程断网可用**。

## 功能模块

| 模块 | 说明 |
|---|---|
| 合同体检 | 粘贴劳动合同全文 → **47 条规则**扫描（含 verify 二次判定）→ 风险分级评分 + 原文按严重度高亮 + 法条依据 + 整改建议；支持「导出打印版报告」（含依据法条全文） |
| 权益计算 | **8 类计算**：加班费（150/200/300%）、经济补偿 N、违法解除 2N、未签合同双倍工资、未休年假折现、试用期上限校验、工伤停工留薪期工资、生育津贴，逐步展示公式可手算核验 |
| 维权导航 | **6 类纠纷各自专属维权路线**（欠薪 6 步含监察投诉/支付令/刑事追责、工伤 5 步行政认定前置、违法解除「继续履行 vs 2N」择一、社保行政补缴主线等），每步带通道标签、时限、材料清单、举证责任 |
| 情景闯关 | **14 道**防坑题（含新就业形态冷门考点），作答即判分 + 法条解析 + 成绩等级，登录后计入 TOP10 排行榜 |
| 法条速查 | **9 部法律法规 53 条**核心条文（法名/条号/标题/正文/标签五维检索），体检与计算结论可一键对照原文 |
| 我的 | 注册/登录、学习统计（连续打卡/闯关最佳/历史条数）、每日学法打卡、体检/计算历史（重放/删除）、闯关排行榜 |
| 问答板 | 学习问答：发帖提问、同学互答；浏览无需登录，发帖/回复需登录 |

## 快速开始

```bash
# 方式一：纯前端演示（最简单）——双击 index.html（file:// 直开，零安装零依赖）
# 方式二：本地静态服务器
python -m http.server 8000 --directory .
# 访问 http://localhost:8000
```

```bash
# 方式三：完整功能（推荐，含后端与学习闭环）
python -m server.server
# 访问 http://127.0.0.1:5000
# 前端自动探测后解锁：注册登录 / 体检与计算历史 / 闯关排行榜 / 每日打卡 / 问答板
```

## 核心特性

- **双模式优雅降级**：`api.js` 探测 `GET /api/health`；`file://` 下不发起探测请求，直接进入本地引擎模式，五大模块照常演示，控制台零报错
- **每条结论有依据**：风险提示、计算结果、维权时限均标注「法名 + 条号」，法条速查可对照原文全文；打印版报告把依据法条原文直接附在报告里
- **内容差异化**：6 类纠纷维权路线按真实行政/司法流程单独设计（劳动监察、支付令、工伤行政认定前置、社保行政补缴），不是一套流程换皮
- **可解释的规则引擎**：47 条正则规则 + verify 二次判定；100 分制评分（高危 -22 / 中危 -10 / 低危 -4）；原文区间高亮并做重叠去重
- **界面**：极简深色设计（`#0b0f14` + 金色强调），无第三方 UI 库、无 emoji 依赖、无外部请求
- **后端安全底线**：口令 PBKDF2-SHA256 20 万次迭代加盐存储；历史记录按属主校验，跨用户不可读/删；打卡按自然日幂等；问答只追加不删除
- **隐私**：纯前端模式下输入仅存于浏览器内存；启用后端后数据存本机 SQLite（`data/labs.db`），仍是纯本地部署

## 在线功能（后端 API）

运行 `python -m server.server` 后，页面右上角徽章显示「● 本地引擎模式」（纯前端）或「● 未登录 / ● 用户名」（后端在线）。

| 模块 | 接口 | 说明 |
|---|---|---|
| 健康检查 | `GET /api/health` | 模式探测 |
| 认证 | `POST /api/auth/register` / `login` / `logout`，`GET /api/auth/me` | session + PBKDF2-SHA256（20 万次迭代） |
| 体检历史 | `POST/GET /api/history/check`，`GET/DELETE /api/history/check/<id>` | 记录归属用户，跨用户不可读/删 |
| 计算历史 | `POST/GET /api/history/calc`，`GET/DELETE /api/history/calc/<id>` | 同上 |
| 闯关 | `POST /api/quiz/score`，`GET /api/quiz/leaderboard`（Top10），`GET /api/quiz/mine` | 每次作答记一条，排行取最佳 |
| 打卡 | `POST /api/checkin`（每日一次，幂等），`GET /api/checkin?days=150` | 连续天数从今天（或昨天）往前数 |
| 问答板 | `GET /api/qa`（含回复），`POST /api/qa`，`POST /api/qa/<id>/reply` | 只追加不删除，帖子限 50 条 |

## 目录结构

```
劳动法治教育/
├── index.html                    单页应用入口（双击即用，file:// 自动降级）
├── assets/
│   ├── css/style.css             设计系统（极简深色 + 金色强调，无图片无渐变）
│   ├── favicon.svg
│   └── js/
│       ├── data-law.js           法条库（9 部法律 53 条，五维检索）
│       ├── engine-check.js       合同体检引擎（47 规则 + verify + 评分 + 高亮）
│       ├── engine-calc.js        权益计算引擎（21.75 折算 / N / 2N / 双倍工资 / 年假 / 停工留薪 / 生育津贴）
│       ├── engine-quiz.js        情景闯关题库（14 题含解析）
│       ├── roadmap-data.js       维权路径数据（6 类纠纷专属路线，带通道标签）
│       ├── sample-contract.js    示例问题合同（内置 20+ 违法点）
│       ├── api.js                后端连接层（优雅降级探测 + 全部 API 封装）
│       └── app.js                路由 / SVG 图表 / 交互 / 打印版报告导出
├── server/                       Flask 后端（SQLite，7 表）
│   ├── server.py                 入口（app 工厂 + 蓝图注册）
│   ├── db.py                     SQLite（data/labs.db）
│   ├── auth.py                   会话 + PBKDF2 口令散列 + 登录保护
│   ├── history.py                体检/计算历史 API
│   ├── quiz.py                   闯关成绩 + 排行榜 + 我的成绩
│   ├── checkin.py                每日打卡 + 连续天数
│   └── qa.py                     问答板（发帖 / 回复）
├── data/labs.db                  SQLite 数据库（运行时生成，不入库）
├── docs/                         设计文档 / 演示脚本 / 测试报告 / 答辩PPT素材
├── tests/                        后端单测 + Playwright e2e（见下）
└── shots/                        测试截图证据（含演示用图）
```

## 测试

```bash
# 后端单测（23 个：auth 4 / health 2 / history 6 / quiz 4 / checkin 4 / qa 3）
python -m unittest discover -s tests -p "test_*.py"

# 前端 e2e（需 Python + playwright + 系统 Edge；http 用例需先起后端）
python tests/e2e_check.py     # file:// 全流程走查：体检/计算/导航/闯关/法条，0 console error
python tests/probe_layout.py  # 布局溢出 + 数据一致性
python tests/probe_quiz.py    # 闯关判分探针
python tests/e2e_roadmap.py   # 6 类维权路线差异度断言
python tests/probe_s4.py      # S4 内容断言（新规则命中 + 新计算金额 + 总量契约）+ 截图证据
python tests/probe_s5.py      # file:// 双模式全内容验证 + 打印版报告导出
python tests/probe_ui.py      # UI 设计令牌 + 全站 0 emoji + 计算金额契约
python tests/e2e_m7.py        # 注册/登录/登出/档案 + 离线降级
python tests/e2e_m8.py        # 自动保存/统计/打卡/排行榜/删除/重放
python tests/e2e_m9.py        # 问答板发帖/回复/匿名浏览

# 注：e2e_check / e2e_m8 的闯关循环读取 LJ.QUIZ.length，题库增题无需改测试
```

最新回归：**23 后端单测 + 10 个前端脚本全绿**，console/page errors 均为 0（详见 `docs/测试报告.md`）。

## 截图证据

演示与测试截图见 `shots/`（首页、体检结果+高亮、计算结果、维权时间线、闯关、法条速查、
档案页、打印版报告导出等），答辩 PPT 素材引用与建议配图见 `docs/答辩PPT素材.md`。

## 部署

前端为纯静态单页，可零修改发布到 GitHub Pages / 任意静态托管：

```bash
git init && git add -A && git commit -m "labor-law-guardian"
# 推送后到仓库 Settings → Pages → 选择 main 分支根目录发布
```

后端为本地可选增强（`python -m server.server`），无需部署即可完成全部演示。

## 免责声明

本工具依据现行有效法律整理，供学习与自查参考；具体争议以劳动行政部门、仲裁机构、
人民法院的认定为准。如发现条文与最新生效版本不符，请以官方文本为准并反馈修正。
