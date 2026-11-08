'use client';

import { AuthProvider } from '@/context/AuthContext';
import { PortfolioProvider } from '@/context/PortfolioContext';
import { HoldingsProvider } from '@/context/HoldingsContext';
import { ThemeProvider } from '@/context/ThemeContext';

export default function AppProviders({ children }: { children: React.ReactNode }) {
    return (
        <ThemeProvider><AuthProvider>
            <PortfolioProvider>
                <HoldingsProvider>
                    {children}
                </HoldingsProvider>
            </PortfolioProvider>
        </AuthProvider></ThemeProvider>
    );
}
