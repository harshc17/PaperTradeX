import type { Metadata } from 'next';
import InformationPage from '@/components/InformationPage';

export const metadata: Metadata = { title: 'About | PaperTradeX', description: 'Learn about PaperTradeX, a virtual stock trading platform for practising Indian stock market strategies.' };

export default function AboutPage() {
    return <InformationPage title="Learn the market. Practise your approach." dated={false}
        intro="PaperTradeX is a paper trading platform for exploring Indian stocks and practising investment ideas with virtual money. Build confidence, understand price movements, and learn from your decisions."
        sections={[
            { title: 'Practice with a virtual portfolio', text: 'New accounts start with ₹1,00,000 in virtual funds. Explore stocks, place simulated buy and sell orders, and follow your holdings, transactions and returns. Virtual funds cannot be deposited, withdrawn, transferred or redeemed for money.' },
            { title: 'Tools for curious learners', text: 'Explore market data, screeners, watchlists and weekly paper trading challenges. Ask AI uses app help, a managed finance education library and optional actual portfolio snapshots. Generated explanations require an enabled Gemini or OpenAI provider. Other AI features are coming soon.' },
            { title: 'Understand the simulation', text: 'PaperTradeX does not execute orders on an exchange, hold customer investment money, or provide personalised investment advice. Market feeds may be delayed or unavailable. Simulated fills, costs and returns can differ from real trading, and simulated success does not predict future results.' },
            { title: 'Built around learning', text: 'Use the platform to test ideas, review outcomes and develop a more informed understanding of risk. Company names and logos identify the securities shown; they do not imply a partnership or endorsement.' },
        ]} />;
}
