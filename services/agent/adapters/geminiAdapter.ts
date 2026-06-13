import { GoogleGenAI, Content, Part } from "@google/genai";
import { ILlmAdapter, SendMessageResult } from '../types';
import { ChatMessage } from '../../../types/ui';
import { ALL_TOOLS } from '../tools';

export class GeminiAdapter implements ILlmAdapter {
  private apiKey: string = '';
  private geminiAi: GoogleGenAI | null = null;
  private modelName = 'gemini-3-flash-preview';
  private currentChat: any = null;

  initialize(apiKey: string): void {
    this.apiKey = apiKey;
    if (apiKey) {
      this.geminiAi = new GoogleGenAI({ apiKey });
      this.currentChat = null;
    }
  }

  async sendMessage(
    systemInstruction: string,
    history: ChatMessage[],
    message: string,
    image?: string
  ): Promise<SendMessageResult> {
    if (!this.geminiAi) {
      throw new Error("Gemini not initialized");
    }

    const geminiHistory: Content[] = history
      .filter(m => m.role !== 'system')
      .slice(-10)
      .map(m => {
        const parts: Part[] = [];
        if (m.image) {
          const base64Data = m.image.split(',')[1];
          const mimeType = m.image.split(';')[0].split(':')[1];
          parts.push({ inlineData: { mimeType, data: base64Data } });
        }
        if (m.content && m.content.trim().length > 0) {
          parts.push({ text: m.content });
        }
        return {
          role: m.role === 'user' ? 'user' : 'model',
          parts: parts
        };
      });

    if (!this.currentChat) {
      this.currentChat = this.geminiAi.chats.create({
        model: this.modelName,
        history: geminiHistory,
        config: {
          systemInstruction,
          tools: [{ functionDeclarations: ALL_TOOLS }],
        }
      });
    }

    const currentParts: Part[] = [];
    if (image) {
      const base64Data = image.split(',')[1];
      const mimeType = image.split(';')[0].split(':')[1];
      currentParts.push({ inlineData: { mimeType, data: base64Data } });
    }

    const safeMessage = message.trim();
    if (safeMessage) {
      currentParts.push({ text: safeMessage });
    } else if (currentParts.length === 0) {
      currentParts.push({ text: "." });
    }

    const result = await this.currentChat.sendMessage({ message: currentParts });
    const calls = result.functionCalls;

    if (calls && calls.length > 0) {
      return {
        text: result.text || "",
        toolCalls: calls.map((call: any) => ({ name: call.name, args: call.args }))
      };
    }

    return { text: result.text || "", toolCalls: [] };
  }

  async continueWithToolResult(
    toolName: string,
    toolResponse: any
  ): Promise<SendMessageResult> {
    if (!this.currentChat) {
      throw new Error("No active chat session");
    }

    const result = await this.currentChat.sendMessage({
      message: [{ functionResponse: { name: toolName, response: toolResponse } }]
    });

    const calls = result.functionCalls;
    if (calls && calls.length > 0) {
      return {
        text: result.text || "",
        toolCalls: calls.map((call: any) => ({ name: call.name, args: call.args }))
      };
    }

    return { text: result.text || "", toolCalls: [] };
  }

  resetChat(): void {
    this.currentChat = null;
  }
}
