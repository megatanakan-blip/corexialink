import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import { ShieldCheck, LogOut } from 'lucide-react';
import { auth } from '../firebaseConfig';

export const PendingApproval: React.FC = () => {
    console.log("PendingApproval component mounted");
    const { currentUser } = useAuth();

    const handleLogout = () => {
        auth.signOut();
    };

    return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
            <div className="max-w-md w-full bg-white rounded-2xl shadow-xl overflow-hidden p-8 text-center space-y-6">
                <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto text-brand-blue">
                    <ShieldCheck size={40} />
                </div>

                <div>
                    <h2 className="text-2xl font-bold text-slate-800">承認待ちです</h2>
                    <p className="text-slate-500 mt-2">
                        申請を受け付けました。<br />
                        管理者による承認が完了するまでお待ちください。<br />
                        承認完了後、ログインが可能になります。
                    </p>
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
                    onClick={handleLogout}
                    className="w-full py-3 text-slate-500 hover:text-red-500 transition-colors font-medium flex items-center justify-center gap-2"
                >
                    <LogOut size={18} />
                    ログアウト
                </button>
            </div>
        </div>
    );
};
