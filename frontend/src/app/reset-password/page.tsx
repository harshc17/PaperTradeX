'use client';
import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { API_URL as API } from '@/lib/config';
import { TrendingUp, Eye, EyeOff, ArrowLeft, CheckCircle2 } from 'lucide-react';

const inputCls = "w-full px-4 py-3 rounded-xl text-sm text-ink placeholder-[#5c6675] bg-surface-2 border border-white/10 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all";

function ResetPasswordForm() {
    const router = useRouter();
    const params = useSearchParams();
    const token = params.get('token') || '';
    const email = params.get('email') || '';

    const [password, setPassword] = useState('');
    const [confirm, setConfirm] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [done, setDone] = useState(false);
    const [error, setError] = useState('');

    const invalidLink = !token || !email;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        if (password !== confirm) {
            setError('Passwords do not match');
            return;
        }
        setLoading(true);
        try {
            const res = await fetch(`${API}/api/reset-password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, token, password }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Reset failed');
            setDone(true);
            setTimeout(() => router.push('/login'), 1800);
        } catch (e: any) {
            setError(e.message || 'Reset failed');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-[#0a0e14] p-6">
            <div className="w-full max-w-md">
                <div className="flex items-center gap-2 mb-8">
                    <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                        <TrendingUp className="w-5 h-5 text-[#003829]" />
                    </div>
                    <span className="text-xl font-bold text-white">PaperTradeX</span>
                </div>

                <div className="bg-surface-2 border border-[#1e2a38] rounded-2xl p-8">
                    {done ? (
                        <div className="text-center">
                            <CheckCircle2 className="w-12 h-12 text-primary mx-auto mb-4" />
                            <h1 className="text-xl font-bold text-white mb-2">Password reset</h1>
                            <p className="text-ink-muted text-sm">Redirecting you to login...</p>
                        </div>
                    ) : invalidLink ? (
                        <div className="text-center">
                            <h1 className="text-xl font-bold text-white mb-2">Invalid reset link</h1>
                            <p className="text-ink-muted text-sm mb-6">This link is missing information or has expired. Request a new one.</p>
                            <button onClick={() => router.push('/forgot-password')}
                                className="text-sm font-medium text-primary hover:underline">Request a new link</button>
                        </div>
                    ) : (
                        <>
                            <h1 className="text-2xl font-bold text-white mb-2">Set a new password</h1>
                            <p className="text-ink-muted text-sm mb-6">Resetting password for <span className="text-ink">{email}</span></p>

                            {error && (
                                <div className="mb-4 p-3 bg-red-900/30 border border-red-700/40 rounded-xl text-red-400 text-sm">
                                    {error}
                                </div>
                            )}

                            <form onSubmit={handleSubmit} className="space-y-4">
                                <div>
                                    <label className="block text-xs font-semibold text-ink-muted uppercase tracking-wider mb-1.5">New Password</label>
                                    <div className="relative">
                                        <input type={showPassword ? 'text' : 'password'} required value={password}
                                            onChange={e => setPassword(e.target.value)}
                                            placeholder="Min. 8 chars, 1 letter & 1 number" className={`${inputCls} pr-12`} />
                                        <button type="button" onClick={() => setShowPassword(!showPassword)}
                                            className="absolute right-4 top-1/2 -translate-y-1/2 text-ink-faint hover:text-ink-muted transition-colors">
                                            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                        </button>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-ink-muted uppercase tracking-wider mb-1.5">Confirm Password</label>
                                    <input type={showPassword ? 'text' : 'password'} required value={confirm}
                                        onChange={e => setConfirm(e.target.value)} placeholder="Re-enter password" className={inputCls} />
                                </div>
                                <button type="submit" disabled={loading}
                                    className="w-full py-3.5 text-sm font-bold rounded-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-[#003829]"
                                    style={{ background: 'linear-gradient(135deg, #33c9dd, #22a9bc)', boxShadow: '0 0 24px rgba(51,201,221,0.25)' }}>
                                    {loading ? 'Resetting...' : 'Reset password'}
                                </button>
                            </form>

                            <button onClick={() => router.push('/login')}
                                className="mt-5 text-sm font-medium text-ink-faint hover:text-ink-muted flex items-center gap-1 transition-colors">
                                <ArrowLeft className="w-4 h-4" /> Back to login
                            </button>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}

export default function ResetPasswordPage() {
    return (
        <Suspense fallback={<div className="min-h-screen bg-[#0a0e14]" />}>
            <ResetPasswordForm />
        </Suspense>
    );
}
