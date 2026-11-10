'use client';
import { API_URL } from '@/lib/config';

import { useState, useRef, useEffect } from 'react';
import Header from '@/components/dashboard/Header';
import { Send, Bot, User as UserIcon, AlertCircle } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import ReactMarkdown from 'react-markdown';
import Link from 'next/link';

interface Message {
    role: 'user' | 'ai';
    content: string;
}

export default function AskAIPage() {
    const { user, loading } = useAuth();
    const router = useRouter();
    const [messages, setMessages] = useState<Message[]>([{
        role: 'ai',
        content: "Hello! I am your PaperTradeX financial AI assistant. I can help you with questions regarding the stock market, investing, economics, or specific stocks. How can I assist you today?"
    }]);
    const [input, setInput] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!loading && !user) router.push('/login');
    }, [user, loading, router]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, isTyping]);

    if (loading || !user) return null;

    const sendMessage = async () => {
        if (!input.trim()) return;

        const newMsg: Message = { role: 'user', content: input.trim() };
        setMessages(prev => [...prev, newMsg]);
        setInput('');
        setIsTyping(true);

        try {
            const token = localStorage.getItem('ptx_token') || localStorage.getItem('token') || '';
            const history = messages.slice(-10); // send last 10 messages for context

            const res = await fetch(`${API_URL}/api/ai/chat`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ question: newMsg.content, history }),
            });

            if (res.status === 404) {
                setMessages(prev => [...prev, { role: 'ai', content: "Backend endpoint not found. Please restart your backend server to load the Ask AI endpoint." }]);
                return;
            }

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || 'Failed to get answer');
            }

            setMessages(prev => [...prev, { role: 'ai', content: data.answer }]);
        } catch (error: any) {
            setMessages(prev => [...prev, { role: 'ai', content: `Error: ${error.message}` }]);
        } finally {
            setIsTyping(false);
        }
    };

    return (
        <div className="min-h-screen flex flex-col bg-transparent font-sans page-fade-in">
            <Header />

            <main className="flex-1 max-w-4xl w-full mx-auto p-4 sm:p-6 lg:p-8 flex flex-col">
                <div className="mb-6 flex items-center justify-between">
                    <div>
                        <h1 className="text-[28px] font-semibold text-ink-heading flex items-center gap-2.5 font-heading">
                            <span className="w-10 h-10 rounded-xl flex items-center justify-center"
                                style={{ background: 'var(--primary)', color: 'var(--primary-ink)' }}>

                            </span>
                            Ask AI
                        </h1>
                        <p className="text-ink-faint text-sm mt-1.5">Get expert financial insights and stock market analysis.</p>
                        <Link href="/trading-coach" className="mt-2 inline-flex min-h-11 items-center text-sm text-primary hover:underline">Review your completed trades with Trading coach →</Link>
                    </div>
                </div>

                <div className="bg-surface h-[65dvh] min-h-[320px] max-h-[800px] rounded-2xl border border-line shadow-none overflow-hidden flex flex-col">
                    {/* Chat Area */}
                    <div className="flex-1 min-h-0 p-3 sm:p-6 overflow-y-auto space-y-6 bg-surface-2">
                        {messages.map((msg, idx) => (
                            <div key={idx} className={`flex gap-2 sm:gap-4 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                {msg.role === 'ai' && (
                                    <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-1"
                                        style={{ background: 'var(--primary)', color: 'var(--primary-ink)' }}>
                                        <Bot className="w-4 h-4 text-[var(--primary-ink)]" />
                                    </div>
                                )}

                                <div className={`min-w-0 max-w-[85%] break-words rounded-2xl px-3 sm:px-5 py-3.5 text-base ${
                                    msg.role === 'user'
                                    ? 'bg-primary text-[var(--primary-ink)] font-medium rounded-tr-sm'
                                    : 'bg-surface border border-line text-ink rounded-tl-sm'
                                }`}>
                                    {msg.role === 'ai' ? (
                                        <div className="prose prose-sm prose-invert [&_pre]:overflow-x-auto [&_pre]:max-w-full prose-p:leading-relaxed prose-headings:font-semibold prose-a:text-primary max-w-none">
                                            <ReactMarkdown>{msg.content}</ReactMarkdown>
                                        </div>
                                    ) : (
                                        <p className="leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                                    )}
                                </div>

                                {msg.role === 'user' && (
                                    <div className="w-8 h-8 rounded-full bg-surface-3 border border-line flex items-center justify-center flex-shrink-0 mt-1">
                                        <UserIcon className="w-4 h-4 text-ink-muted" />
                                    </div>
                                )}
                            </div>
                        ))}
                        {isTyping && (
                            <div className="flex gap-4 justify-start">
                                <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-1"
                                    style={{ background: 'var(--primary)', color: 'var(--primary-ink)' }}>
                                    <Bot className="w-4 h-4 text-[var(--primary-ink)]" />
                                </div>
                                <div className="bg-surface border border-line rounded-2xl rounded-tl-sm px-5 py-4 flex items-center gap-2">
                                    <div className="w-2 h-2 bg-primary/50 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                                    <div className="w-2 h-2 bg-primary/50 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                                    <div className="w-2 h-2 bg-primary/50 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                                </div>
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                    </div>

                    {/* Input Area */}
                    <div className="p-4 bg-surface border-t border-line">
                        <div className="flex items-center gap-2 bg-surface-2 border border-line rounded-xl p-2 focus-within:ring-2 focus-within:ring-primary/20 focus-within:border-primary transition-colors">
                            <input
                                type="text"
                                value={input}
                                onChange={e => setInput(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && sendMessage()}
                                placeholder="Ask about stocks, market trends, or trading strategies..."
                                aria-label="Message to AI"
                                className="min-w-0 flex-1 bg-transparent px-3 py-2 outline-none text-base text-ink placeholder-[var(--text-faint)]"
                                disabled={isTyping}
                            />
                            <button
                                onClick={sendMessage}
                                disabled={!input.trim() || isTyping}
                                aria-label="Send message"
                                className="shrink-0 w-11 h-11 bg-primary hover:bg-surface-3 disabled:bg-surface-3 disabled:text-ink-faint text-[var(--primary-ink)] rounded-lg flex items-center justify-center transition-colors"
                            >
                                <Send className="w-4 h-4" />
                            </button>
                        </div>
                        <div className="mt-3 flex items-center justify-center gap-1.5 text-xs text-ink-faint">
                            <AlertCircle className="w-3.5 h-3.5" />
                            AI can make mistakes. Always verify important financial information.
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}
