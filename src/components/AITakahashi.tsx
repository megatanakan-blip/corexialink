import React, { useState, useEffect, useRef } from 'react';
import { X, Send, Loader2, ShoppingCart, ExternalLink, Globe, CheckCircle, PackageCheck, Check, Camera } from 'lucide-react';
import type { MaterialItem } from '../types';
import * as gemini from '../services/geminiService';

export interface Source {
    uri: string;
    title: string;
}

export interface PendingAction {
    type: string;
    payload: any;
    executed: boolean;
}

export type MessagePart =
    | { text: string; inlineData?: never }
    | { inlineData: { mimeType: string; data: string }; text?: never };

export interface Message {
    id: string;
    role: 'user' | 'model';
    parts: MessagePart[];
    sources?: Source[];
    pendingActions?: PendingAction[];
    options?: string[];
    imagePreview?: string;
}

interface AITakahashiProps {
    masterItems: MaterialItem[];
    onAddToCart: (items: any[], silent?: boolean) => void;
    currentScreen?: string;
    messages: Message[];
    setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
}

export const AITakahashi: React.FC<AITakahashiProps> = ({ masterItems, onAddToCart, currentScreen = 'LINK_LITE', messages, setMessages }) => {
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [selectedImage, setSelectedImage] = useState<{ file: File, base64: string } | null>(null);

    const scrollRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }, [messages, isLoading]);

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = () => {
            const base64 = (reader.result as string).split(',')[1];
            setSelectedImage({ file, base64 });
        };
        reader.readAsDataURL(file);
    };

    const handleExecuteAction = (msgIdx: number, actionIdx: number) => {
        const newMessages = [...messages];
        const msg = newMessages[msgIdx];
        if (!msg.pendingActions) return;

        const action = msg.pendingActions[actionIdx];
        if (action.executed) return;

        if (action.type === 'ADD_CART') {
            onAddToCart(Array.isArray(action.payload) ? action.payload : [action.payload]);
        }

        action.executed = true;
        setMessages(newMessages);
    };

    const handleSend = async (textOverride?: string) => {
        const finalInput = textOverride || input;
        if (!finalInput.trim() && !selectedImage && !isLoading) return;

        const userParts: MessagePart[] = [];
        if (finalInput.trim()) userParts.push({ text: finalInput });
        if (selectedImage) {
            userParts.push({
                inlineData: {
                    mimeType: selectedImage.file.type || 'image/jpeg',
                    data: selectedImage.base64
                }
            });
        }

        const userMsg: Message = {
            id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            role: 'user',
            parts: userParts,
            imagePreview: selectedImage ? `data:${selectedImage.file.type};base64,${selectedImage.base64}` : undefined
        };

        setMessages(prev => [...prev, userMsg]);
        setInput('');
        setSelectedImage(null);
        setIsLoading(true);

        try {
            const chatHistory = messages.map(m => ({
                role: m.role,
                parts: m.parts.map(p => {
                    if (p.text) return { text: p.text };
                    if (p.inlineData) return { inlineData: p.inlineData };
                    return { text: "" };
                })
            }));
            chatHistory.push({
                role: userMsg.role,
                parts: userMsg.parts
            });

            const response = await gemini.chatWithTakahashi(chatHistory, masterItems, currentScreen);
            let fullText = response.text || "";

            const sources: Source[] = [];
            const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
            if (chunks) {
                chunks.forEach((chunk: any) => {
                    if (chunk.web && chunk.web.uri) {
                        sources.push({ uri: chunk.web.uri, title: chunk.web.title || "参考サイト" });
                    }
                });
            }

            const actionRegex = /<<<ACTION\|(\w+)\|([\s\S]+?)>>>/g;
            let match;
            const pendingActions: PendingAction[] = [];

            while ((match = actionRegex.exec(fullText)) !== null) {
                const type = match[1];
                try {
                    const payload = JSON.parse(match[2]);
                    pendingActions.push({ type, payload, executed: false });
                } catch (e) {
                    console.error("Action parse error:", e, "Content:", match[2]);
                }
            }

            const displayableText = fullText.replace(/<<<ACTION\|[\s\S]+?>>>/g, '').replace(/\[\[OPTIONS:[\s\S]+?\]\]/g, '').trim();

            setMessages(prev => [...prev, {
                id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                role: 'model',
                parts: [{ text: displayableText || "あ、高橋です。なんのせ、僕にお任せください。" }],
                sources: sources.length > 0 ? sources : undefined,
                pendingActions: pendingActions.length > 0 ? pendingActions : undefined
            }]);

            // Auto-execute ADD_CART actions
            if (pendingActions.length > 0) {
                setTimeout(() => {
                    // 1. Filter out only the actions we want to auto-execute
                    const targetActions = pendingActions.filter(a => a.type === 'ADD_CART' && !a.executed);

                    if (targetActions.length > 0) {
                        try {
                            // 2. Perform the side-effect (updating parent cart state) OUTSIDE of any state setter
                            targetActions.forEach(action => {
                                const itemsArray = Array.isArray(action.payload) ? action.payload : [action.payload];
                                onAddToCart(itemsArray, true); // silent = true
                            });

                            // 3. Mark the actions as executed in our UI state
                            setMessages(currentMsgs => {
                                if (currentMsgs.length === 0) return currentMsgs;
                                const newMsgs = [...currentMsgs];
                                const lastIndex = newMsgs.length - 1;
                                const lastMsg = { ...newMsgs[lastIndex] };

                                if (lastMsg.role === 'model' && lastMsg.pendingActions) {
                                    lastMsg.pendingActions = lastMsg.pendingActions.map(a =>
                                        a.type === 'ADD_CART' ? { ...a, executed: true } : a
                                    );
                                    newMsgs[lastIndex] = lastMsg;
                                    return newMsgs;
                                }
                                return currentMsgs;
                            });
                        } catch (err) {
                            console.error("Auto-execute error:", err);
                        }
                    }
                }, 100);
            }

        } catch (err: any) {
            console.error("AI Takahashi Error:", err);
            let errorText = "あ、高橋です。なんのせ少し考えがまとまらなかった。";

            // Debug info
            let debugInfo = "";
            if (err instanceof Error) {
                debugInfo = `\n(Error: ${err.message})`;
                if (err.message.includes("400")) debugInfo += " - Request Invalid";
                if (err.message.includes("403")) debugInfo += " - API Key/Quota Issue";
                if (err.message.includes("404")) debugInfo += " - Model Not Found";
                if (err.message.includes("Failed to fetch")) debugInfo += " - Network/CORS";
            } else {
                debugInfo = `\n(Error: ${String(err)})`;
            }

            // Check Key presence
            const currentKey = (import.meta as any).env?.VITE_GEMINI_API_KEY;
            const keyStatus = currentKey ? `Key: ${currentKey.slice(0, 4)}...${currentKey.slice(-4)}` : "Key: UNDEFINED";

            errorText += `\n\n【デバッグ情報 [v3-Stable]】\n${debugInfo}\n${keyStatus}`;

            setMessages(prev => [...prev, {
                id: `msg-error-${Date.now()}`,
                role: 'model',
                parts: [{ text: errorText }]
            }]);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="flex flex-col h-full bg-slate-50 relative notranslate" translate="no">
            {/* Chat Area */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 pb-24">
                {messages.map((m) => (
                    <div key={m.id} className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'}`}>
                        <div className={`max-w-[85%] p-3 rounded-2xl text-sm leading-relaxed shadow-sm ${m.role === 'user' ? 'bg-brand-green text-white rounded-tr-none' : 'bg-white text-slate-800 border border-slate-100 rounded-tl-none'}`}>
                            {m.imagePreview && (
                                <div className="mb-2 rounded-lg overflow-hidden border border-white/20">
                                    <img src={m.imagePreview} alt="User Upload" className="w-full h-auto max-h-48 object-cover" />
                                </div>
                            )}

                            {m.parts && m.parts.map((part, pIdx) => (
                                <div key={pIdx}>
                                    {part && part.text && part.text.split('\n').map((line, idx) => <p key={idx} className="min-h-[1em]">{line}</p>)}
                                </div>
                            ))}

                            {m.pendingActions && m.pendingActions.map((action, actionIdx) => (
                                <div key={actionIdx} className={`mt-3 overflow-hidden rounded-xl border transition-all ${action.executed ? 'border-emerald-100 bg-emerald-50 text-emerald-800' : 'border-blue-100 bg-blue-50/50 text-blue-800'}`}>
                                    <div className={`px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest flex items-center gap-2 ${action.executed ? 'bg-emerald-100' : 'bg-blue-100 text-blue-600'}`}>
                                        {action.executed ? <CheckCircle size={12} /> : <ShoppingCart size={12} />}
                                        {action.type === 'ADD_CART' ? 'カート追加' : 'アクション'}
                                    </div>
                                    <div className="p-3">
                                        {action.type === 'ADD_CART' && (
                                            <div className="space-y-1 mb-3">
                                                {(Array.isArray(action.payload) ? action.payload : [action.payload]).map((item: any, i: number) => (
                                                    <div key={i} className="flex justify-between items-center text-xs font-mono bg-white p-1.5 rounded border border-slate-100">
                                                        <span className="truncate flex-1 font-bold">{item?.name || '不明な商品'}</span>
                                                        <span className="font-black ml-2 bg-slate-100 px-1 rounded">{item?.quantity || 0}個</span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}

                                        {action.executed ? (
                                            <div className="flex items-center gap-2 text-emerald-600 font-bold text-xs">
                                                <Check size={14} /> カートに追加しました
                                            </div>
                                        ) : (
                                            <button
                                                onClick={() => handleExecuteAction(messages.indexOf(m), actionIdx)}
                                                className="w-full py-2 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700 transition-all flex items-center justify-center gap-2 shadow-sm active:scale-95"
                                            >
                                                <PackageCheck size={14} /> カートに入れる
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))}

                            {m.sources && m.sources.length > 0 && (
                                <div className="mt-3 pt-2 border-t border-slate-100 space-y-1">
                                    <p className="text-[10px] text-slate-400 font-bold flex items-center gap-1"><Globe size={10} /> 参考情報</p>
                                    <div className="flex flex-wrap gap-1">
                                        {m.sources.map((s, idx) => (
                                            <a key={idx} href={s.uri} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-slate-50 text-blue-600 rounded text-[10px] border border-blue-50 truncate max-w-full">
                                                <span className="truncate">{s.title}</span>
                                                <ExternalLink size={8} className="shrink-0" />
                                            </a>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                ))}
                {isLoading && (
                    <div className="flex justify-start">
                        <div className="bg-white p-3 rounded-2xl rounded-tl-none border border-slate-100 shadow-sm flex items-center gap-2">
                            <Loader2 size={16} className="animate-spin text-brand-green" />
                            <span className="text-xs font-bold text-slate-500">高橋さんが考えています...</span>
                        </div>
                    </div>
                )}
            </div>

            {/* Input Area - Fixed at bottom above nav */}
            <div className="absolute bottom-0 left-0 right-0 bg-white border-t border-slate-200 p-3 z-10">
                {selectedImage && (
                    <div className="absolute bottom-full left-0 m-3 mb-1">
                        <div className="relative w-16 h-16 rounded-lg overflow-hidden border-2 border-brand-green/20 shadow-md bg-white">
                            <img src={`data:${selectedImage.file.type};base64,${selectedImage.base64}`} className="w-full h-full object-cover" />
                            <button onClick={() => setSelectedImage(null)} className="absolute top-0 right-0 bg-slate-900/50 text-white p-0.5 rounded-bl-md">
                                <X size={12} />
                            </button>
                        </div>
                    </div>
                )}
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => fileInputRef.current?.click()}
                        className="p-3 bg-slate-100 text-slate-500 rounded-xl hover:bg-slate-200 active:scale-95 transition-all"
                    >
                        <Camera size={20} />
                    </button>
                    <input type="file" ref={fileInputRef} onChange={handleFileSelect} className="hidden" accept="image/*" />

                    <div className="flex-1 relative">
                        <input
                            value={input}
                            onChange={e => setInput(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleSend()}
                            placeholder="メッセージを入力..."
                            className="w-full pl-4 pr-10 py-3 bg-slate-100 border-none rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-brand-green/50 transition-all"
                        />
                        <button
                            onClick={() => handleSend()}
                            disabled={isLoading || (!input.trim() && !selectedImage)}
                            className="absolute right-1 top-1/2 -translate-y-1/2 p-2 bg-brand-green text-white rounded-lg shadow-sm disabled:opacity-50 disabled:bg-slate-300 transition-all"
                        >
                            <Send size={16} />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
