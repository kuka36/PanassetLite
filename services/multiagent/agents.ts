import { AgentRole, AgentConfig, Task, TaskResult, TaskStatus } from './types';
import { LLMClient } from './llmClient';
import { AGENT_SYSTEM_PROMPTS } from './config';
import { AIProvider } from '../../types/store';

export abstract class BaseAgent {
  protected config: AgentConfig;
  protected llmClient: LLMClient;
  protected currentTask: Task | null = null;

  constructor(config: AgentConfig, llmClient: LLMClient) {
    this.config = config;
    this.llmClient = llmClient;
  }

  get role(): AgentRole {
    return this.config.role;
  }

  get name(): string {
    return this.config.name;
  }

  abstract execute(task: Task): Promise<TaskResult>;

  protected async runWithTimeout<T>(
    fn: () => Promise<T>,
    timeoutMs: number
  ): Promise<T> {
    return Promise.race([
      fn(),
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new Error(`Task timeout after ${timeoutMs}ms`)), timeoutMs)
      )
    ]);
  }

  protected createTaskResult(
    task: Task,
    output?: Record<string, any>,
    error?: string
  ): TaskResult {
    return {
      taskId: task.id,
      success: !error,
      output,
      error,
      executionTime: Date.now() - task.createdAt,
      agentUsed: this.config.role
    };
  }
}

export class OrchestratorAgent extends BaseAgent {
  private systemPrompt: string;

  constructor(
    config: AgentConfig,
    llmClient: LLMClient,
    projectContext: string
  ) {
    super(config, llmClient);
    this.systemPrompt = `${AGENT_SYSTEM_PROMPTS[AgentRole.ORCHESTRATOR]}\n\nProject Context:\n${projectContext}`;
  }

  async execute(task: Task): Promise<TaskResult> {
    const startTime = Date.now();
    
    try {
      const result = await this.runWithTimeout(
        async () => {
          const analysis = await this.analyzeRequirements(task.input.requirements);
          const subtasks = await this.decomposeTasks(analysis);
          return { analysis, subtasks };
        },
        this.config.timeout
      );

      return {
        taskId: task.id,
        success: true,
        output: result,
        executionTime: Date.now() - startTime,
        agentUsed: this.config.role
      };
    } catch (error) {
      return this.createTaskResult(task, undefined, (error as Error).message);
    }
  }

  private async analyzeRequirements(requirements: string): Promise<Record<string, any>> {
    const prompt = `
Analyze the following requirements and provide structured analysis:

Requirements:
${requirements}

Output JSON with:
- summary: Brief summary of what needs to be built
- type: "feature" | "bugfix" | "refactor" | "enhancement"
- priority: "low" | "medium" | "high" | "critical"
- complexity: "low" | "medium" | "high"
- keyComponents: Array of component names that need to be created/modified
- affectedAreas: Array of areas in the codebase that will be affected
- risks: Array of potential risks or concerns
`;

    return this.llmClient.generateJSON(prompt, {
      type: 'OBJECT',
      properties: {
        summary: { type: 'STRING' },
        type: { type: 'STRING', enum: ['feature', 'bugfix', 'refactor', 'enhancement'] },
        priority: { type: 'STRING', enum: ['low', 'medium', 'high', 'critical'] },
        complexity: { type: 'STRING', enum: ['low', 'medium', 'high'] },
        keyComponents: { type: 'ARRAY', items: { type: 'STRING' } },
        affectedAreas: { type: 'ARRAY', items: { type: 'STRING' } },
        risks: { type: 'ARRAY', items: { type: 'STRING' } }
      },
      required: ['summary', 'type', 'priority', 'complexity']
    }, this.systemPrompt);
  }

