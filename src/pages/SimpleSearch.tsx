import React, { useState, useEffect, useMemo } from 'react';
import type { MaterialItem } from '../types';
import { Search, Plus } from 'lucide-react';
import { subscribeToMaterials } from '../services/OrderService';
import { filterAndSortItems } from '../services/searchUtils';


interface SimpleSearchProps {
    onAddToCart: (item: MaterialItem, quantity: number) => void;
    onUpdateQuantity: (id: string, quantity: number) => void;
    cartItems: { [id: string]: number };
}

export const SimpleSearch: React.FC<SimpleSearchProps> = ({ onAddToCart, onUpdateQuantity, cartItems }) => {
    const [items, setItems] = useState<MaterialItem[]>([]);
    const [query, setQuery] = useState('');
    const [selectedCategory, setSelectedCategory] = useState<string>('all');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const unsubscribe = subscribeToMaterials((data) => {
            setItems(data);
            setLoading(false);
        });
        return unsubscribe;
    }, []);



    // Build dynamic category list from actual Firestore data (preserves exact strings)
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
            
        if (!query.trim()) return categoryFiltered;
        return filterAndSortItems(categoryFiltered, query);
    }, [items, selectedCategory, query]);


    return (
        <div className="h-full flex flex-col bg-slate-50">
            <div className="sticky top-0 bg-white z-10 p-4 shadow-sm space-y-3">
                <div className="relative">
                    <Search className="absolute left-3 top-3 text-slate-400" size={20} />
                    <input
                        type="text"
                        placeholder="商品名、型番、メーカーで検索..."
                        className="w-full pl-10 pr-4 py-3 bg-slate-100 border-none rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-green/50 transition-all font-medium"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                    />
                </div>
                <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
                    <button
                        onClick={() => setSelectedCategory('all')}
                        className={`whitespace-nowrap px-4 py-1.5 rounded-full text-xs font-bold transition-all ${selectedCategory === 'all' ? 'bg-brand-green text-white shadow-md' : 'bg-slate-100 text-slate-500'}`}
                    >
                        すべて
                    </button>
                    {/* Tabs built from actual Firestore data so spelling always matches */}
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
                {loading ? (
                    <div className="text-center py-10 text-slate-400 text-sm">読み込み中...</div>
                ) : filteredItems.length === 0 ? (
                    <div className="text-center py-10 text-slate-400 text-sm">該当する資材が見つかりません</div>
                ) : (
                    filteredItems.map(item => (
                        <div key={item.id} className="bg-white rounded-xl p-4 shadow-sm border border-slate-100 flex items-center justify-between">
                            <div>
                                <div className="text-xs text-brand-green font-bold mb-0.5">{item.category}</div>
                                <h3 className="font-bold text-slate-800 line-clamp-1">{item.name}</h3>
                                <div className="flex items-center gap-2 mt-1 text-xs text-slate-500 font-mono">
                                    <span className="bg-slate-100 px-1.5 py-0.5 rounded">{item.model}</span>
                                    <span>{item.dimensions}</span>
                                </div>
                            </div>

                            <div className="flex items-center gap-3">
                                {cartItems[item.id] ? (
                                    <div className="flex items-center gap-2 bg-slate-50 border border-brand-green/30 rounded-lg p-1">
                                        <button 
                                            onClick={() => onUpdateQuantity(item.id, cartItems[item.id] - 1)}
                                            className="w-8 h-8 flex items-center justify-center text-brand-green bg-white rounded shadow-sm hover:bg-green-50 active:scale-95 transition-all text-lg font-black"
                                        >-</button>
                                        <span className="w-6 text-center font-black text-slate-800 text-sm">{cartItems[item.id]}</span>
                                        <button 
                                            onClick={() => onUpdateQuantity(item.id, cartItems[item.id] + 1)}
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
                    ))
                )}
            </div>
        </div>
    );
};
