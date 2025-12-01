# PanassetLite 项目审查报告（2026-04-23）

## 1. 项目总体判断

### 当前状态
- 能运行、能构建、类型检查通过。
- 已经不是 demo 骨架，而是一个有完整产品雏形的单机资产管理应用。
- 核心路线清楚：Local-First + 资产账本 + 行情刷新 + AI 助手。

### 当前阶段判断
项目目前处于：
- 产品可演示
- 个人可用
- 继续堆功能前，应该先做架构收敛

### 主要技术债
- 命名遗留（`investflow_*`）
- 文档与实现漂移
- AI 逻辑过重
- 市场数据层职责过多
- 大组件持续膨胀
- 性能优化还没开始系统做

---

## 2. 入口与应用壳层

### `index.tsx`
**作用**
- React 应用入口，挂载 `App`

**优点**
- 干净
- 没有多余逻辑
- 严格模式已开启

**问题**
- 没明显问题

**结论**
- 健康

### `App.tsx`
**作用**
- 应用总路由与全局 Provider 装配

**优点**
- `PortfolioProvider` 统一包裹
- 路由结构清晰
- `Toast` 做成全局挂载，合理

**问题**
- 当前所有主页面都同步加载，没有懒加载
- `DashboardView / AssetsView / Analytics / Settings` 都会进入主 bundle

**建议**
- 后续用 `React.lazy` + `Suspense` 拆页面级 chunk

**结论**
- 结构清楚，但有性能优化空间

### `vite.config.ts`
**作用**
- 构建、环境变量、chunk 拆分、GitHub Pages base 路径

**优点**
- 已正确配置 `base: '/PanassetLite/'` 适配 GitHub Pages
- 有基础 chunk 策略
- 生产构建会去掉 `console/debugger`

**问题**
1. 环境变量注入方式不够 Vite 化，仍在走 `process.env.*`
2. Key 直接注入前端，本质仍暴露给浏览器端
3. chunk 策略不够，build 已经出现大包告警

**结论**
- 可用，但偏“能跑就行”型配置

---

## 3. 布局与页面容器

### `components/Layout.tsx`
**作用**
- 侧边栏、移动端导航、全局聊天面板入口

**优点**
- 桌面 / 移动布局都考虑了
- 侧边栏折叠状态持久化
- AI 助手入口集成自然

**问题**
1. 直接操作 localStorage，和 `StorageService` 风格不统一
2. 命名遗留明显，仍使用 `investflow_sidebar_collapsed`
3. 布局职责偏多
4. AI 是否启用的判断不完整，未覆盖 qwen

**结论**
- 中等健康，建议后续拆 Sidebar / MobileHeader / FooterInfo

---

## 4. 状态管理与领域核心

### `context/PortfolioContext.tsx`
**作用**
- 全局资产、交易、设置、刷新、导入导出等统一状态入口

**优点**
- 是项目主干，设计方向正确
- reducer + provider 比单纯 useState 更稳
- 派生资产与原始元数据区分明确
- 持久化、迁移、市场数据刷新都挂在这里

**问题**
1. 职责太重：初始化、持久化、迁移、刷新、action helper、i18n 都在这里
2. 副作用较多，后续维护成本会上升
3. 导入逻辑不统一，批量 transaction 导入是逐条 dispatch
4. 设置初始化混入 envKey，配置来源边界不够清晰

**结论**
- 主架构正确，但已经接近“上帝 Context”

### `context/portfolioReducer.ts`
**作用**
- 全局状态 reducer

**优点**
- 逻辑直白
- action 分类清晰
- 可读性不错

**问题**
1. 领域约束偏弱
2. 部分业务规则散落在调用方，而非 reducer 或 domain service

**结论**
- 健康，但偏薄

### `services/PortfolioEngine.ts`
**作用**
- 交易重放、持仓计算、PnL 计算

**优点**
- 项目里最强的一块之一
- Event Sourcing 思路明确
- 交易排序 -> 重放 -> 派生资产 的主链路成立
- `BUY/SELL/DIVIDEND/BALANCE_ADJUSTMENT` 分发清楚

