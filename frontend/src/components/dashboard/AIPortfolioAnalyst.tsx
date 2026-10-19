'use client';
import { useState } from 'react';
import { Sparkles, BrainCircuit, CheckCircle2, AlertCircle, Lightbulb, RefreshCw } from 'lucide-react';
import { usePortfolio } from '@/context/PortfolioContext';

export default function AIPortfolioAnalyst() {
    const { holdings } = usePortfolio();
    const [analysis, setAnalysis] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const generateAnalysis = async () => {
        if (holdings.length === 0) { setError("No holdings to analyze yet! Make some trades first."); return; }
        setLoading(true); setError('');
        try {
            const token = localStorage.getItem('ptx_token') || localStorage.getItem('token') || '';
            const res = await fetch('http://localhost:3001/api/ai/portfolio', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ holdings }),
            });
            if (res.status === 404) throw new Error('Endpoint not found. Please restart your backend server!');
            if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || 'Failed to fetch AI analysis'); }
            setAnalysis(await res.json());
        } catch (err: any) {
            setError(err.message || 'Something went wrong.');
        } finally { setLoading(false); }
    };

    return (
        <div className="rounded-[14px] border p-6 relative overflow-hidden"
            style={{ background: 'linear-gradient(145deg, #0e1a2b 0%, #111e30 60%, #0c1520 100%)', borderColor: 'rgba(51,201,221,0.18)' }}>
            {/* Glow orbs */}
            <div className="absolute top-0 right-0 -mr-8 -mt-8 w-32 h-32 rounded-full blur-[60px] opacity-30 pointer-events-none"
                style={{ background: 'radial-gradient(circle, rgba(51,201,221,0.4) 0%, transparent 70%)' }} />
            <div className="absolute bottom-0 left-0 -ml-8 -mb-8 w-32 h-32 rounded-full blur-[60px] opacity-20 pointer-events-none"
                style={{ background: 'radial-gradient(circle, rgba(139,92,246,0.4) 0%, transparent 70%)' }} />

            <div className="relative z-10">
                <div className="flex items-center justify-between mb-5">
                    <h3 className="text-[15px] font-bold text-ink-heading flex items-center gap-2 font-heading">
                        <Sparkles className="w-4 h-4 text-[#fbbf24]" />
                        AI Portfolio Analyst
                    </h3>
                    {analysis && (
                        <button onClick={generateAnalysis} disabled={loading} className="text-ink-faint hover:text-ink-muted transition-colors">
                            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                        </button>
                    )}
                </div>

                {!analysis && !loading && (
                    <div className="text-center py-4">
                        <div className="w-12 h-12 bg-primary/10 border border-primary/20 rounded-full flex items-center justify-center mx-auto mb-3">
                            <BrainCircuit className="w-6 h-6 text-primary" />
                        </div>
                        <p className="text-sm text-ink-muted mb-4 px-2 leading-relaxed">
                            Let AI analyze your paper trading strategy, identify risks, and suggest improvements.
                        </p>
                        <button onClick={generateAnalysis}
                            className="w-full py-2.5 text-[#003829] text-sm font-bold rounded-xl transition-all"
                            style={{ background: 'linear-gradient(135deg, #33c9dd, #22a9bc)', boxShadow: '0 0 18px rgba(51,201,221,0.25)' }}>
                            Generate Analysis
                        </button>
                        {error && <p className="text-down text-xs mt-3">{error}</p>}
                    </div>
                )}

                {loading && (
                    <div className="text-center py-6">
                        <div className="w-10 h-10 border-2 border-primary/20 border-t-primary rounded-full animate-spin mx-auto mb-4" />
                        <p className="text-sm text-ink-faint animate-pulse">AI is analyzing your holdings...</p>
                    </div>
                )}

                {analysis && !loading && (
                    <div className="space-y-4">
                        <div className="bg-white/5 border border-white/8 rounded-xl p-4">
                            <p className="text-sm text-[#c8d0de] leading-relaxed">{analysis.summary}</p>
                        </div>
                        {[
                            { key: 'strengths', label: 'Strengths', icon: <CheckCircle2 className="w-3.5 h-3.5 text-up" />, dot: 'bg-up/50' },
                            { key: 'weaknesses', label: 'Areas of Risk', icon: <AlertCircle className="w-3.5 h-3.5 text-[#f5a623]" />, dot: 'bg-[#f5a623]/50' },
                            { key: 'recommendations', label: 'Recommendations', icon: <Lightbulb className="w-3.5 h-3.5 text-[#fbbf24]" />, dot: 'bg-[#fbbf24]/50' },
                        ].map(({ key, label, icon, dot }) => analysis[key]?.length > 0 && (
                            <div key={key}>
                                <h4 className="text-[10px] font-bold text-ink-faint uppercase tracking-widest mb-2 flex items-center gap-1.5">{icon}{label}</h4>
                                <ul className="space-y-1.5">
                                    {analysis[key].map((item: string, i: number) => (
                                        <li key={i} className={`text-sm text-ink-muted pl-5 relative before:content-[''] before:absolute before:left-1.5 before:top-2 before:w-1.5 before:h-1.5 before:rounded-full before:${dot}`}>{item}</li>
                                    ))}
                                </ul>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
