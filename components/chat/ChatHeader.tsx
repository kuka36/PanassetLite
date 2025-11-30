import React from 'react';
import { Sparkles, Trash2, X, ArrowUpRight } from 'lucide-react';
import { Language } from '../../types';

interface ChatHeaderProps {
    language: Language;
    onClearHistory: () => void;
    onClose: () => void;
    isResizing: boolean;
    isMobile: boolean;
    onResizeStart: (e: React.MouseEvent) => void;
}

export const ChatHeader: React.FC<ChatHeaderProps> = ({
    language,
    onClearHistory,
    onClose,
    isResizing,
    isMobile,
    onResizeStart
}) => {
    return (
        <div className={`p-4 bg-gradient-to-r from-indigo-600 to-blue-600 flex justify-between items-center shrink-0 text-white shadow-sm relative ${isResizing ? 'pointer-events-auto' : ''}`}>
            <div className="flex items-center gap-3">
                <div className="p-1.5 bg-white/20 rounded-lg">
                    <Sparkles size={18} className="text-white" />
                </div>
                <div>
                    <h3 className="font-bold text-sm">
                        {language === 'zh' ? "盘资产 智能助手" : "Panasset Assistant"}
                    </h3>
                    <p className="text-[10px] text-indigo-100 flex items-center gap-1 opacity-90">
                        <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse"></span>
                        {language === 'zh' ? "在线" : "Online"}
                    </p>
                </div>
            </div>
            <div className="flex items-center gap-1 pr-6 md:pr-0">
                <button onClick={onClearHistory} className="text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition-colors p-2" title={language === 'zh' ? "清除历史" : "Clear History"}>
                    <Trash2 size={18} />
                </button>
                <button onClick={onClose} className="text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition-colors p-2">
                    <X size={22} />
                </button>
            </div>

            {/* Resize Handle (Desktop Only) */}
            {!isMobile && (
                <div
                    className="absolute top-0 right-0 w-8 h-8 cursor-ne-resize flex items-center justify-center text-white/50 hover:text-white hover:bg-white/10 rounded-bl-xl transition-colors z-20"
                    onMouseDown={onResizeStart}
                    title="Resize"
                >
                    <ArrowUpRight size={16} />
                </div>
            )}
        </div>
    );
};
