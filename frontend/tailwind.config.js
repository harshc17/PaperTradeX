/** @type {import('tailwindcss').Config} */
module.exports = {
    content: [
        './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
        './src/components/**/*.{js,ts,jsx,tsx,mdx}',
        './src/app/**/*.{js,ts,jsx,tsx,mdx}',
    ],
    theme: {
        extend: {
            colors: {
                primary: {
                    DEFAULT: '#00A982',
                    dark: '#006c52',
                    light: '#78f9cd',
                },
                up: '#00A982',
                down: '#ffb4ab',
                surface: {
                    DEFAULT: '#0a0a0a',
                    2: '#121212',
                    3: '#1a1a1a',
                },
                line: {
                    DEFAULT: 'rgba(255,255,255,0.06)',
                    strong: 'rgba(255,255,255,0.12)',
                },
                ink: {
                    DEFAULT: '#e5e2e1',
                    heading: '#F0F0F0',
                    muted: '#8B949E',
                    faint: '#474746',
                },
            },
            fontFamily: {
                heading: ['var(--font-heading)', 'Times New Roman', 'serif'],
                sans: ['var(--font-body)', 'system-ui', 'sans-serif'],
                num: ['var(--font-mono)', 'SF Mono', 'ui-monospace', 'monospace'],
            },
            borderRadius: {
                xl2: '18px',
            },
            boxShadow: {
                soft: '0 2px 8px rgba(0, 0, 0, 0.38)',
                elevated: '0 10px 28px rgba(0, 0, 0, 0.46), 0 2px 6px rgba(0, 0, 0, 0.32)',
                float: '0 22px 52px rgba(0, 0, 0, 0.56), 0 4px 14px rgba(0, 0, 0, 0.40)',
                glow: '0 0 26px rgba(0, 169, 130, 0.28)',
            },
            keyframes: {
                fadeInUp: {
                    from: { opacity: '0', transform: 'translateY(10px)' },
                    to: { opacity: '1', transform: 'translateY(0)' },
                },
            },
            animation: {
                'fade-in-up': 'fadeInUp 480ms cubic-bezier(0.22, 1, 0.36, 1)',
            },
        },
    },
    plugins: [],
}
