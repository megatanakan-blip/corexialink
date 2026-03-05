import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import { ShieldCheck, Home } from 'lucide-react';
import { auth } from '../firebaseConfig';

export const PendingApproval: React.FC = () => {
    const { currentUser } = useAuth();

    const handleGoTop = async () => {
        await auth.signOut();
        // Use full page reload to avoid React DOM reconciliation crash
        // that occurs when auth state changes and navigate() fire simultaneously
        window.location.href = import.meta.env.BASE_URL + 'login';
    };

    return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
            <div className="max-w-md w-full bg-white rounded-2xl shadow-xl overflow-hidden p-8 text-center space-y-6">
                <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto text-brand-blue">
                    <ShieldCheck size={40} />
                </div>

                <div>
                    <h2 className="text-2xl font-black text-slate-800 tracking-tight">登録申請を受け付けました</h2>
                    <div className="mt-6 bg-blue-50 border border-blue-100 p-6 rounded-2xl text-blue-900 shadow-sm">
                        <p className="text-sm font-bold leading-relaxed">
                            登録承認メールが届くまで少々お待ちください。<br />
                            基本的に24時間以内に承認メールが届きますが、<br />
                            万が一届かない場合はお手数ですが<br />
                            <span className="text-lg block mt-2 text-brand-blue">
                                0155-35-6815<br />
                                大栄管機、田中まで
                            </span>
                            お問い合わせください。
                        </p>
                    </div>
                </div>

                <div className="text-left bg-slate-50 p-4 rounded-xl border border-slate-100">
                    <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mb-2">申請情報</p>
                    <div className="space-y-1">
                        <p className="text-sm text-slate-700"><span className="font-semibold">氏名:</span> {currentUser?.displayName}</p>
                        <p className="text-sm text-slate-700"><span className="font-semibold">会社名:</span> {currentUser?.companyName}</p>
                        <p className="text-sm text-slate-700"><span className="font-semibold">電話番号:</span> {currentUser?.phoneNumber}</p>
                        <p className="text-sm text-slate-700"><span className="font-semibold">メール:</span> {currentUser?.email}</p>
                    </div>
                </div>

                <button
                    onClick={handleGoTop}
                    className="w-full py-3 bg-brand-blue text-white font-bold rounded-xl hover:bg-brand-blue-dark transition-colors flex items-center justify-center gap-2 shadow-lg shadow-brand-blue/20"
                >
                    <Home size={18} />
                    トップへ戻る
                </button>
            </div>
        </div>
    );
};
