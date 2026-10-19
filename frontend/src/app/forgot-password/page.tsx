'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { API_URL as API } from '@/lib/config';
import { TrendingUp, ArrowLeft, CheckCircle2 } from 'lucide-react';

export default function ForgotPasswordPage() {
    const router = useRouter();
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        try {
            const res = await fetch(`${API}/api/forgot-password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Something went wrong');
            setSubmitted(true);
        } catch (e: any) {
            setError(e.message || 'Something went wrong');
        } finally {
            setLoading(false);
        }
    };

    const inputCls = "w-full px-4 py-3 rounded-xl text-sm text-ink placeholder-[#5c6675] bg-surface-2 border border-white/10 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all";

    return (
        <div className="min-h-screen flex items-center justify-center bg-[#0a0e14] p-6">
            <div className="w-full max-w-md">
                <div className="flex items-center gap-2 mb-8">
                    <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                        <TrendingUp className="w-5 h-5 text-[#003829]" />
                    </div>
                    <span className="text-xl font-bold text-white">PaperTradeX</span>
                </div>

                {submitted ? (
                    <div className="bg-surface-2 border border-[#1e2a38] rounded-2xl p-8 text-center">
                        <CheckCircle2 className="w-12 h-12 text-primary mx-auto mb-4" />
                        <h1 className="text-xl font-bold text-white mb-2">Check your email</h1>
                        <p className="text-ink-muted text-sm mb-6">
                            If that email is registered, we've sent a password reset link. Check your inbox (and spam folder).
                        </p>
                        <button onClick={() => router.push('/login')}
                            className="text-sm font-medium text-primary hover:underline flex items-center gap-1 mx-auto">
                            <ArrowLeft className="w-4 h-4" /> Back to login
                        </button>
                    </div>
                ) : (
                    <div className="bg-surface-2 border border-[#1e2a38] rounded-2xl p-8">
                        <h1 className="text-2xl font-bold text-white mb-2">Forgot password?</h1>
                        <p className="text-ink-muted text-sm mb-6">
                            Enter your email and we'll send you a reset link.
                        </p>

                        {error && (
                            <div className="mb-4 p-3 bg-red-900/30 border border-red-700/40 rounded-xl text-red-400 text-sm">
                                {error}
                            </div>
                        )}

                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="block text-xs font-semibold text-ink-muted uppercase tracking-wider mb-1.5">Email Address</label>
                                <input type="email" required value={email} onChange={e => setEmail(e.target.value)}
                                    placeholder="you@example.com" className={inputCls} />
                            </div>
                            <button type="submit" disabled={loading}
                                className="w-full py-3.5 text-sm font-bold rounded-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-[#003829]"
                                style={{ background: 'linear-gradient(135deg, #33c9dd, #22a9bc)', boxShadow: '0 0 24px rgba(51,201,221,0.25)' }}>
                                {loading ? (
                                    <span className="flex items-center gap-2">
                                        <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                        </svg>
                                        Sending...
                                    </span>
                                ) : 'Send reset link'}
                            </button>
                        </form>

                        <button onClick={() => router.push('/login')}
                            className="mt-5 text-sm font-medium text-ink-faint hover:text-ink-muted flex items-center gap-1 transition-colors">
                            <ArrowLeft className="w-4 h-4" /> Back to login
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
