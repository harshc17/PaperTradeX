'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import Header from '@/components/dashboard/Header';

export default function AIComingSoonPage({ title }: { title: string }) {
    const { user, loading } = useAuth();
    const router = useRouter();
    useEffect(() => { if (!loading && !user) router.replace('/login'); }, [loading, user, router]);
    if (loading || !user) return null;
    return <div className="min-h-screen"><Header />
        <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
            <h1 className="text-2xl font-semibold text-ink-heading">{title}</h1>
            <p className="mt-5 text-base font-medium text-primary">Coming soon!</p>
        </main>
    </div>;
}
