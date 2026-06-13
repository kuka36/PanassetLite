import { Asset, Transaction, Currency } from '../../types/domain';
import { Language, AIProvider, PendingAction } from '../../types/store';
import { ChatMessage } from '../../types/ui';
import { ILlmAdapter, SendMessageResult, ToolContext, ProcessResult } from './types';
import { ToolExecutor } from './executor';
import { GeminiAdapter } from './adapters/geminiAdapter';
import { OpenAIAdapter } from './adapters/openaiAdapter';
import { extractToolCallFromText } from './schemaUtils';

export class AgentService {
  private adapter: ILlmAdapter;
  private executor: ToolExecutor;
  private provider: AIProvider;
  private apiKey: string;

  constructor(apiKey: string, provider: AIProvider = 'gemini') {
    this.apiKey = apiKey;
    this.provider = provider;
    this.executor = new ToolExecutor();

    this.adapter = provider === 'gemini'
      ? new GeminiAdapter()
      : new OpenAIAdapter(provider === 'qwen' ? 'qwen' : 'deepseek');

    if (apiKey) {
      this.adapter.initialize(apiKey);
    }
  }

  async processMessage(
    userMessage: string,
    history: ChatMessage[],
    assets: Asset[],
    transactions: Transaction[],
    baseCurrency: Currency,
    language: Language,
    image?: string
  ): Promise<ProcessResult> {
    if (!this.apiKey) {
      return {
        text: language === 'zh'
          ? `我需要 **${this.getProviderName()} API Key** 才能作为您的 AI 助手工作。\n\n请前往 **设置** 页面进行配置。`
          : `I need a **${this.getProviderName()} API Key** to function as your AI assistant. \n\nPlease go to **Settings** to configure it.`
      };
    }

    try {
      const systemInstruction = this.buildSystemInstruction(baseCurrency, language, assets);
      const result = await this.adapter.sendMessage(
        systemInstruction,
        history,
        userMessage,
        image
      );

      if (result.toolCalls.length > 0) {
        const call = result.toolCalls[0];
        const context: ToolContext = { assets, transactions, language };
        const toolResult = this.executor.executeToolCall(call.name, call.args, context);

        if (toolResult.action) {
          return { text: toolResult.text || "", action: toolResult.action };
        }

        const continued = await this.continueWithToolResult(
          call.name,
          toolResult.response,
          history,
          userMessage,
          image
        );

        if (continued.toolCalls.length > 0) {
          const chainedCall = continued.toolCalls[0];
          const chainedResult = this.executor.executeToolCall(chainedCall.name, chainedCall.args, context);
          if (chainedResult.action) {
            return { text: chainedResult.text || "", action: chainedResult.action };
          }
        }

        return { text: continued.text || result.text };
      }

      if (result.text) {
        const parsed = extractToolCallFromText(result.text);
        if (parsed) {
          const context: ToolContext = { assets, transactions, language };
          const toolResult = this.executor.executeToolCall(parsed.name, parsed.args, context);
          if (toolResult.action) {
            return { text: toolResult.text || "", action: toolResult.action };
          }
          return { text: JSON.stringify(toolResult.response) };
        }
      }

      return { text: result.text };

    } catch (error: any) {
      console.error("Agent Error:", error);
      return {
        text: language === 'zh'
          ? "抱歉，AI 暂时无法处理您的请求。"
          : "Sorry, I encountered an issue processing your request."
      };
    }
  }

