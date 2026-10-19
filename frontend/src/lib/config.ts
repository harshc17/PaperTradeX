// Central place for the backend base URL.
// Override at build/run time with NEXT_PUBLIC_API_URL (e.g. in .env.local or the deploy env).
export const API_URL =
    process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, '') || 'http://localhost:3001';

// Google OAuth Client ID — set NEXT_PUBLIC_GOOGLE_CLIENT_ID in frontend/.env.local.
// When unset, the Google login button is hidden.
export const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '';
