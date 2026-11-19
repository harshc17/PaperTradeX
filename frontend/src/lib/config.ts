// Central place for the backend base URL.
// Production prefers Render, with Railway in NEXT_PUBLIC_BACKUP_API_URL.
// Override at build/run time with NEXT_PUBLIC_API_URL (e.g. in .env.local or the deploy env).
export const API_URL =
    process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, '') || 'http://localhost:3001';

export const BACKUP_API_URL = process.env.NEXT_PUBLIC_BACKUP_API_URL?.replace(/\/$/, '') || '';

// Google sign-in reads its public client configuration from the backend at runtime.
