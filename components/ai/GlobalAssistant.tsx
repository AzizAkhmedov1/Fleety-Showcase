'use client';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Download, FileText, Loader2, MessageSquare, Send, Square, X } from 'lucide-react';
import FleetyIcon from '@/components/icons/FleetyIcon';
import { getApiBaseUrl, hasValidTmsToken, readPersistedTmsToken, TMS_TOKEN_UPDATED_EVENT, validateTmsSession, } from '@/lib/api-client';
import { streamAiChat, type AiChatMessage } from '@/lib/ai-client';
interface DriverRcLoadAttachment {
    id: number;
    broker_load_id?: string | null;
    lane?: string;
    rate_con_url?: string | null;
}
interface PayrollPdfAttachment {
    id: number;
    statement_number?: string | null;
    period_label?: string | null;
    payroll_pdf_url?: string | null;
}
type ChatMessage = AiChatMessage & {
    loadAttachments?: DriverRcLoadAttachment[];
    payrollAttachments?: PayrollPdfAttachment[];
};
const LOADING_LABEL = 'Querying database ledger...';
const DEFAULT_WELCOME_MESSAGE: ChatMessage = {
    role: 'assistant',
    content: 'Ask about financials (profit, revenue, cash flow), unbatched dispatcher commissions, or driver rate confirmations.',
};
export default function GlobalAssistant() {
    const [isOpen, setIsOpen] = useState(false);
    const [input, setInput] = useState('');
    const [messages, setMessages] = useState<ChatMessage[]>([DEFAULT_WELCOME_MESSAGE]);
    const [isLoading, setIsLoading] = useState(false);
    const [isStreaming, setIsStreaming] = useState(false);
    const [streamingText, setStreamingText] = useState('');
    const [isMounted, setIsMounted] = useState(false);
    const [authRevision, setAuthRevision] = useState(0);
    const scrollRef = useRef<HTMLDivElement>(null);
    const scrollAnchorRef = useRef<HTMLDivElement>(null);
    const abortControllerRef = useRef<AbortController | null>(null);
    const chatHistory = useMemo(() => messages ?? [], [messages]);
    const sessionToken = useMemo(() => {
        void authRevision;
        return readPersistedTmsToken();
    }, [authRevision]);
    const canUseAssistant = isMounted && hasValidTmsToken(sessionToken);
    const stopStreaming = useCallback(() => {
        abortControllerRef.current?.abort();
        abortControllerRef.current = null;
    }, []);
    const handleClose = useCallback(() => {
        stopStreaming();
        setIsOpen(false);
    }, [stopStreaming]);
    useEffect(() => {
        setIsMounted(true);
        const syncAuth = () => {
            void validateTmsSession().finally(() => {
                setAuthRevision((revision) => revision + 1);
            });
        };
        syncAuth();
        window.addEventListener(TMS_TOKEN_UPDATED_EVENT, syncAuth);
        window.addEventListener('focus', syncAuth);
        document.addEventListener('visibilitychange', syncAuth);
        return () => {
            window.removeEventListener(TMS_TOKEN_UPDATED_EVENT, syncAuth);
            window.removeEventListener('focus', syncAuth);
            document.removeEventListener('visibilitychange', syncAuth);
        };
    }, []);
    useEffect(() => {
        return () => {
            abortControllerRef.current?.abort();
        };
    }, []);
    useEffect(() => {
        scrollAnchorRef.current?.scrollIntoView({ behavior: isStreaming ? 'auto' : 'smooth', block: 'end' });
    }, [chatHistory, streamingText, isLoading, isStreaming, isOpen]);
    const openAuthenticatedDocument = useCallback((documentPath: string) => {
        if (!hasValidTmsToken()) {
            return;
        }
        const normalizedPath = documentPath.startsWith('/') ? documentPath : `/${documentPath}`;
        const url = `${getApiBaseUrl()}${normalizedPath}`;
        window.open(url, '_blank', 'noopener,noreferrer');
    }, []);
    const sendMessage = useCallback(async () => {
        const trimmed = input.trim();
        if (!trimmed || isLoading || isStreaming)
            return;
        if (!hasValidTmsToken()) {
            setMessages((prev) => [
                ...(prev ?? []),
                { role: 'user', content: trimmed },
                { role: 'assistant', content: 'Please sign in to query operational data.' },
            ]);
            setInput('');
            setAuthRevision((revision) => revision + 1);
            return;
        }
        const priorHistory = chatHistory.filter((message) => message?.content?.trim());
        setMessages((prev) => [...(prev ?? []), { role: 'user', content: trimmed }]);
        setInput('');
        setIsLoading(true);
        setStreamingText('');
        const controller = new AbortController();
        abortControllerRef.current = controller;
        let streamedContent = '';
        let loadAttachments: DriverRcLoadAttachment[] | undefined;
        let payrollAttachments: PayrollPdfAttachment[] | undefined;
        try {
            await streamAiChat(trimmed, priorHistory.map((message) => ({
                role: message.role,
                content: message.content,
            })), {
                signal: controller.signal,
                onToken: (chunk) => {
                    streamedContent += chunk;
                    setStreamingText(streamedContent);
                    setIsLoading(false);
                    setIsStreaming(true);
                },
                onMeta: (meta) => {
                    const loads = meta?.data?.loads?.filter((load) => Boolean(load?.rate_con_url)) ?? [];
                    const batches = meta?.data?.settled_batches?.filter((batch) => Boolean(batch?.payroll_pdf_url)) ?? [];
                    loadAttachments = loads.length > 0 ? loads : undefined;
                    payrollAttachments = batches.length > 0 ? batches : undefined;
                },
            });
            setMessages((prev) => [
                ...(prev ?? []),
                {
                    role: 'assistant',
                    content: streamedContent.trim() || 'No response received.',
                    loadAttachments,
                    payrollAttachments,
                },
            ]);
        }
        catch (err: unknown) {
            if (err instanceof DOMException && err.name === 'AbortError') {
                if (streamedContent.trim()) {
                    setMessages((prev) => [
                        ...(prev ?? []),
                        {
                            role: 'assistant',
                            content: streamedContent.trim(),
                            loadAttachments,
                            payrollAttachments,
                        },
                    ]);
                }
            }
            else {
                const detail = err instanceof Error && err.message.trim()
                    ? err.message
                    : 'Unable to reach the operations assistant.';
                setMessages((prev) => [...(prev ?? []), { role: 'assistant', content: detail }]);
            }
        }
        finally {
            if (abortControllerRef.current === controller) {
                abortControllerRef.current = null;
            }
            setIsLoading(false);
            setIsStreaming(false);
            setStreamingText('');
        }
    }, [chatHistory, input, isLoading, isStreaming]);
    if (!canUseAssistant) {
        return null;
    }
    return (<div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">
      {isOpen && (<div className="w-[min(100vw-2rem,24rem)] h-[min(70vh,32rem)] bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-200">
          <div className="px-4 py-3 border-b border-zinc-800 bg-zinc-950 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FleetyIcon className="h-[18px] w-[18px] shrink-0" aria-hidden/>
              <div>
                <p className="text-sm font-bold text-white">Fleety AI</p>
                <p className="text-[10px] text-zinc-500 uppercase tracking-wider">AI Assistant</p>
              </div>
            </div>
            <button type="button" onClick={handleClose} className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors" aria-label="Close assistant">
              <X size={16}/>
            </button>
          </div>

          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3 relative">
            {chatHistory.map((message, index) => {
                const loadAttachments = message?.loadAttachments ?? [];
                const payrollAttachments = message?.payrollAttachments ?? [];
                return (<div key={`${message?.role ?? 'assistant'}-${index}`} className={`flex ${message?.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] rounded-xl px-3 py-2 text-sm whitespace-pre-wrap leading-relaxed ${message?.role === 'user'
                        ? 'bg-sky-600 text-white'
                        : 'bg-zinc-800 text-zinc-100 border border-zinc-700'}`}>
                    {message?.content ?? ''}
                    {message?.role === 'assistant' && loadAttachments.length > 0 && (<div className="mt-2 space-y-1.5">
                        {loadAttachments.map((load, loadIndex) => {
                            const label = load?.broker_load_id || `L-${load?.id ?? loadIndex}`;
                            const documentPath = load?.rate_con_url;
                            if (!documentPath)
                                return null;
                            return (<button key={`rc-${load?.id ?? loadIndex}-${loadIndex}`} type="button" onClick={() => openAuthenticatedDocument(documentPath)} className="flex w-full items-center gap-2 bg-zinc-700 hover:bg-zinc-600 px-2.5 py-1.5 rounded text-xs text-white border border-zinc-600 transition-colors">
                              <FileText size={12} className="shrink-0"/>
                              <span className="truncate">View RC — {label}</span>
                              <Download size={12} className="shrink-0 ml-auto opacity-80"/>
                            </button>);
                        })}
                      </div>)}
                    {message?.role === 'assistant' && payrollAttachments.length > 0 && (<div className="mt-2 space-y-1.5">
                        {payrollAttachments.map((batch, batchIndex) => {
                            const label = batch?.statement_number || `Batch-${batch?.id ?? batchIndex}`;
                            const period = batch?.period_label ? ` (${batch.period_label})` : '';
                            const documentPath = batch?.payroll_pdf_url;
                            if (!documentPath)
                                return null;
                            return (<button key={`payroll-${batch?.id ?? batchIndex}-${batchIndex}`} type="button" onClick={() => openAuthenticatedDocument(documentPath)} className="flex w-full items-center gap-2 bg-zinc-700 hover:bg-zinc-600 px-2.5 py-1.5 rounded text-xs text-white border border-zinc-600 transition-colors">
                              <FileText size={12} className="shrink-0"/>
                              <span className="truncate">
                                View Payroll PDF — {label}
                                {period}
                              </span>
                              <Download size={12} className="shrink-0 ml-auto opacity-80"/>
                            </button>);
                        })}
                      </div>)}
                  </div>
                </div>);
            })}

            {isStreaming && streamingText && (<div className="flex justify-start">
                <div className="max-w-[85%] rounded-xl px-3 py-2 text-sm whitespace-pre-wrap leading-relaxed bg-zinc-800 text-zinc-100 border border-zinc-700">
                  {streamingText}
                </div>
              </div>)}

            {isLoading && !isStreaming && (<div className="flex justify-start">
                <div className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs bg-zinc-800 text-zinc-300 border border-zinc-700">
                  <Loader2 size={14} className="animate-spin text-sky-400"/>
                  {LOADING_LABEL}
                </div>
              </div>)}

            <div ref={scrollAnchorRef} aria-hidden className="h-px w-full shrink-0"/>
          </div>

          <form className="p-3 border-t border-zinc-800 bg-zinc-950" onSubmit={(event) => {
                event.preventDefault();
                void sendMessage();
            }}>
            <div className="flex items-center gap-2">
              <input type="text" value={input} onChange={(event) => setInput(event.target.value)} placeholder="Ask about profit or commissions..." disabled={isLoading || isStreaming} className="flex-1 bg-zinc-900 border border-zinc-800 text-white text-sm rounded-xl px-3 py-2 outline-none focus:ring-1 focus:ring-sky-500 placeholder:text-zinc-500 disabled:opacity-60"/>
              {isStreaming ? (<button type="button" onClick={stopStreaming} className="p-2.5 rounded-xl bg-rose-600 text-white hover:bg-rose-500 transition-colors" aria-label="Stop generating">
                  <Square size={16} fill="currentColor"/>
                </button>) : (<button type="submit" disabled={isLoading || !input.trim()} className="p-2.5 rounded-xl bg-sky-600 text-white hover:bg-sky-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors" aria-label="Send message">
                  <Send size={16}/>
                </button>)}
            </div>
          </form>
        </div>)}

      <button type="button" onClick={() => (isOpen ? handleClose() : setIsOpen(true))} className="h-14 w-14 rounded-full bg-sky-600 hover:bg-sky-500 text-white shadow-lg shadow-sky-900/40 flex items-center justify-center transition-colors" aria-label={isOpen ? 'Close operations assistant' : 'Open operations assistant'}>
        {isOpen ? <X size={22}/> : <MessageSquare size={22}/>}
      </button>
    </div>);
}
