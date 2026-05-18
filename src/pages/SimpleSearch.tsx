import React, { useState, useEffect, useMemo, useRef, useDeferredValue } from 'react';
import type { MaterialItem } from '../types';
import { Search, Plus, X } from 'lucide-react';
import { subscribeToMaterials } from '../services/OrderService';
import { filterAndSortItems } from '../services/searchUtils';

interface SimpleSearchProps {
    onAddToCart: (item: MaterialItem, quantity: number) => void;
    onUpdateQuantity: (id: string, quantity: number) => void;
    cartItems: { [id: string]: number };
}

interface MaterialRowProps {
    item: MaterialItem;
    cartQuantity: number;
    onAddToCart: (item: MaterialItem, quantity: number) => void;
    onUpdateQuantity: (id: string, quantity: number) => void;
}

const MaterialRow = React.memo<MaterialRowProps>(({ item, cartQuantity, onAddToCart, onUpdateQuantity }) => {
    return (
        <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-100 flex items-center justify-between">
            <div>
                <div className="text-xs text-brand-green font-bold mb-0.5">{item.category}</div>
                <h3 className="font-bold text-slate-800 line-clamp-1">{item.name}</h3>
                <div className="flex items-center gap-2 mt-1 text-xs text-slate-500 font-mono">
                    <span className="bg-slate-100 px-1.5 py-0.5 rounded">{item.model}</span>
                    <span>{item.dimensions}</span>
                </div>
            </div>

            <div className="flex items-center gap-3">
                {cartQuantity ? (
                    <div className="flex items-center gap-2 bg-slate-50 border border-brand-green/30 rounded-lg p-1">
                        <button 
                            onClick={() => onUpdateQuantity(item.id, cartQuantity - 1)}
                            className="w-8 h-8 flex items-center justify-center text-brand-green bg-white rounded shadow-sm hover:bg-green-50 active:scale-95 transition-all text-lg font-black"
                        >-</button>
                        <span className="w-6 text-center font-black text-slate-800 text-sm">{cartQuantity}</span>
                        <button 
                            onClick={() => onUpdateQuantity(item.id, cartQuantity + 1)}
                            className="w-8 h-8 flex items-center justify-center text-brand-green bg-white rounded shadow-sm hover:bg-green-50 active:scale-95 transition-all text-lg font-black"
                        >+</button>
                    </div>
                ) : (
                    <button
                        onClick={() => onAddToCart(item, 1)}
                        className="bg-slate-900 text-white p-3 rounded-xl shadow-lg shadow-slate-900/20 active:scale-95 transition-all outline-none"
                    >
                        <Plus size={20} />
                    </button>
                )}
            </div>
        </div>
    );
}, (prevProps, nextProps) => {
    // Highly optimized custom memo comparison: only re-render if the item metadata or quantity changes.
    // This makes character typing 100% instant as callbacks or parent re-renders are ignored.
    return (
        prevProps.item.id === nextProps.item.id &&
        prevProps.item.name === nextProps.item.name &&
        prevProps.item.model === nextProps.item.model &&
        prevProps.item.dimensions === nextProps.item.dimensions &&
        prevProps.cartQuantity === nextProps.cartQuantity
    );
});

