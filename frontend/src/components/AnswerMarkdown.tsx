import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export default function AnswerMarkdown({ text }: { text: string }) {
    return (
        <ReactMarkdown remarkPlugins={[remarkGfm]} skipHtml components={{
            table: ({ children }) => <div className="max-w-full overflow-x-auto"><table>{children}</table></div>,
            a: ({ children }) => <span>{children}</span>,
        }}>
            {text}
        </ReactMarkdown>
    );
}
