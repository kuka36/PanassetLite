import React, { useState, useCallback } from 'react';
import { Loader2, Bot, FileCode, FileText, CheckCircle, AlertCircle, X, Play, StopCircle } from 'lucide-react';
import { multiAgentService, MultiAgentRequest, PipelineProgress, PipelineResult } from '../../services/multiagent';
import { AIProvider } from '../../types/store';

interface AgentTask {
  id: string;
  name: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  icon: React.ReactNode;
}

interface GeneratedFile {
  path: string;
  content: string;
  language: string;
  action: string;
}

const AGENT_TASKS: AgentTask[] = [
  { id: 'architect', name: 'Architecture Design', status: 'pending', icon: <Bot size={16} /> },
  { id: 'developer', name: 'Code Generation', status: 'pending', icon: <FileCode size={16} /> },
  { id: 'tester', name: 'Test Generation', status: 'pending', icon: <Bot size={16} /> },
  { id: 'reviewer', name: 'Code Review', status: 'pending', icon: <Bot size={16} /> },
  { id: 'documenter', name: 'Documentation', status: 'pending', icon: <FileText size={16} /> },
];

const MultiAgentPipeline: React.FC<{
  provider: AIProvider;
  apiKey: string;
  onClose: () => void;
}> = ({ provider, apiKey, onClose }) => {
  const [requirements, setRequirements] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState<PipelineProgress | null>(null);
  const [result, setResult] = useState<PipelineResult | null>(null);
  const [tasks, setTasks] = useState<AgentTask[]>(AGENT_TASKS);
  const [activeTab, setActiveTab] = useState<'output' | 'code' | 'review'>('output');

  const updateTaskStatus = useCallback((taskId: string, status: AgentTask['status']) => {
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status } : t));
  }, []);

  const handleExecute = async () => {
    if (!requirements.trim()) return;
    if (!apiKey) {
      alert('Please configure API key first');
      return;
    }

    setIsRunning(true);
    setResult(null);
    setTasks(AGENT_TASKS.map(t => ({ ...t, status: 'pending' })));

    multiAgentService.initialize(provider, apiKey);
    multiAgentService.onProgress((prog) => {
      setProgress(prog);
      
      if (prog.phase === 'analysis') updateTaskStatus('architect', 'running');
      if (prog.phase === 'development') {
        updateTaskStatus('architect', 'completed');
        updateTaskStatus('developer', 'running');
        updateTaskStatus('tester', 'running');
      }
      if (prog.phase === 'review') {
        updateTaskStatus('developer', 'completed');
        updateTaskStatus('tester', 'completed');
        updateTaskStatus('reviewer', 'running');
      }
      if (prog.phase === 'documentation') {
        updateTaskStatus('reviewer', 'completed');
        updateTaskStatus('documenter', 'running');
      }
      if (prog.phase === 'complete') {
        updateTaskStatus('documenter', 'completed');
      }
    });

    try {
      const response = await multiAgentService.executeRequest({ requirements });
      
      if (response.result) {
        setResult(response.result);
        
        if (!response.success) {
          setTasks(prev => prev.map(t => 
            t.status === 'running' ? { ...t, status: 'failed' } : t
          ));
        }
      }
    } catch (error) {
      console.error('Pipeline error:', error);
      setTasks(prev => prev.map(t => 
        t.status === 'running' ? { ...t, status: 'failed' } : t
      ));
    } finally {
      setIsRunning(false);
    }
  };

  const handleCancel = () => {
    multiAgentService.cancel();
    setIsRunning(false);
    setTasks(prev => prev.map(t => 
      t.status === 'running' ? { ...t, status: 'failed' } : t
    ));
  };

  const getStatusColor = (status: AgentTask['status']) => {
    switch (status) {
      case 'completed': return 'text-green-500';
      case 'failed': return 'text-red-500';
      case 'running': return 'text-blue-500';
      default: return 'text-gray-400';
    }
  };

  const getStatusIcon = (status: AgentTask['status']) => {
    switch (status) {
      case 'completed': return <CheckCircle size={14} className="text-green-500" />;
      case 'failed': return <AlertCircle size={14} className="text-red-500" />;
      case 'running': return <Loader2 size={14} className="text-blue-500 animate-spin" />;
      default: return null;
    }
  };

  const renderCodePreview = () => {
    if (!result?.code?.files?.length) {
      return (
        <div className="text-center text-gray-500 py-8">
          No code generated yet
        </div>
      );
    }

    return (
      <div className="space-y-2">
        {result.code.files.map((file: GeneratedFile, index: number) => (
          <div key={index} className="border rounded-lg overflow-hidden">
            <div className="bg-gray-100 px-3 py-2 flex items-center justify-between">
              <span className="font-mono text-sm">{file.path}</span>
              <span className={`text-xs px-2 py-1 rounded ${
                file.action === 'create' ? 'bg-green-100 text-green-700' :
                file.action === 'update' ? 'bg-blue-100 text-blue-700' :
                'bg-red-100 text-red-700'
              }`}>
                {file.action}
              </span>
            </div>
            <pre className="p-3 text-xs overflow-x-auto max-h-60 bg-white">
              {file.content.length > 1000 
                ? file.content.substring(0, 1000) + '...' 
                : file.content}
            </pre>
          </div>
        ))}
      </div>
    );
  };

  const renderReviewResults = () => {
    if (!result?.review) {
      return (
        <div className="text-center text-gray-500 py-8">
          No review results yet
        </div>
      );
    }

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-lg font-medium">Code Quality Score</span>
          <span className={`text-2xl font-bold ${
            result.review.score >= 80 ? 'text-green-500' :
            result.review.score >= 60 ? 'text-yellow-500' : 'text-red-500'
          }`}>
            {result.review.score}/100
          </span>
        </div>

        {result.review.issues.length > 0 && (
          <div>
            <h4 className="font-medium mb-2">Issues Found</h4>
            <div className="space-y-2">
              {result.review.issues.map((issue, index) => (
                <div key={index} className={`p-2 rounded border-l-4 ${
                  issue.severity === 'error' ? 'border-red-500 bg-red-50' :
                  issue.severity === 'warning' ? 'border-yellow-500 bg-yellow-50' :
                  'border-blue-500 bg-blue-50'
                }`}>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-medium uppercase ${
                      issue.severity === 'error' ? 'text-red-600' :
                      issue.severity === 'warning' ? 'text-yellow-600' : 'text-blue-600'
                    }`}>
                      {issue.severity}
                    </span>
                    {issue.file && (
                      <span className="text-xs text-gray-500">
                        {issue.file}{issue.line ? `:${issue.line}` : ''}
                      </span>
                    )}
                  </div>
                  <p className="text-sm mt-1">{issue.message}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {result.review.suggestions.length > 0 && (
          <div>
            <h4 className="font-medium mb-2">Suggestions</h4>
            <div className="space-y-2">
              {result.review.suggestions.map((suggestion, index) => (
                <div key={index} className="p-2 rounded bg-gray-50">
                  <p className="text-sm">{suggestion.message}</p>
                  {suggestion.replacement && (
                    <pre className="mt-2 p-2 bg-white rounded text-xs">
                      {suggestion.replacement}
                    </pre>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b bg-gray-50">
          <div className="flex items-center gap-2">
            <Bot size={20} className="text-blue-500" />
            <h2 className="font-semibold">Multi-Agent Development Pipeline</h2>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-gray-200 rounded">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-auto p-4">
          <div className="mb-4">
            <label className="block text-sm font-medium mb-2">
              Requirements / Feature Description
            </label>
            <textarea
              value={requirements}
              onChange={(e) => setRequirements(e.target.value)}
              placeholder="Describe the feature, bug fix, or refactoring you want to implement..."
              className="w-full h-32 p-3 border rounded-lg text-sm resize-none"
              disabled={isRunning}
            />
          </div>

          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Pipeline Tasks</span>
              {progress && (
                <span className="text-xs text-gray-500">
                  {progress.completedTasks}/{progress.totalTasks}
                </span>
              )}
            </div>
            <div className="flex gap-2 flex-wrap">
              {tasks.map(task => (
                <div
                  key={task.id}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm ${
                    task.status === 'running' ? 'bg-blue-100' :
                    task.status === 'completed' ? 'bg-green-100' :
                    task.status === 'failed' ? 'bg-red-100' :
                    'bg-gray-100'
                  }`}
                >
                  {task.icon}
                  <span>{task.name}</span>
                  {getStatusIcon(task.status)}
                </div>
              ))}
            </div>
          </div>

          {progress && (
            <div className="mb-4">
              <div className="flex items-center gap-2 mb-1">
                <Loader2 size={14} className="animate-spin text-blue-500" />
                <span className="text-sm">{progress.message}</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-blue-500 h-2 rounded-full transition-all"
                  style={{ width: `${(progress.completedTasks / progress.totalTasks) * 100}%` }}
                />
              </div>
            </div>
          )}

          {result && (
            <div className="border-t pt-4">
              <div className="flex gap-2 mb-4">
                {['output', 'code', 'review'].map(tab => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab as typeof activeTab)}
                    className={`px-3 py-1.5 text-sm rounded ${
                      activeTab === tab ? 'bg-blue-500 text-white' : 'bg-gray-100'
                    }`}
                  >
                    {tab === 'output' ? 'Output' : tab === 'code' ? 'Generated Code' : 'Review'}
                  </button>
                ))}
              </div>

              <div className="bg-gray-50 rounded-lg p-4 max-h-80 overflow-auto">
                {activeTab === 'output' && (
                  <div className="space-y-3">
                    {result.errors.length > 0 && (
                      <div className="p-3 bg-red-50 border border-red-200 rounded">
                        <h4 className="font-medium text-red-700 mb-2">Errors</h4>
                        <ul className="list-disc list-inside text-sm text-red-600">
                          {result.errors.map((err, i) => (
                            <li key={i}>{err}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {result.analysis && (
                      <div>
                        <h4 className="font-medium mb-2">Analysis</h4>
                        <pre className="text-xs bg-white p-2 rounded overflow-x-auto">
                          {JSON.stringify(result.analysis, null, 2)}
                        </pre>
                      </div>
                    )}
                    {result.documentation?.sections?.length > 0 && (
                      <div>
                        <h4 className="font-medium mb-2">Documentation</h4>
                        <div className="space-y-2">
                          {result.documentation.sections.map((section, i) => (
                            <div key={i}>
                              <h5 className={`font-medium ${section.level === 1 ? 'text-lg' : ''}`}>
                                {section.title}
                              </h5>
                              <p className="text-sm text-gray-600">{section.content}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
                {activeTab === 'code' && renderCodePreview()}
                {activeTab === 'review' && renderReviewResults()}
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between px-4 py-3 border-t bg-gray-50">
          <span className="text-sm text-gray-500">
            {result ? `Completed in ${(result.totalTime / 1000).toFixed(1)}s` : ''}
          </span>
          <div className="flex gap-2">
            {isRunning ? (
              <button
                onClick={handleCancel}
                className="flex items-center gap-2 px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
              >
                <StopCircle size={16} />
                Cancel
              </button>
            ) : (
              <button
                onClick={handleExecute}
                disabled={!requirements.trim() || !apiKey}
                className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
              >
                <Play size={16} />
                Execute Pipeline
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default MultiAgentPipeline;