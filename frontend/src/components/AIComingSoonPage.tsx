'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import Header from '@/components/dashboard/Header';
import Link from 'next/link';
import { Bot, ArrowRight } from 'lucide-react';

export default function AIComingSoonPage({ title }: { title: string }) {
    const { user, loading } = useAuth();
    const router = useRouter();
    useEffect(() => { if (!loading && !user) router.replace('/login'); }, [loading, user, router]);
    if (loading || !user) return null;
    return <div className="w-full min-w-0"><Header />
        <main className="mx-auto w-full min-w-0 max-w-4xl px-4 py-6 sm:px-6 sm:py-10">
            <section className="mx-auto w-full max-w-lg rounded-2xl border border-line bg-surface p-5 sm:p-8" aria-labelledby="ai-coming-soon-title">
                <div className="flex min-w-0 items-center gap-3">
                    <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary" aria-hidden="true"><Bot className="h-5 w-5" /></div>
                    <h1 id="ai-coming-soon-title" className="min-w-0 break-words text-xl font-semibold text-ink-heading sm:text-2xl">{title}</h1>
                </div>
                <p className="mt-6 text-base font-medium text-primary">Coming soon!</p>
                <p className="mt-2 text-sm leading-6 text-ink-muted">Explore stocks and track your portfolio while this feature is unavailable.</p>
                <Link href="/dashboard" className="mt-5 inline-flex min-h-11 items-center gap-2 text-sm font-medium text-primary hover:underline">Back to Explore <ArrowRight className="h-4 w-4" aria-hidden="true" /></Link>
            </section>
        </main>
    </div>;
}