  private async decomposeTasks(analysis: Record<string, any>): Promise<Task[]> {
    const prompt = `
Based on the analysis, create detailed subtasks:

Analysis:
${JSON.stringify(analysis, null, 2)}

Create subtasks with:
- id: Unique identifier
- type: "analysis" | "development" | "testing" | "review" | "documentation"
- title: Short task title
- description: Detailed description
- assignedTo: Agent role to handle this task
- dependencies: Array of task IDs this depends on
- priority: Task priority

Return JSON array of tasks.`;

    const tasks = await this.llmClient.generateJSON(prompt, {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          id: { type: 'STRING' },
          type: { type: 'STRING' },
          title: { type: 'STRING' },
          description: { type: 'STRING' },
          assignedTo: { type: 'STRING' },
          dependencies: { type: 'ARRAY', items: { type: 'STRING' } },
          priority: { type: 'STRING' }
        },
        required: ['id', 'type', 'title', 'assignedTo']
      }
    }, this.systemPrompt);

    return (tasks as any[]).map(t => ({
      id: t.id,
      type: t.type,
      title: t.title,
      description: t.description,
      priority: t.priority || 'medium',
      status: TaskStatus.PENDING,
      assignedTo: t.assignedTo as AgentRole,
      dependencies: t.dependencies || [],
      input: { analysis, task: t },
      createdAt: Date.now(),
      updatedAt: Date.now()
    }));
  }
}

export class ArchitectAgent extends BaseAgent {
  private systemPrompt: string;

  constructor(
    config: AgentConfig,
    llmClient: LLMClient,
    projectContext: string
  ) {
    super(config, llmClient);
    this.systemPrompt = `${AGENT_SYSTEM_PROMPTS[AgentRole.ARCHITECT]}\n\nProject Context:\n${projectContext}`;
  }

  async execute(task: Task): Promise<TaskResult> {
    const startTime = Date.now();

    try {
      const result = await this.runWithTimeout(
        async () => this.designArchitecture(task),
        this.config.timeout
      );

      return {
        taskId: task.id,
        success: true,
        output: result,
        executionTime: Date.now() - startTime,
        agentUsed: this.config.role
      };
    } catch (error) {
      return this.createTaskResult(task, undefined, (error as Error).message);
    }
  }

  private async designArchitecture(task: Task): Promise<Record<string, any>> {
    const { requirements, existingComponents } = task.input;

    const prompt = `
Design the architecture for the following feature:

Requirements:
${requirements}

Existing Components:
${existingComponents || 'New feature, no existing components'}

Provide:
1. Component Specifications - detailed design for each component
2. Data Models - TypeScript interfaces
3. API/Interface definitions
4. Technical decisions and rationale
5. File structure recommendations
6. Dependencies analysis

Use TypeScript/React conventions matching the existing codebase.`;

    return this.llmClient.generateJSON(prompt, {
      type: 'OBJECT',
      properties: {
        components: {
          type: 'ARRAY',
          items: {
            type: 'OBJECT',
            properties: {
              name: { type: 'STRING' },
              type: { type: 'STRING' },
              path: { type: 'STRING' },
              description: { type: 'STRING' },
              props: { type: 'OBJECT' },
              methods: { type: 'ARRAY', items: { type: 'STRING' } },
              dependencies: { type: 'ARRAY', items: { type: 'STRING' } }
            }
          }
        },
        dataModels: { type: 'ARRAY', items: { type: 'STRING' } },
        technicalDecisions: { type: 'ARRAY', items: { type: 'STRING' } },
        risks: { type: 'ARRAY', items: { type: 'STRING' } },
        complexity: { type: 'STRING', enum: ['low', 'medium', 'high'] }
      }
    }, this.systemPrompt);
  }
}

export class DeveloperAgent extends BaseAgent {
  private systemPrompt: string;

  constructor(
    config: AgentConfig,
    llmClient: LLMClient,
    projectContext: string
  ) {
    super(config, llmClient);
    this.systemPrompt = `${AGENT_SYSTEM_PROMPTS[AgentRole.DEVELOPER]}\n\nProject Context:\n${projectContext}`;
  }

  async execute(task: Task): Promise<TaskResult> {
    const startTime = Date.now();

    try {
      const result = await this.runWithTimeout(
        async () => this.generateCode(task),
        this.config.timeout
      );

      return {
        taskId: task.id,
        success: true,
        output: result,
        executionTime: Date.now() - startTime,
        agentUsed: this.config.role
      };
    } catch (error) {
      return this.createTaskResult(task, undefined, (error as Error).message);
    }
  }

