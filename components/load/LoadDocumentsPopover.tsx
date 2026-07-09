"use client";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Download, FileText, Loader2 } from "lucide-react";
import { Popover, PopoverAnchor, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { loadDocumentDisplayName, loadDocumentsPopoverTitle, resolveLoadDocumentUrl, } from "@/lib/load-documents";
import type { LoadDocumentRecord, TmsApi } from "@/lib/tms-api";
interface LoadDocumentsPopoverProps {
    loadId: number;
    api: TmsApi;
    hasIngestPdf?: boolean;
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
    anchor?: React.ReactElement;
    trigger?: React.ReactElement;
    align?: "start" | "center" | "end";
    side?: "top" | "bottom" | "left" | "right";
    refreshKey?: number;
}
export default function LoadDocumentsPopover({ loadId, api, hasIngestPdf = false, open: controlledOpen, onOpenChange, anchor, trigger, align = "end", side = "bottom", refreshKey, }: LoadDocumentsPopoverProps) {
    const [internalOpen, setInternalOpen] = useState(false);
    const [documents, setDocuments] = useState<LoadDocumentRecord[] | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const wasOpenRef = useRef(false);
    const isControlled = controlledOpen !== undefined;
    const open = isControlled ? controlledOpen : internalOpen;
    const setOpen = useCallback((nextOpen: boolean) => {
        if (isControlled) {
            onOpenChange?.(nextOpen);
        }
        else {
            setInternalOpen(nextOpen);
        }
    }, [isControlled, onOpenChange]);
    const fetchDocuments = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const docs = await api.loads.documents(loadId);
            setDocuments(docs);
        }
        catch (err: unknown) {
            setDocuments([]);
            const message = err && typeof err === "object" && "response" in err
                ? (err as {
                    response?: {
                        data?: {
                            detail?: string;
                        };
                    };
                }).response?.data?.detail
                : null;
            setError(typeof message === "string" ? message : "Failed to load files.");
        }
        finally {
            setLoading(false);
        }
    }, [api, loadId]);
    useEffect(() => {
        const becameOpen = open && !wasOpenRef.current;
        wasOpenRef.current = open;
        if (!becameOpen)
            return;
        setDocuments(null);
        void fetchDocuments();
    }, [open, fetchDocuments]);
    useEffect(() => {
        if (!open || refreshKey === undefined || refreshKey < 1)
            return;
        setDocuments(null);
        void fetchDocuments();
    }, [refreshKey, open, fetchDocuments]);
    const handleOpenChange = (nextOpen: boolean) => {
        setOpen(nextOpen);
    };
    const title = loadDocumentsPopoverTitle(documents ?? []);
    const openDocument = (event: React.MouseEvent, resolvedUrl: string) => {
        event.preventDefault();
        event.stopPropagation();
        window.open(resolvedUrl, "_blank", "noopener,noreferrer");
    };
    return (<Popover open={open} onOpenChange={handleOpenChange}>
      {anchor ? <PopoverAnchor asChild>{anchor}</PopoverAnchor> : null}
      {trigger ? <PopoverTrigger asChild>{trigger}</PopoverTrigger> : null}
      <PopoverContent align={align} side={side} data-load-documents-popover className="w-80 p-0">
        <div className="border-b border-zinc-200 dark:border-zinc-800 px-3 py-2.5">
          <p className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            {loading ? "Attached Files" : title}
          </p>
        </div>

        <div className="max-h-56 overflow-y-auto p-2">
          {loading ? (<div className="flex items-center justify-center gap-2 py-6 text-xs text-zinc-500">
              <Loader2 size={14} className="animate-spin"/>
              Loading files...
            </div>) : error ? (<p className="px-2 py-4 text-xs text-rose-500 text-center">{error}</p>) : !documents?.length ? (<p className="px-2 py-4 text-xs text-zinc-500 text-center">
              {hasIngestPdf
                ? "Rate confirmation was ingested but no downloadable file is on record yet."
                : "No documents attached yet."}
            </p>) : (<ul className="space-y-1">
              {documents.map((doc) => {
                const href = resolveLoadDocumentUrl(doc);
                const label = loadDocumentDisplayName(doc);
                return (<li key={doc.id}>
                    {href ? (<a href={href} role="button" className="flex items-center gap-2 rounded-lg px-2 py-2 text-sm text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer" onClick={(event) => openDocument(event, href)}>
                        <FileText size={14} className="shrink-0 text-zinc-400"/>
                        <span className="flex-1 min-w-0 truncate">{label}</span>
                        <Download size={14} className="shrink-0 text-zinc-400"/>
                      </a>) : (<div className="flex items-center gap-2 rounded-lg px-2 py-2 text-sm text-zinc-500">
                        <FileText size={14} className="shrink-0"/>
                        <span className="flex-1 min-w-0 truncate">{label}</span>
                      </div>)}
                  </li>);
            })}
            </ul>)}
        </div>
      </PopoverContent>
    </Popover>);
}
