
import React, { useState, useEffect, useRef } from 'react';
import { useChat } from '../hooks/useChat';
import { usePortfolio } from '../context/PortfolioContext';
import { ChatHeader } from './chat/ChatHeader';
import { ChatInput } from './chat/ChatInput';
import { MessageList } from './chat/MessageList';

const DIMENSIONS_KEY = 'panasset_chat_dim';

interface AIChatAssistantProps {
    isOpen: boolean;
    onClose: () => void;
    isSidebarCollapsed?: boolean;
}

export const AIChatAssistant: React.FC<AIChatAssistantProps> = ({ isOpen, onClose, isSidebarCollapsed = false }) => {
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

    // Resizable State
    const [dimensions, setDimensions] = useState({ width: 400, height: 600 });
    const [isResizing, setIsResizing] = useState(false);
    const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
    const dimensionsRef = useRef(dimensions);

    // Sync dimensions ref
    useEffect(() => { dimensionsRef.current = dimensions; }, [dimensions]);

    // Load Dimensions & Mobile Check
    useEffect(() => {
        try {
            const savedDim = localStorage.getItem(DIMENSIONS_KEY);
            if (savedDim) setDimensions(JSON.parse(savedDim));
        } catch (e) { }

        const handleResize = () => setIsMobile(window.innerWidth < 768);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // --- Resize Logic ---
    const handleResizeStart = (e: React.MouseEvent) => {
        e.preventDefault();
        setIsResizing(true);
        const startX = e.clientX;
        const startY = e.clientY;
        const startW = dimensions.width;
        const startH = dimensions.height;

        const onMouseMove = (ev: MouseEvent) => {
            const deltaX = ev.clientX - startX;
            const deltaY = ev.clientY - startY;

            // Logic: Dragging Top-Right corner.
            // Moving Right (+X) increases Width.
            // Moving Up (-Y) increases Height (since it's anchored to bottom).

            const newW = Math.max(320, Math.min(1200, startW + deltaX));
            const newH = Math.max(400, Math.min(window.innerHeight - 50, startH - deltaY));

            setDimensions({ width: newW, height: newH });
        };

        const onMouseUp = () => {
            setIsResizing(false);
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('mouseup', onMouseUp);
            localStorage.setItem(DIMENSIONS_KEY, JSON.stringify(dimensionsRef.current));
        };

        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);
    };

    const desktopLeftClass = isSidebarCollapsed ? 'md:left-24' : 'md:left-72';
    const resizeStyle = !isMobile ? { width: dimensions.width, height: dimensions.height } : {};

    if (!isOpen) return null;

    return (
        <div
            onClick={(e) => e.stopPropagation()}
            className={`
        fixed z-50 flex flex-col overflow-hidden bg-white shadow-2xl transition-all duration-75
        inset-0 rounded-none 
        md:inset-auto md:bottom-4 md:right-auto md:rounded-2xl md:border md:border-slate-200 ${desktopLeftClass}
        animate-slide-up origin-bottom-left
        ${isResizing ? 'pointer-events-none select-none' : ''}
    `}
            style={resizeStyle}
        >
            <ChatHeader
                language={settings.language}
                onClearHistory={handleClearHistory}
                onClose={onClose}
                isResizing={isResizing}
                isMobile={isMobile}
                onResizeStart={handleResizeStart}
            />

            <MessageList
                messages={messages}
                isTyping={isTyping}
                language={settings.language}
                onUpdatePendingAction={handleUpdatePendingAction}
                onConfirmAction={handleConfirmAction}
                isResizing={isResizing}
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
                isResizing={isResizing}
            />
        </div>
    );
};