  private async generateCode(task: Task): Promise<Record<string, any>> {
    const { componentSpec, existingCode } = task.input;

    const prompt = `
Generate production-ready code for the following specification:

Component Specification:
${JSON.stringify(componentSpec, null, 2)}

${existingCode ? `Reference existing code patterns:\n${existingCode}` : ''}

Requirements:
- Use TypeScript with strict typing
- Follow React 19 best practices
- Match existing code style
- Include proper imports
- Add JSDoc for complex functions
- Handle edge cases
- Use functional components with hooks

Generate complete code that can be directly written to files. Return JSON with:
- files: Array of { path, content, language, action }
- imports: Required import statements
- exports: Main exports`;

    return this.llmClient.generateJSON(prompt, {
      type: 'OBJECT',
      properties: {
        files: {
          type: 'ARRAY',
          items: {
            type: 'OBJECT',
            properties: {
              path: { type: 'STRING' },
              content: { type: 'STRING' },
              language: { type: 'STRING' },
              action: { type: 'STRING', enum: ['create', 'update', 'delete'] }
            }
          }
        },
        imports: { type: 'ARRAY', items: { type: 'STRING' } },
        exports: { type: 'ARRAY', items: { type: 'STRING' } }
      },
      required: ['files']
    }, this.systemPrompt);
  }
}

export class TesterAgent extends BaseAgent {
  private systemPrompt: string;

  constructor(
    config: AgentConfig,
    llmClient: LLMClient,
    projectContext: string
  ) {
    super(config, llmClient);
    this.systemPrompt = `${AGENT_SYSTEM_PROMPTS[AgentRole.TESTER]}\n\nProject Context:\n${projectContext}`;
  }

  async execute(task: Task): Promise<TaskResult> {
    const startTime = Date.now();

    try {
      const result = await this.runWithTimeout(
        async () => this.generateTests(task),
        this.config.timeout
      );

      return {
        taskId: task.id,
        success: true,
        output: result,
        executionTime: Date.now() - startTime,
        agentUsed: this.config.role
      };
    } catch (error) {
      return this.createTaskResult(task, undefined, (error as Error).message);
    }
  }

  private async generateTests(task: Task): Promise<Record<string, any>> {
    const { codeFiles, componentSpec } = task.input;

    const prompt = `
Generate test cases for the following code:

Component:
${JSON.stringify(componentSpec, null, 2)}

Code to test:
${codeFiles || 'No specific code provided'}

Testing approach:
- Use Vitest/Jest conventions (since this is a Vite project)
- Focus on critical functionality
- Cover edge cases
- Test behavior, not implementation
- Mock external dependencies where needed

Return JSON with:
- testFiles: Array of { path, content, language }
- coverage: Estimated coverage percentage
- passingTests: Number of tests that should pass`;

    return this.llmClient.generateJSON(prompt, {
      type: 'OBJECT',
      properties: {
        testFiles: {
          type: 'ARRAY',
          items: {
            type: 'OBJECT',
            properties: {
              path: { type: 'STRING' },
              content: { type: 'STRING' },
              language: { type: 'STRING' }
            }
          }
        },
        coverage: { type: 'NUMBER' },
        passingTests: { type: 'NUMBER' }
      }
    }, this.systemPrompt);
  }
}

export class ReviewerAgent extends BaseAgent {
  private systemPrompt: string;

  constructor(
    config: AgentConfig,
    llmClient: LLMClient,
    projectContext: string
  ) {
    super(config, llmClient);
    this.systemPrompt = `${AGENT_SYSTEM_PROMPTS[AgentRole.REVIEWER]}\n\nProject Context:\n${projectContext}`;
  }

  async execute(task: Task): Promise<TaskResult> {
    const startTime = Date.now();

    try {
      const result = await this.runWithTimeout(
        async () => this.reviewCode(task),
        this.config.timeout
      );

      return {
        taskId: task.id,
        success: true,
        output: result,
        executionTime: Date.now() - startTime,
        agentUsed: this.config.role
      };
    } catch (error) {
      return this.createTaskResult(task, undefined, (error as Error).message);
    }
  }

