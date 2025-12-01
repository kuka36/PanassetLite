import { ILlmAdapter, SendMessageResult } from '../types';
import { ChatMessage } from '../../../types/ui';
import { ALL_TOOLS } from '../tools';

function convertSchemaTypes(schema: any): any {
  if (!schema || typeof schema !== 'object') return schema;

  const newSchema = { ...schema };
  if (newSchema.type && typeof newSchema.type === 'string') {
    newSchema.type = newSchema.type.toLowerCase();
  }

  if (newSchema.properties) {
    const newProps: any = {};
    for (const key in newSchema.properties) {
      newProps[key] = convertSchemaTypes(newSchema.properties[key]);
    }
    newSchema.properties = newProps;
  }

  if (newSchema.items) {
    newSchema.items = convertSchemaTypes(newSchema.items);
  }

  return newSchema;
}

export class OpenAIAdapter implements ILlmAdapter {
  private apiKey: string = '';
  private provider: 'qwen' | 'deepseek';
  private baseUrl: string;

  constructor(provider: 'qwen' | 'deepseek') {
    this.provider = provider;
    this.baseUrl = provider === 'qwen'
      ? 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions'
      : 'https://api.deepseek.com/chat/completions';
  }

  initialize(apiKey: string): void {
    this.apiKey = apiKey;
  }

  async sendMessage(
    systemInstruction: string,
    history: ChatMessage[],
    message: string,
    image?: string
  ): Promise<SendMessageResult> {
    const tools = ALL_TOOLS.map(tool => ({
      type: "function",
      function: {
        name: tool.name,
        description: tool.description,
        parameters: convertSchemaTypes(tool.parameters)
      }
    }));

    let modelToUse = this.provider === 'qwen' ? "qwen-plus" : "deepseek-chat";
    const messages: any[] = [
      { role: "system", content: systemInstruction },
      ...history.filter(m => m.role !== 'system').slice(-10).map(m => ({
        role: m.role === 'model' ? 'assistant' : m.role,
        content: m.content
      }))
    ];

    if (image && this.provider === 'qwen') {
      modelToUse = "qwen-vl-max";
      messages.push({
        role: "user",
        content: [
          { type: "image_url", image_url: { url: image } },
          { type: "text", text: message }
        ]
      });
    } else {
      messages.push({ role: "user", content: message });
    }

    const response = await fetch(this.baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      },
      body: JSON.stringify({
        model: modelToUse,
        messages: messages,
        tools: tools,
        tool_choice: "auto"
      })
    });

    const data = await response.json();
    const choice = data.choices?.[0];
    const responseMessage = choice?.message;

    if (responseMessage?.tool_calls?.length > 0) {
      const toolCall = responseMessage.tool_calls[0];
      return {
        text: responseMessage.content || "",
        toolCalls: [{
          name: toolCall.function.name,
          args: JSON.parse(toolCall.function.arguments)
        }]
      };
    }

    return {
      text: responseMessage?.content || "",
      toolCalls: []
    };
  }

  async continueWithToolResult(
    toolName: string,
    toolResponse: any,
    previousMessages: any[]
  ): Promise<SendMessageResult> {
    const tools = ALL_TOOLS.map(tool => ({
      type: "function",
      function: {
        name: tool.name,
        description: tool.description,
        parameters: convertSchemaTypes(tool.parameters)
      }
    }));

    let modelToUse = this.provider === 'qwen' ? "qwen-plus" : "deepseek-chat";

    const messages = [
      ...previousMessages,
      {
        role: "tool",
        content: JSON.stringify(toolResponse)
      }
    ];

    const response = await fetch(this.baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      },
      body: JSON.stringify({
        model: modelToUse,
        messages: messages,
        tools: tools
      })
    });

    const data = await response.json();
    const choice = data.choices?.[0];
    const responseMessage = choice?.message;

    if (responseMessage?.tool_calls?.length > 0) {
      const toolCall = responseMessage.tool_calls[0];
      return {
        text: responseMessage.content || "",
        toolCalls: [{
          name: toolCall.function.name,
          args: JSON.parse(toolCall.function.arguments)
        }]
      };
    }

    return {
      text: responseMessage?.content || "",
      toolCalls: []
    };
  }
}
