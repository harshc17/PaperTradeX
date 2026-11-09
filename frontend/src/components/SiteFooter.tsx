import Link from 'next/link';
import ThemeToggle from './ThemeToggle';
import BrandLogo from './BrandLogo';

export const SUPPORT_EMAIL = 'harsh@papertradex.in';

export default function SiteFooter() {
    return <footer className="border-t border-line bg-surface-2 px-4 sm:px-6 lg:px-8 py-8 text-sm text-ink-muted">
        <div className="mx-auto max-w-[1280px]">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-5">
            <div><Link href="/dashboard" aria-label="PaperTradeX home"><BrandLogo className="text-xl" /></Link><p className="mt-3 text-sm">Learn the markets. Practise with virtual funds.</p></div>
            <a href={`mailto:${SUPPORT_EMAIL}`} className="inline-flex min-h-11 items-center text-sm hover:text-primary">{SUPPORT_EMAIL}</a>
        </div>
        <div className="flex flex-col gap-4 border-t border-line pt-5 lg:flex-row lg:flex-wrap lg:items-center lg:justify-between">
            <p className="text-xs leading-relaxed">© {new Date().getFullYear()} PaperTradeX. Virtual trading for learning. No real money trades.</p>
            <nav aria-label="Website information" className="flex flex-wrap items-center gap-x-5 gap-y-2">
                {[[ '/about', 'About' ], [ '/privacy', 'Privacy Policy' ], [ '/terms', 'Terms & Conditions' ]].map(([href, label]) =>
                    <Link key={href} href={href} className="inline-flex min-h-11 items-center rounded hover:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">{label}</Link>)}
                <ThemeToggle showLabel />
            </nav>
        </div></div>
    </footer>;
}
