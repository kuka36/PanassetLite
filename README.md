# PanassetLite

轻量但够用的个人资产管理小工具。不用注册、隐私至上 —— 所有数据只存在你的浏览器里。

把散落在不同 App 里的银行存款、支付宝理财、股票、基金、加密货币、房产、房贷等资产聚到一个地方,一眼看清:

- 我现在总共有多少钱?
- 资产都分布在哪些地方?
- 哪些赚钱了、收益率是不是太低?哪些在亏?
- 最近一个月我的财富到底涨了还是跌了?

## 功能

- **统一记账**:8 类资产(现金存款 / 理财 / 股票 / 基金 / 加密货币 / 房产 / 负债 / 其他),多币种自动折算 CNY
- **事件溯源**:持仓、市值、盈亏、收益率、净值历史全部由交易事件流重放计算(`PortfolioEngine`),不存派生状态
- **手动估值也能算收益率**:支付宝理财、银行产品每月更新一次总值,自动算出区间年化,判断"还值不值得买"
- **自动行情**:加密货币(CoinGecko,免 key)、汇率(Frankfurter,免 key)、美股(Finnhub,免费 key)
- **强大图表**:净资产趋势、资产分布、持仓占比(ECharts)
- **AI 智能顾问**:内置本地规则引擎做风险评估、健康评分、配置建议(零配置可用);可选接入 DeepSeek 或任意 OpenAI 兼容 LLM 做深度分析
- **数据自主**:一键导出 / 导入 JSON 备份,一键清空

## 快速开始

```bash
npm install
npm run dev
```

打开后到「设置 → 加载演示数据」可立即体验全部功能。

## 构建部署

**自动发布**（推荐）：PR 合并到 `main` 前打上 `release` 标签，由 owner merge 后会自动创建日期版本标签（如 `v2026.06.15.1`）并部署 GitHub Pages。

**手动发布**（回滚或重发）：

```bash
npm run build
git tag v2026.06.15.1
git push origin v2026.06.15.1
```

## 架构原则

- **Event Sourcing**:所有财务状态由 `src/engine/portfolio.ts` 从交易历史计算
- **Local-First**:数据通过 `src/services/storage.ts` 存于 LocalStorage
- **Privacy-Focused**:无注册;除非你主动配置并触发 API 调用,数据绝不离开浏览器
- **Progressive Enhancement**:不配任何 key 也完整可用,配置 key 后体验更好

## 技术栈

Vite · React 19 · TypeScript · Tailwind CSS 4 · ECharts · Zustand
