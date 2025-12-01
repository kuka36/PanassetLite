
import React, { useState, useEffect, useRef } from 'react';
import { useChat } from '../hooks/useChat';
import { usePortfolio } from '../context/PortfolioContext';
import { ChatHeader } from './chat/ChatHeader';
import { ChatInput } from './chat/ChatInput';
import { MessageList } from './chat/MessageList';

interface AIChatAssistantProps {
    isOpen: boolean;
    onClose: () => void;
}

export const AIChatAssistant: React.FC<AIChatAssistantProps> = ({ isOpen, onClose }) => {
    const { t } = usePortfolio();
    const {
        input,
        setInput,
        isTyping,
        messages,
        isVoiceMode,
        setIsVoiceMode,
        selectedImage,
        setSelectedImage,
        handleSend,
        handleFileSelect,
        handlePaste,
        handleConfirmAction,
        handleUpdatePendingAction,
        handleClearHistory,
        settings
    } = useChat(isOpen);

    const [isMobile, setIsMobile] = useState(false);
    const [isMaximized, setIsMaximized] = useState(false);
    const [chatWidth, setChatWidth] = useState(450);
    const [isResizing, setIsResizing] = useState(false);
    const resizeRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        setIsMobile(window.innerWidth < 768);
        const handleResize = () => {
            setIsMobile(window.innerWidth < 768);
            if (window.innerWidth < 768) {
                setIsMaximized(false);
            }
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (!isResizing) return;
            const newWidth = window.innerWidth - e.clientX;
            if (newWidth >= 320 && newWidth <= window.innerWidth * 0.8) {
                setChatWidth(newWidth);
            }
        };

        const handleMouseUp = () => {
            setIsResizing(false);
            document.body.style.cursor = 'default';
        };

        if (isResizing) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
            document.body.style.cursor = 'ew-resize';
        }

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isResizing]);

    const handleMouseDown = (e: React.MouseEvent) => {
        e.preventDefault();
        setIsResizing(true);
    };

    const toggleMaximize = () => {
        setIsMaximized(!isMaximized);
    };

    // Width calculation
    const getWidth = () => {
        if (isMobile || isMaximized) return '100%';
        return `${chatWidth}px`;
    };

    return (
        <>
            {/* Backdrop for mobile or to focus on chat */}
            <div
                className={`fixed inset-0 bg-slate-900/20 backdrop-blur-sm z-40 transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
                onClick={onClose}
            />

            <div
                onClick={(e) => e.stopPropagation()}
                className={`
                    fixed top-0 right-0 z-50 flex flex-col overflow-hidden bg-white shadow-2xl transition-all duration-300 ease-in-out
                    h-full border-l border-slate-200
                    ${isOpen ? 'translate-x-0' : 'translate-x-full'}
                    ${isResizing ? '!transition-none' : ''}
                `}
                style={{ width: getWidth() }}
            >
                {/* Resize handle */}
                {!isMobile && !isMaximized && (
                    <div
                        onMouseDown={handleMouseDown}
                        className="absolute left-0 top-0 w-1.5 h-full cursor-ew-resize hover:bg-indigo-500/30 transition-colors z-[60]"
                    />
                )}

                <ChatHeader
                    language={settings.language}
                    onClearHistory={handleClearHistory}
                    onClose={onClose}
                    isMobile={isMobile}
                    isMaximized={isMaximized}
                    onToggleMaximize={toggleMaximize}
                />

                <MessageList
                    messages={messages}
                    isTyping={isTyping}
                    language={settings.language}
                    onUpdatePendingAction={handleUpdatePendingAction}
                    onConfirmAction={handleConfirmAction}
                />

                <ChatInput
                    input={input}
                    setInput={setInput}
                    isTyping={isTyping}
                    isVoiceMode={isVoiceMode}
                    setIsVoiceMode={setIsVoiceMode}
                    selectedImage={selectedImage}
                    setSelectedImage={setSelectedImage}
                    handleSend={handleSend}
                    handleFileSelect={handleFileSelect}
                    handlePaste={handlePaste}
                    language={settings.language}
                    t={t}
                />
            </div>
        </>
    );
};