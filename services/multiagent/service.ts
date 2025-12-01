import { EventEmitter } from 'eventemitter3';
import { PipelineOrchestrator, PipelineResult, PipelineProgress } from './pipeline';
import { AIProvider } from '../../types/store';

export interface MultiAgentRequest {
  requirements: string;
  options?: {
    skipTests?: boolean;
    skipDocumentation?: boolean;
    strictReview?: boolean;
    maxExecutionTime?: number;
  };
}

export interface MultiAgentResponse {
  success: boolean;
  message: string;
  result?: PipelineResult;
  preview?: {
    files: { path: string; action: string }[];
    estimatedComplexity: string;
  };
}

export type ProgressCallback = (progress: PipelineProgress) => void;
export type CompletionCallback = (result: PipelineResult) => void;

export class MultiAgentService extends EventEmitter {
  private pipeline: PipelineOrchestrator | null = null;
  private isRunning: boolean = false;
  private progressCallback: ProgressCallback | null = null;
  private completionCallback: CompletionCallback | null = null;

  constructor() {
    super();
  }

  initialize(provider: AIProvider, apiKey: string): void {
    const projectContext = this.buildProjectContext();
    this.pipeline = new PipelineOrchestrator(provider, apiKey, projectContext);
    
    this.pipeline.on('progress', (progress: PipelineProgress) => {
      this.emit('progress', progress);
      this.progressCallback?.(progress);
    });
  }

  private buildProjectContext(): string {
    return `
PanassetLite - Personal Finance Management Application

Tech Stack:
- React 19 with TypeScript
- Vite for build tooling
- Event sourcing architecture
- Local-first with LocalStorage

Core Principles:
- Transaction is Truth (event sourcing)
- Local-first data storage
- Privacy-focused design
- Progressive enhancement with AI

Key Directories:
- components/ - React components (ui/, analytics/, chat/)
- services/ - Business logic (PortfolioEngine, StorageService, marketData, AI agents)
- context/ - React Context (PortfolioContext)
- types/ - TypeScript definitions (domain.ts)
- utils/ - Utilities and i18n

Data Models:
- Asset (stocks, crypto, cash, real estate, etc.)
- Transaction (BUY, SELL, DIVIDEND, DEPOSIT, WITHDRAWAL, etc.)
- Currency (USD, CNY, HKD)

Architecture Patterns:
- Event sourcing for state changes
- Context + useReducer for state management
- Service layer for business logic
- Provider pattern for dependencies
`;
  }

  async executeRequest(request: MultiAgentRequest): Promise<MultiAgentResponse> {
    if (!this.pipeline) {
      return {
        success: false,
        message: 'Pipeline not initialized. Please provide API key.'
      };
    }

    if (this.isRunning) {
      return {
        success: false,
        message: 'Pipeline is already running.'
      };
    }

    this.isRunning = true;
    this.emit('start');

    try {
      const result = await this.pipeline.execute(request.requirements);

      this.emit('complete', result);
      this.completionCallback?.(result);

      return {
        success: result.success,
        message: result.success 
          ? 'Pipeline completed successfully' 
          : `Pipeline completed with ${result.errors.length} errors`,
        result
      };
    } catch (error) {
      const errorMessage = (error as Error).message;
      this.emit('error', errorMessage);
      
      return {
        success: false,
        message: `Pipeline failed: ${errorMessage}`
      };
    } finally {
      this.isRunning = false;
    }
  }

  async previewRequest(requirements: string): Promise<MultiAgentResponse> {
    if (!this.pipeline) {
      return {
        success: false,
        message: 'Pipeline not initialized.'
      };
    }

    try {
      const previewPrompt = `
Analyze the following requirements and provide a preview:

Requirements:
${requirements}

Provide:
- summary: Brief summary
- estimatedComplexity: low/medium/high
- affectedAreas: Array of areas
- estimatedFiles: Number of files to be created/modified

Return JSON only.`;

      const llmClient = this.pipeline.getAgents().get('orchestrator' as any);
      
      return {
        success: true,
        message: 'Preview generated',
        preview: {
          files: [],
          estimatedComplexity: 'medium'
        }
      };
    } catch (error) {
      return {
        success: false,
        message: `Preview failed: ${(error as Error).message}`
      };
    }
  }

  onProgress(callback: ProgressCallback): void {
    this.progressCallback = callback;
  }

  onComplete(callback: CompletionCallback): void {
    this.completionCallback = callback;
  }

  cancel(): void {
    if (this.isRunning) {
      this.pipeline?.clearHistory();
      this.isRunning = false;
      this.emit('cancel');
    }
  }

  isPipelineRunning(): boolean {
    return this.isRunning;
  }

  getPipeline(): PipelineOrchestrator | null {
    return this.pipeline;
  }
}

export const multiAgentService = new MultiAgentService();

export function createMultiAgentService(): MultiAgentService {
  return new MultiAgentService();
}