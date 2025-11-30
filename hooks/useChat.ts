import { useState, useEffect, useRef } from 'react';
import { usePortfolio } from '../context/PortfolioContext';
import { AgentService } from '../services/agentService';
import { ChatMessage, PendingAction, TransactionType, AssetType, Currency, BulkAssetItem } from '../types';
import { compressImage } from '../utils/imageCompression';

const HISTORY_KEY = 'panasset_chat_history';

export const useChat = (isOpen: boolean) => {
    const { settings, assets, transactions, addTransaction, editTransaction, deleteTransaction, addAsset, editAsset, deleteAsset } = usePortfolio();
    const [input, setInput] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [isVoiceMode, setIsVoiceMode] = useState(false);
    const [selectedImage, setSelectedImage] = useState<string | null>(null);

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
    }, [settings.language]);

    // Save History on Update
    useEffect(() => {
        if (messages.length > 0) {
            const validMessages = messages.filter(m => (m.content && m.content.trim() !== '') || m.image || m.pendingAction);
            localStorage.setItem(HISTORY_KEY, JSON.stringify(validMessages.slice(-50)));
        }
    }, [messages]);

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            try {
                const compressedDataUrl = await compressImage(file);
                setSelectedImage(compressedDataUrl);
            } catch (error) {
                console.error("Image compression failed", error);
                alert(settings.language === 'zh' ? "图片处理失败" : "Failed to process image");
            }
        }
        e.target.value = '';
    };

    const handlePaste = async (e: React.ClipboardEvent) => {
        const items = e.clipboardData.items;
        for (let i = 0; i < items.length; i++) {
            if (items[i].type.indexOf('image') !== -1) {
                e.preventDefault();
                const blob = items[i].getAsFile();
                if (blob) {
                    try {
                        const compressedDataUrl = await compressImage(blob);
                        setSelectedImage(compressedDataUrl);
                    } catch (error) {
                        console.error("Image compression failed", error);
                        alert(settings.language === 'zh' ? "图片处理失败" : "Failed to process image");
                    }
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

    const handleUpdatePendingAction = (msgId: string, newItems: BulkAssetItem[]) => {
        setMessages(prev => prev.map(m => {
            if (m.id === msgId && m.pendingAction) {
                return {
                    ...m,
                    pendingAction: {
                        ...m.pendingAction,
                        items: newItems
                    }
                };
            }
            return m;
        }));
    };

    const handleConfirmAction = (msgId: string, action: PendingAction) => {
        try {
            const { type, data, targetId, items } = action;

            if (type === 'BULK_ASSET_UPDATE' && items && items.length > 0) {
                items.forEach(item => {
                    const symbolUpper = item.symbol?.toUpperCase();
                    const nameUpper = item.name?.toUpperCase();

                    // Smart Matching Logic
                    let existing = assets.find(a => a.symbol === symbolUpper); // 1. Exact Symbol

                    if (!existing && nameUpper) {
                        existing = assets.find(a => a.name.toUpperCase() === nameUpper); // 2. Exact Name
                    }

                    if (!existing && symbolUpper && symbolUpper.length >= 3) {
                        existing = assets.find(a => a.symbol.includes(symbolUpper) || symbolUpper.includes(a.symbol)); // 3. Fuzzy Symbol
                    }

                    if (!existing && nameUpper && nameUpper.length >= 4) {
                        existing = assets.find(a => a.name.toUpperCase().includes(nameUpper) || nameUpper.includes(a.name.toUpperCase())); // 4. Fuzzy Name
                    }

                    if (existing) {
                        const newQty = Number(item.quantity);
                        const delta = newQty - existing.quantity;

                        // Update price if significantly different
                        const itemPrice = Number(item.price);
                        if (item.price && Math.abs(itemPrice - existing.currentPrice) > 0.00001) {
                            editAsset({ ...existing, currentPrice: itemPrice, lastUpdated: Date.now() });
                        }

                        // Create Balance Adjustment Transaction
                        if (Math.abs(delta) > 0.000001) {
                            addTransaction({
                                assetId: existing.id,
                                type: TransactionType.BALANCE_ADJUSTMENT,
                                date: new Date().toISOString(),
                                quantityChange: delta,
                                pricePerUnit: itemPrice || existing.currentPrice,
                                fee: 0,
                                total: delta * (itemPrice || existing.currentPrice),
                                note: 'AI Bulk Import Adjustment'
                            });
                        }
                    } else {
                        // Create New Asset
                        const meta = {
                            id: crypto.randomUUID(),
                            symbol: symbolUpper || 'UNKNOWN',
                            name: item.name || symbolUpper || 'Unknown Asset',
                            type: item.assetType as AssetType || AssetType.STOCK,
                            currentPrice: Number(item.price) || 0,
                            currency: (item.currency as Currency) || settings.baseCurrency,
                            lastUpdated: Date.now(),
                            dateAcquired: item.dateAcquired || new Date().toISOString()
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
                    dateAcquired: data.date || new Date().toISOString()
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
                        dateAcquired: new Date().toISOString()
                    };


                    addAsset(meta, 0, 0, meta.dateAcquired);
                }

                if (assetId) {
                    const qty = data.quantity || 0;
                    const isNegative = (data.type === TransactionType.SELL || data.type === TransactionType.WITHDRAWAL || data.type === TransactionType.REPAY);

                    addTransaction({
                        assetId: assetId,
                        type: data.type as TransactionType || TransactionType.BUY,
                        date: data.date || new Date().toISOString(),
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

            else if (type === 'BATCH_DELETE_ASSET' && items && items.length > 0) {
                items.forEach(item => {
                    if (item.id) {
                        deleteAsset(item.id);
                    }
                });
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
        setMessages([]);
        localStorage.removeItem(HISTORY_KEY);
    };

    return {
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
        settings // Export settings for UI components to use
    };
};
