const referenceUrl = 'https://groww.in/blog/books-investing-stock-markets-trading';
const sections = [
    {
        title: 'Groww’s main list',
        books: [
            ['rich-dad-poor-dad', 'Rich Dad Poor Dad', 'Robert Kiyosaki', 'Assets, cash flow, and financial independence.'],
            ['think-and-grow-rich', 'Think and Grow Rich', 'Napoleon Hill', 'Goal setting, persistence, and personal development.'],
            ['psychology-of-money', 'The Psychology of Money', 'Morgan Housel', 'How habits, emotions, and risk shape money decisions.'],
            ['intelligent-investor', 'The Intelligent Investor', 'Benjamin Graham', 'Value investing and maintaining discipline through market swings.'],
            ['richest-man-in-babylon', 'The Richest Man in Babylon', 'George S. Clason', 'Parables about saving and managing money.'],
            ['coffee-can-investing', 'Coffee Can Investing: The Low-Risk Road to Stupendous Wealth', 'Saurabh Mukherjea, Rakshit Ranjan, and Pranab Uniyal', 'Long-term investing with examples from Indian equities.'],
            ['one-up-on-wall-street', 'One Up on Wall Street', 'Peter Lynch with John Rothchild', 'Finding investment ideas and checking them against company fundamentals.'],
            ['millionaire-fastlane', 'The Millionaire Fastlane: Crack the Code to Wealth and Live Rich for a Lifetime!', 'M. J. DeMarco', 'Entrepreneurship and business ownership as approaches to building wealth.'],
            ['security-analysis', 'Security Analysis', 'Benjamin Graham and David Dodd', 'Studying financial statements and valuing securities.'],
            ['secrets-millionaire-mind', 'Secrets of the Millionaire Mind', 'T. Harv Eker', 'Beliefs and habits that influence financial behavior.'],
            ['i-will-teach-you-to-be-rich', 'I Will Teach You to Be Rich', 'Ramit Sethi', 'Setting up practical systems for spending, saving, and investing.'],
            ['fooled-by-randomness', 'Fooled by Randomness', 'Nassim Nicholas Taleb', 'Separating luck from skill when judging investment outcomes.'],
            ['millionaire-next-door', 'The Millionaire Next Door: The Surprising Secrets of America’s Wealthy', 'Thomas J. Stanley and William D. Danko', 'Spending and saving habits observed in wealthy households.'],
            ['black-swan', 'The Black Swan', 'Nassim Nicholas Taleb', 'Rare events, uncertainty, and the limits of prediction.'],
            ['warren-buffett-way', 'The Warren Buffett Way', 'Robert G. Hagstrom', 'Business valuation and Warren Buffett’s long-term investing approach.'],
        ],
    },
    {
        title: 'Honourable mentions',
        books: [
            ['common-stocks-uncommon-profits', 'Common Stocks and Uncommon Profits', 'Philip A. Fisher', 'Researching the quality and growth prospects of businesses.'],
            ['bulls-bears-other-beasts', 'Bulls, Bears and Other Beasts', 'Santosh Nair', 'The history of India’s equity markets after liberalisation.'],
            ['alchemy-of-finance', 'The Alchemy of Finance', 'George Soros', 'How investor beliefs and market conditions can influence each other.'],
            ['reminiscences-stock-operator', 'Reminiscences of a Stock Operator', 'Edwin Lefèvre', 'A fictionalised account of speculation and the lessons of a trader’s career.'],
            ['stocks-to-riches', 'Stocks to Riches', 'Parag Parikh', 'Investor behavior and common mistakes in the Indian stock market.'],
            ['market-wizards', 'Market Wizards', 'Jack D. Schwager', 'Interviews on trading methods, discipline, and risk.'],
            ['beginners-guide-stock-market', 'A Beginner’s Guide to the Stock Market', 'Matthew R. Kratter', 'Introductory stock market concepts and common beginner pitfalls.'],
            ['money-manual', 'The Money Manual', 'Tonya B. Rapley', 'Day-to-day money management and setting financial goals.'],
            ['fundamental-analysis-investors', 'Fundamental Analysis for Investors', 'Raghu Palat', 'Assessing companies in the context of their industries and the economy.'],
            ['investing-in-india', 'Investing in India', 'Rahul Saraogi', 'Value investing and the institutions that shape Indian markets.'],
        ],
    },
    {
        title: 'Also featured on the page',
        books: [
            ['discovering-india', 'Discovering India: Through the Eyes of Groww', 'Rohit Raman', 'Stories about how investing habits are changing across India.'],
        ],
    },
];

const documents = sections.flatMap(({ title: section, books }) => books.map(([id, title, author, topic]) => ({
    id: `reading-${id}`, title, scope: 'education', referenceUrl,
    content: `Book: ${title}. Author: ${author}. Topic: ${topic} This entry is a reading note, not the full book.`,
    effectiveDate: null, reviewedAt: '2026-11-25', section, documentType: 'reading_note',
})));

function readingListAnswer(question) {
    const text = question.trim().replace(/[?!.]+$/, '').toLowerCase();
    const genericList = /^(?:please )?(?:(?:show|list|display|give)(?: me)? (?:a |the )?(?:list of )?(?:all )?(?:the )?(?:available )?(?:(?:investing|investment|trading|stock market|finance|financial) )?books(?: (?:in (?:the )?(?:library|knowledge base|available information)|from groww|on groww))?|(?:what|which) (?:(?:investing|investment|trading|stock market|finance|financial) )?books (?:are available|do you have)|(?:show |list )?(?:the )?(?:groww )?(?:reading|book) list)$/;
    if (!genericList.test(text)) return null;
    return [
        `Here are all **${documents.length} books** from Groww’s reading page, including the honourable mentions and the separately featured title.`,
        ...sections.map(({ title, books }) => `### ${title}\n\n${books.map(([, book, author, topic]) => `- **${book}** — ${author}. ${topic}`).join('\n')}`),
    ].join('\n\n');
}

module.exports = { documents, readingListAnswer };
