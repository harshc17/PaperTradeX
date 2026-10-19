'use client';

export default function AppLoader({ label = 'Loading PaperTradeX' }: { label?: string }) {
    return (
        <div className="min-h-screen flex items-center justify-center bg-transparent">
            <div className="text-center fade-in">
                <div className="app-loader relative w-14 h-14 mx-auto mb-6">
                    <div className="loader-ring" />
                    <div className="loader-tile absolute inset-0 rounded-2xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #33c9dd, #22a9bc)' }}>
                        <svg className="w-7 h-7 text-[#003829]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
                            <polyline points="17 6 23 6 23 12" />
                        </svg>
                    </div>
                </div>
                <p className="text-ink-muted text-sm font-medium tracking-tight mb-2">{label}</p>
                <div className="loader-dots" aria-hidden="true">
                    <span /><span /><span />
                </div>
            </div>
        </div>
    );
}
