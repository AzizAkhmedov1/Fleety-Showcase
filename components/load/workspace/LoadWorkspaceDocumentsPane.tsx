"use client";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import toast from "react-hot-toast";
import { FileEdit, FileText, Loader2, UploadCloud } from "lucide-react";
import { CARD_SECTION_LABEL_CLASS } from "@/lib/display-labels";
import { createApiClient } from "@/lib/api-client";
import { filterOperationalDocuments, loadDocumentDisplayName, resolveLoadDocumentUrl, } from "@/lib/load-documents";
import { createTmsApi, type LoadDocumentRecord } from "@/lib/tms-api";
const UploadRevisionModal = dynamic(() => import("@/components/UploadRevisionModal"), {
    ssr: false,
});
interface LoadWorkspaceDocumentsPaneProps {
    loadId: number;
    token: string;
    hasIngestPdf?: boolean;
    onRefresh: () => Promise<void>;
}
function inferDocumentType(fileName: string) {
    const lower = fileName.toLowerCase();
    if (lower.includes("pod"))
        return "POD";
    if (lower.includes("bol"))
        return "BOL";
    if (lower.includes("lumper"))
        return "LUMPER";
    if (lower.includes("scale"))
        return "SCALE_TICKET";
    return "Other";
}
export default function LoadWorkspaceDocumentsPane({ loadId, token, hasIngestPdf = false, onRefresh, }: LoadWorkspaceDocumentsPaneProps) {
    const api = useMemo(() => createTmsApi(createApiClient(token)), [token]);
    const uploadInputRef = useRef<HTMLInputElement>(null);
    const [documents, setDocuments] = useState<LoadDocumentRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [revisionOpen, setRevisionOpen] = useState(false);
    const fetchDocuments = useCallback(async () => {
        setLoading(true);
        try {
            const docs = await api.loads.documents(loadId);
            setDocuments(docs);
        }
        catch {
            setDocuments([]);
        }
        finally {
            setLoading(false);
        }
    }, [api, loadId]);
    useEffect(() => {
        void fetchDocuments();
    }, [fetchDocuments]);
    const openDocument = (event: React.MouseEvent, href: string) => {
        event.preventDefault();
        event.stopPropagation();
        window.open(href, "_blank", "noopener,noreferrer");
    };
    const handleUploadChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const files = event.target.files ? Array.from(event.target.files) : [];
        if (files.length === 0)
            return;
        setUploading(true);
        const toastId = toast.loading(files.length === 1 ? "Uploading document..." : `Uploading ${files.length} documents...`);
        try {
            for (const file of files) {
                const formData = new FormData();
                formData.append("file", file, file.name);
                formData.append("document_type", inferDocumentType(file.name));
                await api.loads.postDocumentForm(loadId, formData);
            }
            await fetchDocuments();
            await onRefresh();
            toast.success(files.length === 1 ? "Document uploaded." : `${files.length} documents uploaded.`, { id: toastId });
        }
        catch (err: unknown) {
            const message = err && typeof err === "object" && "response" in err
                ? (err as {
                    response?: {
                        data?: {
                            detail?: string;
                        };
                    };
                }).response?.data?.detail
                : null;
            toast.error(typeof message === "string" ? message : "Failed to upload document.", {
                id: toastId,
            });
        }
        finally {
            event.target.value = "";
            setUploading(false);
        }
    };
    const operationalDocuments = useMemo(() => filterOperationalDocuments(documents), [documents]);
    return (<div className="space-y-6">
      <input ref={uploadInputRef} type="file" multiple accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx" className="hidden" onChange={(event) => void handleUploadChange(event)}/>

      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#161616] p-4">
        <p className={CARD_SECTION_LABEL_CLASS}>
          Attached Files
        </p>
        {loading ? (<div className="flex items-center justify-center gap-2 py-10 text-sm text-zinc-500">
            <Loader2 size={16} className="animate-spin" aria-hidden/>
            Loading files...
          </div>) : operationalDocuments.length === 0 ? (<p className="text-sm text-zinc-500 dark:text-zinc-400 text-center py-10">
            {hasIngestPdf
                ? "Rate confirmation was ingested but no downloadable file is on record yet."
                : "No documents attached yet."}
          </p>) : (<ul className="space-y-2">
            {operationalDocuments.map((doc) => {
                const href = resolveLoadDocumentUrl(doc);
                const label = loadDocumentDisplayName(doc);
                return (<li key={doc.id}>
                  {href ? (<button type="button" onClick={(event) => openDocument(event, href)} className="w-full flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors text-left">
                      <FileText size={16} className="shrink-0 text-zinc-400" aria-hidden/>
                      <span className="flex-1 min-w-0 truncate">{label}</span>
                    </button>) : (<div className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm text-zinc-500 dark:text-zinc-400">
                      <FileText size={16} className="shrink-0" aria-hidden/>
                      <span className="flex-1 min-w-0 truncate">{label}</span>
                    </div>)}
                </li>);
            })}
          </ul>)}
      </div>

      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#161616] p-4">
        <p className={CARD_SECTION_LABEL_CLASS}>
          Upload Documents
        </p>
        <button type="button" disabled={uploading} onClick={() => uploadInputRef.current?.click()} className="w-full border-2 border-dashed border-zinc-300 dark:border-zinc-700 rounded-xl p-8 flex flex-col items-center justify-center gap-2 text-zinc-500 dark:text-zinc-400 hover:border-zinc-500 dark:hover:border-zinc-500 hover:bg-zinc-50 dark:hover:bg-zinc-900/40 transition-colors disabled:opacity-50">
          {uploading ? (<Loader2 size={24} className="animate-spin" aria-hidden/>) : (<UploadCloud size={24} aria-hidden/>)}
          <span className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
            {uploading ? "Uploading..." : "Drop files or click to upload"}
          </span>
          <span className="text-xs">PDF, PNG, JPG, DOC</span>
        </button>
      </div>

      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#161616] p-4">
        <p className={CARD_SECTION_LABEL_CLASS}>
          Revised Rate Confirmation
        </p>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-4">
          Upload a revised rate confirmation to compare and apply updated financial terms.
        </p>
        <button type="button" onClick={() => setRevisionOpen(true)} className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg border border-zinc-200 dark:border-zinc-700 text-sm font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors">
          <FileEdit size={16} aria-hidden/>
          Upload Revised Rate Confirmation
        </button>
      </div>

      <UploadRevisionModal isOpen={revisionOpen} onClose={() => setRevisionOpen(false)} loadId={loadId} onApplied={async () => {
            await fetchDocuments();
            await onRefresh();
            setRevisionOpen(false);
        }}/>
    </div>);
}
