import { EventEmitter } from 'eventemitter3';
import {
  AgentRole,
  Task,
  TaskResult,
  TaskStatus,
  TaskPriority,
  PipelineConfig,
  CodeGenerationResult,
  TestGenerationResult,
  ReviewResult,
  DocumentationResult,
  AnalysisResult
} from './types';
import { DEFAULT_AGENT_CONFIGS, AGENT_SYSTEM_PROMPTS } from './config';
import { LLMClient, createLLMClient } from './llmClient';
import {
  BaseAgent,
  createAgent,
  OrchestratorAgent,
  ArchitectAgent,
  DeveloperAgent,
  TesterAgent,
  ReviewerAgent,
  DocumenterAgent
} from './agents';
import { AIProvider } from '../../types/store';

export interface PipelineResult {
  success: boolean;
  analysis?: AnalysisResult;
  code?: CodeGenerationResult;
  tests?: TestGenerationResult;
  review?: ReviewResult;
  documentation?: DocumentationResult;
  errors: string[];
  totalTime: number;
}

export interface PipelineProgress {
  phase: string;
  completedTasks: number;
  totalTasks: number;
  currentAgent: AgentRole | null;
  message: string;
}

export class PipelineOrchestrator extends EventEmitter {
  private agents: Map<AgentRole, BaseAgent> = new Map();
  private llmClient: LLMClient;
  private config: PipelineConfig;
  private projectContext: string;
  private taskQueue: Task[] = [];
  private completedTasks: Map<string, TaskResult> = new Map();

  constructor(
    provider: AIProvider,
    apiKey: string,
    projectContext: string,
    customConfig?: Partial<PipelineConfig>
  ) {
    super();
    this.llmClient = createLLMClient({ provider, apiKey });
    this.projectContext = projectContext;
    this.config = {
      agents: DEFAULT_AGENT_CONFIGS,
      maxParallelTasks: customConfig?.maxParallelTasks ?? 3,
      taskTimeout: customConfig?.taskTimeout ?? 120000,
      enableCaching: customConfig?.enableCaching ?? true,
      provider: customConfig?.provider ?? provider
    };
    this.initializeAgents();
  }

  private initializeAgents(): void {
    for (const agentConfig of this.config.agents) {
      const agent = createAgent(
        agentConfig.role,
        agentConfig,
        this.llmClient,
        this.projectContext
      );
      this.agents.set(agentConfig.role, agent);
    }
  }

  private getAgent(role: AgentRole): BaseAgent {
    const agent = this.agents.get(role);
    if (!agent) {
      throw new Error(`Agent not found for role: ${role}`);
    }
    return agent;
  }

  async execute(requirements: string): Promise<PipelineResult> {
    const startTime = Date.now();
    const errors: string[] = [];

    this.emit('progress', {
      phase: 'analysis',
      completedTasks: 0,
      totalTasks: 1,
      currentAgent: AgentRole.ORCHESTRATOR,
      message: 'Analyzing requirements...'
    } as PipelineProgress);

    const orchestrator = this.getAgent(AgentRole.ORCHESTRATOR) as OrchestratorAgent;

    let analysis: AnalysisResult | undefined;
    let tasks: Task[] = [];

    try {
      const orchestratorResult = await orchestrator.execute({
        id: 'orchestrate-1',
        type: 'orchestration',
        title: 'Analyze and decompose requirements',
        description: requirements,
        priority: TaskPriority.HIGH,
        status: TaskStatus.IN_PROGRESS,
        input: { requirements },
        dependencies: [],
        createdAt: Date.now(),
        updatedAt: Date.now()
      });

      if (orchestratorResult.success && orchestratorResult.output) {
        analysis = orchestratorResult.output.analysis;
        tasks = orchestratorResult.output.subtasks || [];
      } else {
        errors.push(orchestratorResult.error || 'Orchestration failed');
      }
    } catch (error) {
      errors.push(`Orchestration error: ${(error as Error).message}`);
    }

    this.emit('progress', {
      phase: 'development',
      completedTasks: 1,
      totalTasks: tasks.length + 1,
      currentAgent: null,
      message: `Starting development phase with ${tasks.length} tasks...`
    } as PipelineProgress);

    const codeResult = await this.executeDevelopmentPhase(tasks, errors);

    this.emit('progress', {
      phase: 'review',
      completedTasks: tasks.length + 1,
      totalTasks: tasks.length + 2,
      currentAgent: AgentRole.REVIEWER,
      message: 'Reviewing code...'
    } as PipelineProgress);

    const reviewResult = await this.executeReviewPhase(codeResult, errors);

    this.emit('progress', {
      phase: 'documentation',
      completedTasks: tasks.length + 2,
      totalTasks: tasks.length + 3,
      currentAgent: AgentRole.DOCUMENTER,
      message: 'Generating documentation...'
    } as PipelineProgress);

    const documentationResult = await this.executeDocumentationPhase(codeResult, errors);

    this.emit('progress', {
      phase: 'complete',
      completedTasks: tasks.length + 3,
      totalTasks: tasks.length + 3,
      currentAgent: null,
      message: 'Pipeline completed'
    } as PipelineProgress);

    return {
      success: errors.length === 0,
      analysis,
      code: codeResult.code,
      tests: codeResult.tests,
      review: reviewResult,
      documentation: documentationResult,
      errors,
      totalTime: Date.now() - startTime
    };
  }

