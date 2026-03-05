import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../firebaseConfig';
import { LogIn, Mail, Lock, Loader2 } from 'lucide-react';

export const Login: React.FC = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            await signInWithEmailAndPassword(auth, email, password);
            // Use full page reload to avoid React DOM reconciliation crash
            // that occurs when auth state changes and navigate() fire simultaneously
            window.location.href = import.meta.env.BASE_URL;
        } catch (err: any) {
            console.error('Login error:', err);
            setError('ログインに失敗しました。メールアドレスとパスワードを確認してください。');
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
            <div className="max-w-md w-full bg-white rounded-2xl shadow-xl overflow-hidden">
                <div className="bg-brand-blue p-8 text-center">
                    <h1 className="text-3xl font-black text-white tracking-tight">COREXIA-Link</h1>
                    <p className="text-blue-100 mt-2 font-medium">ログイン</p>
                </div>

                <form onSubmit={handleLogin} className="p-8 space-y-6">
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
                                placeholder="パスワード"
                                className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-blue focus:border-transparent transition-all"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
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
                            <LogIn size={20} />
                            ログイン
                        </span>
                        <span style={{ display: loading ? 'flex' : 'none', alignItems: 'center' }}>
                            <Loader2 className="animate-spin" />
                        </span>
                    </button>

                    <div className="text-center mt-4">
                        <Link to="/signup" className="text-sm text-slate-500 hover:text-brand-blue font-medium">
                            アカウントをお持ちでない場合はこちら
                        </Link>
                    </div>
                </form>
            </div>
        </div>
    );
};
