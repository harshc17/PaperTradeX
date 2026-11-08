import BrandLogo from '@/components/BrandLogo';
import Link from 'next/link';


export default function Navbar() {
    return (
        <nav className="bg-surface border-b border-line sticky top-0 z-50">
            <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
                <div className="flex items-center gap-8">
                    <Link href="/" className="text-2xl"><BrandLogo /></Link>
                    <div className="hidden md:flex gap-6 text-sm font-medium">
                        <Link href="/" className="text-ink border-b-2 border-primary">Explore</Link>
                        <Link href="#" className="text-ink-muted hover:text-ink">Investments</Link>
                    </div>
                </div>
            </div>
        </nav>
    );
}
