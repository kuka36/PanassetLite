import React, { useRef, useEffect } from 'react';
import { User, Sparkles, CheckCircle2, ListChecks, AlertCircle, Check } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { ChatMessage, PendingAction, Language, BulkAssetItem } from '../../types';
import { ConfirmationTable } from '../ConfirmationTable';

interface MessageListProps {
    messages: ChatMessage[];
    isTyping: boolean;
    language: Language;
    onUpdatePendingAction: (msgId: string, newItems: BulkAssetItem[]) => void;
    onConfirmAction: (msgId: string, action: PendingAction) => void;
    isResizing: boolean;
}

export const MessageList: React.FC<MessageListProps> = ({
    messages,
    isTyping,
    language,
    onUpdatePendingAction,
    onConfirmAction,
    isResizing
}) => {
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Auto Scroll
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, isTyping]);

    const MarkdownContent = ({ content }: { content: string }) => {
        if (!content) return null;
        return (
            <div className="prose prose-sm max-w-none prose-p:leading-relaxed prose-pre:bg-slate-800 prose-pre:text-white prose-p:my-1 prose-ul:my-1 prose-li:my-0">
                <ReactMarkdown>{content}</ReactMarkdown>
            </div>
        );
    };

    return (
        <div className={`flex-1 overflow-y-auto p-4 space-y-6 bg-slate-50 scroll-smooth ${isResizing ? 'pointer-events-auto' : ''}`}>
            {messages.map((msg) => (
                <div key={msg.id} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 shadow-sm ${msg.role === 'user' ? 'bg-slate-200 text-slate-500' : 'bg-indigo-100 text-indigo-600'
                        }`}>
                        {msg.role === 'user' ? <User size={16} /> : <Sparkles size={16} />}
                    </div>

                    <div className={`max-w-[85%] rounded-2xl p-3.5 text-sm shadow-sm ${msg.role === 'user'
                        ? 'bg-slate-200 text-slate-800 rounded-tr-none'
                        : 'bg-white text-slate-700 border border-slate-200 rounded-tl-none'
                        }`}>
                        {msg.image && (
                            <div className="mb-2">
                                <img src={msg.image} alt="Upload" className="max-w-full max-h-[200px] rounded-lg border border-slate-300/50" />
                            </div>
                        )}
                        <MarkdownContent content={msg.content} />

                        {msg.pendingAction && (
                            <div className={`mt-2 p-3 rounded-xl animate-fade-in border ${msg.pendingAction.status === 'executed'
                                ? 'bg-slate-50 border-slate-200 opacity-80'
                                : 'bg-indigo-50 border-indigo-100'
                                }`}>
                                <div className="flex items-start gap-2 mb-2">
                                    <div className={`${msg.pendingAction.status === 'executed' ? 'text-green-500' : 'text-indigo-600'} mt-0.5 shrink-0`}>
                                        {msg.pendingAction.status === 'executed' ? <CheckCircle2 size={16} /> : (
                                            msg.pendingAction.type === 'BULK_ASSET_UPDATE' ? <ListChecks size={16} /> : <AlertCircle size={16} />
                                        )}
                                    </div>
                                    <div className={`text-xs font-medium ${msg.pendingAction.status === 'executed' ? 'text-green-700' : 'text-indigo-800'}`}>
                                        {language === 'zh'
                                            ? (msg.pendingAction.status === 'executed' ? "操作已执行" : "需确认操作")
                                            : (msg.pendingAction.status === 'executed' ? "Action Executed" : "Action Required")
                                        }
                                    </div>
                                </div>
                                <div className="text-sm font-bold text-slate-800 mb-3 pl-6">
                                    {msg.pendingAction.summary}
                                </div>

                                {msg.pendingAction.type === 'BULK_ASSET_UPDATE' && msg.pendingAction.items && (
                                    <div className="pl-6 mb-3">
                                        <ConfirmationTable
                                            items={msg.pendingAction.items}
                                            onUpdate={(newItems) => onUpdatePendingAction(msg.id, newItems)}
                                        />
                                    </div>
                                )}

                                {msg.pendingAction.type !== 'BULK_ASSET_UPDATE' && (
                                    <div className="pl-6 mb-3">
                                        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs bg-white/50 p-2 rounded-lg border border-indigo-100">
                                            {Object.entries(msg.pendingAction.data).map(([k, v]) => (
                                                v !== undefined && v !== null && k !== 'assetId' && k !== 'targetId' ? (
                                                    <React.Fragment key={k}>
                                                        <span className="text-slate-500 font-medium capitalize">{k}:</span>
                                                        <span className="text-slate-800 text-right truncate font-mono">{v.toString()}</span>
                                                    </React.Fragment>
                                                ) : null
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {msg.pendingAction.status !== 'executed' && (
                                    <div className="flex gap-2 pl-6">
                                        <button
                                            onClick={() => onConfirmAction(msg.id, msg.pendingAction!)}
                                            className={`flex-1 text-white text-xs font-bold py-2 rounded-lg flex items-center justify-center gap-1 transition-colors shadow-sm ${msg.pendingAction.type.includes('DELETE') ? 'bg-red-500 hover:bg-red-600' : 'bg-indigo-600 hover:bg-indigo-700'
                                                }`}
                                        >
                                            <Check size={14} /> {language === 'zh' ? (msg.pendingAction.type === 'BULK_ASSET_UPDATE' ? "确认导入全部" : "执行") : "Confirm"}
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            ))}

            {isTyping && (
                <div className="flex gap-3">
                    <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center shrink-0">
                        <Sparkles size={16} />
                    </div>
                    <div className="bg-white border border-slate-200 rounded-2xl rounded-tl-none p-4 shadow-sm flex items-center gap-1.5 h-10">
                        <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce"></span>
                        <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce delay-100"></span>
                        <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce delay-200"></span>
                    </div>
                </div>
            )}

            <div ref={messagesEndRef} />
        </div>
    );
};