**问题**
1. `tx.total` 语义依赖过重，需要文档化
2. 负债模型较简化
3. `BALANCE_ADJUSTMENT` 属于产品妥协模型，需小心污染成本逻辑

**结论**
- 核心亮点模块，值得保留并继续强化

### `context/usePortfolioCalculations.ts`
**作用**
- 对 `PortfolioEngine` 的 memo 化封装

**结论**
- 健康

---

## 5. 存储与迁移

### `services/StorageService.ts`
**作用**
- 本地数据读写、缓存、清理、legacy 清理

**优点**
- localStorage key 集中定义
- core data / cache / legacy / panasset key 分类清楚
- 支持 prefix 清理

**问题**
1. 命名债明显：大量 `investflow_*`
2. 单文件职责偏多
3. settings / API key / 聊天记录都在 localStorage，安全性有限
4. `clearAllData` 保留 settings，产品上合理，但语义上可能让用户误解

**结论**
- 实用，但明显是演化出来的，不够整洁

### `services/MigrationService.ts`
**作用**
- 旧数据结构迁移到 event-sourcing 模型

**优点**
- 有迁移意识
- 无交易记录时自动补初始交易，这个处理合理

**问题**
1. 没有正式版本号 migration 体系
2. 日志治理一般
3. 旧数据解析使用 `any[]`

**结论**
- 够用，但不是长期演进型迁移框架

### `services/SequenceService.ts`
**作用**
- 生成 ID

**优点**
- 直接使用 UUID，简单有效

**问题**
- 模块过薄，可留可并

**结论**
- 可留可并

---

## 6. 市场数据层

### `services/marketData.ts`
**作用**
- 汇率、加密价格、股票价格、历史价格、缓存、失败缓存、货币转换

**优点**
- 功能完整度高
- 有缓存 TTL、失败缓存、限流意识
- 支持多 provider

**问题**
1. 文件过重，是典型超载模块
2. 模块边界混乱，`convertValue` 这种纯函数不该耦合在抓数服务中
3. 调试日志偏多
4. provider 分支逻辑继续增长会失控

**建议拆分**
- `marketData/fx.ts`
- `marketData/crypto.ts`
- `marketData/stocks.ts`
- `marketData/history.ts`
- `marketData/cache.ts`
- `marketData/convert.ts`

**结论**
- 高价值模块，但已明显需要拆

### `hooks/useMarketData.ts`
**作用**
- 行情刷新 orchestration

**优点**
- UI 层和 service 层有初步隔离
- 有 debounce 批量刷新意识
- 用 `settingsRef` 避免闭包旧值问题

**问题**
1. hook 内业务逻辑仍偏重
2. `dispatch` 更新逻辑复杂，继续扩会难维护

**结论**
- 可用，但后续要和 marketData 一起收敛

---

## 7. AI 能力层

### `services/aiEngine.ts`
**作用**
- Gemini / DeepSeek / Qwen 统一抽象

**优点**
- Strategy Pattern 思路是对的
- `generateText / generateJSON` 接口统一合理
- 错误类型有基本分层

**问题**
1. 抽象表面统一，底层行为差异很大
2. Qwen JSON 解析方式脆弱
3. 模型名硬编码，不利于未来切换

**结论**
- 方向对，但鲁棒性一般

### `services/geminiService.ts`
**作用**
- AI 分析、风险评估、语音命令解析

**优点**
- 有 cache
- prompt 的业务目标明确
- 有隐私规则意识

**问题**
1. 文件名已不准确，不只服务 Gemini
2. prompt-heavy，较脆
3. 风险逻辑、分析逻辑、语音解析混在一起

**结论**
- 能用，但不是可长期扩展的服务边界

### `services/agentService.ts`
**作用**
- 聊天助手主逻辑：对话、工具调用、图片资产识别、动作提案

**优点**
- 功能很强
- 已实现“AI 提案 -> 用户确认执行”的闭环
- 工具 schema 明确，产品方向成熟

**问题**
1. 这是全项目最危险的复杂点之一
2. 可维护性风险高
3. 强依赖模型服从性
4. 工具定义、会话编排、provider adapter 没有拆开

**建议拆分**
- `agent/tools.ts`
- `agent/systemPrompt.ts`
- `agent/providers/geminiAgent.ts`
- `agent/providers/openaiCompatibleAgent.ts`
- `agent/actionMapper.ts`

