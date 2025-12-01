export enum AgentRole {
  ORCHESTRATOR = 'orchestrator',
  ARCHITECT = 'architect',
  DEVELOPER = 'developer',
  TESTER = 'tester',
  REVIEWER = 'reviewer',
  DOCUMENTER = 'documenter'
}

export enum TaskStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  FAILED = 'failed'
}

export enum TaskPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export interface AgentConfig {
  role: AgentRole;
  name: string;
  description: string;
  capabilities: string[];
  maxConcurrentTasks: number;
  timeout: number;
  retryCount: number;
}

export interface Task {
  id: string;
  type: string;
  title: string;
  description: string;
  priority: TaskPriority;
  status: TaskStatus;
  assignedTo?: AgentRole;
  dependencies: string[];
  input: Record<string, any>;
  output?: Record<string, any>;
  error?: string;
  createdAt: number;
  updatedAt: number;
}

export interface TaskResult {
  taskId: string;
  success: boolean;
  output?: Record<string, any>;
  error?: string;
  executionTime: number;
  agentUsed?: AgentRole;
}

export interface PipelineConfig {
  agents: AgentConfig[];
  maxParallelTasks: number;
  taskTimeout: number;
  enableCaching: boolean;
  provider: 'gemini' | 'deepseek' | 'qwen';
}

export interface PipelineContext {
  requirements: string;
  projectStructure: string;
  existingCode: Map<string, string>;
  taskHistory: TaskResult[];
  sharedState: Record<string, any>;
}

export interface CodeGenerationResult {
  files: GeneratedFile[];
  imports: string[];
  exports: string[];
}

export interface GeneratedFile {
  path: string;
  content: string;
  language: string;
  action: 'create' | 'update' | 'delete';
}

export interface TestGenerationResult {
  testFiles: GeneratedFile[];
  coverage: number;
  passingTests: number;
}

export interface DocumentationResult {
  sections: DocumentationSection[];
  examples: CodeExample[];
}

export interface DocumentationSection {
  title: string;
  content: string;
  level: number;
}

export interface CodeExample {
  title: string;
  code: string;
  language: string;
  description: string;
}

export interface ReviewResult {
  issues: CodeIssue[];
  suggestions: CodeSuggestion[];
  score: number;
  passed: boolean;
}

export interface CodeIssue {
  severity: 'error' | 'warning' | 'info';
  line?: number;
  file?: string;
  message: string;
  rule?: string;
}

export interface CodeSuggestion {
  file?: string;
  line?: number;
  message: string;
  original?: string;
  replacement?: string;
}

export interface AnalysisResult {
  summary: string;
  components: ComponentSpec[];
  technicalDecisions: string[];
  risks: string[];
  estimatedComplexity: 'low' | 'medium' | 'high';
}

export interface ComponentSpec {
  name: string;
  type: 'component' | 'service' | 'hook' | 'type' | 'util';
  path: string;
  description: string;
  props?: Record<string, any>;
  methods?: string[];
  dependencies: string[];
}

export interface AgentMessage {
  id: string;
  from: AgentRole;
  to: AgentRole | 'broadcast';
  type: 'task' | 'result' | 'status' | 'error' | 'coordinate';
  content: any;
  timestamp: number;
}