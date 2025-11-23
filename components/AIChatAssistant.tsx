import React, { useState, useEffect, useRef } from 'react';
import { X, Send, Sparkles, Check, AlertCircle, Trash2, User, Keyboard, AudioLines } from 'lucide-react';
import { usePortfolio } from '../context/PortfolioContext';
import { AgentService } from '../services/agentService';
import { ChatMessage, PendingAction, TransactionType, AssetType } from '../types';
import ReactMarkdown from 'react-markdown';
import { VoiceInput } from './ui/VoiceInput';

const HISTORY_KEY = 'panasset_chat_history';

interface AIChatAssistantProps {
  isOpen: boolean;
  onClose: () => void;
  isSidebarCollapsed?: boolean;
}

export const AIChatAssistant: React.FC<AIChatAssistantProps> = ({ isOpen, onClose, isSidebarCollapsed = false }) => {
  const { settings, assets, addTransaction, addAsset, t } = usePortfolio();
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isVoiceMode, setIsVoiceMode] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load History on Mount
  useEffect(() => {
    const saved = localStorage.getItem(HISTORY_KEY);
    if (saved) {
      try {
        setMessages(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to load chat history", e);
      }
    } else {
      setMessages([{
        id: 'init',
        role: 'model',
        content: settings.language === 'zh' 
            ? "您好！我是您的资产助手。我可以帮您记录交易或分析持仓。试试说：“我以 150 的价格买入了 10 股苹果”。"
            : "Hi! I'm your PanassetLite assistant. I can help you track assets or analyze your portfolio. Try saying \"I bought 10 AAPL at 150\".",
        timestamp: Date.now()
      }]);
    }
  }, []);

  // Save History on Update
  useEffect(() => {
    if (messages.length > 0) {
      const validMessages = messages.filter(m => m.content && m.content.trim() !== '');
      localStorage.setItem(HISTORY_KEY, JSON.stringify(validMessages.slice(-50))); 
    }
  }, [messages]);

  // Auto Scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isOpen, isTyping, isVoiceMode]);

  const handleSend = async (textOverride?: string) => {
    const textToSend = typeof textOverride === 'string' ? textOverride : input;
    if (!textToSend?.trim()) return;

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: textToSend.trim(),
      timestamp: Date.now()
    };

    setMessages(prev => [...prev, userMsg]);
    if (typeof textOverride !== 'string') setInput('');
    setIsTyping(true);

    const agent = new AgentService(settings.geminiApiKey);
    
    const response = await agent.processMessage(
        userMsg.content, 
        messages, 
        assets, 
        settings.baseCurrency, 
        settings.language
    );

    const botMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'model',
      content: response.text || "", 
      timestamp: Date.now(),
      pendingAction: response.action
    };

    setIsTyping(false);
    setMessages(prev => [...prev, botMsg]);
  };

  const handleConfirmAction = (msgId: string, action: PendingAction) => {
    try {
      if (action.type === 'ADD_TRANSACTION') {
        const asset = assets.find(a => a.symbol === action.data.symbol);
        let assetId = asset?.id;
        
        if (!assetId) {
             assetId = crypto.randomUUID();
             addAsset({
                 id: assetId,
                 symbol: action.data.symbol,
                 name: action.data.symbol,
                 type: AssetType.STOCK, 
                 quantity: 0,
                 avgCost: 0,
                 currentPrice: action.data.price,
                 currency: settings.baseCurrency,
                 lastUpdated: Date.now()
             });
        }

        addTransaction({
          assetId: assetId,
          type: action.data.type as TransactionType,
          date: new Date().toISOString().split('T')[0],
          quantity: action.data.quantity,
          price: action.data.price,
          fee: 0,
          total: action.data.quantity * action.data.price
        });
      } else if (action.type === 'ADD_ASSET') {
          addAsset({
              id: crypto.randomUUID(),
              symbol: action.data.symbol,
              name: action.data.symbol,
              type: action.data.type as AssetType,
              quantity: action.data.quantity,
              avgCost: action.data.price,
              currentPrice: action.data.price,
              currency: settings.baseCurrency,
              lastUpdated: Date.now()
          });
      }

      setMessages(prev => prev.map(m => 
        m.id === msgId ? { ...m, content: m.content + (settings.language === 'zh' ? "\n\n✅ *操作已确认执行。*" : "\n\n✅ *Action Confirmed & Executed.*"), pendingAction: undefined } : m
      ));

    } catch (e) {
      console.error(e);
      alert(settings.language === 'zh' ? "执行操作失败。" : "Failed to execute action.");
    }
  };

  const handleClearHistory = () => {
      setMessages([{
        id: crypto.randomUUID(),
        role: 'model',
        content: settings.language === 'zh' ? "历史记录已清除。有什么可以帮您？" : "History cleared. How can I help you today?",
        timestamp: Date.now()
      }]);
      localStorage.removeItem(HISTORY_KEY);
  };

  if (!settings.isAiAssistantEnabled) return null;

  const desktopLeftClass = isSidebarCollapsed ? 'md:left-24' : 'md:left-72';

  const MarkdownContent = ({ content }: { content: string }) => (
     <div className="prose prose-sm max-w-none prose-p:leading-relaxed prose-pre:bg-slate-800 prose-pre:text-white prose-p:my-1 prose-ul:my-1 prose-li:my-0">
        <ReactMarkdown>{content}</ReactMarkdown>
     </div>
  );

  if (!isOpen) return null;

  return (
    <div 
        onClick={(e) => e.stopPropagation()} 
        className={`
        fixed z-50 flex flex-col overflow-hidden bg-white shadow-2xl transition-all duration-300
        inset-0 rounded-none 
        md:inset-auto md:bottom-4 md:right-auto md:w-[400px] md:h-[600px] md:max-h-[80vh] md:rounded-2xl md:border md:border-slate-200 ${desktopLeftClass}
        animate-slide-up origin-bottom-left
    `}>
      
      {/* Header */}
      <div className="p-4 bg-gradient-to-r from-indigo-600 to-blue-600 flex justify-between items-center shrink-0 text-white shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-1.5 bg-white/20 rounded-lg">
            <Sparkles size={18} className="text-white" />
          </div>
          <div>
            <h3 className="font-bold text-sm">
                {settings.language === 'zh' ? "Panasset 智能助手" : "Panasset Assistant"}
            </h3>
            <p className="text-[10px] text-indigo-100 flex items-center gap-1 opacity-90">
               <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse"></span>
               {settings.language === 'zh' ? "在线" : "Online"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
            <button onClick={handleClearHistory} className="text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition-colors p-2" title={settings.language==='zh'?"清除历史":"Clear History"}>
                <Trash2 size={18} />
            </button>
            <button onClick={onClose} className="text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition-colors p-2">
                <X size={22} />
            </button>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6 bg-slate-50 scroll-smooth">
        {messages.map((msg) => (
          <div key={msg.id} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 shadow-sm ${
                msg.role === 'user' ? 'bg-slate-200 text-slate-500' : 'bg-indigo-100 text-indigo-600'
            }`}>
                {msg.role === 'user' ? <User size={16} /> : <Sparkles size={16} />}
            </div>

            <div className={`max-w-[85%] rounded-2xl p-3.5 text-sm shadow-sm ${
              msg.role === 'user' 
                ? 'bg-slate-200 text-slate-800 rounded-tr-none' 
                : 'bg-white text-slate-700 border border-slate-200 rounded-tl-none'
            }`}>
              <MarkdownContent content={msg.content} />

              {msg.pendingAction && (
                <div className="mt-3 p-3 bg-indigo-50 border border-indigo-100 rounded-xl">
                    <div className="flex items-start gap-2 mb-2">
                        <AlertCircle size={16} className="text-indigo-600 mt-0.5 shrink-0"/>
                        <div className="text-xs text-indigo-800 font-medium">
                            {settings.language === 'zh' ? "需确认操作" : "Action Required"}
                        </div>
                    </div>
                    <div className="text-sm font-bold text-slate-800 mb-3 pl-6">
                        {msg.pendingAction.summary}
                    </div>
                    <div className="flex gap-2 pl-6">
                        <button 
                            onClick={() => handleConfirmAction(msg.id, msg.pendingAction!)}
                            className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold py-2 rounded-lg flex items-center justify-center gap-1 transition-colors shadow-sm"
                        >
                            <Check size={14} /> {settings.language === 'zh' ? "确认" : "Confirm"}
                        </button>
                    </div>
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

      <div className="p-3 bg-white border-t border-slate-200 flex items-center gap-2 shrink-0 pb-6 md:pb-3 transition-all duration-300">
        
        {/* Toggle Mode */}
        <button 
            onClick={() => setIsVoiceMode(!isVoiceMode)}
            className="p-2.5 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-full transition-colors shrink-0"
            title={isVoiceMode ? t('switchToKeyboard') : t('switchToVoice')}
        >
            {isVoiceMode ? <Keyboard size={24} /> : <AudioLines size={24} />}
        </button>

        {isVoiceMode ? (
            <div className="flex-1 animate-in fade-in duration-200">
                <VoiceInput 
                    mode="CHAT" 
                    variant="bar"
                    onTextResult={(text) => handleSend(text)} 
                />
            </div>
        ) : (
            <>
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && !isTyping && handleSend()}
                  placeholder={settings.language === 'zh' ? "输入消息..." : "Type a message..."}
                  disabled={isTyping} 
                  autoFocus
                  className="flex-1 bg-slate-50 border border-slate-200 text-slate-800 text-sm rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50 transition-all animate-in fade-in duration-200"
                />
                <button 
                    onClick={() => handleSend()}
                    disabled={!input.trim() || isTyping}
                    className="p-3 bg-indigo-600 text-white rounded-xl shadow-md hover:bg-indigo-700 disabled:bg-slate-200 disabled:text-slate-400 transition-all active:scale-95 flex items-center justify-center shrink-0"
                >
                    <Send size={20} />
                </button>
            </>
        )}
      </div>
    </div>
  );
};