**结论**
- 高价值、高风险、优先重构对象

### `hooks/useChat.ts`
**作用**
- 聊天状态、图片输入、消息记录、确认动作执行

**优点**
- 用户交互闭环完整
- 历史记录持久化
- 图片压缩和消息发送流程顺畅

**问题**
1. `handleConfirmAction` 过重
2. 隐式业务规则太多
3. 错误处理较粗，仍用 `alert`
4. 聊天历史与初始化 welcome message 有耦合

**结论**
- 能跑，但应该把 action execution 抽成 service

### `components/AIChatAssistant.tsx`
**作用**
- AI 聊天 UI 外壳

**优点**
- 支持拖拽宽度、最大化、移动端适配
- UI 壳层职责较清楚

**问题**
- `isSidebarCollapsed` 似乎是遗留参数，未实际使用

**结论**
- 较健康

### `components/GeminiAdvisor.tsx`
**作用**
- 仪表盘上的 AI 分析卡片

**优点**
- 入口清晰
- 状态区分明确

**问题**
1. 命名过时
2. provider key 判断不完整，未和 qwen 对齐

**结论**
- 小问题，命名该修

---

## 8. 业务页面

### `components/Dashboard.tsx`
**作用**
- 首页仪表盘指标与图表

**优点**
- 信息密度不错
- 隐私模式适配已做
- 视觉层次清晰

**问题**
1. 有未使用 import，代码卫生一般
2. 依赖上游 summary，而 summary 里存在 dayPnL 假数据问题

**结论**
- UI 不差，但依赖上游统计可信度

### `hooks/usePortfolioSummary.ts`
**作用**
- 汇总净值、资产、负债、总收益、日收益、配置数据

**优点**
- 结构清晰
- 基准货币换算处理合理

**严重问题**
- `dayPnL` 使用了 `Math.random()`，属于正式业务展示中的假数据

**影响**
- 首页日盈亏不可信
- 会误导用户以为系统具备真实日收益能力

**结论**
- 必须优先修。没真实日级数据之前，宁可隐藏，也不要随机生成。

### `components/DashboardView.tsx`
**结论**
- 健康

### `components/AssetsView.tsx`
**作用**
- 资产管理主页面

**优点**
- 搜索、标签筛选、刷新、趋势图、加资产、记交易流程完整

**问题**
1. 桌面端 / 移动端 Tag Filter 重复代码较多
2. 页面状态较多
3. i18n 不完全一致，存在 fallback 英文文案

**结论**
- 功能完整，但组件已开始肿胀

### `components/TransactionHistory.tsx`
**作用**
- 交易历史页

**优点**
- 过滤器完整
- 移动端 / 桌面端都做了
- deleted asset 做了 graceful fallback

**问题**
1. 移动端和桌面端渲染重复逻辑明显
2. 格式化逻辑散在组件里
3. `editingTransaction` 仍是 `any`

**结论**
- 能用，但重复度偏高

### `components/Analytics.tsx`
**作用**
- 分析页，资产结构、风险、币种分布、表现等

**优点**
- 维度完整
- 比 Dashboard 更接近正式分析页
- 风险模型采用规则 + AI 混合路线

**问题**
1. 页面内 `useMemo` 聚合偏多
2. 无 key 时回退体验一般
3. 格式化逻辑存在局部重复

**结论**
- 功能可以，但值得抽出 analytics selectors

### `components/Settings.tsx`
**作用**
- 设置、导入导出、隐私模式、API 配置、重置等

**优点**
- 功能完整
- 导入导出比较实用
- API key 显示/隐藏有基本处理

**问题**
1. 文件过大，已超出舒适维护范围
2. CSV 解析手写，边界风险高
3. 导入逻辑复杂
4. 强 UI + 强业务逻辑混杂

**建议拆分**
- `settings/PrivacySection`
- `settings/DataImportExportSection`
- `settings/APIKeysSection`
- `settings/importExportService.ts`

**结论**
- 优先拆分对象

---

## 9. 类型层

### `types/domain.ts`
**优点**
- 主体清晰
- `AssetMetadata / Transaction / Asset` 分层合理

