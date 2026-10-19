'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { useAuth } from '@/context/AuthContext';
import Header from '@/components/dashboard/Header';
import AppLoader from '@/components/ui/AppLoader';

const IndicesBanner = dynamic(() => import('@/components/dashboard/IndicesBanner'), {
    loading: () => <div className="h-12 bg-white/80 border-b border-gray-100 animate-pulse" />,
});
const DashboardMarket = dynamic(() => import('@/components/dashboard/DashboardMarket'), {
    loading: () => <div className="h-[620px] rounded-2xl bg-white border border-gray-100 shadow-[0_10px_24px_rgba(15,23,42,0.06)] animate-pulse" />,
});
const DashboardSidebar = dynamic(() => import('@/components/dashboard/DashboardSidebar'), {
    loading: () => <div className="h-[620px] rounded-2xl bg-white border border-gray-100 shadow-[0_10px_24px_rgba(15,23,42,0.06)] animate-pulse" />,
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
            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 stagger-children">
                    {/* Main Content */}
                    <div className="lg:col-span-2">
                        <DashboardMarket />
                    </div>
                    {/* Sidebar */}
                    <div className="lg:col-span-1">
                        <DashboardSidebar />
                    </div>
                </div>
            </main>
        </div>
    );
}
