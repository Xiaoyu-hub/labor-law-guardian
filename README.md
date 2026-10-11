# 劳动法治护航 · 劳动者权益守护平台

劳动法治教育课程大作业演示系统：把《劳动合同法》《劳动法》《社会保险法》等法律条文，
变成「会看条款、会算权益、会走维权」的可交互平台。

**双模式架构**：纯静态前端（零依赖，`file://` 直开即可演示）+ 可选 Flask/SQLite 后端
（解锁账号、历史记录、排行榜、每日打卡、问答板等在线功能）。

## 快速开始

```bash
# 方式一：纯前端演示（最简单）——双击 index.html
# 方式二：本地静态服务器
python -m http.server 8000 --directory .
# 访问 http://localhost:8000
```

```bash
# 方式三：完整功能（推荐，含后端）
python -m server.server
# 访问 http://127.0.0.1:5000
# 前端自动检测到后端后解锁：注册登录 / 体检与计算历史 / 闯关排行榜 / 每日打卡 / 问答板
```

## 功能模块

| 模块 | 说明 |
|---|---|
| 📋 合同体检 | 粘贴劳动合同全文 → 43 条规则扫描 → 风险分级评分 + 原文高亮 + 法条依据 + 整改建议（登录后自动存档，可重放/删除） |
| 🧮 权益计算 | 加班费（150/200/300%）、经济补偿 N、违法解除 2N、未签合同双倍工资、未休年假折现、试用期上限校验（登录后自动存档，可重放/删除） |
| 🛡 维权导航 | 6 类纠纷 × 五步时间线（协商→调解→仲裁→诉讼→执行），含法定时限、材料清单、举证责任、避坑提醒 |
| 🎯 情景闯关 | 12 道防坑题，作答即判分 + 法条解析 + 成绩等级（登录后提交成绩并计入 TOP10 排行榜） |
| 📖 法条速查 | 6 部法律法规 48 条核心条文，关键词检索 |
| 👤 我的 | 注册/登录、学习统计（连续打卡/闯关最佳/历史条数）、每日学法打卡、体检/计算历史、闯关排行榜 |
| 💬 问答 | 学习问答板：发帖提问、同学互答（浏览无需登录，发帖/回复需登录） |

## 在线功能（后端 API）

运行 `python -m server.server` 后，前端 `assets/js/api.js` 探测 `/api/health` 自动切换模式：
页面右上角徽章显示「● 本地引擎模式」（纯前端）或「● 未登录 / ● 用户名」（后端在线）。

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
│   ├── css/style.css             设计系统（深色法庭风，纯 CSS 无图片）
│   ├── favicon.svg
│   └── js/
│       ├── data-law.js           法条库（48 条，含标签索引）
│       ├── engine-check.js       合同体检引擎（规则 + verify 二次判定 + 评分 + 高亮）
│       ├── engine-calc.js        权益计算引擎（21.75 折算 / N / 2N / 双倍工资 / 年假）
│       ├── engine-quiz.js        情景闯关题库（12 题含解析）
│       ├── roadmap-data.js       维权路径数据（6 类纠纷 × 五步时间线）
│       ├── sample-contract.js    示例问题合同（内置 20+ 违法点）
│       ├── api.js                后端连接层（优雅降级探测 + 全部 API 封装）
│       └── app.js                路由 / SVG 图表 / 交互层
├── server/                       Flask 后端
│   ├── server.py                 入口（app 工厂 + 蓝图注册）
│   ├── db.py                     SQLite（data/labs.db，7 表）
│   ├── auth.py                   会话 + PBKDF2 口令散列 + 登录保护
│   ├── history.py                体检/计算历史 API
│   ├── quiz.py                   闯关成绩 + 排行榜 + 我的成绩
│   ├── checkin.py                每日打卡 + 连续天数
│   └── qa.py                     问答板（发帖 / 回复）
├── data/labs.db                  SQLite 数据库（运行时生成）
├── docs/                         设计文档 / 演示脚本 / 测试报告
├── tests/                        后端单测 + Playwright e2e（见下）
└── shots/                        测试截图证据
```

## 测试

```bash
# 后端单测（23 个：auth 4 / health 2 / history 6 / quiz 4 / checkin 4 / qa 3）
python -m unittest discover -s tests -p "test_api*.py"

# 前端 e2e（需 Python + playwright + 系统 Edge；先起后端再跑 http 用例）
python tests/e2e_check.py     # file:// 全流程：体检/计算/导航/闯关/法条，0 console error
python tests/probe_layout.py  # 布局溢出 + 数据一致性
python tests/probe_quiz.py    # 闯关判分探针
python tests/e2e_m7.py        # 注册/登录/登出/档案 + 离线降级
python tests/e2e_m8.py        # 自动保存/统计/打卡/排行榜/删除/重放
python tests/e2e_m9.py        # 问答板发帖/回复/匿名浏览
```

## 设计说明

- **双模式优雅降级**：`api.js` 探测 `/api/health`；`file://` 下不发起探测请求，直接进入本地引擎模式，五大模块照常演示，控制台零报错
- **每条结论有依据**：风险提示、计算结果、时限均标注「法名 + 条号」，可在法条速查中对照原文
- **可解释的规则引擎**：43 条正则规则 + verify 二次判定；评分 100 分制（高危 -22 / 中危 -10 / 低危 -4）；原文区间高亮并做重叠去重
- **后端安全底线**：口令 PBKDF2-SHA256 20 万次迭代加盐存储；历史记录按属主校验，跨用户不可读/删；打卡按自然日幂等；问答只追加不删除
- **隐私**：纯前端模式下输入仅存在于浏览器内存；启用后端后数据存本机 SQLite（`data/labs.db`），仍是纯本地部署

## 免责声明

本工具依据现行有效法律整理，供学习与自查参考；具体争议以劳动行政部门、仲裁机构、
人民法院的认定为准。如发现条文与最新生效版本不符，请以官方文本为准并反馈修正。