export const SimpleSearch: React.FC<SimpleSearchProps> = ({ onAddToCart, onUpdateQuantity, cartItems }) => {
    const [items, setItems] = useState<MaterialItem[]>([]);
    const [query, setQuery] = useState('');
    const [selectedCategory, setSelectedCategory] = useState<string>('all');
    const [loading, setLoading] = useState(true);
    const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const [debouncedQuery, setDebouncedQuery] = useState('');
    // useDeferredValue lets React deprioritise the expensive filter recompute
    // so the input always feels instant even if filtering takes >16ms
    const searchQuery = useDeferredValue(debouncedQuery);

    // Free entry states
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [manualName, setManualName] = useState('');
    const [manualModel, setManualModel] = useState('');
    const [manualDimensions, setManualDimensions] = useState('');
    const [manualCategory, setManualCategory] = useState<string>('自由入力');
    const [manualQuantity, setManualQuantity] = useState(1);
    const [manualUnit, setManualUnit] = useState('個');

    useEffect(() => {
        const unsubscribe = subscribeToMaterials((data) => {
            setItems(data);
            setLoading(false);
        });
        return unsubscribe;
    }, []);

    // Debounce: update debouncedQuery 300ms after typing stops.
    // useDeferredValue then further deprioritises the filter recompute.
    const handleQueryChange = (value: string) => {
        setQuery(value);
        if (debounceTimer.current) clearTimeout(debounceTimer.current);
        debounceTimer.current = setTimeout(() => {
            setDebouncedQuery(value);
        }, 300);
    };

    const resetManualForm = () => {
        setManualName('');
        setManualModel('');
        setManualDimensions('');
        setManualCategory('自由入力');
        setManualQuantity(1);
        setManualUnit('個');
    };

    const handleAddManualItem = (e: React.FormEvent) => {
        e.preventDefault();
        if (!manualName.trim()) {
            alert('商品名を入力してください');
            return;
        }

        const tempId = `manual-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
        const newItem: MaterialItem = {
            id: tempId,
            name: manualName.trim(),
            category: manualCategory,
            model: manualModel.trim(),
            dimensions: manualDimensions.trim(),
            quantity: 0,
            unit: manualUnit.trim() || '個',
            location: '',
            listPrice: 0,
            sellingPrice: 0,
            costPrice: 0,
            updatedAt: Date.now()
        };

        onAddToCart(newItem, manualQuantity);
        setIsModalOpen(false);
        resetManualForm();
    };

    // Build dynamic category list from actual Firestore data
    const categories = useMemo(() => {
        const seen = new Set<string>();
        const result: string[] = [];
        items.forEach(item => {
            const cat = item.category?.trim();
            if (cat && !seen.has(cat)) {
                seen.add(cat);
                result.push(cat);
            }
        });
        return result.sort();
    }, [items]);

    const filteredItems = useMemo(() => {
        const categoryFiltered = selectedCategory === 'all' 
            ? items 
            : items.filter(item => item.category?.trim() === selectedCategory);
            
        return filterAndSortItems(categoryFiltered, searchQuery);
    }, [items, selectedCategory, searchQuery]);

    return (
        <div className="h-full flex flex-col bg-slate-50 relative">
            <div className="sticky top-0 bg-white z-10 p-4 shadow-sm space-y-3">
                <div className="flex gap-2">
                    <div className="relative flex-grow">
                        <Search className="absolute left-3 top-3.5 text-slate-400" size={18} />
                        <input
                            type="text"
                            placeholder="商品名、型番、メーカーで検索..."
                            className="w-full pl-10 pr-4 py-3 bg-slate-100 border-none rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-green/50 transition-all font-medium text-sm"
                            value={query}
                            onChange={(e) => handleQueryChange(e.target.value)}
                        />
                    </div>
                    <button
                        onClick={() => {
                            if (query) {
                                setManualName(query);
                            }
                            setIsModalOpen(true);
                        }}
                        className="bg-slate-900 hover:bg-slate-800 text-white font-bold px-4 py-3 rounded-xl transition-all text-xs flex items-center gap-1.5 shrink-0 shadow-sm active:scale-95"
                    >
                        <Plus size={14} />
                        <span>自由入力</span>
                    </button>
                </div>
                <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
                    <button
                        onClick={() => setSelectedCategory('all')}
                        className={`whitespace-nowrap px-4 py-1.5 rounded-full text-xs font-bold transition-all ${selectedCategory === 'all' ? 'bg-brand-green text-white shadow-md' : 'bg-slate-100 text-slate-500'}`}
                    >
                        すべて
                    </button>
                    {categories.map(cat => (
                        <button
                            key={cat}
                            onClick={() => setSelectedCategory(cat)}
                            className={`whitespace-nowrap px-4 py-1.5 rounded-full text-xs font-bold transition-all ${selectedCategory === cat ? 'bg-brand-green text-white shadow-md' : 'bg-slate-100 text-slate-500'}`}
                        >
                            {cat}
                        </button>
                    ))}
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3 pb-24">
                {/* Free entry banner if user starts searching */}
                {query.trim().length > 0 && filteredItems.length > 0 && (
                    <div className="bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-100 rounded-xl p-4 shadow-sm flex items-center justify-between animate-in slide-in-from-top-2 duration-300">
                        <div className="flex-1 pr-2">
                            <h4 className="font-bold text-slate-800 text-xs">「{query}」を自由に入力して追加</h4>
                            <p className="text-[10px] text-slate-500 mt-0.5 font-medium">お探しの商品が見つからない場合は自由に入力できます</p>
                        </div>
                        <button
                            onClick={() => {
                                setManualName(query);
                                setIsModalOpen(true);
                            }}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-3 py-2 rounded-lg transition-colors flex items-center gap-1 shrink-0 shadow-sm active:scale-95"
                        >
                            <Plus size={12} /> 自由追加
                        </button>
                    </div>
                )}

                {loading ? (
                    <div className="text-center py-10 text-slate-400 text-sm">読み込み中...</div>
                ) : filteredItems.length === 0 ? (
                    <div className="text-center py-12 px-6 bg-white rounded-2xl border border-slate-100 shadow-sm max-w-sm mx-auto my-8 animate-in fade-in duration-300">
                        <div className="w-16 h-16 bg-slate-50 text-slate-400 rounded-full flex items-center justify-center mx-auto mb-4 border border-slate-100">
                            <Search size={24} className="opacity-60" />
                        </div>
                        <h3 className="font-bold text-slate-800 text-sm mb-1">商品が見つかりません</h3>
                        <p className="text-xs text-slate-400 mb-6 leading-relaxed">
                            お探しの商品がマスターに登録されていないようです。自由に入力して直接追加できます。
                        </p>
                        <button
                            onClick={() => {
                                if (query) setManualName(query);
                                setIsModalOpen(true);
                            }}
                            className="w-full bg-brand-green hover:bg-green-700 text-white font-bold py-3.5 rounded-xl transition-all shadow-md active:scale-95 flex items-center justify-center gap-2 text-sm"
                        >
                            <Plus size={16} />
                            自由に入力して追加する
                        </button>
                    </div>
                ) : (
                    <>
                        {filteredItems.slice(0, 100).map(item => (
                            <MaterialRow
                                key={item.id}
                                item={item}
                                cartQuantity={cartItems[item.id] || 0}
                                onAddToCart={onAddToCart}
                                onUpdateQuantity={onUpdateQuantity}
                            />
                        ))}
                        {filteredItems.length > 100 && (
                            <div className="text-center py-6 text-slate-400 text-xs font-bold bg-slate-100/50 rounded-xl border border-dashed border-slate-200">
                                検索結果が100件を超えています。より具体的なキーワードで絞り込んでください。
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* Free Entry Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[150] flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div 
                        className="bg-white w-full max-w-md rounded-3xl overflow-hidden shadow-2xl border border-slate-100 flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Modal Header */}
                        <div className="p-6 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-slate-100 flex items-center justify-between shrink-0">
                            <div>
                                <h3 className="font-black text-base text-slate-800 tracking-tight">商品を自由に入力して追加</h3>
                                <p className="text-[10px] text-slate-400 font-bold mt-0.5">マスターにない資材の情報を自由に入力してください</p>
                            </div>
                            <button
                                onClick={() => {
                                    setIsModalOpen(false);
                                    resetManualForm();
                                }}
                                className="w-8 h-8 bg-white hover:bg-slate-100 rounded-full flex items-center justify-center transition-colors border border-slate-200 shadow-sm"
                            >
                                <X size={14} className="text-slate-500" />
                            </button>
                        </div>

                        {/* Modal Body / Form */}
                        <form onSubmit={handleAddManualItem} className="flex-1 overflow-y-auto p-6 space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-1.5">商品名 <span className="text-red-500">*</span></label>
                                <input
                                    type="text"
                                    required
                                    placeholder="例: 白ソケット 20A"
                                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-green/30 focus:bg-white transition-all text-sm font-medium"
                                    value={manualName}
                                    onChange={(e) => setManualName(e.target.value)}
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 mb-1.5">型番/モデル</label>
                                    <input
                                        type="text"
                                        placeholder="例: S"
                                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-green/30 focus:bg-white transition-all text-sm font-medium"
                                        value={manualModel}
                                        onChange={(e) => setManualModel(e.target.value)}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 mb-1.5">寸法/サイズ</label>
                                    <input
                                        type="text"
                                        placeholder="例: 20A"
                                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-green/30 focus:bg-white transition-all text-sm font-medium"
                                        value={manualDimensions}
                                        onChange={(e) => setManualDimensions(e.target.value)}
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4 items-end">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 mb-1.5">数量</label>
                                    <div className="flex items-center bg-slate-50 border border-slate-200 rounded-xl p-1">
                                        <button
                                            type="button"
                                            onClick={() => setManualQuantity(prev => Math.max(1, prev - 1))}
                                            className="w-9 h-9 flex items-center justify-center bg-white rounded-lg shadow-sm text-slate-600 active:scale-95 transition-all font-black text-lg border border-slate-100"
                                        >
                                            -
                                        </button>
                                        <input
                                            type="number"
                                            min="1"
                                            className="w-12 text-center bg-transparent border-none focus:outline-none font-bold text-slate-800 text-sm"
                                            value={manualQuantity}
                                            onChange={(e) => setManualQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setManualQuantity(prev => prev + 1)}
                                            className="w-9 h-9 flex items-center justify-center bg-white rounded-lg shadow-sm text-slate-600 active:scale-95 transition-all font-black text-lg border border-slate-100"
                                        >
                                            +
                                        </button>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 mb-1.5">単位</label>
                                    <input
                                        type="text"
                                        placeholder="例: 個、本、m"
                                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-green/30 focus:bg-white transition-all text-sm font-medium"
                                        value={manualUnit}
                                        onChange={(e) => setManualUnit(e.target.value)}
                                    />
                                </div>
                            </div>

                            <button
                                type="submit"
                                className="w-full bg-slate-900 hover:bg-slate-800 text-white font-black py-4 rounded-xl shadow-lg active:scale-95 transition-all text-sm mt-2 flex items-center justify-center gap-2"
                            >
                                <Plus size={16} />
                                カートに追加する
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};
