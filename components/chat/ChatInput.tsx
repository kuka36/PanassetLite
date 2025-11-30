import React, { useRef, useEffect } from 'react';
import { Keyboard, AudioLines, ImageIcon, Send, X, Sparkles } from 'lucide-react';
import { VoiceInput } from '../ui/VoiceInput';
import { Language } from '../../types';

interface ChatInputProps {
    input: string;
    setInput: (val: string) => void;
    isTyping: boolean;
    isVoiceMode: boolean;
    setIsVoiceMode: (val: boolean) => void;
    selectedImage: string | null;
    setSelectedImage: (val: string | null) => void;
    handleSend: (textOverride?: string) => void;
    handleFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
    handlePaste: (e: React.ClipboardEvent) => void;
    language: Language;
    t: (key: string) => string;
    isResizing: boolean;
}

export const ChatInput: React.FC<ChatInputProps> = ({
    input,
    setInput,
    isTyping,
    isVoiceMode,
    setIsVoiceMode,
    selectedImage,
    setSelectedImage,
    handleSend,
    handleFileSelect,
    handlePaste,
    language,
    t,
    isResizing
}) => {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    // Auto resize textarea
    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            const newHeight = Math.min(textareaRef.current.scrollHeight, 120);
            textareaRef.current.style.height = `${Math.max(24, newHeight)}px`;
        }
    }, [input]);

    return (
        <div className={`p-3 bg-white border-t border-slate-200 flex items-end gap-2 shrink-0 pb-6 md:pb-3 transition-all duration-300 relative ${isResizing ? 'pointer-events-auto' : ''}`}>

            {/* Toggle Mode */}
            <button
                onClick={() => setIsVoiceMode(!isVoiceMode)}
                className="p-2.5 mb-0.5 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-full transition-colors shrink-0"
                title={isVoiceMode ? t('switchToKeyboard') : t('switchToVoice')}
            >
                {isVoiceMode ? <Keyboard size={24} /> : <AudioLines size={24} />}
            </button>

            {isVoiceMode ? (
                <div className="flex-1 animate-in fade-in duration-200 mb-0.5">
                    <VoiceInput
                        mode="CHAT"
                        variant="bar"
                        onTextResult={(text) => handleSend(text)}
                    />
                </div>
            ) : (
                <>
                    {/* Image Preview */}
                    {selectedImage && (
                        <div className="absolute bottom-full left-0 w-full p-2 bg-gradient-to-t from-white to-transparent">
                            <div className="relative inline-block">
                                <img src={selectedImage} alt="Preview" className="h-20 w-auto object-cover rounded-lg border border-slate-200 shadow-sm bg-white" />
                                <button
                                    onClick={() => setSelectedImage(null)}
                                    className="absolute -top-2 -right-2 bg-slate-800 text-white rounded-full p-0.5 hover:bg-slate-700 shadow-md border border-white"
                                >
                                    <X size={12} />
                                </button>
                            </div>
                        </div>
                    )}

                    <div className="flex-1 flex gap-2 items-end bg-slate-50 border border-slate-200 rounded-xl px-2 py-2 focus-within:ring-2 focus-within:ring-indigo-500 focus-within:bg-white transition-all">
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            className="p-1.5 mb-px text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors shrink-0 self-end"
                            title="Upload Image"
                        >
                            <ImageIcon size={20} />
                        </button>
                        <input
                            type="file"
                            ref={fileInputRef}
                            className="hidden"
                            accept="image/*"
                            onChange={handleFileSelect}
                        />

                        <textarea
                            ref={textareaRef}
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    if (!isTyping) handleSend();
                                }
                            }}
                            onPaste={handlePaste}
                            placeholder={language === 'zh' ? "输入消息..." : "Type a message..."}
                            disabled={isTyping}
                            rows={1}
                            className="flex-1 bg-transparent border-none p-1.5 text-sm focus:ring-0 resize-none max-h-32 outline-none disabled:opacity-50 overflow-y-auto"
                            style={{ minHeight: '24px', lineHeight: '1.5' }}
                        />
                    </div>

                    <button
                        onClick={() => handleSend()}
                        disabled={(!input.trim() && !selectedImage) || isTyping}
                        className="p-3 mb-0.5 bg-indigo-600 text-white rounded-xl shadow-md hover:bg-indigo-700 disabled:bg-slate-200 disabled:text-slate-400 transition-all active:scale-95 flex items-center justify-center shrink-0"
                    >
                        <Send size={20} />
                    </button>
                </>
            )}
        </div>
    );
};
