export function BrandIcon({ className = 'h-10 w-10' }: { className?: string }) {
    return <svg className={className} viewBox="0 0 100 100" fill="none" aria-hidden="true">
        <rect width="100" height="100" rx="29" fill="#20B4C5" />
        <path d="M29 61 43 47 54 58 72 39M60 39h12v12" stroke="#004C43" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>;
}

export default function BrandLogo({ className = '', compact = false }: { className?: string; compact?: boolean }) {
    return <span role="img" aria-label="PaperTradeX" className={`inline-flex shrink-0 items-center gap-3 ${className}`}>
        <BrandIcon className="h-[1.6em] w-[1.6em] shrink-0" />
        <span aria-hidden="true" className={compact ? 'hidden md:inline' : ''}
            style={{ fontFamily: 'Georgia, "Times New Roman", serif', fontStyle: 'italic', fontWeight: 400, color: 'var(--brand-wordmark, #20B4C5)', whiteSpace: 'nowrap', lineHeight: 1.1 }}>PaperTradeX</span>
    </span>;
}
