
import React, { useState, useEffect, useRef } from 'react';
import { X, Send, Bot, Sparkles, Check, AlertCircle, Trash2 } from 'lucide-react';
import { usePortfolio } from '../context/PortfolioContext';
import { AgentService } from '../services/agentService';
import { ChatMessage, PendingAction, TransactionType, AssetType } from '../types';
import { Link } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';

const HISTORY_KEY = 'panasset_chat_history';

export const AIChatAssistant: React.FC = () => {
  const { settings, assets, addTransaction, addAsset, t } = usePortfolio();
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
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
      // Initial Greeting based on language
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
      // Clean history before saving: ensure no message has empty/undefined content
      const validMessages = messages.filter(m => m.content && m.content.trim() !== '');
      localStorage.setItem(HISTORY_KEY, JSON.stringify(validMessages.slice(-50))); 
    }
  }, [messages]);

  // Auto Scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isOpen, isTyping]);

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: input.trim(),
      timestamp: Date.now()
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsTyping(true);

    const agent = new AgentService(settings.geminiApiKey);
    
    // Pass current language setting
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
      content: response.text || "", // Ensure string
      timestamp: Date.now(),
      pendingAction: response.action
    };

    setIsTyping(false);
    setMessages(prev => [...prev, botMsg]);
  };

  const handleConfirmAction = (msgId: string, action: PendingAction) => {
    try {
      if (action.type === 'ADD_TRANSACTION') {
        // Find asset ID by symbol
        const asset = assets.find(a => a.symbol === action.data.symbol);
        let assetId = asset?.id;
        
        // If asset doesn't exist, create it implicitly
        if (!assetId) {
             assetId = crypto.randomUUID();
             addAsset({
                 id: assetId,
                 symbol: action.data.symbol,
                 name: action.data.symbol,
                 type: AssetType.STOCK, // Default assumption if just adding tx
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

      // Update message to remove the action button (mark as done)
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

  // Styled Markdown Wrapper to fix styling issues
  const MarkdownContent = ({ content }: { content: string }) => (
     <div className="prose prose-sm max-w-none prose-p:leading-relaxed prose-pre:bg-slate-800 prose-pre:text-white prose-p:my-1 prose-ul:my-1 prose-li:my-0">
        <ReactMarkdown>{content}</ReactMarkdown>
     </div>
  );

  return (
    <>
      {/* Floating Action Button (FAB) - Always Visible */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`fixed bottom-6 right-6 z-50 p-4 rounded-full shadow-2xl transition-all duration-300 flex items-center justify-center hover:scale-110 ${
          isOpen ? 'bg-slate-800 rotate-90' : 'bg-gradient-to-r from-blue-600 to-indigo-600'
        }`}
        title="AI Assistant"
      >
        {isOpen ? <X className="text-white" size={28} /> : <Bot className="text-white" size={28} />}
        {!settings.geminiApiKey && !isOpen && (
             <span className="absolute -top-1 -right-1 w-4 h-4 bg-amber-500 rounded-full border-2 border-white"></span>
        )}
      </button>

      {/* Chat Window */}
      {isOpen && (
        <div className="fixed bottom-24 right-4 sm:right-6 w-[90vw] sm:w-[400px] h-[550px] max-h-[75vh] bg-white/95 backdrop-blur-md rounded-3xl shadow-2xl border border-slate-100 flex flex-col overflow-hidden z-50 animate-slide-up origin-bottom-right">
          
          {/* Header */}
          <div className="p-4 bg-gradient-to-r from-slate-50 to-white border-b border-slate-100 flex justify-between items-center shrink-0">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-indigo-100 text-indigo-600 rounded-lg">
                <Sparkles size={18} />
              </div>
              <div>
                <h3 className="font-bold text-slate-800">Panasset Assistant</h3>
                <p className="text-xs text-slate-500 flex items-center gap-1">
                   {settings.geminiApiKey ? <span className="w-1.5 h-1.5 bg-green-500 rounded-full"></span> : <span className="w-1.5 h-1.5 bg-amber-500 rounded-full"></span>}
                   {settings.geminiApiKey ? (settings.language==='zh'?"在线":"Online") : (settings.language==='zh'?"缺少 API Key":"API Key Missing")}
                </p>
              </div>
            </div>
            <button onClick={handleClearHistory} className="text-slate-400 hover:text-red-500 transition-colors p-1" title={settings.language==='zh'?"清除历史":"Clear History"}>
                <Trash2 size={16} />
            </button>
          </div>

          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/50">
            {messages.map((msg) => (
              <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] rounded-2xl p-3 text-sm shadow-sm ${
                  msg.role === 'user' 
                    ? 'bg-blue-600 text-white rounded-tr-none' 
                    : 'bg-white text-slate-700 border border-slate-100 rounded-tl-none'
                }`}>
                  <MarkdownContent content={msg.content} />

                  {/* Pending Action Card */}
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
                                className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold py-2 rounded-lg flex items-center justify-center gap-1 transition-colors"
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
                <div className="flex justify-start">
                    <div className="bg-white border border-slate-100 rounded-2xl rounded-tl-none p-3 shadow-sm flex items-center gap-1">
                        <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce"></span>
                        <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce delay-100"></span>
                        <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce delay-200"></span>
                    </div>
                </div>
            )}
            
            <div ref={messagesEndRef} />
          </div>

          {/* Fallback Alert if no Key */}
          {!settings.geminiApiKey && (
             <div className="px-4 py-3 bg-amber-50 border-t border-amber-100 text-xs text-amber-700 flex justify-between items-center shrink-0">
                 <span>{settings.language === 'zh' ? "配置 API Key 以使用 AI 功能" : "Setup Gemini API Key for AI features."}</span>
                 <Link to="/settings" onClick={() => setIsOpen(false)} className="font-bold underline hover:text-amber-800">Settings</Link>
             </div>
          )}

          {/* Input Area */}
          <div className="p-3 bg-white border-t border-slate-100 flex items-center gap-2 shrink-0">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !isTyping && handleSend()}
              placeholder={settings.geminiApiKey ? (settings.language==='zh'?"输入消息...":"Type a message...") : (settings.language==='zh'?"请先设置 Key...":"Setup Key first...")}
              disabled={isTyping} 
              className="flex-1 bg-slate-50 border border-slate-200 text-slate-800 text-sm rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
            />
            <button 
                onClick={handleSend}
                disabled={!input.trim() || isTyping}
                className="p-3 bg-blue-600 text-white rounded-xl shadow-md hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-400 transition-all active:scale-95 flex items-center justify-center"
            >
                <Send size={20} />
            </button>
          </div>
        </div>
      )}
    </>
  );
};
