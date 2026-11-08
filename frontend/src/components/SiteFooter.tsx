import Link from 'next/link';
import ThemeToggle from './ThemeToggle';

export const SUPPORT_EMAIL = 'harsh@papertradex.in';

export default function SiteFooter() {
    return <footer className="border-t border-line bg-surface px-4 py-6 text-sm text-ink-muted">
        <div className="mx-auto flex max-w-[1440px] flex-col gap-4 lg:flex-row lg:flex-wrap lg:items-center lg:justify-between">
            <p className="text-xs leading-relaxed">© {new Date().getFullYear()} PaperTradeX. Virtual trading for learning. No real money trades.</p>
            <nav aria-label="Website information" className="flex flex-wrap items-center gap-x-5 gap-y-2">
                {[[ '/about', 'About' ], [ '/privacy', 'Privacy Policy' ], [ '/terms', 'Terms & Conditions' ]].map(([href, label]) =>
                    <Link key={href} href={href} className="inline-flex min-h-11 items-center rounded hover:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">{label}</Link>)}
                <ThemeToggle showLabel />
            </nav>
        </div>
    </footer>;
}
