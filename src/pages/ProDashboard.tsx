import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import {
    Home, Search, ShoppingCart, User, LogOut,
    MessageSquare, FilePlus, History, Loader2, Trash2, CheckCircle, Building2, X
} from 'lucide-react';
import { auth } from '../firebaseConfig';
import { SimpleSearch } from './SimpleSearch';
import { AITakahashi } from '../components/AITakahashi';
import type { Message } from '../components/AITakahashi';
import { DebugErrorBoundary } from '../components/DebugErrorBoundary';
import { SiteManager } from '../components/SiteManager';
import type { MaterialItem, SlipItem, Slip } from '../types';
import { createEstimate, subscribeToMyOrders, subscribeToMyEstimates, subscribeToMaterials, subscribeToSiteOrders, deleteSlip } from '../services/OrderService';
import { subscribeToMySites } from '../services/SiteService';
import { filterAndSortItems } from '../services/searchUtils';
import type { Genba } from '../types';

export const ProDashboard: React.FC = () => {
    const { currentUser } = useAuth();
    const [activeTab, setActiveTab] = useState<'home' | 'search' | 'estimate' | 'history' | 'chat'>('home');
    const [cart, setCart] = useState<{ [id: string]: { item: MaterialItem, quantity: number } }>({});
    const [materials, setMaterials] = useState<MaterialItem[]>([]);
    const [orderHistory, setOrderHistory] = useState<Slip[]>([]);
    const [estimateHistory, setEstimateHistory] = useState<any[]>([]);
    const [submitting, setSubmitting] = useState(false);
    const [selectedSlip, setSelectedSlip] = useState<Slip | null>(null);
    const [showCancelConfirm, setShowCancelConfirm] = useState(false);

    // Site management
    const [currentSiteId, setCurrentSiteId] = useState<string>('');
    const [currentSiteName, setCurrentSiteName] = useState<string>('未設定');
    const [currentSiteCreatedBy, setCurrentSiteCreatedBy] = useState<string>('');
    const [sites, setSites] = useState<Genba[]>([]);
    const [isSiteManagerOpen, setIsSiteManagerOpen] = useState(false);

    const defaultMessage: Message = {
        id: 'init-msg',
        role: 'model',
        parts: [{ text: "あ、高橋です。お疲れ様です。資材の注文から現場のトラブル相談まで、なんのせ何でも聞いてみてください。" }]
    };
    const [messages, setMessages] = useState<Message[]>([defaultMessage]);

    useEffect(() => {
        if (currentUser?.uid) {
            // Subscribe to estimates (Personal)
            const unsubEstimates = subscribeToMyEstimates(currentUser.uid, (data) => setEstimateHistory(data));

            let unsubOrders: () => void;
            if (currentSiteId) {
                // If site selected, subscribe to SITE orders
                unsubOrders = subscribeToSiteOrders(currentSiteId, (slips) => setOrderHistory(slips));
            } else {
                // Otherwise subscribe to MY orders
                unsubOrders = subscribeToMyOrders(currentUser.uid, (slips) => setOrderHistory(slips));
            }

            return () => { unsubOrders && unsubOrders(); unsubEstimates(); };
        }
    }, [currentUser, currentSiteId]);

    useEffect(() => {
        const unsub = subscribeToMaterials((data) => setMaterials(data));

        let unsubSites: () => void;
        if (currentUser?.uid) {
            unsubSites = subscribeToMySites(currentUser.uid, (data) => setSites(data));
        }

        return () => {
            unsub();
            if (unsubSites) unsubSites();
        };
    }, [currentUser]);

    const handleAddToCart = (item: MaterialItem, quantity: number) => {
        const itemId = item.id || `temp-${Date.now()}`;
        setCart(prev => ({
            ...prev,
            [itemId]: { item: { ...item, id: itemId }, quantity: (prev[itemId]?.quantity || 0) + quantity }
        }));
        alert(`${item.name} をリストに追加しました`);
    };

    const handleUpdateCartQuantity = (id: string, newQuantity: number) => {
        setCart(prev => {
            const next = { ...prev };
            if (newQuantity <= 0) {
                delete next[id];
            } else if (next[id]) {
                next[id] = { ...next[id], quantity: newQuantity };
            }
            return next;
        });
    };

    const handleTabChange = (tab: typeof activeTab) => {
        if ((tab === 'search' || tab === 'estimate' || tab === 'chat') && !currentSiteId) {
            alert('資材を検索したり見積を作成したりする前に、現場を選択してください。');
            setIsSiteManagerOpen(true);
            return;
        }
        setActiveTab(tab);
    };

    const handleCreateEstimate = async () => {
        if (!currentUser || Object.keys(cart).length === 0) return;
        if (!confirm('カートの内容で見積書を作成しますか？')) return;

        setSubmitting(true);
        try {
            const items: SlipItem[] = Object.values(cart).map(v => ({
                ...v.item,
                quantity: v.quantity,
                appliedPrice: v.item.listPrice || 0 // Use List Price for Estimate by default
            }));
            await createEstimate(items, currentUser.companyName, currentUser.uid, currentSiteName, '', currentSiteId, currentUser.displayName, currentUser.companyName);
            setCart({});
            setActiveTab('history');
            alert('見積を作成しました');
        } catch (e) {
            console.error(e);
            alert('作成失敗');
        } finally {
            setSubmitting(false);
        }
    };

    const handleSiteSelect = (siteId: string, siteName: string, _generalContractor?: string, createdBy?: string) => {
        setCurrentSiteId(siteId);
        setCurrentSiteName(siteName);
        setCurrentSiteCreatedBy(createdBy || '');
        setIsSiteManagerOpen(false);
    };

    const handleAIAddToCart = (items: any[], silent: boolean = false) => {
        items.forEach(item => {
            const matItem: MaterialItem = {
                id: item.id || '',
                name: item.name,
                quantity: 0,
                category: 'AI追加',
                model: item.model || '',
                dimensions: item.dimensions || '',
                unit: '個',
                location: '',
                listPrice: 0,
                sellingPrice: 0,
                costPrice: 0,
                updatedAt: Date.now()
            };
            
            // Try exact ID match first
            let targetItem = materials.find(m => m.id === item.id);
            
            // If ID match fails or ID is empty, use powerful fallback search
            if (!targetItem && item.name) {
                const searchResults = filterAndSortItems(materials, item.name);
                if (searchResults.length > 0) {
                    targetItem = searchResults[0];
                    console.log(`[AI Cart Fallback] Mapped '${item.name}' to Master Item:`, targetItem);
                }
            }
            
            // Fallback to dummy template if still not found
            targetItem = targetItem || matItem;

            const itemId = targetItem.id || `temp-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
            setCart(prev => ({
                ...prev,
                [itemId]: {
                    item: { ...targetItem, id: itemId },
                    quantity: (prev[itemId]?.quantity || 0) + item.quantity
                }
            }));
        });
        if (!silent) {
            alert('見積カートに追加しました');
            setActiveTab('estimate');
        }
    };

    // Sync selected slip with real-time updates from orderHistory
    useEffect(() => {
        if (selectedSlip) {
            const updatedSlip = orderHistory.find(s => s.id === selectedSlip.id);
            if (updatedSlip) {
                // Check if status fundamentally changed (handled or closed)
                const wasHandled = !!selectedSlip.isHandled || !!selectedSlip.isClosed;
                const isHandled = !!updatedSlip.isHandled || !!updatedSlip.isClosed;

                if (isHandled !== wasHandled) {
                    setSelectedSlip(updatedSlip);
                    if (isHandled) setShowCancelConfirm(false);
                }
            } else {
                // Slip was deleted from the database
                setSelectedSlip(null);
                setShowCancelConfirm(false);
            }
        } else {
            setShowCancelConfirm(false);
        }
    }, [orderHistory, selectedSlip]);

    const handleCancelOrder = async (orderId: string) => {
        try {
            await deleteSlip(orderId);
            setSelectedSlip(null);
            setShowCancelConfirm(false);
            alert('注文をキャンセルしました。');
        } catch (error) {
            console.error("Error canceling order:", error);
            alert('注文のキャンセルに失敗しました。時間をおいて再度お試しください。');
        }
    };

    const menuItems = [
        { id: 'home', label: 'ホーム', icon: Home },
        { id: 'search', label: '資材検索・発注', icon: Search },
        { id: 'estimate', label: '見積作成', icon: FilePlus },
        { id: 'history', label: '履歴・承認', icon: History },
        { id: 'chat', label: 'AI高橋', icon: MessageSquare },
    ];

    return (
        <div className="min-h-screen bg-slate-100 flex flex-col md:flex-row">
            {/* Sidebar (Desktop) */}
            <aside className="hidden md:flex flex-col w-64 bg-slate-900 text-white min-h-screen sticky top-0 overflow-y-auto z-20">
                <div className="p-6">
                    <div className="flex items-center gap-2 mb-8">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-black text-xs">CX</div>
                        <h1 className="font-bold text-lg tracking-tight">COREXIA-LinkP <span className="text-[10px] text-white/40 font-normal ml-2">Build: 02:05</span></h1>
                    </div>

                    <div className="space-y-1">
                        {menuItems.map(item => (
                            <button
                                key={item.id}
                                onClick={() => handleTabChange(item.id as any)}
                                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === item.id ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}
                            >
                                <item.icon size={20} />
                                <span className="font-bold text-sm">{item.label}</span>
                            </button>
                        ))}
                    </div>
                </div>

                <div className="mt-auto p-6 border-t border-slate-800">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center text-slate-400">
                            <User size={20} />
                        </div>
                        <div>
                            <div className="text-sm font-bold">{currentUser?.displayName}</div>
                            <div className="text-xs text-slate-500 truncate max-w-[120px]">{currentUser?.companyName}</div>
                        </div>
                    </div>
                    <button onClick={() => auth.signOut()} className="w-full py-2 flex items-center justify-center gap-2 text-red-400 hover:bg-red-500/10 rounded-lg text-xs font-bold transition-colors">
                        <LogOut size={16} /> ログアウト
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 p-4 md:p-8 h-screen overflow-y-auto pb-24 md:pb-8 relative">

                {/* Site Manager Modal */}
                {isSiteManagerOpen && (
                    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                        <div className="bg-white rounded-2xl w-full max-w-md max-h-[80vh] overflow-y-auto relative">
                            <button onClick={() => setIsSiteManagerOpen(false)} className="absolute top-4 right-4 p-2 bg-slate-100 rounded-full hover:bg-slate-200 z-10">
                                <X size={16} className="text-slate-500" />
                            </button>
                            <div className="p-6">
                                <SiteManager onSiteSelect={handleSiteSelect} currentSiteId={currentSiteId} />
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'home' && (
                    <div className="space-y-6">
                        {/* Site Selector Widget */}
                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex justify-between items-center">
                            <div>
                                <h3 className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-1">現在の現場 (GENBA LINK)</h3>
                                <div className="text-2xl font-black text-slate-800 flex items-center gap-2">
                                    <Building2 className="text-blue-600" />
                                    {currentSiteName}
                                </div>
                                {currentSiteId && <div className="text-xs text-green-600 font-bold flex items-center gap-1 mt-1"><CheckCircle size={12} /> 連携中: 注文履歴が共有されています</div>}
                            </div>
                            <button
                                onClick={() => setIsSiteManagerOpen(true)}
                                className="bg-slate-100 text-slate-600 px-4 py-2 rounded-lg font-bold hover:bg-slate-200 transition-colors"
                            >
                                {currentSiteId ? '現場切替' : '現場を選択'}
                            </button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                                <h3 className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-2">今月の注文 ({currentSiteId ? '現場計' : '個人計'})</h3>
                                <div className="text-3xl font-black text-slate-800">{orderHistory.length} <span className="text-sm text-slate-400 font-medium">件</span></div>
                            </div>
                            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                                <h3 className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-2">承認待ち見積</h3>
                                <div className="text-3xl font-black text-blue-600">{estimateHistory.filter(e => e.status === 'pending').length} <span className="text-sm text-slate-400 font-medium">件</span></div>
                            </div>
                        </div>

                        <h3 className="font-bold text-slate-800 text-lg">最近のアクティビティ {currentSiteId && <span className="text-sm font-normal text-slate-500">(現場共有)</span>}</h3>
                        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 divide-y divide-slate-100">
                            {orderHistory.slice(0, 5).map(order => (
                                <div
                                    key={order.id}
                                    onClick={() => setSelectedSlip(order)}
                                    className="p-4 flex items-center justify-between cursor-pointer hover:bg-slate-50 active:scale-[0.99] transition-all"
                                >
                                    <div>
                                        <div className="text-xs text-slate-400">
                                            {order.date} {order.createdAt ? new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''} - 注文
                                        </div>
                                        <div className="font-bold text-slate-800">{order.items.length}点の商品</div>
                                        {order.orderingPerson !== currentUser?.uid && (
                                            <div className="text-xs text-blue-600 font-bold mt-1">
                                                By {order.orderingPersonName || '不明'} ({order.orderingCompanyName || '不明'})
                                            </div>
                                        )}
                                    </div>
                                    <span className="bg-slate-100 text-slate-600 px-2 py-1 rounded text-xs font-bold">
                                        {(order.isHandled || order.isClosed) ? '手配済' : '処理中'}
                                    </span>
                                </div>
                            ))}
                            {orderHistory.length === 0 && (
                                <div className="p-8 text-center text-slate-400">履歴がありません</div>
                            )}
                        </div>
                    </div>
                )}

                {activeTab === 'search' && (
                    <div className="flex flex-col h-full">
                        <div className="flex-1 overflow-hidden relative">
                            <SimpleSearch
                                onAddToCart={handleAddToCart}
                                onUpdateQuantity={handleUpdateCartQuantity}
                                cartItems={Object.fromEntries(Object.values(cart).map(c => [c.item.id, c.quantity]))}
                            />
                        </div>
                    </div>
                )}

                {activeTab === 'estimate' && (
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 flex flex-col h-full max-w-4xl mx-auto">
                        <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50 rounded-t-2xl">
                            <h2 className="font-bold text-lg flex items-center gap-2"><FilePlus className="text-blue-600" /> 見積作成</h2>
                            <div className="text-sm text-slate-500">
                                リスト: <span className="font-bold text-slate-800">{Object.keys(cart).length}</span> 点
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto p-4 space-y-4">
                            {Object.keys(cart).length === 0 ? (
                                <div className="text-center py-20 text-slate-400">
                                    <ShoppingCart size={48} className="mx-auto mb-4 opacity-20" />
                                    <p>リストは空です。「資材検索」から追加してください。</p>
                                    <button onClick={() => handleTabChange('search')} className="mt-4 text-blue-600 font-bold hover:underline">資材を探す</button>
                                </div>
                            ) : (
                                Object.values(cart).map(entry => (
                                    <div key={entry.item.id} className="flex justify-between items-center p-4 bg-slate-50 rounded-xl border border-slate-100">
                                        <div>
                                            <div className="font-bold text-slate-800">{entry.item.name}</div>
                                            <div className="text-xs text-slate-500">{entry.item.model} {entry.item.dimensions && `/ ${entry.item.dimensions}`}</div>
                                        </div>
                                        <div className="text-right">
                                            <div className="font-bold text-slate-800">{entry.quantity} {entry.item.unit}</div>
                                            <div className="text-xs text-slate-500">標準単価: ¥{(entry.item.listPrice || 0).toLocaleString()}</div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>

                        <div className="p-4 border-t border-slate-100 bg-slate-50 rounded-b-2xl">
                            <button
                                onClick={handleCreateEstimate}
                                disabled={Object.keys(cart).length === 0 || submitting}
                                className="w-full bg-blue-600 text-white font-bold py-3 rounded-xl hover:bg-blue-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                                {submitting ? <Loader2 className="animate-spin" /> : <><FilePlus size={18} /> 見積書を作成する</>}
                            </button>
                        </div>
                    </div>
                )}

                {activeTab === 'history' && (
                    <div className="space-y-6">
                        {/* Site Greeting (Foreman's Message) */}
                        <div className="relative">
                            <h2 className="text-3xl font-black text-slate-900 tracking-tight">
                                {sites.find(s => s.id === currentSiteId)?.foremanMessage || "お疲れ様です！"}
                            </h2>
                            <p className="text-slate-500 font-bold mt-1">
                                {currentUser?.displayName} さん <span className="font-normal opacity-50 px-2">|</span> {currentUser?.companyName}
                            </p>

                            {/* Helper hint for foreman to set message if empty */}
                            {currentSiteId && currentSiteCreatedBy === currentUser?.uid && !sites.find(s => s.id === currentSiteId)?.foremanMessage && (
                                <button
                                    onClick={() => setIsSiteManagerOpen(true)}
                                    className="text-[10px] mt-2 text-slate-400 hover:text-brand-green underline underline-offset-2 font-bold"
                                >
                                    ※ここを「職長のひと言」に変更できます（現場設定から）
                                </button>
                            )}
                        </div>

                        <div className="space-y-6">
                            <h3 className="font-bold text-sm text-slate-500 uppercase tracking-wider">見積履歴</h3>
                            {estimateHistory.length === 0 ? (
                                <div className="p-8 text-center bg-white rounded-xl border border-dashed border-slate-300 text-slate-400">見積履歴はありません</div>
                            ) : (
                                estimateHistory.map(est => (
                                    <div key={est.id} className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex justify-between items-center hover:border-blue-400 transition-colors">
                                        <div>
                                            <div className="font-bold text-slate-800">No. {est.id.slice(0, 8)}...</div>
                                            <div className="text-xs text-slate-500">{est.date} 作成</div>
                                        </div>
                                        <div className="text-right">
                                            <div className="font-bold text-slate-800">¥{est.grandTotal.toLocaleString()}</div>
                                            <span className="text-xs px-2 py-1 rounded bg-yellow-100 text-yellow-700 font-bold">承認待ち</span>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>

                        <div className="space-y-4">
                            <h3 className="font-bold text-sm text-slate-500 uppercase tracking-wider">注文履歴</h3>
                            {orderHistory.length === 0 ? (
                                <div className="p-8 text-center bg-white rounded-xl border border-dashed border-slate-300 text-slate-400">注文履歴はありません</div>
                            ) : (
                                orderHistory.map(order => (
                                    <div key={order.id}
                                        onClick={() => { console.log("Order clicked:", order.id); setSelectedSlip(order); }}
                                        className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex justify-between items-center cursor-pointer hover:border-blue-600 active:scale-[0.99] transition-all"
                                    >
                                        <div>
                                            <div className="font-bold text-slate-800">{order.items.length}点の商品</div>
                                            <div className="text-xs text-slate-400">
                                                {order.date} {order.createdAt ? new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''} 注文
                                            </div>
                                            {order.orderingPersonName && (
                                                <div className="text-[10px] text-blue-600 font-bold mt-1">
                                                    発注者: {order.orderingPersonName} ({order.orderingCompanyName})
                                                </div>
                                            )}
                                        </div>
                                        <div className="text-right flex flex-col items-end gap-2">
                                            <span className={`text-[10px] px-2 py-1 rounded font-black ${(order.isHandled || order.isClosed) ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'}`}>
                                                {(order.isHandled || order.isClosed) ? '手配済' : '手配中'}
                                            </span>
                                            <div className="text-[10px] text-slate-300 font-mono">ID: {order.id.slice(-6).toUpperCase()}</div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                )}

                {activeTab === 'chat' && (
                    <div className="h-[calc(100vh-100px)] bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                        <DebugErrorBoundary componentName="AITakahashi">
                            <AITakahashi masterItems={materials} onAddToCart={handleAIAddToCart} currentScreen="LINK_PRO" messages={messages} setMessages={setMessages} />
                        </DebugErrorBoundary>
                    </div>
                )}
            </main>

            {/* Order Detail Modal */}
            {selectedSlip && (
                <div
                    className="fixed inset-0 bg-slate-900/80 z-[200] flex items-center justify-center p-4 cursor-pointer"
                    onClick={() => setSelectedSlip(null)}
                >
                    <div
                        className="bg-white w-full max-w-lg rounded-3xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl cursor-default"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Modal Header */}
                        <div className="p-6 border-b border-slate-100 flex items-center justify-between shrink-0">
                            <div>
                                <h3 className="font-black text-xl text-slate-900 tracking-tight">注文詳細</h3>
                                <div className="text-[10px] text-slate-400 font-mono mt-1 space-y-0.5">
                                    <div>{selectedSlip.date} {selectedSlip.createdAt ? new Date(selectedSlip.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}</div>
                                    <div>No.{selectedSlip.id.slice(-6).toUpperCase()}</div>
                                    {selectedSlip.orderingPersonName && (
                                        <div className="text-blue-600 font-bold text-[11px]">注文者: {selectedSlip.orderingPersonName} ({selectedSlip.orderingCompanyName})</div>
                                    )}
                                </div>
                            </div>
                            <button
                                onClick={() => setSelectedSlip(null)}
                                className="w-10 h-10 bg-slate-100 hover:bg-slate-200 rounded-full flex items-center justify-center transition-colors"
                            >
                                <X size={20} className="text-slate-500" />
                            </button>
                        </div>

                        {/* Modal Content */}
                        <div className="flex-1 overflow-y-auto p-6 space-y-4">
                            <div className="flex items-center justify-between bg-slate-50 p-4 rounded-2xl">
                                <div className="text-sm font-bold text-slate-600">ステータス</div>
                                {(selectedSlip.isHandled || selectedSlip.isClosed) ? (
                                    <span className="bg-blue-600 text-white text-xs font-black px-3 py-1 rounded-full">手配完了</span>
                                ) : (
                                    <span className="bg-orange-500 text-white text-xs font-black px-3 py-1 rounded-full">手配中</span>
                                )}
                            </div>

                            <div className="space-y-3">
                                <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-1">注文商品 ({selectedSlip.items.length})</h4>
                                {selectedSlip.items.map((item, idx) => (
                                    <div key={idx} className="bg-white border border-slate-100 p-4 rounded-2xl flex justify-between items-center">
                                        <div className="flex-1 min-w-0 pr-4">
                                            <div className="font-black text-slate-800 text-sm truncate">{item.name}</div>
                                            <div className="text-[10px] text-slate-400 font-bold mt-1 truncate">
                                                {item.model} {item.dimensions && ` / ${item.dimensions}`}
                                            </div>
                                        </div>
                                        <div className="shrink-0 text-right">
                                            <div className="text-lg font-black text-slate-900 leading-none">{item.quantity}</div>
                                            <div className="text-[10px] font-bold text-slate-400 mt-1">{item.unit || '個'}</div>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {selectedSlip.note && (
                                <div className="bg-amber-50 p-4 rounded-2xl border border-amber-100">
                                    <h4 className="text-[10px] font-black uppercase tracking-widest text-amber-700 mb-1">備考</h4>
                                    <p className="text-sm text-amber-900 leading-relaxed font-bold">{selectedSlip.note}</p>
                                </div>
                            )}
                            
                            {/* Cancel Order Section */}
                            {(selectedSlip.isHandled || selectedSlip.isClosed) ? (
                                <div className="mt-4 p-4 bg-slate-50 border border-slate-200 rounded-xl text-center">
                                    <p className="text-xs font-bold text-slate-500">※手配済みのためキャンセルや変更の場合はお電話（0155-35-6815）でお問い合わせ下さい</p>
                                </div>
                            ) : showCancelConfirm ? (
                                <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-xl text-center shadow-inner">
                                    <p className="text-sm font-bold text-red-600 mb-3">本当にこの注文をキャンセルしますか？</p>
                                    <p className="text-[10px] text-red-500 mb-4 tracking-tight">※この操作は取り消せません。既に職人が手配を進めている場合があるためご注意ください。</p>
                                    <div className="flex items-center gap-3">
                                        <button
                                            onClick={() => setShowCancelConfirm(false)}
                                            className="flex-1 py-3 bg-white text-slate-600 font-bold rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors text-sm"
                                        >
                                            やめる
                                        </button>
                                        <button
                                            onClick={() => handleCancelOrder(selectedSlip.id)}
                                            className="flex-1 py-3 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 shadow-lg shadow-red-600/20 active:scale-95 transition-all text-sm"
                                        >
                                            キャンセル確定
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <button
                                    onClick={() => setShowCancelConfirm(true)}
                                    className="mt-4 w-full py-3 bg-red-50 text-red-600 font-bold rounded-xl border border-red-200 hover:bg-red-100 transition-colors"
                                >
                                    この注文をキャンセルする
                                </button>
                            )}
                        </div>

                        {/* Modal Footer */}
                        <div className="p-6 border-t border-slate-100 bg-slate-50 shrink-0">
                            <button
                                onClick={() => setSelectedSlip(null)}
                                className="w-full bg-slate-900 text-white font-black py-4 rounded-2xl shadow-xl shadow-slate-900/20 active:scale-95 transition-all text-sm uppercase tracking-widest"
                            >
                                閉じる
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
