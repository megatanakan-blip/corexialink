import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Home, Search, ShoppingCart, User, LogOut, MessageSquare, Package, Trash2, Send, Loader2, Building2, X, CheckCircle, Edit3 } from 'lucide-react';
import { auth } from '../firebaseConfig';
import { SimpleSearch } from './SimpleSearch';
import type { MaterialItem, SlipItem, Slip, Genba } from '../types';
import { createOrder, subscribeToMyOrders, subscribeToMaterials, subscribeToSiteOrders, deleteSlip } from '../services/OrderService';
import { deleteSite, leaveSite, subscribeToMySites, updateSiteMessage } from '../services/SiteService';
import { filterAndSortItems } from '../services/searchUtils';
import { AITakahashi } from '../components/AITakahashi';
import type { Message } from '../components/AITakahashi';
import { DebugErrorBoundary } from '../components/DebugErrorBoundary';
import { SiteManager } from '../components/SiteManager'; // Added SiteManager

// Separate component for success view to manage its own lifecycle and hooks safely
const OrderSuccessView: React.FC<{ onComplete: () => void }> = ({ onComplete }) => {
    const [countdown, setCountdown] = useState(3);

    useEffect(() => {
        const timer = setInterval(() => {
            setCountdown((prev) => {
                if (prev <= 1) {
                    clearInterval(timer);
                    onComplete();
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
        return () => clearInterval(timer);
    }, [onComplete]);

    return (
        <div className="h-[calc(100vh-140px)] flex flex-col items-center justify-center p-8 text-center animate-in zoom-in-95 duration-300">
            <div className="w-24 h-24 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-6">
                <CheckCircle size={48} />
            </div>
            <h2 className="text-2xl font-bold text-slate-800 mb-2">注文を受け付けました！</h2>
            <p className="text-slate-500 mb-8">ご注文ありがとうございます。<br />
                <span className="font-bold text-brand-green text-lg">{countdown}</span> 秒後にホームに戻ります...
            </p>

            <button
                onClick={onComplete}
                className="w-full bg-slate-900 text-white font-bold py-4 rounded-xl shadow-lg shadow-slate-900/20 active:scale-95 transition-all hover:bg-slate-800"
            >
                すぐにトップに戻る
            </button>
            <div className="mt-4 text-xs text-slate-300 font-mono">Build: 02:10</div>
        </div>
    );
};

export const LiteDashboard: React.FC = () => {
    const { currentUser } = useAuth();
    const [activeTab, setActiveTab] = useState<'home' | 'search' | 'chat' | 'cart' | 'profile'>('home');
    const [showSuccess, setShowSuccess] = useState(false);
    const [cart, setCart] = useState<{ [id: string]: { item: MaterialItem, quantity: number } }>({});
    const [orderHistory, setOrderHistory] = useState<Slip[]>([]);
    const [submitting, setSubmitting] = useState(false);
    const [materials, setMaterials] = useState<MaterialItem[]>([]);
    const [selectedSlip, setSelectedSlip] = useState<Slip | null>(null);
    const [showCancelConfirm, setShowCancelConfirm] = useState(false);
    const [sites, setSites] = useState<Genba[]>([]);
    const [isEditingMessage, setIsEditingMessage] = useState(false);
    const [editingMessageText, setEditingMessageText] = useState('');

    const defaultMessage: Message = {
        id: 'init-msg',
        role: 'model',
        parts: [{ text: "あ、高橋です。お疲れ様です。資材の注文から現場のトラブル相談まで、なんのせ何でも聞いてみてください。" }]
    };
    const [messages, setMessages] = useState<Message[]>([defaultMessage]);

    // Removed orderComplete and countdown state (moved to OrderSuccessView)

    // Site Management
    const [currentSiteId, setCurrentSiteId] = useState<string>('');
    const [currentSiteName, setCurrentSiteName] = useState<string>('未設定');
    const [currentSiteCreatedBy, setCurrentSiteCreatedBy] = useState<string>('');
    const [currentGeneralContractor, setCurrentGeneralContractor] = useState<string>('');
    const [isSiteManagerOpen, setIsSiteManagerOpen] = useState(false);

    useEffect(() => {
        if (currentUser?.uid) {
            let unsubOrders: () => void;
            if (currentSiteId) {
                unsubOrders = subscribeToSiteOrders(currentSiteId, (slips) => setOrderHistory(slips));
            } else {
                unsubOrders = subscribeToMyOrders(currentUser.uid, (slips) => setOrderHistory(slips));
            }

            return unsubOrders;
        }
    }, [currentUser, currentSiteId]);

    useEffect(() => {
        const unsubMaterials = subscribeToMaterials((data) => {
            setMaterials(data);
        });

        let unsubSites: () => void;
        if (currentUser?.uid) {
            unsubSites = subscribeToMySites(currentUser.uid, (data) => setSites(data));
        }

        return () => {
            unsubMaterials();
            if (unsubSites) unsubSites();
        };
    }, [currentUser]);

    const handleTabChange = (tab: typeof activeTab) => {
        if ((tab === 'search' || tab === 'chat' || tab === 'cart') && !currentSiteId) {
            alert('資材を探したり注文したりする前に、現場を選択してください。');
            setIsSiteManagerOpen(true);
            return;
        }
        setActiveTab(tab);
    };

    const handleAddToCart = useCallback((item: MaterialItem, quantity: number) => {
        try {
            const itemId = item.id || `temp-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
            const itemWithId = { ...item, id: itemId };

            setCart(prev => ({
                ...prev,
                [itemId]: {
                    item: itemWithId,
                    quantity: (prev[itemId]?.quantity || 0) + quantity
                }
            }));
        } catch (error) {
            console.error("Cart update error:", error);
        }
    }, []);

    const handleUpdateCartQuantity = useCallback((id: string, newQuantity: number) => {
        setCart(prev => {
            const next = { ...prev };
            if (newQuantity <= 0) {
                delete next[id];
            } else if (next[id]) {
                next[id] = { ...next[id], quantity: newQuantity };
            }
            return next;
        });
    }, []);

    // COREマスターデータからAI提案アイテムの最近似値を探す
    const findBestMasterMatch = useCallback((aiItem: any): MaterialItem | null => {
        if (!materials || materials.length === 0) return null;

        // ===== フィルター群 =====

        // 1. 材質一致フィルター
        // クエリに「白」がある → 結果にも「白」が必要（MRジョイント・Wプレスなど非白品を除外）
        // クエリに「白」がある → ステン/モルコは除外
        const filterByMaterialConsistency = (results: MaterialItem[], qName: string): MaterialItem[] => {
            const qLow = (qName || '').toLowerCase();

            const filtered = results.filter(item => {
                const rLow = [(item.name || ''), (item.model || ''), (item.category || '')].join(' ').toLowerCase();

                // 「白」クエリ → 結果に「白」が必須（ライトカバー, MRジョイント等を排除）
                if (qLow.includes('白')) {
                    if (!rLow.includes('白')) return false;
                    // 白クエリに対してステン/モルコは除外
                    if (['ステン', 'sus', 'モルコ', 'su管'].some(ex => rLow.includes(ex))) return false;
                }

                // 「黒」クエリ → 結果に「黒」が必須
                if (qLow.includes('黒')) {
                    if (!rLow.includes('黒')) return false;
                }

                // クエリ材質指定なくてもステン/モルコは追加しない
                if (!qLow.includes('ステン') && !qLow.includes('sus') && !qLow.includes('モルコ')) {
                    if (['ステン', 'sus', 'モルコ', 'su管'].some(ex => rLow.includes(ex))) return false;
                }

                // VP/VUクエリ → 白SGP除外
                if (qLow.includes('vp') && ['sgp', '白管', '黒管'].some(ex => rLow.includes(ex))) return false;
                if (qLow.includes('vu') && ['sgp'].some(ex => rLow.includes(ex))) return false;

                return true;
            });
            return filtered.length > 0 ? filtered : results;
        };

        // 2. 特殊品種フィルター
        // 短管・ニップル・45L（45度エルボ）・ライニング管は明示指定なければ除外
        const filterSpecificItems = (results: MaterialItem[], qName: string): MaterialItem[] => {
            const qLow = (qName || '').toLowerCase();
            const SPECIFIC_KEYWORDS = [
                '短管',
                'ニップル', 'nipple',
                '45l',          // 45度エルボ（L/エルボ指示では90度が標準、45度は別物）
                'ライニング',    // ライニング管（VB管等）は通常の白ガス管と別物
            ];
            const filtered = results.filter(item => {
                const rLow = (item.name || '').toLowerCase();
                return !SPECIFIC_KEYWORDS.some(kw => rLow.includes(kw) && !qLow.includes(kw));
            });
            return filtered;
        };


        // 3. 品種タイプ一貫性フィルター（Positive matching）
        // 「白ガス管」クエリ → 結果にも「管/パイプ/SGP」が必要（ライトカバーを排除）
        const filterByProductType = (results: MaterialItem[], qName: string): MaterialItem[] => {
            const qLow = (qName || '').toLowerCase();
            const isPipeQuery = /(パイプ|sgp|白管|黒管|ガス管|水道管)/.test(qLow) &&
                                !/(ソケット|エルボ|継手|バンド|チーズ|カップリング)/.test(qLow);
            if (isPipeQuery) {
                const filtered = results.filter(item => {
                    const rLow = (item.name || '').toLowerCase();
                    // 管/パイプ/SGP(配管材)のいずれかが品名に含まれること
                    return /(管|パイプ|pipe|sgp|鋼管)/.test(rLow);
                });
                console.log(`[AI Match] 管クエリ絞り込み: ${results.length}→${filtered.length}件`);
                return filtered;
            }
            return results;
        };

        // 4. カテゴリ/名称の排他フィルター
        // 「全ねじ/寸切り」クエリ → 「テープ/ヒーター」を排除
        // 「テープ/ヒーター」クエリ → 「全ねじ」を排除
        const filterByExclusion = (results: MaterialItem[], qName: string): MaterialItem[] => {
            const qLow = (qName || '').toLowerCase();
            const isBoltQuery = /(全ねじ|寸切り|全ネジ|ボルト)/.test(qLow);
            const isTapeQuery = /(テープ|ヒーター)/.test(qLow);

            if (isBoltQuery) {
                const filtered = results.filter(item => {
                    const rLow = (item.name || '').toLowerCase();
                    return !/(テープ|ヒーター)/.test(rLow);
                });
                return filtered.length > 0 ? filtered : results;
            }
            if (isTapeQuery) {
                const filtered = results.filter(item => {
                    const rLow = (item.name || '').toLowerCase();
                    return !/(全ねじ|寸切り|全ネジ|ボルト)/.test(rLow);
                });
                return filtered.length > 0 ? filtered : results;
            }
            return results;
        };

        // 全フィルター + 非CKMA優先
        const applyFilters = (results: MaterialItem[], qName: string): MaterialItem[] => {
            const f1 = filterSpecificItems(results, qName);
            const f2 = filterByMaterialConsistency(f1, qName);
            const f3 = filterByProductType(f2, qName);
            const f4 = filterByExclusion(f3, qName);
            const qLow = (qName || '').toLowerCase();
            if (!qLow.includes('ckma') && !qLow.includes('カムロック')) {
                const nonCkma = f4.filter(item => {
                    const rLow = (item.name || '').toLowerCase();
                    return !rLow.includes('ckma') && !rLow.includes('カムロック') && !rLow.includes('ロック付');
                });
                if (nonCkma.length > 0) return nonCkma;
            }
            return f4;
        };

        // AIの正式名称をメモに近い簡潔な語に変換してから検索
        // 業界常識マッピングも適用: 白管/白ガス管/白パイプ → 白SGP
        const simplifySearchQuery = (name: string): string => {
            return (name || '')
                .replace(/ねじ込み継手?/g, '')         // マスターにない「ねじ込み継手」を削除
                .replace(/配管用炭素鋼鋼管/g, '')        // JIS規格名称を削除
                .replace(/90°?/g, '')                  // 角度記号を削除（エルボは残る）
                .replace(/[（(]([^）)]*)[）)]/g, ' $1 ') // 括弧の中身を取り出す: (白SGP)→白SGP
                // 業界常識: 白管/白ガス管/白パイプ → 白SGP
                .replace(/白(ガス)?管/g, '白SGP')
                .replace(/白パイプ/g, '白SGP')
                // 業界常識: 黒管/黒ガス管/黒パイプ → 黒SGP
                .replace(/黒(ガス)?管/g, '黒SGP')
                .replace(/黒パイプ/g, '黒SGP')
                .replace(/\s+/g, ' ')
                .trim();
        };

        // Step 1: IDが存在すれば完全一致を優先
        // ただしCKMAが返ってきた場合で、モデルコードが単純（L/S等）なら非CKMAを優先探索
        if (aiItem.id) {
            const exactById = materials.find(m => m.id === aiItem.id);
            if (exactById) {
                const isCkmaResult = (exactById.name || '').toLowerCase().includes('ckma');
                const isSimpleModel = aiItem.model && /^[a-zA-Z]{1,3}$/.test(aiItem.model.trim());
                if (isCkmaResult && isSimpleModel) {
                    // L/S等の単純モデルコードでCKMAが返った → 同モデルの非CKMA品を寸法一致で探す
                    const nonCkmaByModel = materials.filter(m => {
                        const rLow = (m.name || '').toLowerCase();
                        if (rLow.includes('ckma') || rLow.includes('カムロック') || rLow.includes('ロック付')) return false;
                        return (m.model || '').toLowerCase().trim() === aiItem.model.toLowerCase().trim();
                    });
                    if (nonCkmaByModel.length > 0) {
                        // filterAndSortItemsで寸法一致も確認してから返す（150mmソケットを20Aで選ばない）
                        const modelDimQuery = [aiItem.model, aiItem.dimensions].filter(Boolean).join(' ');
                        const sorted = filterAndSortItems(nonCkmaByModel, modelDimQuery);
                        const best = applyFilters(sorted.length > 0 ? sorted : nonCkmaByModel, aiItem.name);
                        if (best.length > 0) {
                            console.log(`[AI Match] CKMA→非CKMA代替 model="${aiItem.model}" dim="${aiItem.dimensions}": ${exactById.name} → ${best[0].name}`);
                            return best[0];
                        }
                    }
                }

                console.log(`[AI Match] ID完全一致: ${aiItem.id} → ${exactById.name}`);
                return exactById;
            }

        }

        // Step 2: 簡潔化した name + model + dimensions でフル検索
        // 「白ねじ込み継手エルボ」→「白エルボ」に変換してから「白エルボ L 20A」で検索
        const simpleName = simplifySearchQuery(aiItem.name);
        const queryParts = [simpleName, aiItem.model, aiItem.dimensions].filter(Boolean);
        if (queryParts.length > 0) {
            const fullQuery = queryParts.join(' ');
            const fullResults = filterAndSortItems(materials, fullQuery);
            if (fullResults.length > 0) {
                const best = applyFilters(fullResults, aiItem.name);
                console.log(`[AI Match] フル検索 ("${fullQuery}"←"${aiItem.name}"): → ${best[0].name} [${best[0].model}/${best[0].dimensions}]`);
                return best[0];
            }
        }

        // Step 3: 簡潔化した name + dimensions のみで検索（modelを除く）
        const dimParts = [simpleName, aiItem.dimensions].filter(Boolean);
        if (dimParts.length > 0) {
            const dimQuery = dimParts.join(' ');
            const dimResults = filterAndSortItems(materials, dimQuery);
            if (dimResults.length > 0) {
                const best = applyFilters(dimResults, aiItem.name);
                console.log(`[AI Match] 寸法付き検索 ("${dimQuery}"): → ${best[0].name} [${best[0].dimensions}]`);
                return best[0];
            }
        }

        // Step 4: 元のname（変換前）でもう一度試す（フォールバック）
        if (aiItem.name) {
            const nameResults = filterAndSortItems(materials, aiItem.name);
            if (nameResults.length > 0) {
                const best = applyFilters(nameResults, aiItem.name);
                console.warn(`[AI Match] 元名称フォールバック: "${aiItem.name}" → ${best[0].name} [${best[0].dimensions}]`);
                return best[0];
            }
        }

        console.warn(`[AI Match] マスター未照合: name="${aiItem.name}" model="${aiItem.model}" dim="${aiItem.dimensions}"`);
        return null;
    }, [materials]);



    const handleAIAddToCart = useCallback((items: any[], silent: boolean = false) => {
        try {
            items.forEach(item => {
                // マスターデータから最近似値を探す
                const masterMatch = findBestMasterMatch(item);

                if (masterMatch) {
                    // マスターデータが見つかった場合はそれを使用
                    handleAddToCart(masterMatch, item.quantity);
                } else {
                    // マスターにない場合はAIの情報でフォールバック作成
                    const fallbackItem: MaterialItem = {
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
                    console.warn(`[AI Cart] マスター未照合のためAI情報で追加: ${item.name}`);
                    handleAddToCart(fallbackItem, item.quantity);
                }
            });
            if (!silent) alert('カートに追加しました');
        } catch (error) {
            console.error("AI Cart update error:", error);
        }
    }, [materials, handleAddToCart, findBestMasterMatch]);

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

    const removeFromCart = (id: string) => {
        setCart(prev => {
            const next = { ...prev };
            delete next[id];
            return next;
        });
    };

    const updateQuantity = (id: string, delta: number) => {
        setCart(prev => {
            const currentItem = prev[id];
            if (!currentItem) return prev;

            const newQuantity = currentItem.quantity + delta;
            if (newQuantity < 1) return prev; // Do not go below 1, use remove button for that

            return {
                ...prev,
                [id]: {
                    ...currentItem,
                    quantity: newQuantity
                }
            };
        });
    };

    const handleOrder = async () => {
        console.log("handleOrder started");
        if (!currentUser) { console.error("No current user"); return; }
        if (Object.keys(cart).length === 0) { console.error("Cart empty"); return; }
        if (!confirm('注文を確定しますか？')) { console.log("Order cancelled"); return; }

        setSubmitting(true);
        console.log("Submitting order...");
        try {
            const slipItems: SlipItem[] = Object.values(cart).map(entry => ({
                ...entry.item,
                quantity: entry.quantity,
                appliedPrice: entry.item.sellingPrice || 0,
            }));

            // Mapping requirements:
            // 1. generalContractor -> Customer Name (〇〇御中)
            // 2. siteName -> Construction Name (現場名)
            // 3. LINK user company -> Ordering Person (発注者)
            const orderId = await createOrder(
                slipItems,
                currentGeneralContractor || currentUser.companyName, // Customer Name
                currentUser.uid,
                'none',
                'site',
                currentSiteId,
                currentSiteName, // Pass as constructionName
                currentUser.displayName, // Pass as orderingPersonName (Human name)
                currentUser.companyName // Pass as orderingCompanyName (Company name)
            );
            console.log("Order created with ID:", orderId);

            // Do NOT clear cart here to avoid race condition with UI unmounting
            setShowSuccess(true);
            console.log("Showing success overlay");
        } catch (error) {
            console.error("Order failed:", error);
            alert('注文に失敗しました。\n' + (error instanceof Error ? error.message : String(error)));
        } finally {
            setSubmitting(false);
        }
    };

    const handleSiteSelect = (siteId: string, siteName: string, generalContractor?: string, createdBy?: string) => {
        setCurrentSiteId(siteId);
        setCurrentSiteName(siteName);
        setCurrentGeneralContractor(generalContractor || '');
        setCurrentSiteCreatedBy(createdBy || '');
        setIsSiteManagerOpen(false);
    };

    const handleDeleteSite = async () => {
        if (!currentSiteId) return;
        if (!confirm(`現場「${currentSiteName}」を完全に削除してもよろしいですか？\nこの操作は取り消せません。`)) return;

        try {
            await deleteSite(currentSiteId);
            setCurrentSiteId('');
            setCurrentSiteName('未設定');
            setCurrentGeneralContractor('');
            setCurrentSiteCreatedBy('');
            alert('現場を削除しました');
        } catch (e) {
            console.error(e);
            alert('削除に失敗しました');
        }
    };

    const handleLeaveSite = async () => {
        if (!currentSiteId || !currentUser) return;
        if (!confirm(`現場「${currentSiteName}」から抜けますか？`)) return;

        try {
            await leaveSite(currentSiteId, currentUser.uid);
            setCurrentSiteId('');
            setCurrentSiteName('未設定');
            setCurrentGeneralContractor('');
            setCurrentSiteCreatedBy('');
            alert('現場から抜けました');
        } catch (e) {
            console.error(e);
            alert('エラーが発生しました');
        }
    };

    const handleReturnHome = useCallback(() => {
        setShowSuccess(false);
        setCart({}); // Clear cart only when returning
        setActiveTab('home');
    }, []);

    const cleanupTargetOrders = async () => {
        const targets = orderHistory.filter(s => !s.siteId || s.constructionName === '未設定' || !s.constructionName);
        console.log("Found targets for cleanup:", targets);

        if (targets.length === 0) {
            alert('削除対象の「未設定」注文は見つかりませんでした。\n条件: siteIdが空、または現場名が「未設定」もしくは空');
            return;
        }
        if (!confirm(`${targets.length} 件の「未設定」注文を削除しますか？`)) return;

        setSubmitting(true);
        try {
            console.log("Cleaning up orders:", targets.map(t => t.id));
            for (const target of targets) {
                await deleteSlip(target.id);
            }
            alert(`${targets.length} 件の注文を削除しました。`);
        } catch (e) {
            console.error(e);
            alert('削除中にエラーが発生しました。');
        } finally {
            setSubmitting(false);
        }
    };

    const handleSaveMessage = async () => {
        if (!currentSiteId) return;
        try {
            await updateSiteMessage(currentSiteId, editingMessageText);
            setIsEditingMessage(false);
        } catch (error) {
            console.error("Failed to update message:", error);
            alert("メッセージの更新に失敗しました");
        }
    };

    const startEditingMessage = () => {
        const currentSite = sites.find(s => s.id === currentSiteId);
        if (currentSite) {
            setEditingMessageText(currentSite.foremanMessage || "");
            setIsEditingMessage(true);
        }
    };

    const renderContent = () => {
        switch (activeTab) {
            case 'home':
                return (
                    <div className="space-y-6 pb-24">
                        <div className="bg-gradient-to-br from-brand-green to-teal-600 rounded-2xl p-6 text-white shadow-lg relative overflow-hidden">
                            {/* Background Decoration */}
                            <div className="absolute top-0 right-0 p-4 opacity-10">
                                <Building2 size={100} />
                            </div>

                            {/* Site Info Card */}
                            <div
                                onClick={() => setIsSiteManagerOpen(true)}
                                className="bg-black/20 backdrop-blur-sm p-3 rounded-xl mb-4 flex items-center justify-between cursor-pointer hover:bg-black/30 transition-all border border-white/10"
                            >
                                <div className="flex items-center gap-2">
                                    <Building2 size={16} className="text-white/80" />
                                    <div>
                                        <div className="text-[10px] text-white/60 font-medium">現在の現場</div>
                                        <div className="font-bold text-sm truncate max-w-[150px]">{currentSiteName}</div>
                                    </div>
                                </div>
                                <div className="bg-white/20 px-2 py-1 rounded text-[10px] font-bold">切替</div>
                            </div>

                            {/* Site Greeting (Foreman's Message) */}
                            <div className="relative">
                                {isEditingMessage ? (
                                    <div className="bg-white/10 p-2 rounded-lg backdrop-blur-sm mt-2">
                                        <input
                                            value={editingMessageText}
                                            onChange={(e) => setEditingMessageText(e.target.value)}
                                            className="w-full bg-white/20 text-white placeholder-white/50 border border-white/30 rounded px-2 py-1 text-lg font-bold mb-2 focus:outline-none focus:border-white"
                                            placeholder="職長のひと言を入力"
                                            autoFocus
                                        />
                                        <div className="flex gap-2 justify-end">
                                            <button
                                                onClick={() => setIsEditingMessage(false)}
                                                className="text-xs bg-white/20 hover:bg-white/30 text-white px-3 py-1 rounded font-bold"
                                            >
                                                キャンセル
                                            </button>
                                            <button
                                                onClick={handleSaveMessage}
                                                className="text-xs bg-white text-brand-green px-3 py-1 rounded font-bold"
                                            >
                                                保存
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <>
                                        <div className="flex items-center gap-2">
                                            <h2 className="text-2xl font-bold">
                                                {sites.find(s => s.id === currentSiteId)?.foremanMessage || "お疲れ様です！"}
                                            </h2>
                                            {currentSiteId && sites.find(s => s.id === currentSiteId)?.createdBy === currentUser?.uid && (
                                                <button
                                                    onClick={startEditingMessage}
                                                    className="opacity-60 hover:opacity-100 transition-opacity p-1"
                                                    title="ひと言を編集"
                                                >
                                                    <Edit3 size={16} className="text-white" />
                                                </button>
                                            )}
                                        </div>
                                        <p className="mt-1 opacity-90">{currentUser?.displayName} さん</p>

                                        {/* Helper hint for foreman to set message if empty */}
                                        {currentSiteId && sites.find(s => s.id === currentSiteId)?.createdBy === currentUser?.uid && !sites.find(s => s.id === currentSiteId)?.foremanMessage && (
                                            <button
                                                onClick={startEditingMessage}
                                                className="text-[10px] mt-2 text-white/60 hover:text-white underline underline-offset-2"
                                            >
                                                ※ここを「職長のひと言」に変更できます
                                            </button>
                                        )}
                                    </>
                                )}
                            </div>

                            {/* Orphaned Orders Cleanup Alert */}
                            {orderHistory.filter(s => !s.siteId || s.constructionName === '未設定' || !s.constructionName).length > 0 && (
                                <div className="mt-4 p-3 bg-red-600/20 border border-red-400/50 rounded-xl flex items-center justify-between animate-pulse">
                                    <div className="text-[10px] font-bold">
                                        「未設定」の注文が {orderHistory.filter(s => !s.siteId || s.constructionName === '未設定' || !s.constructionName).length} 件残っています
                                    </div>
                                    <button
                                        onClick={cleanupTargetOrders}
                                        className="bg-red-600 text-white text-[10px] font-bold px-3 py-1 rounded-lg shadow-lg active:scale-95 transition-all"
                                    >
                                        一括削除する
                                    </button>
                                </div>
                            )}

                            <div className="mt-4 flex gap-3">
                                <button
                                    onClick={() => handleTabChange('search')}
                                    className="bg-white/20 backdrop-blur-sm border border-white/30 rounded-lg px-4 py-2 text-sm font-bold flex items-center gap-2 hover:bg-white/30 transition-all"
                                >
                                    <Search size={16} /> 資材を探す
                                </button>
                                <button
                                    onClick={() => handleTabChange('cart')}
                                    className="bg-white text-teal-800 rounded-lg px-4 py-2 text-sm font-bold flex items-center gap-2 shadow-sm hover:bg-gray-50 transition-all"
                                >
                                    <ShoppingCart size={16} /> 注文リスト
                                    {Object.keys(cart).length > 0 && <span className="bg-red-500 text-white rounded-full text-[10px] w-5 h-5 flex items-center justify-center">{Object.keys(cart).length}</span>}
                                </button>
                            </div>
                        </div>

                        <h3 className="font-bold text-slate-800 text-lg px-2">
                            {currentSiteId ? '現場の注文履歴' : '最近の注文履歴'}
                            {currentSiteId && <span className="block text-xs font-normal text-slate-500">※同じ現場メンバーの注文も表示されます</span>}
                        </h3>
                        <div className="space-y-3">
                            {orderHistory.length === 0 ? (
                                <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-8 text-center text-slate-400">
                                    <Package size={48} className="mx-auto mb-3 opacity-20" />
                                    <p>まだ注文履歴がありません</p>
                                </div>
                            ) : (
                                orderHistory.map(slip => (
                                    <div
                                        key={slip.id}
                                        onClick={() => { console.log("Lite Order clicked:", slip.id); setSelectedSlip(slip); }}
                                        className="bg-white rounded-xl p-4 shadow-sm border border-slate-100 relative overflow-hidden active:scale-[0.98] transition-all cursor-pointer hover:border-brand-green/30"
                                    >
                                        {/* Highlight own orders vs others */}
                                        {slip.orderingPersonId !== currentUser?.uid && (
                                            <div className="absolute top-0 right-0 bg-yellow-100 text-yellow-800 text-[10px] px-2 py-0.5 rounded-bl-lg font-bold">
                                                他メンバー
                                            </div>
                                        )}
                                        <div className="flex justify-between items-start mb-2">
                                            <div>
                                                <div className="text-xs text-slate-400 font-mono">
                                                    {slip.date} {slip.createdAt ? new Date(slip.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                                                </div>
                                                <div className="font-bold text-slate-800">注文数: {slip.items.length}点</div>
                                                {slip.orderingPersonId !== currentUser?.uid && (
                                                    <div className="text-[10px] text-brand-green font-bold mt-1">
                                                        発注者: {slip.orderingPersonName || '不明'} ({slip.orderingCompanyName || '不明'})
                                                    </div>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-2">
                                                {(slip.isHandled || slip.isClosed) ? (
                                                    <span className="bg-blue-100 text-blue-700 text-xs font-bold px-2 py-1 rounded">手配済</span>
                                                ) : (
                                                    <span className="bg-orange-100 text-orange-700 text-xs font-bold px-2 py-1 rounded">手配待</span>
                                                )}
                                            </div>
                                        </div>
                                        <div className="text-xs text-slate-500 line-clamp-1">
                                            {slip.items.map(i => i.name).join(', ')}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                );
            case 'search':
                return (
                    <div className="h-[calc(100vh-80px)]">
                        <SimpleSearch
                            onAddToCart={handleAddToCart}
                            onUpdateQuantity={handleUpdateCartQuantity}
                            cartItems={Object.fromEntries(Object.values(cart).map(c => [c.item.id, c.quantity]))}
                        />
                    </div>
                );
            case 'chat':
                return (
                    <div className="h-[calc(100vh-160px)]">
                        <DebugErrorBoundary componentName="AITakahashi">
                            <AITakahashi
                                masterItems={materials}
                                onAddToCart={handleAIAddToCart}
                                messages={messages}
                                setMessages={setMessages}
                                cart={cart}
                                orderHistory={orderHistory}
                            />
                        </DebugErrorBoundary>
                    </div>
                );
            case 'cart':
                return (
                    <div className="pb-24">
                        <h2 className="text-xl font-bold bg-white sticky top-0 z-10 p-4 border-b border-slate-100 flex items-center gap-2">
                            <ShoppingCart className="text-brand-green" /> 注文リスト
                        </h2>
                        {Object.keys(cart).length === 0 ? (
                            <div className="text-center py-20 text-slate-400">
                                <ShoppingCart size={48} className="mx-auto mb-4 opacity-20" />
                                <p>カートは空です</p>
                                <button onClick={() => setActiveTab('search')} className="mt-4 text-brand-green font-bold">資材を探す</button>
                            </div>
                        ) : (
                            <div className="p-4 space-y-4">
                                {Object.values(cart).map(entry => (
                                    <div key={entry.item.id} className="bg-white rounded-xl p-4 shadow-sm border border-slate-100 flex justify-between items-center">
                                        <div className="flex-1">
                                            <div className="font-bold text-slate-800">{entry.item.name}</div>
                                            <div className="text-xs text-slate-500">{entry.item.model} {entry.item.dimensions && `/ ${entry.item.dimensions} `}</div>
                                            <div className="flex items-center gap-3 mt-2">
                                                <div className="flex items-center bg-slate-100 rounded-lg p-1">
                                                    <button
                                                        onClick={() => updateQuantity(entry.item.id, -1)}
                                                        className="w-8 h-8 flex items-center justify-center bg-white rounded shadow-sm text-slate-600 active:scale-95 transition-all disabled:opacity-50"
                                                        disabled={entry.quantity <= 1}
                                                    >
                                                        -
                                                    </button>
                                                    <div className="w-10 text-center font-bold text-slate-800">{entry.quantity}</div>
                                                    <button
                                                        onClick={() => updateQuantity(entry.item.id, 1)}
                                                        className="w-8 h-8 flex items-center justify-center bg-white rounded shadow-sm text-slate-600 active:scale-95 transition-all"
                                                    >
                                                        +
                                                    </button>
                                                </div>
                                                <span className="text-xs text-slate-500 font-bold">{entry.item.unit || '個'}</span>
                                            </div>
                                        </div>
                                        <button onClick={() => removeFromCart(entry.item.id)} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors ml-2">
                                            <Trash2 size={18} />
                                        </button>
                                    </div>
                                ))}

                                <div className="fixed bottom-20 left-4 right-4 max-w-lg mx-auto">
                                    <button
                                        onClick={handleOrder}
                                        disabled={submitting}
                                        className="w-full bg-slate-900 text-white font-bold py-4 rounded-xl shadow-lg shadow-slate-900/30 flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-70 disabled:pointer-events-none"
                                    >
                                        {submitting ? (
                                            <Loader2 className="animate-spin" />
                                        ) : (
                                            <span className="flex items-center gap-2">
                                                <Send size={20} /> 注文を確定する
                                            </span>
                                        )}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                );
            case 'profile':
                return (
                    <div className="bg-white rounded-xl shadow-sm border border-slate-100 divide-y divide-slate-100 m-4">
                        <div className="p-4">
                            <div className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-1">アカウント名</div>
                            <div className="font-medium text-slate-800">{currentUser?.displayName}</div>
                        </div>
                        <div className="p-4">
                            <div className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-1">会社名</div>
                            <div className="font-medium text-slate-800">{currentUser?.companyName}</div>
                        </div>
                        <div className="p-4">
                            <div className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-1">メールアドレス</div>
                            <div className="font-medium text-slate-800">{currentUser?.email}</div>
                        </div>

                        {currentSiteId && (
                            <div className="p-4 bg-slate-50">
                                <div className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-2">現在の現場管理</div>
                                <div className="flex items-center justify-between mb-4">
                                    <div>
                                        <div className="font-bold text-slate-800">{currentSiteName}</div>
                                        {currentGeneralContractor && <div className="text-xs text-slate-500">{currentGeneralContractor} 御中</div>}
                                    </div>
                                    <button
                                        onClick={() => setIsSiteManagerOpen(true)}
                                        className="text-xs bg-white border border-slate-200 px-3 py-1.5 rounded-lg font-bold text-slate-600 shadow-sm"
                                    >
                                        切替
                                    </button>
                                </div>

                                {currentUser?.uid === currentSiteCreatedBy ? (
                                    <button
                                        onClick={handleDeleteSite}
                                        className="w-full py-2.5 bg-white border border-red-200 text-red-600 rounded-lg text-xs font-bold flex items-center justify-center gap-2 hover:bg-red-50 transition-colors shadow-sm"
                                    >
                                        <Trash2 size={14} /> 現場を削除して解散する
                                    </button>
                                ) : (
                                    <button
                                        onClick={handleLeaveSite}
                                        className="w-full py-2.5 bg-white border border-slate-200 text-slate-600 rounded-lg text-xs font-bold flex items-center justify-center gap-2 hover:bg-slate-50 transition-colors shadow-sm"
                                    >
                                        <LogOut size={14} /> この現場から抜ける
                                    </button>
                                )}
                                <p className="text-[10px] text-slate-400 mt-2 text-center">
                                    {currentUser?.uid === currentSiteCreatedBy
                                        ? "※作成者のため、削除すると全メンバーのリストから消えます。"
                                        : "※メンバーのため、抜けても他の人のリストには残ります。"}
                                </p>
                            </div>
                        )}


                        <div className="p-4">
                            <button
                                onClick={() => auth.signOut()}
                                className="w-full py-3 bg-red-50 text-red-600 rounded-lg font-bold flex items-center justify-center gap-2 hover:bg-red-100 transition-colors"
                            >
                                <LogOut size={18} /> ログアウト
                            </button>
                        </div>
                    </div>
                );
            default:
                return null;
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 relative">
            {/* Success Overlay */}
            {showSuccess && (
                <div className="fixed inset-0 z-[200] bg-white animate-in fade-in duration-300">
                    <OrderSuccessView onComplete={handleReturnHome} />
                </div>
            )}

            {/* Site Manager Modal */}
            {isSiteManagerOpen && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl w-full max-w-sm max-h-[80vh] overflow-y-auto relative shadow-2xl animate-in zoom-in-95 duration-200">
                        <button onClick={() => setIsSiteManagerOpen(false)} className="absolute top-4 right-4 p-2 bg-slate-100 rounded-full hover:bg-slate-200 z-10">
                            <X size={16} className="text-slate-500" />
                        </button>
                        <div className="p-6">
                            <SiteManager
                                onSiteSelect={(id, name, gc, cb) => handleSiteSelect(id, name, gc, cb)}
                                currentSiteId={currentSiteId}
                            />
                        </div>
                    </div>
                </div>
            )}

            {/* Header, hidden in search and chat tab for maximizing space */}
            {activeTab !== 'search' && activeTab !== 'chat' && (
                <header className="bg-white border-b border-slate-200 sticky top-0 z-30 px-4 py-3 flex items-center justify-between shadow-sm">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-green to-teal-500 flex items-center justify-center text-white font-black text-xs">
                            CX
                        </div>
                        <h1 className="font-black text-slate-800 text-lg tracking-tight">COREXIA-LinkL <span className="text-[10px] text-slate-400 font-normal ml-2">Build: 02:10</span></h1>
                    </div>
                    <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-600">
                        <User size={16} />
                    </div>
                </header>
            )}

            {/* Header for Chat tab */}
            {activeTab === 'chat' && (
                <header className="bg-white border-b border-slate-200 sticky top-0 z-30 px-4 py-3 flex items-center gap-3 shadow-sm">
                    <div className="w-8 h-8 rounded-lg bg-brand-green flex items-center justify-center text-white">
                        <MessageSquare size={18} />
                    </div>
                    <div>
                        <h1 className="font-bold text-slate-800 text-sm">AI高橋さん</h1>
                        <p className="text-[10px] text-slate-500 font-bold">なんのせ何でも聞いてくれや</p>
                    </div>
                </header>
            )}

            {/* Main Content */}
            <main className="max-w-lg mx-auto flex-1 h-full">
                {renderContent()}
            </main>

            {/* Bottom Navigation */}
            <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 px-6 py-4 z-40 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
                <div className="max-w-lg mx-auto flex justify-between items-center">
                    <button
                        onClick={() => handleTabChange('home')}
                        className={`flex flex-col items-center gap-1 transition-colors ${activeTab === 'home' ? 'text-brand-green' : 'text-slate-400 hover:text-slate-600'}`}
                    >
                        <Home size={24} strokeWidth={activeTab === 'home' ? 2.5 : 2} />
                        <span className="text-[10px] font-bold">ホーム</span>
                    </button>
                    <button
                        onClick={() => handleTabChange('search')}
                        className={`flex flex-col items-center gap-1 transition-colors ${activeTab === 'search' ? 'text-brand-green' : 'text-slate-400 hover:text-slate-600'}`}
                    >
                        <Search size={24} strokeWidth={activeTab === 'search' ? 2.5 : 2} />
                        <span className="text-[10px] font-bold">さがす</span>
                    </button>

                    <button
                        onClick={() => handleTabChange('chat')}
                        className="flex flex-col items-center gap-1 -mt-8"
                    >
                        <div className={`w-14 h-14 rounded-full flex items-center justify-center shadow-lg transition-transform ${activeTab === 'chat' ? 'bg-brand-green text-white scale-110' : 'bg-slate-800 text-white'}`}>
                            <MessageSquare size={24} />
                        </div>
                        <span className={`text-[10px] font-bold ${activeTab === 'chat' ? 'text-brand-green' : 'text-slate-500'}`}>相談</span>
                    </button>

                    <button
                        onClick={() => handleTabChange('cart')}
                        className={`flex flex-col items-center gap-1 transition-colors ${activeTab === 'cart' ? 'text-brand-green' : 'text-slate-400 hover:text-slate-600'}`}
                    >
                        <ShoppingCart size={24} strokeWidth={activeTab === 'cart' ? 2.5 : 2} />
                        <span className="text-[10px] font-bold">カート</span>
                        {Object.keys(cart).length > 0 && <span className="absolute ml-6 -mt-2 bg-red-500 text-white rounded-full text-[10px] w-4 h-4 flex items-center justify-center">{Object.keys(cart).length}</span>}
                    </button>
                    <button
                        onClick={() => handleTabChange('profile')}
                        className={`flex flex-col items-center gap-1 transition-colors ${activeTab === 'profile' ? 'text-brand-green' : 'text-slate-400 hover:text-slate-600'}`}
                    >
                        <User size={24} strokeWidth={activeTab === 'profile' ? 2.5 : 2} />
                        <span className="text-[10px] font-bold">設定</span>
                    </button>
                </div>
            </nav>

            {/* Order Detail Modal */}
            {selectedSlip && (
                <div
                    className="fixed inset-0 bg-slate-900/80 z-[200] flex items-end sm:items-center justify-center p-0 sm:p-4 cursor-pointer"
                    onClick={() => setSelectedSlip(null)}
                >
                    <div
                        className="bg-white w-full max-w-lg rounded-t-[2.5rem] sm:rounded-3xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl cursor-default"
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
                                        <div className="text-brand-green font-bold text-[11px]">注文者: {selectedSlip.orderingPersonName} ({selectedSlip.orderingCompanyName})</div>
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
                                    <span className="bg-blue-600 text-white text-xs font-black px-3 py-1 rounded-full shadow-lg shadow-blue-600/20">手配完了</span>
                                ) : (
                                    <span className="bg-orange-500 text-white text-xs font-black px-3 py-1 rounded-full shadow-lg shadow-orange-500/20">手配中</span>
                                )}
                            </div>

                            <div className="space-y-3">
                                <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-1 text-center">注文商品 ({selectedSlip.items.length})</h4>
                                {selectedSlip.items.map((item, idx) => (
                                    <div key={idx} className="bg-white border border-slate-100 p-4 rounded-2xl flex justify-between items-center shadow-sm">
                                        <div className="flex-1 min-w-0 pr-4">
                                            <div className="font-black text-slate-800 text-sm truncate">{item.name}</div>
                                            <div className="text-[10px] text-slate-400 font-bold mt-1 truncate">
                                                {item.model} {item.dimensions && ` / ${item.dimensions} `}
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