  private buildSystemInstruction(baseCurrency: Currency, language: Language, assets: Asset[]): string {
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const currentTime = now.toISOString();

    const langInstruction = language === 'zh'
      ? "You MUST reply in Chinese (Simplified)."
      : "You MUST reply in English.";

    const existingAssetsContext = assets.map(a => `- ${a.symbol} (${a.name})`).join('\n');

    return `
你是 "PanassetLite" 的智能助手。
今天是 ${today}。当前时间是 ${currentTime}。基准货币：${baseCurrency}。

**语言规则：**
${langInstruction}

**现有资产（核心）：**
用户当前持有以下资产。
在分析图片或文本时，如果你识别出的资产与此列表中的某项匹配，**你必须使用该列表中的确切代码 (Symbol)**。
${existingAssetsContext}

**功能能力：**
1. **查询 (READ)**：使用 \`get_portfolio_state\` 查看所有资产。使用 \`get_asset_details\` 调查特定资产及其历史。
2. **变更 (WRITE)**：
   - **新增资产**：使用 \`propose_add_asset\`。
   - **现有资产**：
     - 修改数量/成本 -> 使用 \`propose_transaction\`。
     - 修改名称/类型/价格 -> 使用 \`propose_update_metadata\`。
3. **批量导入**：如果用户提供图片，使用 \`propose_bulk_asset_update\`。

**价格/价值规则：**
1. **区分价格**：
   - **当前价格 (Current Price)**：该资产目前的市场交易价格。
   - **成本价 (Cost/Avg Cost)**：用户买入该资产时的单价。
   - **规则**：在导入新资产或批量更新时，**必须**区分这两者。如果只知道一个，且看起来是买入价，请将其设为成本价。
2. **默认值**：如果未知，价格默认为 1，价值请进行估算。
3. **数量规则**：
   - **默认值**：如果未指定，默认为 1。
   - **基金**：如果只知道总市值，则数量 (Qty) = 总市值，价格 (Price) = 1。
6. **货币**：根据上下文推断。
   - **美股 (例如 AAPL, TSLA)** -> USD
   - **A股 (例如 600519)** -> CNY
   - **港股 (例如 0700)** -> HKD
   - **加密货币** -> 通常为 USD
   - **其他** -> 默认为 ${baseCurrency}

**工具使用规则：**
- **唯一事实来源**：修改资产数量的唯一途径是通过交易 (TRANSACTION)。
- **新增**：\`propose_add_asset\` 会创建资产并生成初始交易记录。
- **更新**：
  - 如果用户说"我又买了 5 个"，使用 \`propose_transaction(ADD, type=BUY...)\`。
  - 如果用户说"把价格更新到 100"，使用 \`propose_update_metadata\`。
  - 如果用户说"我实际上有 10 个，不是 5 个"（纠错），使用 \`propose_transaction(ADD, type=BALANCE_ADJUSTMENT...)\`。

**核心推断规则（不要提问）：**
- **日期**：如果用户未指定日期，**直接假定为今天 (${today})**。不要提问。
- **货币**：根据资产代码或类型进行**推断**。除非极度模糊，否则不要提问。
- **价格**：如果用户未指定价格，将其设为 0 或进行估算。不要提问。
- **总体**：**尽量减少追问。** 只有在绝对无法继续时（例如缺少代码）才提问。

**工具调用规则（严格）：**
- **你不是 Python 解释器。**
- **严禁**编写 Python 代码。
- **严禁**使用 \`print()\`, \`console.log()\`。
- **严禁**使用 \`default_api\` 或任何其他代码包装器。
- **严禁**将函数调用包装在代码块中（例如 \`\`\`python ... \`\`\`）。
- 仅输出**原生函数调用**（JSON 或内部结构）。
- 确保参数完全符合 JSON 架构 (Schema)。
`;
  }

  private async continueWithToolResult(
    toolName: string,
    toolResponse: any,
    history: ChatMessage[],
    userMessage: string,
    image?: string
  ): Promise<SendMessageResult> {
    if (this.adapter instanceof GeminiAdapter) {
      return await (this.adapter as GeminiAdapter).continueWithToolResult(toolName, toolResponse);
    }

    if (this.adapter instanceof OpenAIAdapter) {
      const messages: { role: string; content: any }[] = [
        { role: "system", content: "" },
        ...history.filter(m => m.role !== 'system').slice(-10).map(m => ({
          role: m.role === 'model' ? 'assistant' : m.role,
          content: m.content
        }))
      ];

      if (image && this.provider === 'qwen') {
        messages.push({
          role: "user",
          content: [
            { type: "image_url", image_url: { url: image } },
            { type: "text", text: userMessage }
          ]
        });
      } else {
        messages.push({ role: "user", content: userMessage });
      }

      return await (this.adapter as OpenAIAdapter).continueWithToolResult(
        toolName,
        toolResponse,
        messages
      );
    }

    return { text: "", toolCalls: [] };
  }

  private getProviderName(): string {
    switch (this.provider) {
      case 'gemini': return 'Gemini';
      case 'qwen': return 'Qwen';
      case 'deepseek': return 'DeepSeek';
      default: return 'AI';
    }
  }
}
