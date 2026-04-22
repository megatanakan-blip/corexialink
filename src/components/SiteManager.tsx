import React, { useState, useEffect } from 'react';
import { createSiteWithIndex, joinSiteWithIndex, subscribeToMySites, updateSite, updateSiteMessage } from '../services/SiteService';
import { useAuth } from '../contexts/AuthContext';
import type { Genba } from '../types';
import { Building2, Plus, Users, Copy, Check } from 'lucide-react';

interface SiteManagerProps {
    onSiteSelect: (siteId: string, siteName: string, generalContractor?: string, createdBy?: string) => void;
    currentSiteId?: string;
}

export const SiteManager: React.FC<SiteManagerProps> = ({ onSiteSelect, currentSiteId }) => {
    const { currentUser } = useAuth();
    const [sites, setSites] = useState<Genba[]>([]);
    const [mode, setMode] = useState<'list' | 'create' | 'join'>('list');

    // Form Inputs
    const [newName, setNewName] = useState('');
    const [newAddress, setNewAddress] = useState('');
    const [newGeneralContractor, setNewGeneralContractor] = useState('');
    const [newForemanMessage, setNewForemanMessage] = useState('');
    const [inviteCode, setInviteCode] = useState('');
    const [loading, setLoading] = useState(false);
    const [editingSiteId, setEditingSiteId] = useState<string | null>(null);

    useEffect(() => {
        if (!currentUser) return;
        const unsub = subscribeToMySites(currentUser.uid, (data) => setSites(data));
        return unsub;
    }, [currentUser]);

    const handleCreate = async () => {
        if (!currentUser || !newName) return;
        setLoading(true);
        try {
            const id = await createSiteWithIndex(newName, newAddress, currentUser, newGeneralContractor);
            if (newForemanMessage) {
                await updateSiteMessage(id, newForemanMessage);
            }
            setMode('list');
            resetForm();
            onSiteSelect(id, newName, newGeneralContractor, currentUser.uid);
        } catch (e) {
            alert('作成エラー');
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const handleUpdate = async () => {
        if (!editingSiteId || !newName) return;
        setLoading(true);
        try {
            await updateSite(editingSiteId, {
                name: newName,
                generalContractor: newGeneralContractor,
                address: newAddress,
                foremanMessage: newForemanMessage
            });
            setEditingSiteId(null);
            setMode('list');
            resetForm();
        } catch (e) {
            alert('更新エラー');
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const resetForm = () => {
        setNewName('');
        setNewAddress('');
        setNewGeneralContractor('');
        setNewForemanMessage('');
    };

    const startEdit = (site: Genba) => {
        setEditingSiteId(site.id);
        setNewName(site.name);
        setNewGeneralContractor(site.generalContractor || '');
        setNewAddress(site.address || '');
        setNewForemanMessage(site.foremanMessage || '');
        setMode('create');
    };

    const handleJoin = async () => {
        if (!currentUser || !inviteCode) return;
        setLoading(true);
        try {
            const id = await joinSiteWithIndex(inviteCode, currentUser);
            setMode('list');
            setInviteCode('');
            const joinedSite = sites.find(s => s.id === id);
            if (joinedSite) onSiteSelect(id, joinedSite.name);
            alert('参加しました！');
        } catch (e) {
            alert('参加エラー: コードが正しいか確認してください');
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const copyCode = (code: string) => {
        navigator.clipboard.writeText(code);
        alert('招待コードをコピーしました');
    };

    if (mode === 'create') {
        const isEdit = !!editingSiteId;
        return (
            <div className="p-4 bg-white rounded-xl shadow-sm border border-slate-200">
                <h3 className="font-bold mb-4">{isEdit ? '現場情報の編集' : '新規現場作成'}</h3>
                <div className="space-y-3">
                    <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 block">現場名 <span className="text-rose-500">*</span></label>
                        <input
                            value={newName} onChange={e => setNewName(e.target.value)}
                            placeholder="例: ○○邸新築工事"
                            className="w-full p-2 border border-slate-200 rounded-lg"
                        />
                    </div>
                    <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 block">職長のひと言 (ダッシュボード表示)</label>
                        <input
                            value={newForemanMessage} onChange={e => setNewForemanMessage(e.target.value)}
                            placeholder="例: 今日も一日安全に！"
                            className="w-full p-2 border border-brand-green/30 bg-brand-green/5 rounded-lg text-brand-green font-bold"
                        />
                        <p className="text-[10px] text-slate-400 mt-1">現場メンバー全員のトップ画面に表示されます</p>
                    </div>
                    <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 block">元請け会社名</label>
                        <input
                            value={newGeneralContractor} onChange={e => setNewGeneralContractor(e.target.value)}
                            placeholder="例: 大栄管機株式会社"
                            className="w-full p-2 border border-slate-200 rounded-lg"
                        />
                    </div>
                    <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 block">住所 (任意)</label>
                        <input
                            value={newAddress} onChange={e => setNewAddress(e.target.value)}
                            placeholder="住所"
                            className="w-full p-2 border border-slate-200 rounded-lg"
                        />
                    </div>
                    <div className="flex gap-2 mt-4">
                        <button onClick={() => { setMode('list'); setEditingSiteId(null); resetForm(); }} className="flex-1 py-2 text-slate-500 bg-slate-100 rounded-lg">キャンセル</button>
                        <button onClick={isEdit ? handleUpdate : handleCreate} disabled={loading || !newName} className="flex-1 py-2 text-white bg-blue-600 rounded-lg font-bold disabled:opacity-50">
                            {isEdit ? '更新' : '作成'}
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    if (mode === 'join') {
        return (
            <div className="p-4 bg-white rounded-xl shadow-sm border border-slate-200">
                <h3 className="font-bold mb-4">招待コードで参加</h3>
                <div className="space-y-3">
                    <input
                        value={inviteCode} onChange={e => setInviteCode(e.target.value)}
                        placeholder="招待コードを入力 (6桁)"
                        className="w-full p-2 border border-slate-200 rounded-lg font-mono text-lg tracking-widest text-center"
                        maxLength={6}
                    />
                    <div className="flex gap-2 mt-4">
                        <button onClick={() => setMode('list')} className="flex-1 py-2 text-slate-500 bg-slate-100 rounded-lg">キャンセル</button>
                        <button onClick={handleJoin} disabled={loading} className="flex-1 py-2 text-white bg-blue-600 rounded-lg font-bold">参加</button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between pr-8">
                <h3 className="font-bold text-slate-800 flex items-center gap-2"><Building2 size={18} /> 現場リスト</h3>
                <div className="flex gap-2 text-xs">
                    <button onClick={() => { setMode('join'); resetForm(); }} className="text-blue-600 bg-blue-50 px-3 py-1.5 rounded-lg font-bold">コード入力</button>
                    <button onClick={() => { setMode('create'); setEditingSiteId(null); resetForm(); }} className="text-white bg-blue-600 px-3 py-1.5 rounded-lg font-bold flex items-center gap-1"><Plus size={14} /> 新規</button>
                </div>
            </div>

            <div className="space-y-2">
                {sites.map(site => (
                    <div
                        key={site.id}
                        className={`p-3 rounded-xl border transition-all ${currentSiteId === site.id ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-100' : 'border-slate-200 bg-white hover:border-blue-300'}`}
                    >
                        <div className="flex justify-between items-start">
                            <div className="flex-1 cursor-pointer" onClick={() => onSiteSelect(site.id, site.name, site.generalContractor, site.createdBy)}>
                                <div className="font-bold text-slate-800 flex items-center gap-2">
                                    {site.name}
                                    {currentSiteId === site.id && <Check size={14} className="text-blue-500" />}
                                </div>
                                {site.generalContractor && (
                                    <div className="text-xs text-slate-500 mt-0.5 font-medium">{site.generalContractor} 御中</div>
                                )}
                                <div className="text-xs text-slate-400 mt-0.5">{site.address || "住所未設定"}</div>
                            </div>
                            <div className="flex flex-col items-end gap-1 ml-3">
                                {site.createdBy === currentUser?.uid && (
                                    <button onClick={() => startEdit(site)} className="p-1 px-2 text-[10px] font-bold text-blue-600 bg-blue-50 rounded hover:bg-blue-100 mb-1">
                                        編集
                                    </button>
                                )}
                                <button onClick={() => copyCode(site.inviteCode)} className="flex flex-col items-center gap-1 p-1.5 hover:bg-slate-100 rounded">
                                    <div className="text-[10px] text-slate-400 font-bold uppercase">CODE</div>
                                    <div className="font-mono font-bold text-slate-600 text-sm flex items-center gap-1">
                                        {site.inviteCode} <Copy size={10} />
                                    </div>
                                </button>
                            </div>
                        </div>
                        <div className="mt-2 text-xs text-slate-400 flex items-center gap-1">
                            <Users size={12} /> {site.members.length}名が参加中
                        </div>
                    </div>
                ))}
                {sites.length === 0 && (
                    <div className="text-center py-6 text-slate-400 text-sm border-2 border-dashed border-slate-200 rounded-xl">
                        まだ参加している現場がありません。<br />新規作成するか、招待コードで参加してください。
                    </div>
                )}
            </div>
        </div>
    );
};
