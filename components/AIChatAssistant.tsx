






import React, { useState, useEffect, useRef } from 'react';
import { X, Send, Sparkles, Check, AlertCircle, Trash2, User, Keyboard, AudioLines, Image as ImageIcon } from 'lucide-react';
import { usePortfolio } from '../context/PortfolioContext';
import { AgentService } from '../services/agentService';
import { ChatMessage, PendingAction, TransactionType, AssetType, Currency } from '../types';
import ReactMarkdown from 'react-markdown';
import { VoiceInput } from './ui/VoiceInput';

const HISTORY_KEY = 'panasset_chat_history';

interface AIChatAssistantProps {
  isOpen: boolean;
  onClose: () => void;
  isSidebarCollapsed?: boolean;
}

export const AIChatAssistant: React.FC<AIChatAssistantProps> = ({ isOpen, onClose, isSidebarCollapsed = false }) => {
  const { settings, assets, transactions, addTransaction, editTransaction, deleteTransaction, addAsset, editAsset, deleteAsset, t } = usePortfolio();
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isVoiceMode, setIsVoiceMode] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
            ? "您好！我是您的全能资产助手。您可以发送截图让我识别资产信息，或直接说：“把昨天的苹果买入交易改成 20 股”。"
            : "Hi! I'm your PanassetLite assistant. You can upload screenshots for me to analyze, or say \"Update yesterday's AAPL buy to 20 shares\".",
        timestamp: Date.now()
      }]);
    }
  }, []);

  // Save History on Update
  useEffect(() => {
    if (messages.length > 0) {
      const validMessages = messages.filter(m => (m.content && m.content.trim() !== '') || m.image);
      localStorage.setItem(HISTORY_KEY, JSON.stringify(validMessages.slice(-50))); 
    }
  }, [messages]);

  // Auto Scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isOpen, isTyping, isVoiceMode, selectedImage]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
        const file = e.target.files[0];
        if (file.size > 5 * 1024 * 1024) {
            alert(settings.language === 'zh' ? "图片大小不能超过 5MB" : "Image size must be less than 5MB");
            return;
        }
        const reader = new FileReader();
        reader.onload = (ev) => {
            setSelectedImage(ev.target?.result as string);
        };
        reader.readAsDataURL(file);
    }
    // Reset input so same file can be selected again
    e.target.value = '';
  };

  const handleSend = async (textOverride?: string) => {
    const textToSend = typeof textOverride === 'string' ? textOverride : input;
    
    // Only return if both text and image are missing
    if (!textToSend?.trim() && !selectedImage) return;

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: textToSend.trim(),
      timestamp: Date.now(),
      image: selectedImage || undefined
    };

    setMessages(prev => [...prev, userMsg]);
    if (typeof textOverride !== 'string') setInput('');
    const imageToSend = selectedImage;
    setSelectedImage(null); // Clear image immediately
    setIsTyping(true);

    const agent = new AgentService(settings.geminiApiKey);
    
    // Injected 'transactions' dependency
    const response = await agent.processMessage(
        userMsg.content, 
        messages, 
        assets, 
        transactions,
        settings.baseCurrency, 
        settings.language,
        imageToSend || undefined
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
      const { type, data, targetId } = action;

      // --- ASSET CRUD ---
      if (type === 'ADD_ASSET') {
          const meta = {
            id: crypto.randomUUID(),
            symbol: data.symbol || 'UNKNOWN',
            name: data.name || data.symbol || 'Unknown',
            type: data.type as AssetType || AssetType.STOCK,
            currentPrice: data.price || 0,
            // Priority: Agent provided currency > Base Currency
            currency: (data.currency as Currency) || settings.baseCurrency,
            lastUpdated: Date.now(),
            dateAcquired: new Date().toISOString().split('T')[0]
          };
          addAsset(meta, data.quantity || 0, data.price || 0, meta.dateAcquired);
      }
      else if (type === 'UPDATE_ASSET' && targetId) {
          const existing = assets.find(a => a.id === targetId);
          if (existing) {
              // 1. Update Metadata (Name, Symbol, Type, Current Price)
              editAsset({
                  ...existing,
                  name: data.name ?? existing.name,
                  symbol: data.symbol ?? existing.symbol,
                  type: (data.type as AssetType) ?? existing.type,
                  currentPrice: data.price !== undefined ? data.price : existing.currentPrice,
                  currency: (data.currency as Currency) ?? existing.currency
              });

              // 2. Handle Quantity Update via Balance Adjustment
              // Because we use Event Sourcing, we cannot just set 'quantity'. 
              // We must create a transaction that bridges the gap.
              if (data.quantity !== undefined && data.quantity !== null) {
                  const newQty = Number(data.quantity);
                  const currentQty = existing.quantity;
                  const delta = newQty - currentQty;
                  
                  // Only add transaction if there is a meaningful difference
                  if (Math.abs(delta) > 0.000001) {
                       addTransaction({
                          assetId: existing.id,
                          type: TransactionType.BALANCE_ADJUSTMENT,
                          date: new Date().toISOString(),
                          quantityChange: delta,
                          pricePerUnit: existing.currentPrice, // Keep valuation consistent
                          fee: 0,
                          total: delta * existing.currentPrice,
                          note: 'AI Assistant Balance Correction'
                       });
                  }
              }
          }
      }
      else if (type === 'DELETE_ASSET' && targetId) {
          deleteAsset(targetId);
      }

      // --- TRANSACTION CRUD ---
      else if (type === 'ADD_TRANSACTION') {
        let assetId = data.assetId;
        
        // Auto-create asset if missing (and logic provided symbol, unlikely from strict Agent but good fallback)
        if (!assetId && data.symbol) {
             assetId = crypto.randomUUID();
             const meta = {
                id: assetId,
                symbol: data.symbol,
                name: data.symbol,
                type: AssetType.STOCK, 
                currentPrice: data.price || 0,
                // If Agent provides currency for new asset, use it, else default
                currency: (data.currency as Currency) || settings.baseCurrency,
                lastUpdated: Date.now(),
                dateAcquired: new Date().toISOString().split('T')[0]
             };
             addAsset(meta, 0, 0, meta.dateAcquired);
        }

        if (assetId) {
            const qty = data.quantity || 0;
            const isNegative = (data.type === TransactionType.SELL || data.type === TransactionType.WITHDRAWAL || data.type === TransactionType.REPAY);
            
            addTransaction({
              assetId: assetId,
              type: data.type as TransactionType || TransactionType.BUY,
              date: data.date || new Date().toISOString().split('T')[0],
              quantityChange: isNegative ? -Math.abs(qty) : Math.abs(qty),
              pricePerUnit: data.price || 0,
              fee: data.fee || 0,
              total: (qty * (data.price || 0)) + (data.fee || 0)
            });
        }
      }
      else if (type === 'UPDATE_TRANSACTION' && targetId) {
          const existing = transactions.find(t => t.id === targetId);
          if (existing) {
              const newQty = data.quantity !== undefined ? data.quantity : Math.abs(existing.quantityChange);
              const newPrice = data.price ?? existing.pricePerUnit;
              const newFee = data.fee ?? existing.fee;
              const newType = (data.type as TransactionType) ?? existing.type;
              
              const isNegative = (newType === TransactionType.SELL || newType === TransactionType.WITHDRAWAL || newType === TransactionType.REPAY);
              
              editTransaction({
                  ...existing,
                  quantityChange: isNegative ? -Math.abs(newQty) : Math.abs(newQty),
                  pricePerUnit: newPrice,
                  date: data.date ?? existing.date,
                  type: newType,
                  fee: newFee,
                  total: (newQty * newPrice) + newFee
              });
          }
      }
      else if (type === 'DELETE_TRANSACTION' && targetId) {
          deleteTransaction(targetId);
      }

      setMessages(prev => prev.map(m => 
        m.id === msgId ? { ...m, content: m.content + (settings.language === 'zh' ? "\n\n✅ *操作已执行。*" : "\n\n✅ *Executed.*"), pendingAction: undefined } : m
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
        content: settings.language === 'zh' ? "历史记录已清除。" : "History cleared.",
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
                {settings.language === 'zh' ? "盘资产 智能助手" : "Panasset Assistant"}
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
              {msg.image && (
                 <div className="mb-2">
                    <img src={msg.image} alt="Upload" className="max-w-full max-h-[200px] rounded-lg border border-slate-300/50" />
                 </div>
              )}
              <MarkdownContent content={msg.content} />

              {msg.pendingAction && (
                <div className="mt-3 p-3 bg-indigo-50 border border-indigo-100 rounded-xl animate-fade-in">
                    <div className="flex items-start gap-2 mb-2">
                        <AlertCircle size={16} className="text-indigo-600 mt-0.5 shrink-0"/>
                        <div className="text-xs text-indigo-800 font-medium">
                            {settings.language === 'zh' ? "需确认操作" : "Action Required"}
                        </div>
                    </div>
                    <div className="text-sm font-bold text-slate-800 mb-3 pl-6">
                        {msg.pendingAction.summary}
                    </div>

                    {/* Data Details View */}
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

                    <div className="flex gap-2 pl-6">
                        <button 
                            onClick={() => handleConfirmAction(msg.id, msg.pendingAction!)}
                            className={`flex-1 text-white text-xs font-bold py-2 rounded-lg flex items-center justify-center gap-1 transition-colors shadow-sm ${
                                msg.pendingAction.type.includes('DELETE') ? 'bg-red-500 hover:bg-red-600' : 'bg-indigo-600 hover:bg-indigo-700'
                            }`}
                        >
                            <Check size={14} /> {settings.language === 'zh' ? "执行" : "Confirm"}
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

      <div className="p-3 bg-white border-t border-slate-200 flex items-end gap-2 shrink-0 pb-6 md:pb-3 transition-all duration-300 relative">
        
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
                        className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors shrink-0"
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
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                if (!isTyping) handleSend();
                            }
                        }}
                        placeholder={settings.language === 'zh' ? "输入消息..." : "Type a message..."}
                        disabled={isTyping} 
                        rows={1}
                        className="flex-1 bg-transparent border-none p-1.5 text-sm focus:ring-0 resize-none max-h-24 outline-none disabled:opacity-50"
                        style={{ minHeight: '36px' }}
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
    </div>
  );
};