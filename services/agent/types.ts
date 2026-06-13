import { Asset, Transaction, Currency } from '../../types/domain';
import { Language, AIProvider, PendingAction } from '../../types/store';
import { ChatMessage } from '../../types/ui';

export interface ToolResult {
  response?: any;
  action?: PendingAction;
  text?: string;
}

export interface ToolContext {
  assets: Asset[];
  transactions: Transaction[];
  language: Language;
}

export interface ProcessResult {
  text: string;
  action?: PendingAction;
}

export interface ILlmAdapter {
  initialize(apiKey: string): void;
  sendMessage(
    systemInstruction: string,
    history: ChatMessage[],
    message: string,
    image?: string
  ): Promise<SendMessageResult>;
}

export interface SendMessageResult {
  text: string;
  toolCalls: Array<{ name: string; args: any }>;
}

export interface SessionState {
  history: ChatMessage[];
  currentImage?: string;
}

/**
 * Context passed to tool handlers
 */
export interface ToolContext {
  assets: Asset[];
  transactions: Transaction[];
  language: Language;
}

/**
 * Result from processing a message
 */
export interface ProcessResult {
  text: string;
  action?: PendingAction;
}

/**
 * Adapter interface for LLM providers
 */
export interface ILlmAdapter {
  /**
   * Initialize the adapter with API key
   */
  initialize(apiKey: string): void;

  /**
   * Send a message and get response with tool calls
   */
  sendMessage(
    systemInstruction: string,
    history: ChatMessage[],
    message: string,
    image?: string
  ): Promise<SendMessageResult>;
}

export interface SendMessageResult {
  text: string;
  toolCalls: Array<{ name: string; args: any }>;
}

/**
 * Session state for conversation management
 */
export interface SessionState {
  history: ChatMessage[];
  currentImage?: string;
}
