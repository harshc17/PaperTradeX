'use client';
import { Plus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import CompanyLogo from '@/components/CompanyLogo';

interface StockCardProps {
    name: string;
    symbol: string;
    price: string;
    change: string;
    isPositive: boolean;
    logoUrl?: string;
}

export default function StockCard({ name, symbol, price, change, isPositive, logoUrl }: StockCardProps) {
    const router = useRouter();

    const handleBuy = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        router.push(`/stock/${encodeURIComponent(symbol)}`);
    };

    return (
        <div
            className="terminal-card p-4 hover:shadow-glow hover:-translate-y-1 transition-all duration-200 cursor-pointer group relative"
            onClick={() => router.push(`/stock/${encodeURIComponent(symbol)}`)}
        >
            <button onClick={handleBuy}
                className="absolute top-3 right-3 text-primary hover:bg-primary/10 p-1.5 rounded-full transition-colors opacity-0 group-hover:opacity-100 z-10"
                title="Buy Stock">
                <Plus className="h-4 w-4" />
            </button>
            <CompanyLogo symbol={symbol} className="h-10 w-10 mb-4" />
            <div className="space-y-1">
                <h3 className="text-sm font-medium text-ink truncate pr-6" title={name}>{name}</h3>
                <p className="text-xl font-bold text-ink-heading tabular-nums font-num">₹{price}</p>
                <div className={`text-xs font-semibold tabular-nums font-num ${isPositive ? 'text-up' : 'text-down'}`}>
                    {change}
                </div>
            </div>
        </div>
    );
}
