import { AIEngineFactory } from '../aiEngine';
import { AIProvider } from '../../types/store';

export interface LLMConfig {
  provider: AIProvider;
  apiKey: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

export class LLMClient {
  private engine: ReturnType<typeof AIEngineFactory.create>;
  private config: LLMConfig;

  constructor(config: LLMConfig) {
    this.config = config;
    this.engine = AIEngineFactory.create(config.provider, config.apiKey);
  }

  async generateText(prompt: string, options?: {
    temperature?: number;
    maxTokens?: number;
    system?: string;
  }): Promise<string> {
    const systemPrompt = options?.system || '';
    const fullPrompt = systemPrompt ? `${systemPrompt}\n\n${prompt}` : prompt;
    
    try {
      return await this.engine.generateText(fullPrompt);
    } catch (error) {
      console.error('LLM generation failed:', error);
      throw error;
    }
  }

  async generateJSON<T = any>(prompt: string, schema?: any, system?: string): Promise<T> {
    const fullPrompt = system ? `${system}\n\n${prompt}` : prompt;
    
    try {
      return await this.engine.generateJSON<T>(fullPrompt, schema);
    } catch (error) {
      console.error('LLM JSON generation failed:', error);
      throw error;
    }
  }

  async generateWithRetry(
    prompt: string,
    maxRetries: number = 3,
    delayMs: number = 1000
  ): Promise<string> {
    let lastError: Error | null = null;
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        return await this.generateText(prompt);
      } catch (error) {
        lastError = error as Error;
        if (attempt < maxRetries - 1) {
          await this.sleep(delayMs * (attempt + 1));
        }
      }
    }
    
    throw lastError || new Error('All retry attempts failed');
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  getProvider(): AIProvider {
    return this.config.provider;
  }
}

export function createLLMClient(config: LLMConfig): LLMClient {
  return new LLMClient(config);
}