import './globals.css'
import type { Metadata } from 'next'
import { EB_Garamond, Hanken_Grotesk, JetBrains_Mono } from 'next/font/google'
import Script from 'next/script'
import AppProviders from './providers'

const hankenGrotesk = Hanken_Grotesk({
    subsets: ['latin'],
    weight: ['400', '500', '600', '700'],
    display: 'swap',
    variable: '--font-body',
    preload: true,
    adjustFontFallback: true,
})

const ebGaramond = EB_Garamond({
    subsets: ['latin'],
    weight: ['400', '500', '600', '700'],
    display: 'swap',
    variable: '--font-heading',
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
    title: 'PaperTradeX — Paper Trading with Real Indian Stock Prices',
    description: 'Practice trading Indian stocks on NSE & BSE with ₹1 Lakh virtual money. Real-time prices, zero real risk.',
    keywords: 'paper trading, NSE, BSE, Indian stocks, virtual trading, stock market simulator',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (
        <html lang="en">
            <body className={`${hankenGrotesk.variable} ${ebGaramond.variable} ${jetbrainsMono.variable} font-[var(--font-body)]`}>
                {/* Google Identity Services — loaded only when GOOGLE_CLIENT_ID is set */}
                {process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID && (
                    <Script src="https://accounts.google.com/gsi/client" strategy="beforeInteractive" />
                )}
                <AppProviders>
                    {children}
                </AppProviders>
            </body>
        </html>
    )
}
