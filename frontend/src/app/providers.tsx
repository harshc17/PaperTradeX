'use client';

import { AuthProvider } from '@/context/AuthContext';
import { ThemeProvider } from '@/context/ThemeContext';

export default function AppProviders({ children }: { children: React.ReactNode }) {
    return <ThemeProvider><AuthProvider>{children}</AuthProvider></ThemeProvider>;
}
