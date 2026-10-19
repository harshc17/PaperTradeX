/** @type {import('next').NextConfig} */
const nextConfig = {
    reactStrictMode: true,
    turbopack: {
        root: __dirname,
    },
    devIndicators: false,
    experimental: {
        optimizePackageImports: ['lucide-react', 'react-markdown'],
    },
    images: {
        remotePatterns: [
            { protocol: 'https', hostname: 'assets.utils.com' },
        ],
    },
}
module.exports = nextConfig
