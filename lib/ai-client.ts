import { getApiBaseUrl } from '@/lib/api-client';
export interface AiChatMessage {
    role: 'user' | 'assistant';
    content: string;
}
export interface AiChatResponse {
    response: string;
    intent: string;
    data?: {
        loads?: Array<{
            id: number;
            broker_load_id?: string | null;
            lane?: string;
            rate_con_url?: string | null;
        }>;
        settled_batches?: Array<{
            id: number;
            statement_number?: string | null;
            period_label?: string | null;
            payroll_pdf_url?: string | null;
        }>;
    } | null;
}
export interface StreamAiChatOptions {
    signal?: AbortSignal;
    onToken: (chunk: string) => void;
    onMeta?: (meta: Pick<AiChatResponse, 'intent' | 'data'>) => void;
}
function parseSseEvents(buffer: string): {
    events: Array<{
        event: string;
        data: string;
    }>;
    remainder: string;
} {
    const events: Array<{
        event: string;
        data: string;
    }> = [];
    let remainder = buffer;
    while (true) {
        const boundary = remainder.indexOf('\n\n');
        if (boundary < 0)
            break;
        const rawBlock = remainder.slice(0, boundary);
        remainder = remainder.slice(boundary + 2);
        let eventName = 'message';
        const dataLines: string[] = [];
        for (const line of rawBlock.split('\n')) {
            if (line.startsWith('event:')) {
                eventName = line.slice(6).trim();
            }
            else if (line.startsWith('data:')) {
                dataLines.push(line.slice(5).trimStart());
            }
        }
        if (dataLines.length > 0) {
            events.push({ event: eventName, data: dataLines.join('\n') });
        }
    }
    return { events, remainder };
}
export async function streamAiChat(message: string, conversationHistory: AiChatMessage[] = [], options: StreamAiChatOptions): Promise<void> {
    const response = await fetch(`${getApiBaseUrl()}/api/ai/chat`, {
        method: 'POST',
        credentials: 'include',
        headers: {
            'Content-Type': 'application/json',
            Accept: 'text/event-stream',
        },
        body: JSON.stringify({
            message,
            conversation_history: conversationHistory,
        }),
        signal: options.signal,
    });
    if (!response.ok) {
        let detail = 'Unable to reach the operations assistant.';
        try {
            const payload = (await response.json()) as {
                detail?: unknown;
            };
            if (typeof payload.detail === 'string' && payload.detail.trim()) {
                detail = payload.detail;
            }
        }
        catch {
        }
        throw new Error(detail);
    }
    const reader = response.body?.getReader();
    if (!reader) {
        throw new Error('Streaming response body is unavailable.');
    }
    const decoder = new TextDecoder();
    let buffer = '';
    try {
        while (true) {
            const { value, done } = await reader.read();
            if (done)
                break;
            buffer += decoder.decode(value, { stream: true });
            const parsed = parseSseEvents(buffer);
            buffer = parsed.remainder;
            for (const { event, data } of parsed.events) {
                if (event === 'meta') {
                    try {
                        const meta = JSON.parse(data) as Pick<AiChatResponse, 'intent' | 'data'>;
                        options.onMeta?.(meta);
                    }
                    catch {
                    }
                    continue;
                }
                if (event === 'done') {
                    continue;
                }
                try {
                    const payload = JSON.parse(data) as {
                        t?: string;
                    };
                    if (typeof payload.t === 'string' && payload.t.length > 0) {
                        options.onToken(payload.t);
                    }
                }
                catch {
                    if (data.trim()) {
                        options.onToken(data);
                    }
                }
            }
        }
    }
    finally {
        reader.releaseLock();
    }
}
