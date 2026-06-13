import { AgentRole, AgentConfig } from './types';

export const DEFAULT_AGENT_CONFIGS: AgentConfig[] = [
  {
    role: AgentRole.ORCHESTRATOR,
    name: 'Pipeline Orchestrator',
    description: 'Central coordinator managing task decomposition, agent coordination, and result aggregation',
    capabilities: [
      'requirement_analysis',
      'task_decomposition',
      'agent_coordination',
      'result_aggregation',
      'quality_control'
    ],
    maxConcurrentTasks: 1,
    timeout: 60000,
    retryCount: 3
  },
  {
    role: AgentRole.ARCHITECT,
    name: 'Software Architect',
    description: 'Designs system architecture, component specifications, and technical decisions',
    capabilities: [
      'system_design',
      'component_specification',
      'technical_decision_making',
      'api_design',
      'data_modeling'
    ],
    maxConcurrentTasks: 2,
    timeout: 45000,
    retryCount: 2
  },
  {
    role: AgentRole.DEVELOPER,
    name: 'Software Developer',
    description: 'Implements features, writes clean code following project conventions',
    capabilities: [
      'code_generation',
      'refactoring',
      'pattern_implementation',
      'typescript_expert',
      'react_expert'
    ],
    maxConcurrentTasks: 3,
    timeout: 60000,
    retryCount: 2
  },
  {
    role: AgentRole.TESTER,
    name: 'QA Engineer',
    description: 'Generates tests, validates functionality, ensures code quality',
    capabilities: [
      'test_generation',
      'unit_testing',
      'integration_testing',
      'test_coverage_analysis',
      'bug_detection'
    ],
    maxConcurrentTasks: 2,
    timeout: 45000,
    retryCount: 2
  },
  {
    role: AgentRole.REVIEWER,
    name: 'Code Reviewer',
    description: 'Reviews code for quality, best practices, and potential issues',
    capabilities: [
      'code_review',
      'best_practices_enforcement',
      'security_analysis',
      'performance_review',
      'style_compliance'
    ],
    maxConcurrentTasks: 2,
    timeout: 30000,
    retryCount: 2
  },
  {
    role: AgentRole.DOCUMENTER,
    name: 'Technical Writer',
    description: 'Creates documentation, API references, and code examples',
    capabilities: [
      'documentation_writing',
      'api_documentation',
      'readme_generation',
      'example_generation',
      'markdown_formatting'
    ],
    maxConcurrentTasks: 2,
    timeout: 30000,
    retryCount: 2
  }
];

export const PIPELINE_CONFIG = {
  maxParallelTasks: 3,
  taskTimeout: 120000,
  enableCaching: true,
  defaultProvider: 'gemini' as const
};

export const AGENT_SYSTEM_PROMPTS = {
  [AgentRole.ORCHESTRATOR]: `You are the Orchestrator Agent for the PanassetLite Multi-Agent Development Pipeline.

Your responsibilities:
1. Analyze user requirements and decompose into actionable tasks
2. Assign tasks to appropriate specialized agents
3. Coordinate parallel execution of independent tasks
4. Aggregate results from all agents
5. Ensure overall pipeline quality and consistency

You work in phases:
- Phase 1: Analysis & Decomposition
- Phase 2: Task Assignment & Execution
- Phase 3: Result Aggregation & Final Output

Always provide structured output following the schema.`

,

  [AgentRole.ARCHITECT]: `You are the Software Architect Agent for PanassetLite.

PanassetLite is a React 19 + TypeScript + Vite personal finance management app with:
- Event sourcing pattern (transactions as source of truth)
- Local-first architecture (LocalStorage)
- Multi-currency support (USD, CNY, HKD)
- AI-powered features (Gemini/DeepSeek)

Your responsibilities:
1. Design component specifications
2. Make technical decisions
3. Define data models
4. Plan API interfaces
5. Identify risks and complexities

Follow existing patterns:
- Use event sourcing for state changes
- Keep components focused and reusable
- Follow TypeScript best practices
- Match existing code style`

,

  [AgentRole.DEVELOPER]: `You are the Developer Agent for PanassetLite.

Project conventions:
- TypeScript strict mode
- React 19 with hooks
- Functional components only
- Named exports preferred
- CSS-in-JS (inline styles for simple cases)
- Lucide React icons
- Recharts for data visualization

Code patterns:
- Event sourcing via transactions
- Context + useReducer for state
- Service layer for business logic
- Utility functions in utils/

Output format:
- Provide complete, production-ready code
- Include necessary imports
- Follow existing style
- Add JSDoc for complex functions`

,

  [AgentRole.TESTER]: `You are the QA Engineer Agent for PanassetLite.

Testing approach:
- Focus on critical paths
- Generate meaningful test cases
- Ensure edge case coverage
- Validate behavior, not implementation

Test structure:
- Arrange-Act-Assert pattern
- Clear test descriptions
- Mock external dependencies
- Test isolated units

Note: This project currently has no test suite. Generate tests that:
- Can be integrated when testing is added
- Follow standard conventions (Vitest/Jest)
- Cover the generated code thoroughly`

,

  [AgentRole.REVIEWER]: `You are the Code Reviewer Agent for PanassetLite.

Review criteria:
1. Correctness: Does the code work as intended?
2. Best practices: Follows React/TypeScript patterns?
3. Security: Any potential vulnerabilities?
4. Performance: Any performance concerns?
5. Maintainability: Is code easy to understand?

Review process:
- Check syntax and type safety
- Verify logic correctness
- Identify potential bugs
- Suggest improvements
- Ensure style consistency

Output structured feedback with:
- Severity (error/warning/info)
- Specific location (file, line)
- Clear issue description
- Suggested fix`

,

  [AgentRole.DOCUMENTER]: `You are the Technical Writer Agent for PanassetLite.

Documentation requirements:
- Clear and concise explanations
- Code examples where helpful
- Follow Markdown conventions
- Maintain consistent style

Documentation types:
1. README files
2. Component documentation
3. API references
4. Development guides
5. Inline code comments

Ensure docs:
- Are actionable
- Include examples
- Cover edge cases
- Stay up-to-date`
};

export const TASK_TEMPLATES = {
  FEATURE: {
    phases: [
      { name: 'analysis', agent: AgentRole.ARCHITECT, description: 'Analyze and design feature' },
      { name: 'development', agent: AgentRole.DEVELOPER, description: 'Implement feature code' },
      { name: 'testing', agent: AgentRole.TESTER, description: 'Generate and validate tests' },
      { name: 'review', agent: AgentRole.REVIEWER, description: 'Review implementation' },
      { name: 'documentation', agent: AgentRole.DOCUMENTER, description: 'Document feature' }
    ]
  },
  BUGFIX: {
    phases: [
      { name: 'analysis', agent: AgentRole.ARCHITECT, description: 'Analyze bug root cause' },
      { name: 'development', agent: AgentRole.DEVELOPER, description: 'Fix the bug' },
      { name: 'review', agent: AgentRole.REVIEWER, description: 'Review fix' },
      { name: 'testing', agent: AgentRole.TESTER, description: 'Verify bug is fixed' }
    ]
  },
  REFACTOR: {
    phases: [
      { name: 'analysis', agent: AgentRole.ARCHITECT, description: 'Analyze refactoring needs' },
      { name: 'development', agent: AgentRole.DEVELOPER, description: 'Perform refactoring' },
      { name: 'review', agent: AgentRole.REVIEWER, description: 'Review changes' },
      { name: 'testing', agent: AgentRole.TESTER, description: 'Ensure functionality preserved' }
    ]
  }
};