import Link from 'next/link';

export const SUPPORT_EMAIL = 'harshmaheshwari1711xs@gmail.com';

export default function SiteFooter() {
    return <footer className="border-t border-white/10 bg-surface px-4 py-6 text-sm text-ink-muted">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs leading-relaxed">© {new Date().getFullYear()} PaperTradeX. Virtual trading for learning. No real money trades.</p>
            <nav aria-label="Website information" className="flex flex-wrap gap-x-5 gap-y-1">
                {[[ '/about', 'About' ], [ '/privacy', 'Privacy Policy' ], [ '/terms', 'Terms & Conditions' ]].map(([href, label]) =>
                    <Link key={href} href={href} className="inline-flex min-h-11 items-center rounded hover:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">{label}</Link>)}
            </nav>
        </div>
    </footer>;
}
