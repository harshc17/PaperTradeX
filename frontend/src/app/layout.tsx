import './globals.css'
import type { Metadata } from 'next'
import { Hanken_Grotesk, JetBrains_Mono } from 'next/font/google'
import Script from 'next/script'
import AppProviders from './providers'
import SiteFooter from '@/components/SiteFooter'

const hankenGrotesk = Hanken_Grotesk({
    subsets: ['latin'],
    weight: ['400', '500', '600', '700'],
    display: 'swap',
    variable: '--font-body',
    preload: true,
    adjustFontFallback: true,
})

const jetbrainsMono = JetBrains_Mono({
    subsets: ['latin'],
    weight: ['400', '500', '600', '700'],
    display: 'swap',
    variable: '--font-mono',
    preload: false,
})

export const metadata: Metadata = {
    title: 'PaperTradeX — Practise Trading Indian Stocks',
    description: 'Practise trading NSE and BSE stocks with ₹1,00,000 in virtual funds. Track simulated orders, holdings and returns.',
    icons: { icon: [{ url: '/brand/icon.svg', type: 'image/svg+xml' }, { url: '/favicon.ico', sizes: 'any' }], apple: '/apple-touch-icon.png' },
    keywords: 'paper trading, NSE, BSE, Indian stocks, virtual trading, stock market simulator',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (
        <html lang="en">
            <body className={`${hankenGrotesk.variable} ${jetbrainsMono.variable} font-sans`}>
                {/* Google Identity Services — loaded only when GOOGLE_CLIENT_ID is set */}
                {process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID && (
                    <Script src="https://accounts.google.com/gsi/client" strategy="beforeInteractive" />
                )}
                <AppProviders>
                    {children}
                    <SiteFooter />
                </AppProviders>
            </body>
        </html>
    )
}
