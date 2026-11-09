'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { useAuth } from '@/context/AuthContext';
import PortfolioSummary from '@/components/dashboard/PortfolioSummary';
import Header from '@/components/dashboard/Header';
import AppLoader from '@/components/ui/AppLoader';

const IndicesBanner = dynamic(() => import('@/components/dashboard/IndicesBanner'), {
    loading: () => <div className="h-12 bg-surface/80 border-b border-line animate-pulse" />,
});
const DashboardMarket = dynamic(() => import('@/components/dashboard/DashboardMarket'), {
    loading: () => <div className="h-[620px] rounded-2xl bg-surface border border-line shadow-none animate-pulse" />,
});
const DashboardSidebar = dynamic(() => import('@/components/dashboard/DashboardSidebar'), {
    loading: () => <div className="h-[620px] rounded-2xl bg-surface border border-line shadow-none animate-pulse" />,
});

export default function DashboardPage() {
    const { user, loading } = useAuth();
    const router = useRouter();

    useEffect(() => {
        if (!loading && !user) {
            router.push('/login');
        }
    }, [user, loading, router]);

    if (loading) {
        return <AppLoader />;
    }

    if (!user) return null;

    return (
        <div className="min-h-screen bg-transparent font-sans page-fade-in">
            <Header />
            <IndicesBanner />
            <main className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <div className="lg:hidden mb-5"><PortfolioSummary /></div>
                <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_300px] gap-6 xl:gap-10">
                    {/* Main Content */}
                    <div className="min-w-0">
                        <DashboardMarket />
                    </div>
                    {/* Sidebar */}
                    <div className="min-w-0">
                        <DashboardSidebar />
                    </div>
                </div>
            </main>
        </div>
    );
}
