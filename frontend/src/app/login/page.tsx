'use client';
import { useState, useEffect, useCallback } from 'react';
import BrandLogo from '@/components/BrandLogo';
import ThemeToggle from '@/components/ThemeToggle';
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
    const { login, loginWithGoogle, register, verifySignup } = useAuth();
    const [isLogin, setIsLogin] = useState(true);
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [name, setName] = useState('');
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [verificationPending, setVerificationPending] = useState(false);
    const [code, setCode] = useState('');
    const [cooldown, setCooldown] = useState(0);
    useEffect(() => {
        if (!cooldown) return;
        const timer = setTimeout(() => setCooldown(value => value - 1), 1000);
        return () => clearTimeout(timer);
    }, [cooldown]);

    const sendSignupCode = async () => {
        await register(name, email, password);
        setVerificationPending(true);
        setCode('');
        setCooldown(60);
        setSuccess('Verification code sent. Check your inbox and spam folder.');
    };

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
            } else if (verificationPending) {
                await verifySignup(email, code);
                setPassword('');
                setCode('');
                router.push('/dashboard');
            } else {
                await sendSignupCode();
            }
        } catch (e: any) {
            setError(e.message || 'Something went wrong');
        } finally {
            setLoading(false);
        }
    };

    const switchTab = (toLogin: boolean) => { setIsLogin(toLogin); setVerificationPending(false); setCode(''); setPassword(''); setError(''); setSuccess(''); };

    const inputCls = "w-full px-4 py-3 rounded-xl text-sm text-ink placeholder-[var(--text-faint)] bg-surface-2 border border-line focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors";

    return (
        <div className="min-h-[100svh] min-w-0 flex font-sans bg-[var(--bg)]">
            {/* Practice account preview */}
            <section className="auth-intro-panel hidden lg:flex lg:w-[48%] xl:w-[52%] flex-col justify-between gap-12 border-r border-line bg-surface p-8 xl:p-16">
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
                    <div className="auth-intro-features mt-8 space-y-3 text-sm text-ink-muted">
                        {['Market and limit orders', 'Holdings, watchlists and trade history', 'Orders follow Indian market hours'].map(feature => <p key={feature}>{feature}</p>)}
                    </div>
                </div>
                <div className="flex flex-wrap gap-6 border-t border-line pt-6 text-sm text-ink-muted"><span>Virtual funds only</span><span>No deposits or withdrawals</span></div>
            </section>

            {/* Right Panel — Form */}
            <div className="auth-form-panel min-w-0 flex-1 flex items-start sm:items-center justify-center px-4 py-6 sm:p-8 bg-[var(--bg)]">
                <div className="min-w-0 w-full max-w-md">
                    {/* Mobile logo */}
                    <div className="auth-form-heading-gap mb-6 sm:mb-8 flex items-center justify-between gap-4">
                        <div className="lg:hidden"><BrandLogo className="text-xl sm:text-3xl" /></div>
                        <ThemeToggle className="ml-auto" />
                    </div>


                    <h1 className="text-2xl font-medium text-ink-heading mb-1.5 font-heading">
                        {isLogin ? 'Sign in' : 'Create account'}
                    </h1>
                    <p className="auth-form-heading-gap text-ink-faint text-sm mb-6 sm:mb-8">
                        {isLogin ? 'Sign in to your PaperTradeX account.' : 'Start a paper trading account with ₹1,00,000 in virtual funds.'}
                    </p>

                    {/* Tab toggle */}
                    <div className="auth-form-heading-gap flex bg-surface border border-line rounded-xl p-1 mb-6 sm:mb-8">
                        {['Sign in', 'Create account'].map((tab, i) => {
                            const active = i === 0 ? isLogin : !isLogin;
                            return (
                                    <button key={tab} type="button" disabled={loading} onClick={() => switchTab(i === 0)}
                                    className={`min-h-11 min-w-0 flex-1 py-2.5 text-sm font-semibold rounded-lg transition-colors ${active ? 'bg-surface-3 text-primary shadow-none border border-line' : 'text-ink-faint hover:text-ink-muted'}`}>
                                    {tab}
                                </button>
                            );
                        })}
                    </div>

                    {error && <div role="alert" className="mb-4 break-words p-3 bg-down/10 border border-down/25 rounded-xl text-down text-sm">{error}</div>}
                    {success && (
                        <div role="status" className="mb-4 break-words p-3 bg-up/10 border border-up/25 rounded-xl text-up text-sm flex items-start gap-2">
                            <CheckCircle2 className="mt-0.5 w-4 h-4 shrink-0" /><span className="min-w-0">{success}</span>
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-4">
                        {verificationPending ? <div>
                            <p className="mb-4 break-words text-sm text-ink-muted">Enter the six-digit code sent to {email}. It expires in 10 minutes.</p>
                            <label htmlFor="signup-code" className="block text-xs font-semibold text-ink-muted mb-1.5">Email verification code</label>
                            <input id="signup-code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required value={code} onChange={e => setCode(e.target.value.replace(/\D/g, ''))} className={inputCls} />
                        </div> : <>
                        {!isLogin && (
                            <>
                                <div>
                                    <label htmlFor="signup-name" className="block text-xs font-semibold text-ink-muted mb-1.5">Full name</label>
                                    <input id="signup-name" autoComplete="name" type="text" required value={name} onChange={e => setName(e.target.value)} placeholder="Your name" className={inputCls} />
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
                                <input id="auth-password" aria-describedby={isLogin ? undefined : 'signup-password-hint'} autoComplete={isLogin ? 'current-password' : 'new-password'} type={showPassword ? 'text' : 'password'} required value={password} onChange={e => setPassword(e.target.value)} placeholder={isLogin ? 'Your password' : 'Create a password'} className={`${inputCls} pr-12`} />
                                <button type="button" aria-label={showPassword ? 'Hide password' : 'Show password'} onClick={() => setShowPassword(!showPassword)} className="absolute right-0 inset-y-0 flex min-h-11 w-11 items-center justify-center rounded-r-xl text-ink-faint hover:text-ink-muted transition-colors">
                                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </button>
                            </div>
                            {!isLogin && <p id="signup-password-hint" className="mt-2 text-xs leading-5 text-ink-faint">At least 8 characters, including a letter and a number.</p>}
                            {isLogin && (
                                <div className="text-right mt-1">
                                    <Link href="/forgot-password" className="inline-flex min-h-11 items-center text-sm font-medium text-primary hover:underline">Forgot password?</Link>
                                </div>
                            )}
                        </div>

                        </>}
                        <button type="submit" id="auth-submit-btn" disabled={loading}
                            className="min-h-12 w-full px-3 py-3.5 text-sm font-medium rounded-xl transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 group mt-2 text-[var(--primary-ink)]"
                            style={{ background: 'var(--text-main)', color: 'var(--bg)' }}>
                            {loading ? (
                                <span className="flex items-center gap-2">
                                    <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                    </svg>
                                    {isLogin ? 'Signing in...' : verificationPending ? 'Verifying...' : 'Sending code...'}
                                </span>
                            ) : (
                                <>
                                    {isLogin ? 'Sign in to PaperTradeX' : verificationPending ? 'Verify email and create account' : 'Send verification code'}
                                    <ArrowRight className="w-4 h-4 shrink-0 transition-colors" />
                                </>
                            )}
                        </button>
                    </form>
                    {verificationPending && <div className="mt-4 flex flex-wrap gap-4 text-sm">
                        <button type="button" disabled={loading || cooldown > 0} className="min-h-[44px] text-primary disabled:text-ink-faint" onClick={async () => {
                            setLoading(true); setError('');
                            try { await sendSignupCode(); } catch (e) { setError(e instanceof Error ? e.message : 'Unable to send code'); }
                            finally { setLoading(false); }
                        }}>{cooldown ? `Resend code in ${cooldown}s` : 'Resend code'}</button>
                        <button type="button" disabled={loading} className="min-h-[44px] text-ink-muted" onClick={() => { setVerificationPending(false); setCode(''); setError(''); setSuccess(''); }}>Edit signup details</button>
                    </div>}

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
