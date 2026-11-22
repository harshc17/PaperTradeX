export type ChatPayload = { question: string; includePerformance: boolean; includePortfolio: boolean;
    history: { role: 'user' | 'assistant'; content: string }[] };
type Exchange = { question: string; error?: string; result?: { mode: string; answer: string; portfolio?: unknown; performance?: unknown } };

export function buildChatRequest(question: string, options: { includePerformance: boolean; includePortfolio: boolean },
    entries: Exchange[], original?: ChatPayload): ChatPayload {
    // A retry uses its saved request, even if later messages or settings have changed.
    if (original) return original;
    return { question, ...options,
        history: entries.filter(entry => entry.result && !entry.error && !['unavailable', 'retrieval'].includes(entry.result.mode)).slice(-4).flatMap(entry => [
            { role: 'user' as const, content: entry.question.slice(0, 1000) },
            { role: 'assistant' as const, content: entry.result?.portfolio || entry.result?.performance
                ? 'An account snapshot was shown; fetch current account facts again.'
                : entry.result!.answer.replace(/[ \t]*\[S\d+(?:\s*[,;]\s*S?\d+)*\]/gi, '').slice(0, 1000) },
        ]),
    };
}
