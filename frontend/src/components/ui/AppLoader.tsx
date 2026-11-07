'use client';
import { BrandIcon } from '@/components/BrandLogo';

export default function AppLoader({ label = 'Loading PaperTradeX' }: { label?: string }) {
    return (
        <div className="min-h-screen flex items-center justify-center bg-transparent">
            <div className="text-center fade-in">
                <div className="app-loader relative w-14 h-14 mx-auto mb-6">
                    <div className="loader-ring" />
                    <BrandIcon className="loader-tile absolute inset-0 h-full w-full" />
                </div>
                <p className="text-ink-muted text-sm font-medium tracking-tight mb-2">{label}</p>
                <div className="loader-dots" aria-hidden="true">
                    <span /><span /><span />
                </div>
            </div>
        </div>
    );
}
