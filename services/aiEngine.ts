
import { GoogleGenAI, Type } from "@google/genai";

// Custom Error Classes
export class AIError extends Error {
  constructor(message: string, public provider: string, public originalError?: any) {
    super(message);
    this.name = 'AIError';
  }
}

export class AIParseError extends AIError {
  constructor(message: string, provider: string, originalError?: any) {
    super(message, provider, originalError);
    this.name = 'AIParseError';
  }
}

// 1. Define the Strategy Interface
export interface IAIEngine {
  generateText(prompt: string): Promise<string>;
  generateJSON<T = any>(prompt: string, schema?: any): Promise<T>;
}

// 2. Concrete Strategy: Gemini
export class GeminiEngine implements IAIEngine {
  private ai: GoogleGenAI;

  constructor(apiKey: string) {
    this.ai = new GoogleGenAI({ apiKey });
  }

  async generateText(prompt: string): Promise<string> {
    try {
      const response = await this.ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
      });
      return response.text || "";
    } catch (e) {
      throw new AIError("Gemini Text Generation Failed", 'gemini', e);
    }
  }

  async generateJSON<T = any>(prompt: string, schema?: any): Promise<T> {
    const config: any = {
      responseMimeType: 'application/json',
    };

    // Only attach schema if provided and supported by the generic structure
    if (schema) {
      config.responseSchema = schema;
    }

    try {
      const response = await this.ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
        config: config
      });

      try {
        return JSON.parse(response.text as string);
      } catch (e) {
        throw new AIParseError("Invalid JSON response from Gemini", 'gemini', e);
      }
    } catch (e) {
      if (e instanceof AIParseError) throw e;
      throw new AIError("Gemini JSON Generation Failed", 'gemini', e);
    }
  }
}

// 3. Concrete Strategy: DeepSeek
export class DeepSeekEngine implements IAIEngine {
  private apiKey: string;
  private baseUrl = 'https://api.deepseek.com/chat/completions';

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  private async callAPI(messages: any[], jsonMode: boolean = false): Promise<string> {
    try {
      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          model: "deepseek-chat",
          messages: messages,
          response_format: jsonMode ? { type: "json_object" } : undefined,
          stream: false
        })
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        const msg = errData.error?.message || response.statusText;
        throw new AIError(`DeepSeek API Error: ${msg}`, 'deepseek');
      }

      const data = await response.json();
      return data.choices?.[0]?.message?.content || '';
    } catch (e) {
      if (e instanceof AIError) throw e;
      throw new AIError("DeepSeek Network/API Error", 'deepseek', e);
    }
  }

  async generateText(prompt: string): Promise<string> {
    return this.callAPI([{ role: "user", content: prompt }], false);
  }

  async generateJSON<T = any>(prompt: string, _schema?: any): Promise<T> {
    // DeepSeek V3 supports JSON mode but doesn't support strict Schema validation like Gemini in the same way.
    // We rely on the prompt instructions and JSON mode enforcement.
    const responseText = await this.callAPI([{ role: "user", content: prompt }], true);

    try {
      return JSON.parse(responseText);
    } catch (e) {
      throw new AIParseError("Invalid JSON response from DeepSeek", 'deepseek', e);
    }
  }
}

// 4. Concrete Strategy: Qwen (OpenAI Compatible)
export class QwenEngine implements IAIEngine {
  private apiKey: string;
  private baseUrl = 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions';

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  private async callAPI(messages: any[], tools?: any[]): Promise<any> {
    try {
      const body: any = {
        model: "qwen-plus",
        messages: messages,
        stream: false
      };

      if (tools) {
        body.tools = tools;
      }

      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify(body)
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        const msg = errData.error?.message || response.statusText;
        throw new AIError(`Qwen API Error: ${msg}`, 'qwen');
      }

      const data = await response.json();
      return data;
    } catch (e) {
      if (e instanceof AIError) throw e;
      throw new AIError("Qwen Network/API Error", 'qwen', e);
    }
  }

  async generateText(prompt: string): Promise<string> {
    const data = await this.callAPI([{ role: "user", content: prompt }]);
    return data.choices?.[0]?.message?.content || '';
  }

  async generateJSON<T = any>(prompt: string, _schema?: any): Promise<T> {
    const data = await this.callAPI([{ role: "user", content: prompt }]);
    const content = data.choices?.[0]?.message?.content || '';

    try {
      const jsonMatch = content.match(/```json\n([\s\S]*?)\n```/) || content.match(/```\n([\s\S]*?)\n```/);
      const jsonStr = jsonMatch ? jsonMatch[1] : content;
      return JSON.parse(jsonStr);
    } catch (e) {
      throw new AIParseError("Invalid JSON response from Qwen", 'qwen', e);
    }
  }
}

// 4. Factory
export class AIEngineFactory {
  static create(provider: string, apiKey: string): IAIEngine {
    switch (provider) {
      case 'deepseek':
        return new DeepSeekEngine(apiKey);
      case 'qwen':
        return new QwenEngine(apiKey);
      case 'gemini':
      default:
        return new GeminiEngine(apiKey);
    }
  }
}
