/** @type {import('tailwindcss').Config} */
module.exports = {
    darkMode: 'class',
    content: [
        './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
        './src/components/**/*.{js,ts,jsx,tsx,mdx}',
        './src/app/**/*.{js,ts,jsx,tsx,mdx}',
    ],
    theme: {
        extend: {
            colors: {
                primary: {
                    DEFAULT: 'rgb(var(--primary-rgb) / <alpha-value>)',
                    dark: 'rgb(var(--primary-dark-rgb) / <alpha-value>)',
                    light: 'rgb(var(--primary-light-rgb) / <alpha-value>)',
                },
                up: 'rgb(var(--up-rgb) / <alpha-value>)',
                down: 'rgb(var(--down-rgb) / <alpha-value>)',
                surface: {
                    DEFAULT: 'rgb(var(--surface-rgb) / <alpha-value>)',
                    2: 'rgb(var(--surface-2-rgb) / <alpha-value>)',
                    3: 'rgb(var(--surface-3-rgb) / <alpha-value>)',
                },
                line: {
                    DEFAULT: 'rgb(var(--line-rgb) / 0.10)',
                    strong: 'rgb(var(--line-rgb) / 0.20)',
                },
                ink: {
                    DEFAULT: 'rgb(var(--text-rgb) / <alpha-value>)',
                    heading: 'rgb(var(--text-rgb) / <alpha-value>)',
                    muted: 'rgb(var(--text-muted-rgb) / <alpha-value>)',
                    faint: 'rgb(var(--text-faint-rgb) / <alpha-value>)',
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
