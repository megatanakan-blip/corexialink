import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { auth, db } from '../firebaseConfig';
import type { UserProfile } from '../types';
import { UserPlus, Building2, User, Phone, Mail, Lock, Loader2 } from 'lucide-react';

export const Signup: React.FC = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [displayName, setDisplayName] = useState('');
    const [companyName, setCompanyName] = useState('');
    const [phoneNumber, setPhoneNumber] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const navigate = useNavigate();

    const handleSignup = async (e: React.FormEvent) => {
        e.preventDefault();

        if (password.length < 6) {
            setError('パスワードは6文字以上で設定してください。');
            return;
        }

        setLoading(true);
        setError('');

        try {
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;

            const userProfile: UserProfile = {
                uid: user.uid,
                email: user.email!,
                displayName,
                companyName,
                phoneNumber,
                role: 'pending',
                isApproved: false,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            };

            await setDoc(doc(db, 'users', user.uid), userProfile);
            console.log("Signup success, navigating to /pending");
            navigate('/pending');
        } catch (err: any) {
            console.error('Signup error:', err);
            if (err.code === 'auth/email-already-in-use') {
                setError('このメールアドレスは既に登録されています。ログインをお試しください。万が一ログインできない場合は 0155-35-6815 大栄管機、田中までお問い合わせください。');
            } else {
                setError('登録に失敗しました: ' + err.message);
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
            <div className="max-w-md w-full bg-white rounded-2xl shadow-xl overflow-hidden">
                <div className="bg-brand-blue p-8 text-center">
                    <h1 className="text-3xl font-black text-white tracking-tight">COREXIA-Link</h1>
                    <p className="text-blue-100 mt-2 font-medium">アカウント新規登録</p>
                </div>

                <form onSubmit={handleSignup} className="p-8 space-y-4">
                    {/* Always-present error box: hidden via style to avoid DOM node removal */}
                    <div
                        className="rounded-lg text-sm p-3"
                        style={{
                            display: error ? 'block' : 'none',
                            backgroundColor: '#fef2f2',
                            color: '#dc2626',
                        }}
                    >
                        {error}
                    </div>

                    <div className="space-y-4">
                        <div className="relative">
                            <Mail className="absolute left-3 top-3 text-slate-400" size={20} />
                            <input
                                type="email"
                                placeholder="メールアドレス"
                                className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-blue focus:border-transparent transition-all"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                            />
                        </div>
                        <div className="relative">
                            <Lock className="absolute left-3 top-3 text-slate-400" size={20} />
                            <input
                                type="password"
                                placeholder="パスワード（6文字以上）"
                                className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-blue focus:border-transparent transition-all"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                minLength={6}
                            />
                        </div>
                        <div className="relative">
                            <User className="absolute left-3 top-3 text-slate-400" size={20} />
                            <input
                                type="text"
                                placeholder="氏名 (担当者名)"
                                className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-blue focus:border-transparent transition-all"
                                value={displayName}
                                onChange={(e) => setDisplayName(e.target.value)}
                                required
                            />
                        </div>
                        <div className="relative">
                            <Building2 className="absolute left-3 top-3 text-slate-400" size={20} />
                            <input
                                type="text"
                                placeholder="会社名"
                                className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-blue focus:border-transparent transition-all"
                                value={companyName}
                                onChange={(e) => setCompanyName(e.target.value)}
                                required
                            />
                        </div>
                        <div className="relative">
                            <Phone className="absolute left-3 top-3 text-slate-400" size={20} />
                            <input
                                type="tel"
                                placeholder="電話番号"
                                className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-blue focus:border-transparent transition-all"
                                value={phoneNumber}
                                onChange={(e) => setPhoneNumber(e.target.value)}
                                required
                            />
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-brand-blue text-white font-bold py-4 rounded-xl hover:bg-brand-blue-dark transition-all shadow-lg shadow-brand-blue/30 flex items-center justify-center gap-2"
                    >
                        {/* Stable DOM: both spans always present, toggled via style */}
                        <span style={{ display: loading ? 'none' : 'flex', alignItems: 'center', gap: '8px' }}>
                            <UserPlus size={20} />
                            登録申請を送る
                        </span>
                        <span style={{ display: loading ? 'flex' : 'none', alignItems: 'center' }}>
                            <Loader2 className="animate-spin" />
                        </span>
                    </button>

                    <div className="text-center mt-4">
                        <Link to="/login" className="text-sm text-slate-500 hover:text-brand-blue font-medium">
                            すでにアカウントをお持ちの方はこちら
                        </Link>
                    </div>
                </form>
            </div>
        </div>
    );
};
