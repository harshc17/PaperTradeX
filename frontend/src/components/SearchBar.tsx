'use client';
import { API_URL } from '@/lib/config';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';

type SearchResult = {
    symbol: string;
    shortname?: string;
    quoteType?: string;
    exchange?: string;
};

export default function SearchBar() {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<SearchResult[]>([]);
    const [loading, setLoading] = useState(false);
    const [showResults, setShowResults] = useState(false);
    const router = useRouter();
    const searchRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
                setShowResults(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => {
        if (!query.trim()) {
            setResults([]);
            setShowResults(false);
            return;
        }

        const searchTimeout = setTimeout(async () => {
            setLoading(true);
            try {
                const res = await fetch(`${API_URL}/api/search?q=${encodeURIComponent(query)}`);
                if (res.ok) {
                    const data = await res.json();
                    setResults(data.quotes || []);
                    setShowResults(true);
                }
            } catch (error) {
                console.error('Search error:', error);
            } finally {
                setLoading(false);
            }
        }, 300);

        return () => clearTimeout(searchTimeout);
    }, [query]);

    const handleSelect = (symbol: string) => {
        setQuery('');
        setShowResults(false);
        router.push(`/stock/${encodeURIComponent(symbol)}`);
    };

    return (
        <div ref={searchRef} className="relative w-full max-w-md">
            <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search stocks, ETFs, mutual funds..."
                className="w-full px-4 py-2 pl-10 border border-gray-300 dark:border-line rounded-lg bg-surface dark:bg-surface-2 text-ink dark:text-ink focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <svg
                className="absolute left-3 top-2.5 h-5 w-5 text-ink-faint"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
            >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>

            {showResults && (results.length > 0 || loading) && (
                <div className="absolute z-50 w-full mt-2 bg-surface dark:bg-surface-2 border border-line dark:border-line rounded-lg shadow-none max-h-96 overflow-y-auto">
                    {loading ? (
                        <div className="p-4 text-center text-ink-muted">Searching...</div>
                    ) : results.length > 0 ? (
                        <div className="py-2">
                            {results.slice(0, 10).map((result, idx) => (
                                <button
                                    key={idx}
                                    onClick={() => handleSelect(result.symbol)}
                                    className="w-full px-4 py-3 text-left hover:bg-surface-2 dark:hover:bg-gray-700 transition-colors border-b border-line dark:border-line last:border-0"
                                >
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="font-semibold text-sm text-ink dark:text-ink">
                                                {result.symbol}
                                            </p>
                                            <p className="text-xs text-ink-muted dark:text-ink-faint">
                                                {result.shortname || result.symbol}
                                            </p>
                                        </div>
                                        <div className="text-right">
                                            <span className="text-xs px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded">
                                                {result.quoteType || 'EQUITY'}
                                            </span>
                                        </div>
                                    </div>
                                </button>
                            ))}
                        </div>
                    ) : (
                        <div className="p-4 text-center text-ink-muted">No results found</div>
                    )}
                </div>
            )}
        </div>
    );
}
