'use client';

import { Moon, Sun } from 'lucide-react';
import { useTheme } from '@/context/ThemeContext';

export default function ThemeToggle({ showLabel = false, className = '' }: { showLabel?: boolean; className?: string }) {
    const { theme, setTheme } = useTheme();
    const next = theme === 'dark' ? 'light' : 'dark';
    const label = `Switch to ${next} mode`;
    return <button type="button" aria-label={label} title={label} onClick={() => setTheme(next)} aria-pressed={theme === 'dark'}
        className={`inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center gap-2 rounded-lg border border-line bg-surface px-3 text-sm text-ink-muted transition-colors hover:bg-surface-2 hover:text-ink ${className}`}>
        {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        {showLabel && <span>{next === 'light' ? 'Light mode' : 'Dark mode'}</span>}
    </button>;
}
