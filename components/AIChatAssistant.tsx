

import React, { useState, useEffect, useRef } from 'react';
import { X, Send, Sparkles, Check, AlertCircle, Trash2, User, Keyboard, AudioLines, Image as ImageIcon, ListChecks, ArrowUpRight, CheckCircle2 } from 'lucide-react';
import { usePortfolio } from '../context/PortfolioContext';
import { AgentService } from '../services/agentService';
import { ChatMessage, PendingAction, TransactionType, AssetType, Currency } from '../types';
import ReactMarkdown from 'react-markdown';
import { VoiceInput } from './ui/VoiceInput';

const HISTORY_KEY = 'panasset_chat_history';
const DIMENSIONS_KEY = 'panasset_chat_dim';

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
  
  // Resizable State
  const [dimensions, setDimensions] = useState({ width: 400, height: 600 });
  const [isResizing, setIsResizing] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const dimensionsRef = useRef(dimensions);

  // Sync dimensions ref
  useEffect(() => { dimensionsRef.current = dimensions; }, [dimensions]);

  // Load History & Dimensions on Mount
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

    // Load Dimensions
    try {
        const savedDim = localStorage.getItem(DIMENSIONS_KEY);
        if (savedDim) setDimensions(JSON.parse(savedDim));
    } catch(e) {}

    // Mobile Check Listener
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Save History on Update
  useEffect(() => {
    if (messages.length > 0) {
      const validMessages = messages.filter(m => (m.content && m.content.trim() !== '') || m.image || m.pendingAction);
      localStorage.setItem(HISTORY_KEY, JSON.stringify(validMessages.slice(-50))); 
    }
  }, [messages]);

  // Auto Scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isOpen, isTyping, isVoiceMode, selectedImage]);

  // Auto resize textarea
  useEffect(() => {
    if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
        const newHeight = Math.min(textareaRef.current.scrollHeight, 120);
        textareaRef.current.style.height = `${Math.max(24, newHeight)}px`;
    }
  }, [input]);

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
    e.target.value = '';
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData.items;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        e.preventDefault();
        const blob = items[i].getAsFile();
        if (blob) {
            if (blob.size > 5 * 1024 * 1024) {
                 alert(settings.language === 'zh' ? "图片大小不能超过 5MB" : "Image size must be less than 5MB");
                 return;
            }
            const reader = new FileReader();
            reader.onload = (event) => {
              setSelectedImage(event.target?.result as string);
            };
            reader.readAsDataURL(blob);
        }
        return; 
      }
    }
  };

  const handleSend = async (textOverride?: string) => {
    const textToSend = typeof textOverride === 'string' ? textOverride : input;
    
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
    setSelectedImage(null); 
    setIsTyping(true);

    const agent = new AgentService(settings.geminiApiKey);
    
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
      const { type, data, targetId, items } = action;

      if (type === 'BULK_ASSET_UPDATE' && items && items.length > 0) {
          items.forEach(item => {
              const symbolUpper = item.symbol?.toUpperCase();
              if (!symbolUpper) return;

              const existing = assets.find(a => a.symbol === symbolUpper);
              
              if (existing) {
                  const newQty = Number(item.quantity);
                  const delta = newQty - existing.quantity;
                  
                  if (item.price && Math.abs(item.price - existing.currentPrice) > 0.00001) {
                      editAsset({ ...existing, currentPrice: Number(item.price), lastUpdated: Date.now() });
                  }

                  if (Math.abs(delta) > 0.000001) {
                       addTransaction({
                          assetId: existing.id,
                          type: TransactionType.BALANCE_ADJUSTMENT,
                          date: new Date().toISOString(),
                          quantityChange: delta,
                          pricePerUnit: item.price || existing.currentPrice, 
                          fee: 0,
                          total: delta * (item.price || existing.currentPrice),
                          note: 'AI Bulk Import Adjustment'
                       });
                  }
              } else {
                  const meta = {
                    id: crypto.randomUUID(),
                    symbol: symbolUpper,
                    name: item.name || symbolUpper,
                    type: item.assetType as AssetType || AssetType.STOCK,
                    currentPrice: Number(item.price) || 0,
                    currency: (item.currency as Currency) || settings.baseCurrency,
                    lastUpdated: Date.now(),
                    dateAcquired: new Date().toISOString().split('T')[0]
                  };
                  addAsset(meta, Number(item.quantity) || 0, Number(item.price) || 0, meta.dateAcquired);
              }
          });
      }

      else if (type === 'ADD_ASSET') {
          const meta = {
            id: crypto.randomUUID(),
            symbol: data.symbol || 'UNKNOWN',
            name: data.name || data.symbol || 'Unknown',
            type: data.type as AssetType || AssetType.STOCK,
            currentPrice: data.price || 0,
            currency: (data.currency as Currency) || settings.baseCurrency,
            lastUpdated: Date.now(),
            dateAcquired: new Date().toISOString().split('T')[0]
          };
          addAsset(meta, data.quantity || 0, data.price || 0, meta.dateAcquired);
      }
      else if (type === 'UPDATE_ASSET' && targetId) {
          const existing = assets.find(a => a.id === targetId);
          if (existing) {
              editAsset({
                  ...existing,
                  name: data.name ?? existing.name,
                  symbol: data.symbol ?? existing.symbol,
                  type: (data.type as AssetType) ?? existing.type,
                  currentPrice: data.price !== undefined ? data.price : existing.currentPrice,
                  currency: (data.currency as Currency) ?? existing.currency
              });

              if (data.quantity !== undefined && data.quantity !== null) {
                  const newQty = Number(data.quantity);
                  const currentQty = existing.quantity;
                  const delta = newQty - currentQty;
                  
                  if (Math.abs(delta) > 0.000001) {
                       addTransaction({
                          assetId: existing.id,
                          type: TransactionType.BALANCE_ADJUSTMENT,
                          date: new Date().toISOString(),
                          quantityChange: delta,
                          pricePerUnit: existing.currentPrice, 
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

      else if (type === 'ADD_TRANSACTION') {
        let assetId = data.assetId;
        
        if (!assetId && data.symbol) {
             assetId = crypto.randomUUID();
             const meta = {
                id: assetId,
                symbol: data.symbol,
                name: data.symbol,
                type: AssetType.STOCK, 
                currentPrice: data.price || 0,
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

      // Mark the action as executed but keep the data for display
      setMessages(prev => prev.map(m => 
        m.id === msgId ? { 
            ...m, 
            pendingAction: { ...m.pendingAction!, status: 'executed' } 
        } : m
      ));

    } catch (e) {
      console.error(e);
      alert(settings.language === 'zh' ? "执行操作失败。" : "Failed to execute action.");
    }
  };

  const handleClearHistory = () => {
      // Cleanest approach: just empty the array.
      setMessages([]);
      localStorage.removeItem(HISTORY_KEY);
  };

  const desktopLeftClass = isSidebarCollapsed ? 'md:left-24' : 'md:left-72';
  const resizeStyle = !isMobile ? { width: dimensions.width, height: dimensions.height } : {};

  const MarkdownContent = ({ content }: { content: string }) => {
     if (!content) return null;
     return (
        <div className="prose prose-sm max-w-none prose-p:leading-relaxed prose-pre:bg-slate-800 prose-pre:text-white prose-p:my-1 prose-ul:my-1 prose-li:my-0">
            <ReactMarkdown>{content}</ReactMarkdown>
        </div>
     );
  };

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
      
      {/* Header */}
      <div className={`p-4 bg-gradient-to-r from-indigo-600 to-blue-600 flex justify-between items-center shrink-0 text-white shadow-sm relative ${isResizing ? 'pointer-events-auto' : ''}`}>
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
        <div className="flex items-center gap-1 pr-6 md:pr-0">
            <button onClick={handleClearHistory} className="text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition-colors p-2" title={settings.language==='zh'?"清除历史":"Clear History"}>
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
                onMouseDown={handleResizeStart}
                title="Resize"
            >
                <ArrowUpRight size={16} />
            </div>
        )}
      </div>

      {/* Messages Area */}
      <div className={`flex-1 overflow-y-auto p-4 space-y-6 bg-slate-50 scroll-smooth ${isResizing ? 'pointer-events-auto' : ''}`}>
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
                <div className={`mt-2 p-3 rounded-xl animate-fade-in border ${
                    msg.pendingAction.status === 'executed' 
                    ? 'bg-slate-50 border-slate-200 opacity-80' 
                    : 'bg-indigo-50 border-indigo-100'
                }`}>
                    <div className="flex items-start gap-2 mb-2">
                        <div className={`${msg.pendingAction.status === 'executed' ? 'text-green-500' : 'text-indigo-600'} mt-0.5 shrink-0`}>
                           {msg.pendingAction.status === 'executed' ? <CheckCircle2 size={16} /> : (
                               msg.pendingAction.type === 'BULK_ASSET_UPDATE' ? <ListChecks size={16}/> : <AlertCircle size={16}/>
                           )}
                        </div>
                        <div className={`text-xs font-medium ${msg.pendingAction.status === 'executed' ? 'text-green-700' : 'text-indigo-800'}`}>
                            {settings.language === 'zh' 
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
                            <div className="bg-white/50 rounded-lg border border-indigo-100 overflow-hidden text-xs max-h-[200px] overflow-y-auto">
                                <table className="w-full text-left">
                                    <thead className="bg-indigo-50/50 text-indigo-600 font-medium">
                                        <tr>
                                            <th className="p-2">Symbol</th>
                                            <th className="p-2 text-right">Qty</th>
                                            <th className="p-2 text-right">Price</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-indigo-50">
                                        {msg.pendingAction.items.map((item, idx) => (
                                            <tr key={idx} className="hover:bg-white">
                                                <td className="p-2 font-medium text-slate-700">{item.symbol}</td>
                                                <td className="p-2 text-right text-slate-600">{item.quantity}</td>
                                                <td className="p-2 text-right text-slate-600">{item.price || '-'}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
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
                                onClick={() => handleConfirmAction(msg.id, msg.pendingAction!)}
                                className={`flex-1 text-white text-xs font-bold py-2 rounded-lg flex items-center justify-center gap-1 transition-colors shadow-sm ${
                                    msg.pendingAction.type.includes('DELETE') ? 'bg-red-500 hover:bg-red-600' : 'bg-indigo-600 hover:bg-indigo-700'
                                }`}
                            >
                                <Check size={14} /> {settings.language === 'zh' ? (msg.pendingAction.type === 'BULK_ASSET_UPDATE' ? "确认导入全部" : "执行") : "Confirm"}
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
                        placeholder={settings.language === 'zh' ? "输入消息..." : "Type a message..."}
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
    </div>
  );
};