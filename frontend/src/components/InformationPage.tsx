import Link from 'next/link';
import BrandLogo from './BrandLogo';
import ThemeToggle from './ThemeToggle';
import { SUPPORT_EMAIL } from './SiteFooter';

type Section = { title: string; text: string };

export default function InformationPage({ title, intro, sections, dated = true }: {
    title: string; intro: string; sections: Section[]; dated?: boolean;
}) {
    return <div className="min-h-screen">
        <header className="border-b border-line px-4 py-5 sm:px-6">
            <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-4">
                <Link href="/" aria-label="PaperTradeX home"><BrandLogo className="text-xl sm:text-2xl" /></Link>
                <div className="flex items-center gap-3">
                    <ThemeToggle />
                    <Link href="/dashboard" className="inline-flex min-h-11 items-center rounded-xl border border-line px-4 text-sm hover:border-primary hover:text-primary">Open PaperTradeX →</Link>
                </div>
            </div>
        </header>
        <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6 sm:py-16">
            <p className="mb-3 text-xs font-semibold text-primary">PaperTradeX · papertradex.in</p>
            <h1 className="font-heading text-4xl font-semibold text-ink-heading sm:text-5xl">{title}</h1>
            {dated && <p className="mt-3 text-sm text-ink-muted">Last updated: 8 November 2026</p>}
            <p className="mt-6 max-w-2xl text-base leading-8 text-ink-muted">{intro}</p>
            <div className="mt-10 space-y-8">
                {sections.map(section => <section key={section.title}>
                    <h2 className="mb-3 text-xl font-semibold text-ink-heading">{section.title}</h2>
                    <p className="text-sm leading-7 text-ink-muted">{section.text}</p>
                </section>)}
                <section className="rounded-2xl border border-primary/20 bg-primary/5 p-5 sm:p-7">
                    <h2 className="mb-3 text-xl font-semibold text-ink-heading">Contact us</h2>
                    <p className="text-sm leading-7 text-ink-muted">For questions, account help, corrections, or privacy and deletion requests, email the PaperTradeX operator at{' '}
                        <a className="break-all text-primary underline underline-offset-4" href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.
                        {' '}Use your registered email for account requests. Never send your password or OTP. We may need to verify account ownership before acting on a request.</p>
                </section>
            </div>
        </main>
    </div>;
}
