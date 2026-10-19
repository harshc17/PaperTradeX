'use client';

import { useState, useEffect } from 'react';
import { Sparkles, Clock, RefreshCw, Newspaper } from 'lucide-react';
import { API_URL } from '@/lib/config';

interface AINewsPanelProps {
    symbol: string;
    companyName?: string;
}

export default function AINewsPanel({ symbol, companyName }: AINewsPanelProps) {
    const [news, setNews] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);

    const fetchNews = () => {
        setLoading(true);
        setError(false);
        fetch(`${API_URL}/api/stock/${encodeURIComponent(symbol)}/news`)
            .then(r => r.ok ? r.json() : Promise.reject())
            .then(data => {
                setNews(data);
                setLoading(false);
            })
            .catch(() => {
                setError(true);
                setLoading(false);
            });
    };

    useEffect(() => {
        fetchNews();
    }, [symbol]);

    const formatDateTime = (iso?: string) => {
        if (!iso) return '';
        const d = new Date(iso);
        return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' })
            + ' · ' + d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' });
    };

    if (loading) {
        return (
            <div className="terminal-card p-6 shadow-soft">
                <div className="flex items-center gap-2 mb-5">
                    <div className="w-5 h-5 shimmer rounded-full" />
                    <div className="w-32 h-4 shimmer rounded" />
                </div>
                <div className="w-3/4 h-6 shimmer rounded mb-3" />
                <div className="w-1/2 h-4 shimmer rounded mb-5" />
                <div className="space-y-2 animate-pulse">
                    {[1, 2, 3, 4].map(i => (
                        <div key={i} className="h-3 shimmer rounded" style={{ width: `${100 - i * 8}%` }} />
                    ))}
                </div>
                <p className="text-center text-xs text-ink-muted mt-5 flex items-center justify-center gap-1.5">
                    <Sparkles className="w-3 h-3 animate-pulse text-[#c084fc]" />
                    AI is generating news for {companyName || symbol}...
                </p>
            </div>
        );
    }

    if (error || !news || !news.title) {
        return (
            <div className="terminal-card p-6 shadow-soft text-center">
                <Newspaper className="w-8 h-8 text-ink-faint mx-auto mb-2" />
                <p className="text-sm text-ink-muted mb-3">Could not load AI news for {companyName || symbol}</p>
                <button onClick={fetchNews}
                    className="text-xs text-[#c084fc] hover:underline flex items-center gap-1 mx-auto">
                    <RefreshCw className="w-3 h-3" /> Retry
                </button>
            </div>
        );
    }

    const paragraphs = (news.content || '')
        .split('\n')
        .filter((p: string) => p.trim() !== '');

    return (
        <div className="terminal-card p-6 shadow-soft relative overflow-hidden">
            <div className="relative z-10">
                {/* Header */}
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-[16px] font-semibold text-ink-heading flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-[#c084fc]" />
                        AI News Analyst
                    </h3>
                    <div className="flex items-center gap-2">
                        {news.generatedAt && (
                            <span className="text-[11px] text-ink-faint flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {formatDateTime(news.generatedAt)}
                            </span>
                        )}
                        <span className="text-[10px] font-bold px-2 py-0.5 bg-[#c084fc]/15 text-[#c084fc] border border-[#c084fc]/20 rounded-full uppercase tracking-wide flex items-center gap-1">
                            <Sparkles className="w-2.5 h-2.5" />
                            AI · Daily
                        </span>
                    </div>
                </div>

                {/* Headline */}
                <h4 className="text-[18px] font-bold text-ink-heading leading-tight mb-2">
                    {news.title}
                </h4>

                {/* Summary */}
                <p className="text-[13px] font-medium text-up mb-5 pb-4 border-b border-white/10 leading-relaxed">
                    {news.summary}
                </p>

                {/* Full content */}
                <div className="text-[13px] text-ink-muted leading-relaxed space-y-3">
                    {paragraphs.map((para: string, i: number) => (
                        <p key={i}>{para}</p>
                    ))}
                </div>

                {/* Footer */}
                <div className="mt-5 pt-4 border-t border-white/10 flex items-center justify-between">
                    <p className="text-[11px] text-ink-faint flex items-center gap-1">
                        <Sparkles className="w-3 h-3 text-[#c084fc]" />
                        AI-generated · Refreshes daily at midnight IST
                    </p>
                    {news.cached && (
                        <span className="text-[10px] text-ink-faint bg-surface-3 border border-white/10 px-2 py-0.5 rounded-full">cached</span>
                    )}
                </div>
            </div>
        </div>
    );
}
