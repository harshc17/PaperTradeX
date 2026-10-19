'use client';
import { useEffect, useState } from 'react';
import { Newspaper, Clock, RefreshCw, Sparkles } from 'lucide-react';

interface Article { headline: string; summary: string; time: string; }
interface NewsData { title: string; articles: Article[]; generatedAt?: string; cached?: boolean; }

export default function DashboardNews() {
    const [news, setNews] = useState<NewsData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);

    const fetchNews = () => {
        setLoading(true); setError(false);
        fetch('http://localhost:3001/api/ai/market-news')
            .then(res => res.ok ? res.json() : Promise.reject())
            .then(data => { setNews(data); setLoading(false); })
            .catch(() => { setError(true); setLoading(false); });
    };

    useEffect(() => { fetchNews(); }, []);

    const formatTime = (iso?: string) => iso ? new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' }) : '';
    const formatDate = (iso?: string) => iso ? new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' }) : '';

    if (loading) return (
        <div className="bg-surface rounded-[14px] border border-white/10 p-6 shadow-soft">
            <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-2">
                    <div className="w-5 h-5 bg-surface-3 rounded-full animate-pulse" />
                    <div className="w-36 h-4 bg-surface-3 rounded animate-pulse" />
                </div>
                <div className="w-24 h-5 bg-surface-3 rounded-lg animate-pulse" />
            </div>
            <div className="space-y-5">
                {[1,2,3,4].map(i => (
                    <div key={i} className="animate-pulse">
                        <div className="w-4/5 h-4 bg-surface-3 rounded mb-2" />
                        <div className="w-full h-3 bg-[#161d28] rounded mb-1" />
                        <div className="w-2/3 h-3 bg-[#161d28] rounded mb-2" />
                        <div className="w-16 h-2.5 bg-[#161d28] rounded" />
                    </div>
                ))}
            </div>
            <p className="text-center text-xs text-ink-faint mt-5 flex items-center justify-center gap-1.5">
                <Sparkles className="w-3 h-3 animate-pulse text-primary" />
                AI is generating today's market news...
            </p>
        </div>
    );

    if (error || !news || !news.articles?.length) return (
        <div className="bg-surface rounded-[14px] border border-white/10 p-6 shadow-soft text-center">
            <Newspaper className="w-8 h-8 text-[#2e3a4b] mx-auto mb-2" />
            <p className="text-sm text-ink-faint mb-3">Could not load market news</p>
            <button onClick={fetchNews} className="text-xs text-primary hover:underline flex items-center gap-1 mx-auto">
                <RefreshCw className="w-3 h-3" /> Try again
            </button>
        </div>
    );

    return (
        <div className="bg-surface rounded-[14px] border border-white/10 p-6 shadow-soft relative overflow-hidden">
            <div className="absolute -top-8 -right-8 w-36 h-36 rounded-full blur-[40px] opacity-30 pointer-events-none"
                style={{ background: 'radial-gradient(circle, rgba(51,201,221,0.2) 0%, transparent 70%)' }} />
            <div className="relative z-10">
                <div className="flex items-center justify-between mb-5">
                    <h2 className="text-[15px] font-semibold text-ink-heading flex items-center gap-2 font-heading">
                        <Newspaper className="w-4 h-4 text-primary" />
                        Stocks in news today
                    </h2>
                    <div className="flex items-center gap-2">
                        {news.generatedAt && (
                            <span className="text-[11px] text-ink-faint flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {formatDate(news.generatedAt)} · {formatTime(news.generatedAt)}
                            </span>
                        )}
                        <span className="text-[10px] font-bold px-2 py-0.5 bg-primary/10 text-primary border border-primary/20 rounded-full uppercase tracking-wide flex items-center gap-1">
                            <Sparkles className="w-2.5 h-2.5" />AI · Daily
                        </span>
                    </div>
                </div>

                {news.title && (
                    <p className="text-[12px] font-medium text-ink-faint mb-5 pb-4 border-b border-white/10">{news.title}</p>
                )}

                <div className="space-y-5">
                    {news.articles.map((article, idx) => (
                        <div key={idx} className="group cursor-pointer">
                            <div className="flex items-start gap-3">
                                <span className="text-[11px] font-bold text-[#2e3a4b] mt-1 w-4 flex-shrink-0 font-num">
                                    {String(idx + 1).padStart(2, '0')}
                                </span>
                                <div className="flex-1 min-w-0">
                                    <h3 className="text-[13px] font-bold text-ink group-hover:text-primary transition-colors leading-snug mb-1">{article.headline}</h3>
                                    <p className="text-[12px] text-ink-faint leading-relaxed mb-1.5">{article.summary}</p>
                                    <div className="flex items-center gap-1 text-[10px] font-medium text-ink-faint uppercase tracking-wider">
                                        <Clock className="w-2.5 h-2.5" />{article.time}
                                    </div>
                                </div>
                            </div>
                            {idx < news.articles.length - 1 && <div className="mt-4 border-b border-white/10/60" />}
                        </div>
                    ))}
                </div>

                <div className="mt-5 pt-4 border-t border-white/10 flex items-center justify-between">
                    <p className="text-[11px] text-ink-faint flex items-center gap-1">
                        <Sparkles className="w-3 h-3 text-primary" />
                        Generated by AI · Refreshes daily at midnight IST
                    </p>
                    {news.cached && <span className="text-[10px] text-ink-faint bg-surface-3 px-2 py-0.5 rounded-full border border-white/10">cached</span>}
                </div>
            </div>
        </div>
    );
}
