import { PortfolioProvider } from '@/context/PortfolioContext';

export default function MarketLayout({ children }: { children: React.ReactNode }) {
    return <PortfolioProvider>{children}</PortfolioProvider>;
}
