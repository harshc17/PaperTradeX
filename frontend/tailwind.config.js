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
                    DEFAULT: '#20b4c5',
                    dark: '#168594',
                    light: '#a6e3e9',
                },
                up: '#62c39e',
                down: '#ed9b96',
                surface: {
                    DEFAULT: '#19191b',
                    2: '#232325',
                    3: '#2b2b2e',
                },
                line: {
                    DEFAULT: 'rgba(255,255,255,0.06)',
                    strong: 'rgba(255,255,255,0.12)',
                },
                ink: {
                    DEFAULT: '#ededed',
                    heading: '#ededed',
                    muted: '#b1b1b7',
                    faint: '#909097',
                },
            },
            fontFamily: {
                heading: ['var(--font-body)', 'system-ui', 'sans-serif'],
                sans: ['var(--font-body)', 'system-ui', 'sans-serif'],
                num: ['var(--font-mono)', 'SF Mono', 'ui-monospace', 'monospace'],
            },
            borderRadius: {
                xl2: '18px',
            },
            boxShadow: {
                soft: 'none',
                elevated: 'none',
                float: '0 22px 52px rgba(0, 0, 0, 0.56), 0 4px 14px rgba(0, 0, 0, 0.40)',
                glow: 'none',
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