  private async reviewCode(task: Task): Promise<Record<string, any>> {
    const { codeFiles, architecture } = task.input;

    const prompt = `
Review the following code for quality, best practices, and potential issues:

Code:
${codeFiles || 'No code provided'}

${architecture ? `Architecture:\n${JSON.stringify(architecture, null, 2)}` : ''}

Review criteria:
1. Correctness - Does it work as intended?
2. Best practices - Follows React/TypeScript patterns?
3. Security - Any vulnerabilities?
4. Performance - Any concerns?
5. Maintainability - Easy to understand?

Return JSON with:
- issues: Array of { severity, line?, file?, message, rule? }
- suggestions: Array of { file?, line?, message, original?, replacement? }
- score: Overall quality score (0-100)
- passed: Whether it passes review`;

    return this.llmClient.generateJSON(prompt, {
      type: 'OBJECT',
      properties: {
        issues: {
          type: 'ARRAY',
          items: {
            type: 'OBJECT',
            properties: {
              severity: { type: 'STRING', enum: ['error', 'warning', 'info'] },
              line: { type: 'NUMBER' },
              file: { type: 'STRING' },
              message: { type: 'STRING' },
              rule: { type: 'STRING' }
            }
          }
        },
        suggestions: {
          type: 'ARRAY',
          items: {
            type: 'OBJECT',
            properties: {
              file: { type: 'STRING' },
              line: { type: 'NUMBER' },
              message: { type: 'STRING' },
              original: { type: 'STRING' },
              replacement: { type: 'STRING' }
            }
          }
        },
        score: { type: 'NUMBER' },
        passed: { type: 'BOOLEAN' }
      },
      required: ['issues', 'suggestions', 'score']
    }, this.systemPrompt);
  }
}

export class DocumenterAgent extends BaseAgent {
  private systemPrompt: string;

  constructor(
    config: AgentConfig,
    llmClient: LLMClient,
    projectContext: string
  ) {
    super(config, llmClient);
    this.systemPrompt = `${AGENT_SYSTEM_PROMPTS[AgentRole.DOCUMENTER]}\n\nProject Context:\n${projectContext}`;
  }

  async execute(task: Task): Promise<TaskResult> {
    const startTime = Date.now();

    try {
      const result = await this.runWithTimeout(
        async () => this.generateDocumentation(task),
        this.config.timeout
      );

      return {
        taskId: task.id,
        success: true,
        output: result,
        executionTime: Date.now() - startTime,
        agentUsed: this.config.role
      };
    } catch (error) {
      return this.createTaskResult(task, undefined, (error as Error).message);
    }
  }

  private async generateDocumentation(task: Task): Promise<Record<string, any>> {
    const { componentSpec, codeFiles } = task.input;

    const prompt = `
Generate comprehensive documentation for:

Component:
${JSON.stringify(componentSpec, null, 2)}

Code:
${codeFiles || 'No code provided'}

Documentation should include:
1. Overview and purpose
2. Props/parameters with types
3. Usage examples
4. Code snippets
5. Edge cases and limitations
6. Related components

Format in Markdown. Return JSON with:
- sections: Array of { title, content, level }
- examples: Array of { title, code, language, description }`;

    return this.llmClient.generateJSON(prompt, {
      type: 'OBJECT',
      properties: {
        sections: {
          type: 'ARRAY',
          items: {
            type: 'OBJECT',
            properties: {
              title: { type: 'STRING' },
              content: { type: 'STRING' },
              level: { type: 'NUMBER' }
            }
          }
        },
        examples: {
          type: 'ARRAY',
          items: {
            type: 'OBJECT',
            properties: {
              title: { type: 'STRING' },
              code: { type: 'STRING' },
              language: { type: 'STRING' },
              description: { type: 'STRING' }
            }
          }
        }
      }
    }, this.systemPrompt);
  }
}

export function createAgent(
  role: AgentRole,
  config: AgentConfig,
  llmClient: LLMClient,
  projectContext: string
): BaseAgent {
  switch (role) {
    case AgentRole.ORCHESTRATOR:
      return new OrchestratorAgent(config, llmClient, projectContext);
    case AgentRole.ARCHITECT:
      return new ArchitectAgent(config, llmClient, projectContext);
    case AgentRole.DEVELOPER:
      return new DeveloperAgent(config, llmClient, projectContext);
    case AgentRole.TESTER:
      return new TesterAgent(config, llmClient, projectContext);
    case AgentRole.REVIEWER:
      return new ReviewerAgent(config, llmClient, projectContext);
    case AgentRole.DOCUMENTER:
      return new DocumenterAgent(config, llmClient, projectContext);
    default:
      throw new Error(`Unknown agent role: ${role}`);
  }
}