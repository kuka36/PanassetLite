
## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`


## 开发过程提示词

###
User
我希望InvestFlow始终保持简单实用，同时需要能支持多元化资产（包含多国法币、虚拟币、股票、房地产等）。
请基于当前情况分析并给出一些InvestFlow的产品设计方向建议。
使用中文输出建议。
Gemini 3 Pro Preview
Ran for 21s
lightbulb
Thought for 21 seconds
基于您提供的现有代码结构（React + Tailwind + Gemini API + 本地存储）以及“简单实用、支持多元资产”的目标，InvestFlow 目前的基础已经非常扎实。
为了在保持轻量级的同时真正支持全球化和全品类资产，以下是我对 InvestFlow 未来产品设计方向的建议：
1. 核心架构层面：真正的“多元资产”支持
目前的 AssetType 比较基础（股票、加密货币、基金、现金）。要支持房地产和复杂的国际资产，建议进行以下升级：
引入“负债” (Liabilities) 概念：
痛点：如果不记录负债，记录“房地产”就毫无意义（因为大多数人有房贷）。
设计：增加 AssetType.LIABILITY 或独立的负债模块。
价值：从计算“总资产”转变为计算真正的“净资产 (Net Worth = Assets - Liabilities)”。
多币种动态汇率 (Dynamic Currency Normalization)：
痛点：当前您有 baseCurrency，但资产价值计算比较直接。如果用户持有日元计价的日本房产和美元计价的美股，手动换算非常痛苦。
设计：
资产保留“原生货币”属性。
引入一个简单的汇率服务（可以是硬编码的近似值，或每天更新一次的 API）。
Dashboard 统一按用户设定的“本位币”展示，但允许在详情页看原生价格。
非标资产/手动估值资产 (Illiquid Assets)：
痛点：房地产、一级市场股权、名表或艺术品没有每10分钟更新的行情。
设计：将资产分为“自动更新类”（股票/Crypto）和“手动估值类”。对于手动类，不展示“今日涨跌”，而是展示“上次估值日期”，并允许用户记录估值变更历史（例如：每年手动调整一次房产估值）。
2. 交互体验层面：用 AI 简化“记账”
“简单”的核心在于减少输入的摩擦力。目前的添加资产/交易弹窗虽然标准，但对于频繁交易并不高效。
自然语言记账 (NLP Entry)：
利用 Gemini：目前的 Gemini 仅用于分析。建议增加一个简单的文本框。
场景：用户输入 "Bought 10 AAPL at 175 yesterday" 或 “买入 0.5 BTC 价格 60000”。
实现：Gemini 解析意图 -> 自动填充 Transaction Modal -> 用户确认。这比手动选日期、填数字要快得多。
智能图片识别：
允许用户上传券商截图或房产估值单，利用 Gemini Vision API 提取数据自动入库。
3. 可视化与分析层面：超越简单的饼图
您已经有了很好的饼图和 Gemini 分析。下一步可以做更深度的“实用型”可视化：
地理分布视图 (Geo-Diversification)：
由于是多元资产，用户可能想知道自己的钱在哪个国家。
增加“区域/市场”维度，例如：US (60%), CN (20%), Emerging Markets (20%)。
流动性分层 (Liquidity Pyramid)：
将资产按变现难易度分类：
高流动性：现金、股票、Crypto。
中流动性：基金（有赎回期）。
低流动性：房地产、私募股权。
价值：帮助用户评估在紧急情况下的抗风险能力，这比单纯看收益率更有“安全感”。
4. 数据与隐私：轻量化与安全
便携式数据 (Portable Data)：
目前的 JSON 导入/导出很好。
建议：支持 CSV 格式导出，方便用户将数据放入 Excel/Notion 进行二次 DIY 分析。
隐私模式增强：
您已经做了 Privacy Mode，这很棒。
建议：增加一个“演示模式”或“百分比模式”，在截屏分享时，只显示收益率和占比，完全隐藏绝对金额（目前的遮罩是完全隐藏，不仅隐藏金额）。
5. 具体功能的优先级建议 (Roadmap)
如果我要根据您的现有代码继续开发，我会按以下顺序排期：
P0 (高优)：完善多币种逻辑。确保拥有港股（HKD）、美股（USD）和加密货币（USDT/USD）的用户能看到准确的本位币总值。
P1 (中优)：增加“房地产”和“负债”类型。这是区分“炒股软件”和“财富管理软件”的关键。
P2 (中优)：AI 辅助记账。这是提升“爽感”的核心功能。
P3 (低优)：真实行情对接。目前用的模拟数据，未来可以考虑接入免费的 Yahoo Finance API 或 CoinGecko API 替换模拟生成的 refreshPrices 逻辑。
总结：
InvestFlow 的核心差异化应该在于**“全视图 (Holistic View)”**。不要试图在股票图表上打败 TradingView，也不要在 Crypto 追踪上打败 Debank。InvestFlow 的价值在于把用户的房子、现金、比特币和股票放在一张表里，告诉他：“你现在的身价是多少，你的抗风险能力如何”。

###
User
完成下面功能：
完善多币种逻辑。确保拥有港股（HKD）、美股（USD）和加密货币（USDT/USD）的用户能看到准确的本位币总值。
参考：
获取加密货币价格 - 使用 CoinGecko API： https://api.coingecko.com/api/v3/simple/price
股票价格 - 使用 Alpha Vantage 的免费API (VITE_ALPHA_VANTAGE_KEY=R855D2A1KSKT0CUS)
获取汇率 - 使用 ExchangeRate-API: https://api.exchangerate-api.com/v4/latest

