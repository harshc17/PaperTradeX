'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

export type Theme = 'light' | 'dark';
const THEME_KEY = 'ptx_theme';
const ThemeContext = createContext<{ theme: Theme; setTheme: (theme: Theme) => void } | null>(null);

function applyTheme(theme: Theme) {
    document.documentElement.dataset.theme = theme;
    document.documentElement.classList.toggle('dark', theme === 'dark');
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
    const [theme, updateTheme] = useState<Theme>('dark');

    useEffect(() => {
        // The head script applies the saved theme before the page paints.
        const initial = document.documentElement.dataset.theme === 'light' ? 'light' : 'dark';
        updateTheme(initial);
        const sync = (event: StorageEvent) => {
            if (event.key !== THEME_KEY) return;
            const next = event.newValue === 'light' ? 'light' : 'dark';
            applyTheme(next);
            updateTheme(next);
        };
        window.addEventListener('storage', sync);
        return () => window.removeEventListener('storage', sync);
    }, []);

    const setTheme = useCallback((next: Theme) => {
        applyTheme(next);
        updateTheme(next);
        try { localStorage.setItem(THEME_KEY, next); } catch { /* Theme still works when browser storage is unavailable. */ }
    }, []);

    const value = useMemo(() => ({ theme, setTheme }), [theme, setTheme]);
    return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
    const context = useContext(ThemeContext);
    if (!context) throw new Error('useTheme must be used within ThemeProvider');
    return context;
}