  private async executeDevelopmentPhase(
    tasks: Task[],
    errors: string[]
  ): Promise<{ code?: CodeGenerationResult; tests?: TestGenerationResult }> {
    const architectTasks = tasks.filter(t => t.assignedTo === AgentRole.ARCHITECT);
    const developerTasks = tasks.filter(t => t.assignedTo === AgentRole.DEVELOPER);
    const testerTasks = tasks.filter(t => t.assignedTo === AgentRole.TESTER);

    let architecture: Record<string, any> | undefined;
    let codeResult: CodeGenerationResult | undefined;
    let testsResult: TestGenerationResult | undefined;

    for (const task of architectTasks) {
      try {
        const architect = this.getAgent(AgentRole.ARCHITECT) as ArchitectAgent;
        const result = await architect.execute({
          ...task,
          input: {
            ...task.input,
            existingComponents: this.getExistingComponents()
          }
        });

        if (result.success && result.output) {
          architecture = result.output;
        } else {
          errors.push(`Architect task ${task.id} failed: ${result.error}`);
        }
      } catch (error) {
        errors.push(`Architect error: ${(error as Error).message}`);
      }
    }

    for (const task of developerTasks) {
      try {
        const developer = this.getAgent(AgentRole.DEVELOPER) as DeveloperAgent;
        const result = await developer.execute({
          ...task,
          input: {
            ...task.input,
            componentSpec: architecture,
            existingCode: this.getExistingCodeContext()
          }
        });

        if (result.success && result.output) {
          if (!codeResult) {
            codeResult = { files: [], imports: [], exports: [] };
          }
          if (result.output.files) {
            codeResult.files.push(...result.output.files);
          }
          if (result.output.imports) {
            codeResult.imports.push(...result.output.imports);
          }
          if (result.output.exports) {
            codeResult.exports.push(...result.output.exports);
          }
        } else {
          errors.push(`Developer task ${task.id} failed: ${result.error}`);
        }
      } catch (error) {
        errors.push(`Developer error: ${(error as Error).message}`);
      }
    }

    for (const task of testerTasks) {
      try {
        const tester = this.getAgent(AgentRole.TESTER) as TesterAgent;
        const result = await tester.execute({
          ...task,
          input: {
            ...task.input,
            codeFiles: codeResult?.files || [],
            componentSpec: architecture
          }
        });

        if (result.success && result.output) {
          testsResult = {
            testFiles: result.output.testFiles || [],
            coverage: result.output.coverage || 0,
            passingTests: result.output.passingTests || 0
          };
        } else {
          errors.push(`Tester task ${task.id} failed: ${result.error}`);
        }
      } catch (error) {
        errors.push(`Tester error: ${(error as Error).message}`);
      }
    }

    return { code: codeResult, tests: testsResult };
  }

