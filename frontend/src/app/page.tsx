'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import AppLoader from '@/components/ui/AppLoader';

export default function RootPage() {
    const router = useRouter();
    useEffect(() => {
        const token = localStorage.getItem('ptx_token') || localStorage.getItem('token');
        router.replace(token ? '/dashboard' : '/login');
    }, []);

    return <AppLoader />;
}
