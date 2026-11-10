'use client';
import Link from 'next/link';
import { ChevronRight, BarChart3, Search, Bot, Trophy } from 'lucide-react';
import PortfolioSummary from './PortfolioSummary';
import AIPortfolioAnalyst from './AIPortfolioAnalyst';

export default function DashboardSidebar() {
    const tools = [
        { name: 'Trading coach', icon: Bot, href: '/trading-coach' },
        { name: 'Ask AI', icon: Bot, href: '/ask-ai' },
        { name: 'Stock screener', icon: Search, href: '/stock-screener' },
        { name: 'ETF screener', icon: BarChart3, href: '/etf-screener' },
    ];
    return <div className="space-y-6">
        <div className="hidden lg:block"><PortfolioSummary /></div>
        <section className="rounded-2xl border border-line bg-surface p-5">
            <h3 className="mb-4 text-base font-medium text-ink">Tools</h3>
            <div className="space-y-1">
                {tools.map(({ name, icon: Icon, href }) => <Link key={href} href={href} className="group flex min-h-11 items-center gap-3 rounded-lg px-2 py-2 text-sm text-ink-muted transition-colors hover:bg-surface-2 hover:text-ink">
                    <Icon className="h-4 w-4" />
                    <span className="flex-1">{name}</span>
                    <ChevronRight className="h-4 w-4 text-ink-faint" />
                </Link>)}
            </div>
        </section>
        <Link href="/challenge" className="group flex items-start gap-3 rounded-2xl border border-line bg-surface p-5 transition-colors hover:bg-surface-2">
            <Trophy className="mt-1 h-4 w-4 text-ink-muted" />
            <div className="min-w-0 flex-1"><h3 className="text-base font-medium text-ink">Weekly challenge</h3><p className="mt-2 text-sm leading-5 text-ink-muted">Practise a strategy over seven days</p></div>
            <ChevronRight className="mt-1 h-4 w-4 text-ink-faint" />
        </Link>
        <AIPortfolioAnalyst />
    </div>;
}
