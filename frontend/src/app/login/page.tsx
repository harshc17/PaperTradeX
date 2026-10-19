'use client';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { GOOGLE_CLIENT_ID } from '@/lib/config';
import { TrendingUp, Eye, EyeOff, ArrowRight, CheckCircle2, Activity } from 'lucide-react';

declare global {
    interface Window {
        google?: {
            accounts: { id: { initialize: (cfg: object) => void; renderButton: (el: HTMLElement, cfg: object) => void } };
        };
    }
}

export default function AuthPage() {
    const router = useRouter();
    const { login, loginWithGoogle, register } = useAuth();
    const [isLogin, setIsLogin] = useState(true);
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [name, setName] = useState('');
    const [phone, setPhone] = useState('');
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const handleGoogleCredential = useCallback(async (response: { credential: string }) => {
        setLoading(true);
        setError('');
        try {
            await loginWithGoogle(response.credential);
            router.push('/dashboard');
        } catch (e: any) {
            setError(e.message || 'Google login failed');
        } finally {
            setLoading(false);
        }
    }, [loginWithGoogle, router]);

    useEffect(() => {
        if (!GOOGLE_CLIENT_ID || !window.google) return;
        window.google.accounts.id.initialize({ client_id: GOOGLE_CLIENT_ID, callback: handleGoogleCredential });
        const btn = document.getElementById('google-signin-btn');
        if (btn) window.google.accounts.id.renderButton(btn, { theme: 'outline', size: 'large', width: btn.offsetWidth || 400 });
    }, [handleGoogleCredential]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        setSuccess('');
        try {
            if (isLogin) {
                await login(email, password);
                router.push('/dashboard');
            } else {
                await register(name, email, password, phone);
                setSuccess('Account created! Redirecting...');
                setTimeout(() => router.push('/dashboard'), 1000);
            }
        } catch (e: any) {
            setError(e.message || 'Something went wrong');
        } finally {
            setLoading(false);
        }
    };

    const switchTab = (toLogin: boolean) => { setIsLogin(toLogin); setError(''); setSuccess(''); };

    const inputCls = "w-full px-4 py-3 rounded-xl text-sm text-ink placeholder-[#5c6675] bg-surface-2 border border-white/10 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all";

    return (
        <div className="min-h-screen flex font-sans bg-[#0a0e14]">
            {/* Left Panel */}
            <div className="hidden lg:flex lg:w-[52%] flex-col justify-between p-14 relative overflow-hidden"
                style={{ background: 'linear-gradient(145deg, #0b1a22 0%, #0d2030 40%, #091520 100%)' }}>
                {/* Grid overlay */}
                <div className="absolute inset-0 pointer-events-none"
                    style={{
                        backgroundImage: 'linear-gradient(rgba(51,201,221,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(51,201,221,0.04) 1px, transparent 1px)',
                        backgroundSize: '40px 40px',
                    }} />
                {/* Glow orbs */}
                <div className="absolute top-[-120px] right-[-80px] w-96 h-96 rounded-full pointer-events-none"
                    style={{ background: 'radial-gradient(circle, rgba(51,201,221,0.12) 0%, transparent 70%)' }} />
                <div className="absolute bottom-[-80px] left-[-60px] w-72 h-72 rounded-full pointer-events-none"
                    style={{ background: 'radial-gradient(circle, rgba(56,130,246,0.10) 0%, transparent 70%)' }} />

                {/* Logo */}
                <div className="relative z-10 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                        style={{ background: 'linear-gradient(135deg, #33c9dd, #22a9bc)', boxShadow: '0 0 24px rgba(51,201,221,0.35)' }}>
                        <TrendingUp className="w-5 h-5 text-[#003829]" />
                    </div>
                    <span className="text-white text-xl font-bold tracking-tight font-heading">PaperTradeX</span>
                    <span className="ml-1 text-[10px] font-semibold text-primary bg-primary/10 border border-primary/20 px-2 py-0.5 rounded-full uppercase tracking-widest">Beta</span>
                </div>

                {/* Hero content */}
                <div className="relative z-10">
                    <div className="flex items-center gap-2 mb-5">
                        <span className="w-2 h-2 rounded-full bg-up animate-pulse" />
                        <span className="text-up text-xs font-semibold uppercase tracking-widest font-num">Live Market Data</span>
                    </div>
                    <h2 className="text-[2.6rem] font-bold text-white leading-[1.15] mb-5 font-heading">
                        Trade Indian Stocks<br />
                        <span className="text-gradient">Without Real Risk</span>
                    </h2>
                    <p className="text-ink-muted text-base mb-10 leading-relaxed max-w-sm">
                        Practice with ₹1 Lakh virtual money. Real NSE/BSE prices, zero real risk.
                    </p>
                    <div className="space-y-3.5">
                        {[
                            'Real-time NSE & BSE stock prices',
                            '₹1,00,000 virtual money to start',
                            'Track P&L with live charts',
                            'Buy & sell Indian stocks anytime',
                        ].map(feat => (
                            <div key={feat} className="flex items-center gap-3">
                                <CheckCircle2 className="w-4 h-4 text-primary flex-shrink-0" />
                                <span className="text-ink-muted text-sm">{feat}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Stats row */}
                <div className="relative z-10 flex gap-8 pt-6 border-t border-white/10">
                    {[['₹1L', 'Starting Balance'], ['5000+', 'Indian Stocks'], ['Live', 'Market Data']].map(([val, label]) => (
                        <div key={label}>
                            <p className="text-white text-xl font-bold font-num">{val}</p>
                            <p className="text-ink-faint text-xs mt-0.5">{label}</p>
                        </div>
                    ))}
                </div>
            </div>

            {/* Right Panel — Form */}
            <div className="flex-1 flex items-center justify-center p-8 bg-[#0a0e14]">
                <div className="w-full max-w-md">
                    {/* Mobile logo */}
                    <div className="flex items-center gap-2 mb-8 lg:hidden">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center"
                            style={{ background: 'linear-gradient(135deg, #33c9dd, #22a9bc)' }}>
                            <TrendingUp className="w-4 h-4 text-[#003829]" />
                        </div>
                        <span className="text-lg font-bold text-white font-heading">PaperTradeX</span>
                    </div>

                    <h1 className="text-2xl font-bold text-ink-heading mb-1.5 font-heading">
                        {isLogin ? 'Welcome back' : 'Create account'}
                    </h1>
                    <p className="text-ink-faint text-sm mb-8">
                        {isLogin ? 'Sign in to your PaperTradeX account.' : 'Get ₹1 Lakh to start paper trading instantly.'}
                    </p>

                    {/* Tab toggle */}
                    <div className="flex bg-surface border border-white/10 rounded-xl p-1 mb-8">
                        {['Login', 'Sign Up'].map((tab, i) => {
                            const active = i === 0 ? isLogin : !isLogin;
                            return (
                                <button key={tab} type="button" onClick={() => switchTab(i === 0)}
                                    className={`flex-1 py-2.5 text-sm font-semibold rounded-lg transition-all ${active ? 'bg-surface-3 text-primary shadow-sm border border-white/10' : 'text-ink-faint hover:text-ink-muted'}`}>
                                    {tab}
                                </button>
                            );
                        })}
                    </div>

                    {error && <div className="mb-4 p-3 bg-down/10 border border-down/25 rounded-xl text-down text-sm">{error}</div>}
                    {success && (
                        <div className="mb-4 p-3 bg-up/10 border border-up/25 rounded-xl text-up text-sm flex items-center gap-2">
                            <CheckCircle2 className="w-4 h-4" />{success}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-4">
                        {!isLogin && (
                            <>
                                <div>
                                    <label className="block text-xs font-semibold text-ink-muted uppercase tracking-wider mb-1.5">Full Name</label>
                                    <input type="text" required value={name} onChange={e => setName(e.target.value)} placeholder="Your name" className={inputCls} />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-ink-muted uppercase tracking-wider mb-1.5">Phone Number</label>
                                    <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+91 98765 43210" className={inputCls} />
                                </div>
                            </>
                        )}
                        <div>
                            <label className="block text-xs font-semibold text-ink-muted uppercase tracking-wider mb-1.5">Email Address</label>
                            <input type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" className={inputCls} />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-ink-muted uppercase tracking-wider mb-1.5">Password</label>
                            <div className="relative">
                                <input type={showPassword ? 'text' : 'password'} required value={password} onChange={e => setPassword(e.target.value)} placeholder={isLogin ? 'Your password' : 'Min. 8 chars, 1 letter & 1 number'} className={`${inputCls} pr-12`} />
                                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-ink-faint hover:text-ink-muted transition-colors">
                                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </button>
                            </div>
                            {isLogin && (
                                <div className="text-right mt-2">
                                    <a href="/forgot-password" className="text-xs font-medium text-primary hover:underline">Forgot password?</a>
                                </div>
                            )}
                        </div>

                        <button type="submit" id="auth-submit-btn" disabled={loading}
                            className="w-full py-3.5 text-sm font-bold rounded-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 group mt-2 text-[#003829]"
                            style={{ background: 'linear-gradient(135deg, #33c9dd, #22a9bc)', boxShadow: '0 0 24px rgba(51,201,221,0.30)' }}>
                            {loading ? (
                                <span className="flex items-center gap-2">
                                    <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                    </svg>
                                    {isLogin ? 'Signing in...' : 'Creating Account...'}
                                </span>
                            ) : (
                                <>
                                    {isLogin ? 'Sign in to PaperTradeX' : 'Create Account — Free'}
                                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                                </>
                            )}
                        </button>
                    </form>

                    {GOOGLE_CLIENT_ID && (
                        <>
                            <div className="flex items-center gap-3 my-5">
                                <div className="flex-1 h-px bg-[#1e2a38]" />
                                <span className="text-xs text-ink-faint">or</span>
                                <div className="flex-1 h-px bg-[#1e2a38]" />
                            </div>
                            <div id="google-signin-btn" className="w-full" />
                        </>
                    )}

                    <p className="text-center text-ink-faint text-xs mt-6">
                        By continuing, you agree to our{' '}
                        <span className="text-primary cursor-pointer hover:underline">Terms of Service</span>
                        {' '}and{' '}
                        <span className="text-primary cursor-pointer hover:underline">Privacy Policy</span>
                    </p>
                </div>
            </div>
        </div>
    );
}
