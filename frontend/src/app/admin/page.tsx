'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function AdminPage() {
    const router = useRouter();
    const [user, setUser] = useState<any>(null);

    useEffect(() => {
        const storedUser = localStorage.getItem('user');
        if (!storedUser) {
            router.push('/login');
            return;
        }
        const parsed = JSON.parse(storedUser);
        if (parsed.role !== 'ADMIN') {
            router.push('/dashboard'); // Kick non-admins
            return;
        }
        setUser(parsed);
    }, []);

    if (!user) return <div className="p-10">Checking Admin Access...</div>;

    return (
        <div className="min-h-screen min-w-0 bg-surface-2 px-4 py-6 sm:p-8">
            <div className="max-w-4xl mx-auto min-w-0 bg-surface rounded-xl border border-line p-4 sm:p-6">
                <h1 className="text-2xl font-medium mb-4 text-ink">Admin Panel</h1>
                <p className="mb-4 break-words">Welcome, Admin <strong>{user.username}</strong></p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="p-4 bg-surface-2 rounded-lg border border-line">
                        <h3 className="font-medium">System Status</h3>
                        <p className="text-up">Online</p>
                    </div>
                    <div className="p-4 bg-surface-2 rounded-lg border border-line">
                        <h3 className="font-medium">Total Users</h3>
                        <p>2 (Demo)</p>
                    </div>
                </div>

                <div className="mt-8">
                    <h3 className="font-medium mb-2">Admin Actions</h3>
                    <div className="flex flex-wrap gap-3">
                    <button className="min-h-11 bg-down text-[var(--sell-ink)] px-4 py-2 rounded-lg">Reset Market</button>
                    <button className="min-h-11 bg-primary text-[var(--primary-ink)] px-4 py-2 rounded-lg" onClick={() => router.push('/dashboard')}>Go to Trading Dashboard</button>
                    </div>
                </div>
            </div>
        </div>
    );
}