**问题**
1. 货币枚举较窄
2. `Transaction.total` 语义需要正式文档化

**结论**
- 基础良好，但需要补语义说明

### `types/store.ts`
**优点**
- `PendingAction` 设计方向正确

**问题**
1. `PendingAction.data` 太松
2. `currency?: Currency | string` 后续会侵蚀类型安全
3. action payload 没细化成更严格的 discriminated union

**结论**
- 够用，但后期会限制类型安全

### `types/ui.ts`
**结论**
- 健康

---

## 10. 其他辅助模块

### `services/toastService.ts`
**结论**
- 标准小型 event bus，简单有效，健康

### `utils/assetUtils.ts`
**结论**
- 很薄但有意义，健康

### `utils/i18n.ts`
**结论**
- 当前阶段合理，但属于静态字典级国际化

---

## 11. 文档与工程卫生

### `README.md`
**问题**
- 文案有错字
- 技术栈和实现不完全一致
- provider 说明有过时内容
- 文档可信度需要修复

**结论**
- 需要重写或至少校正

### Git 状态
**现状**
- 本地领先远端 14 个提交
- 有未跟踪 `AGENTS.md`

**风险**
- 后续开发前，建议先确认哪些提交是稳定状态，避免历史债和新改动混在一起

---

## 12. 优先级排序

> 状态标注更新于 2026-05-28。✅ = 已完成，⬜ = 未完成。

### P0：立刻处理
1. ✅ 移除/修正 `usePortfolioSummary.ts` 里的 `Math.random()` dayPnL
2. ✅ 校正文档与实现不一致
3. ✅ 统一 AI provider 命名与启用判断（含 qwen）

### P1：第一轮重构
1. ✅ 拆 `services/agentService.ts`（已拆到 `services/agent/`，原文件保留为 re-export shim）
2. ✅ 拆 `components/Settings.tsx`（已拆到 `components/settings/`）
3. ✅ 拆 `services/marketData.ts`（已拆到 `services/marketData/`：`constants / types / cache / convert / fx / crypto / stocks / history / index`）

### P2：第二轮优化
1. ✅ 页面级懒加载（App.tsx 用 `React.lazy` + `Suspense` 拆出 5 个页面 chunk）
2. ✅ 图表与 AI 面板懒加载（`NetWorthChart` / `TrendModal` / `AIChatAssistant` 全部 lazy）
3. ✅ 清理未使用 import / 重复逻辑（Dashboard 的 `AreaChart/Area/XAxis/YAxis/CartesianGrid/convertValue/AssetType/useMemo`、`AIChatAssistant` 的 `isSidebarCollapsed` prop 移除）
4. ✅ 统一 localStorage key 命名策略（`TagManagementModal` / `useChat` / `Layout` 的 raw `localStorage` 调用全部收敛到 `StorageService`，新增 `getSidebarCollapsed / getMyTags / getRecentTags / getChatHistory` 等 API）

### P3：产品可靠性提升
1. ✅ 重新定义 `transaction total/cashflow` 语义（`types/domain.ts` 的 `Transaction` 补正式 JSDoc 约定：`quantityChange` 带符号、`total` 始终非负、方向由 `type` 决定；新增 [utils/transactionUtils.ts](utils/transactionUtils.ts) 提供 `cashFlowDirection` 与 `getCashFlow` 派生 helper）
2. ✅ 引入正式 migration version（`StorageService` 加 `panasset_schema_version` key + `getSchemaVersion / saveSchemaVersion`；`MigrationService` 重构为版本化 step 数组，导出 `CURRENT_SCHEMA_VERSION`，硬失败时不递增版本以便下次启动重试）
3. ✅ 给 AI action 执行层做更清晰的类型约束（`PendingAction.data` 从匿名 inline 对象抽成命名的 `PendingActionData`；`type` 字段精确为 `AssetType | TransactionType`；`currency` 收窄成 `Currency`，`BulkAssetItem.currency` 同步收窄）

---

## 13. 最终评价

一句话概括：

**这个项目的骨架比表面看起来更好，尤其账本计算主线是成立的；但外围模块已经开始“野生成长”，再不收一轮，后面加功能会越来越痛。**