  private async executeReviewPhase(
    codeResult: { code?: CodeGenerationResult; tests?: TestGenerationResult },
    errors: string[]
  ): Promise<ReviewResult | undefined> {
    const reviewTasks = this.taskQueue.filter(t => t.assignedTo === AgentRole.REVIEWER);

    let reviewResult: ReviewResult | undefined;

    for (const task of reviewTasks) {
      try {
        const reviewer = this.getAgent(AgentRole.REVIEWER) as ReviewerAgent;
        const result = await reviewer.execute({
          ...task,
          input: {
            ...task.input,
            codeFiles: codeResult.code?.files || [],
            architecture: task.input.componentSpec
          }
        });

        if (result.success && result.output) {
          reviewResult = {
            issues: result.output.issues || [],
            suggestions: result.output.suggestions || [],
            score: result.output.score || 0,
            passed: result.output.passed ?? false
          };
        } else {
          errors.push(`Review task ${task.id} failed: ${result.error}`);
        }
      } catch (error) {
        errors.push(`Reviewer error: ${(error as Error).message}`);
      }
    }

    if (!reviewResult && codeResult.code?.files?.length) {
      try {
        const reviewer = this.getAgent(AgentRole.REVIEWER) as ReviewerAgent;
        const result = await reviewer.execute({
          id: 'auto-review-1',
          type: 'review',
          title: 'Auto code review',
          description: 'Automatic review of generated code',
          priority: TaskPriority.MEDIUM,
          status: TaskStatus.IN_PROGRESS,
          input: {
            codeFiles: codeResult.code.files,
            architecture: {}
          },
          dependencies: [],
          createdAt: Date.now(),
          updatedAt: Date.now()
        });

        if (result.success && result.output) {
          reviewResult = {
            issues: result.output.issues || [],
            suggestions: result.output.suggestions || [],
            score: result.output.score || 0,
            passed: result.output.passed ?? false
          };
        }
      } catch (error) {
        errors.push(`Auto-review error: ${(error as Error).message}`);
      }
    }

    return reviewResult;
  }

  private async executeDocumentationPhase(
    codeResult: { code?: CodeGenerationResult; tests?: TestGenerationResult },
    errors: string[]
  ): Promise<DocumentationResult | undefined> {
    let documentationResult: DocumentationResult | undefined;

    try {
      const documenter = this.getAgent(AgentRole.DOCUMENTER) as DocumenterAgent;
      const result = await documenter.execute({
        id: 'docs-1',
        type: 'documentation',
        title: 'Generate documentation',
        description: 'Generate documentation for the implementation',
        priority: TaskPriority.MEDIUM,
        status: TaskStatus.IN_PROGRESS,
        input: {
          componentSpec: codeResult.code?.files || [],
          codeFiles: codeResult.code?.files || []
        },
        dependencies: [],
        createdAt: Date.now(),
        updatedAt: Date.now()
      });

      if (result.success && result.output) {
        documentationResult = {
          sections: result.output.sections || [],
          examples: result.output.examples || []
        };
      } else {
        errors.push(`Documentation task failed: ${result.error}`);
      }
    } catch (error) {
      errors.push(`Documenter error: ${(error as Error).message}`);
    }

    return documentationResult;
  }

  private getExistingComponents(): string {
    return `
Components:
- Dashboard.tsx (main dashboard view)
- AssetsView.tsx (asset list and management)
- TransactionHistory.tsx (transaction history display)
- Analytics.tsx (portfolio analytics and charts)
- AIChatAssistant.tsx (AI-powered chat interface)
- Settings.tsx (app settings)
- Various UI components in components/ui/

Services:
- PortfolioEngine.ts (event-sourced calculations)
- StorageService.ts (LocalStorage persistence)
- MarketDataService.ts (market data fetching)
- AgentService.ts (AI agent functionality)

Context:
- PortfolioContext.tsx (global state management)
- portfolioReducer.ts (state management logic)
`;
  }

  private getExistingCodeContext(): string {
    return `
Code Patterns:
- Functional components with React 19 hooks
- TypeScript strict mode
- Named exports
- Event sourcing for state changes
- Context + useReducer for state management
- Service layer pattern for business logic
`;
  }

  getAgents(): Map<AgentRole, BaseAgent> {
    return this.agents;
  }

  getCompletedTasks(): Map<string, TaskResult> {
    return this.completedTasks;
  }

  clearHistory(): void {
    this.completedTasks.clear();
    this.taskQueue = [];
  }
}

export function createPipeline(
  provider: AIProvider,
  apiKey: string,
  projectContext: string,
  config?: Partial<PipelineConfig>
): PipelineOrchestrator {
  return new PipelineOrchestrator(provider, apiKey, projectContext, config);
}