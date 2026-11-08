'use client';
import { useState, useEffect, useCallback } from 'react';
import BrandLogo from '@/components/BrandLogo';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { GOOGLE_CLIENT_ID } from '@/lib/config';
import { Eye, EyeOff, ArrowRight, CheckCircle2 } from 'lucide-react';

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

    const inputCls = "w-full px-4 py-3 rounded-xl text-sm text-ink placeholder-[var(--text-faint)] bg-surface-2 border border-white/10 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors";

    return (
        <div className="min-h-screen flex font-sans bg-[var(--bg)]">
            {/* Practice account preview */}
            <section className="hidden lg:flex lg:w-[48%] xl:w-[52%] flex-col justify-between gap-12 border-r border-line bg-surface p-8 xl:p-16">
                <BrandLogo className="text-[32px]" />
                <div className="max-w-lg">
                    <p className="mb-4 text-sm text-ink-muted">NSE / BSE · Paper trading</p>
                    <h2 className="text-4xl xl:text-5xl font-medium leading-tight text-ink">Practise Indian<br />stock trading</h2>
                    <p className="mt-6 max-w-sm text-base leading-7 text-ink-muted">Follow Indian stocks and test your decisions with virtual funds. Build a trading record you can learn from.</p>
                    <div className="mt-8 rounded-2xl border border-line bg-surface-2 p-6">
                        <p className="text-sm text-ink-muted">Starting virtual balance</p>
                        <p className="mt-4 text-3xl xl:text-4xl font-medium tabular-nums font-num text-ink">₹1,00,000.00</p>
                        <div className="mt-6 flex flex-wrap items-center justify-between gap-4 border-t border-line pt-4 text-sm text-ink-muted"><span>Real securities</span><span>Simulated orders</span></div>
                    </div>
                    <div className="mt-8 space-y-3 text-sm text-ink-muted">
                        {['Market and limit orders', 'Holdings, watchlists and trade history', 'Orders follow Indian market hours'].map(feature => <p key={feature}>{feature}</p>)}
                    </div>
                </div>
                <div className="flex flex-wrap gap-6 border-t border-line pt-6 text-sm text-ink-muted"><span>Virtual funds only</span><span>No deposits or withdrawals</span></div>
            </section>

            {/* Right Panel — Form */}
            <div className="flex-1 flex items-center justify-center px-4 py-8 sm:p-8 bg-[var(--bg)]">
                <div className="w-full max-w-md">
                    {/* Mobile logo */}
                    <div className="flex items-center gap-2 mb-8 lg:hidden">
                        <BrandLogo className="text-[28px] sm:text-[30px]" />
                    </div>


                    <h1 className="text-2xl font-medium text-ink-heading mb-1.5 font-heading">
                        {isLogin ? 'Sign in' : 'Create account'}
                    </h1>
                    <p className="text-ink-faint text-sm mb-8">
                        {isLogin ? 'Sign in to your PaperTradeX account.' : 'Start a paper trading account with ₹1,00,000 in virtual funds.'}
                    </p>

                    {/* Tab toggle */}
                    <div className="flex bg-surface border border-white/10 rounded-xl p-1 mb-8">
                        {['Sign in', 'Create account'].map((tab, i) => {
                            const active = i === 0 ? isLogin : !isLogin;
                            return (
                                <button key={tab} type="button" onClick={() => switchTab(i === 0)}
                                    className={`flex-1 py-2.5 text-sm font-semibold rounded-lg transition-colors ${active ? 'bg-surface-3 text-primary shadow-none border border-white/10' : 'text-ink-faint hover:text-ink-muted'}`}>
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
                                    <label htmlFor="signup-name" className="block text-xs font-semibold text-ink-muted mb-1.5">Full name</label>
                                    <input id="signup-name" autoComplete="name" type="text" required value={name} onChange={e => setName(e.target.value)} placeholder="Your name" className={inputCls} />
                                </div>
                                <div>
                                    <label htmlFor="signup-phone" className="block text-xs font-semibold text-ink-muted mb-1.5">Phone number</label>
                                    <input id="signup-phone" autoComplete="tel" type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+91 98765 43210" className={inputCls} />
                                </div>
                            </>
                        )}
                        <div>
                            <label htmlFor="auth-email" className="block text-xs font-semibold text-ink-muted mb-1.5">Email address</label>
                            <input id="auth-email" autoComplete="email" type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" className={inputCls} />
                        </div>
                        <div>
                            <label htmlFor="auth-password" className="block text-xs font-semibold text-ink-muted mb-1.5">Password</label>
                            <div className="relative">
                                <input id="auth-password" autoComplete={isLogin ? 'current-password' : 'new-password'} type={showPassword ? 'text' : 'password'} required value={password} onChange={e => setPassword(e.target.value)} placeholder={isLogin ? 'Your password' : 'Min. 8 chars, 1 letter & 1 number'} className={`${inputCls} pr-12`} />
                                <button type="button" aria-label={showPassword ? 'Hide password' : 'Show password'} onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-ink-faint hover:text-ink-muted transition-colors">
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
                            className="w-full py-3.5 text-sm font-medium rounded-xl transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 group mt-2 text-[var(--primary-ink)]"
                            style={{ background: 'var(--text-main)', color: 'var(--bg)' }}>
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
                                    {isLogin ? 'Sign in to PaperTradeX' : 'Create account'}
                                    <ArrowRight className="w-4 h-4 transition-colors" />
                                </>
                            )}
                        </button>
                    </form>

                    {GOOGLE_CLIENT_ID && (
                        <>
                            <div className="flex items-center gap-3 my-5">
                                <div className="flex-1 h-px bg-surface-2" />
                                <span className="text-xs text-ink-faint">or</span>
                                <div className="flex-1 h-px bg-surface-2" />
                            </div>
                            <div id="google-signin-btn" className="w-full" />
                        </>
                    )}

                    <p className="text-center text-ink-faint text-xs mt-6">
                        By continuing, you agree to our{' '}
                        <Link href="/terms" className="text-primary hover:underline">Terms &amp; Conditions</Link>
                        {' '}and{' '}
                        <Link href="/privacy" className="text-primary hover:underline">Privacy Policy</Link>
                    </p>
                </div>
            </div>
        </div>
    );
}
