"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { FileText, Loader2, Recycle, Trash2, Undo2 } from "lucide-react";
import { createApiClient, formatApiError } from "@/lib/api-client";
import { isRateConfirmationDocument, loadDocumentDisplayName, resolveLoadDocumentUrl, } from "@/lib/load-documents";
import { createTmsApi, type LoadDocumentRecord, type TrashLoadItem, type TmsApi, } from "@/lib/tms-api";
interface LoadTrashBinProps {
    token: string;
    refreshData: () => Promise<void>;
}
const fmt = (n: number) => n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
function documentBadgeLabel(doc: LoadDocumentRecord): string {
    if (isRateConfirmationDocument(doc))
        return "Rate Confirmation";
    const type = (doc.document_type || "").toLowerCase();
    if (type.includes("bol"))
        return "BOL";
    if (type.includes("pod"))
        return "POD";
    const name = loadDocumentDisplayName(doc);
    return name.length > 12 ? `${name.slice(0, 10)}…` : name;
}
function openLoadDocument(event: React.MouseEvent, href: string) {
    event.preventDefault();
    event.stopPropagation();
    window.open(href, "_blank", "noopener,noreferrer");
}
function TrashLoadDocumentsCell({ documents, loading, }: {
    documents: LoadDocumentRecord[] | undefined;
    loading: boolean;
}) {
    if (loading) {
        return (<span className="inline-flex items-center text-zinc-400">
        <Loader2 size={12} className="animate-spin"/>
      </span>);
    }
    if (!documents?.length) {
        return <span className="text-zinc-400 dark:text-zinc-500">—</span>;
    }
    return (<div className="flex flex-wrap items-center justify-end gap-1 w-max max-w-full ml-auto">
      {documents.map((doc) => {
            const href = resolveLoadDocumentUrl(doc);
            const label = documentBadgeLabel(doc);
            const title = loadDocumentDisplayName(doc);
            const badgeClassName = "inline-flex w-max max-w-full items-center gap-1 whitespace-nowrap px-2 py-0.5 rounded-md text-[10px] font-semibold border";
            if (!href) {
                return (<span key={doc.id} className={`${badgeClassName} border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900/50 text-zinc-500 dark:text-zinc-400`} title={title}>
              <FileText className="w-3 h-3 shrink-0" aria-hidden/>
              {label}
            </span>);
            }
            return (<button key={doc.id} type="button" title={title} onClick={(event) => openLoadDocument(event, href)} className={`${badgeClassName} border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900/60 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-600 transition-colors`}>
            <FileText className="w-3 h-3 shrink-0" aria-hidden/>
            {label}
          </button>);
        })}
    </div>);
}
export default function LoadTrashBin({ token, refreshData }: LoadTrashBinProps) {
    const api = useMemo(() => createTmsApi(createApiClient(token)), [token]);
    const [trashLoads, setTrashLoads] = useState<TrashLoadItem[]>([]);
    const [documentsByLoadId, setDocumentsByLoadId] = useState<Record<number, LoadDocumentRecord[]>>({});
    const [documentsLoading, setDocumentsLoading] = useState(false);
    const [loading, setLoading] = useState(true);
    const [restoringId, setRestoringId] = useState<number | null>(null);
    const [permanentTarget, setPermanentTarget] = useState<TrashLoadItem | null>(null);
    const [permanentDeleting, setPermanentDeleting] = useState(false);
    const fetchTrashDocuments = useCallback(async (loads: TrashLoadItem[], tmsApi: TmsApi) => {
        if (!loads.length) {
            setDocumentsByLoadId({});
            setDocumentsLoading(false);
            return;
        }
        setDocumentsLoading(true);
        try {
            const entries = await Promise.all(loads.map(async (load) => {
                try {
                    const docs = await tmsApi.loads.documents(load.id);
                    return [load.id, docs] as const;
                }
                catch {
                    return [load.id, []] as const;
                }
            }));
            setDocumentsByLoadId(Object.fromEntries(entries));
        }
        finally {
            setDocumentsLoading(false);
        }
    }, []);
    const fetchTrash = useCallback(async () => {
        setLoading(true);
        try {
            const rows = await api.loads.trash();
            setTrashLoads(rows);
            await fetchTrashDocuments(rows, api);
        }
        catch (err: unknown) {
            console.error(err);
            toast.error(formatApiError(err, "Failed to load recycle bin."));
            setTrashLoads([]);
            setDocumentsByLoadId({});
        }
        finally {
            setLoading(false);
        }
    }, [api, fetchTrashDocuments]);
    useEffect(() => {
        fetchTrash();
    }, [fetchTrash]);
    const handleRestore = async (load: TrashLoadItem) => {
        setRestoringId(load.id);
        const toastId = toast.loading("Restoring load...");
        try {
            await api.loads.restore(load.id);
            setTrashLoads((prev) => prev.filter((row) => row.id !== load.id));
            setDocumentsByLoadId((prev) => {
                const next = { ...prev };
                delete next[load.id];
                return next;
            });
            await refreshData();
            toast.success("Load successfully restored to dashboard", { id: toastId });
        }
        catch (err: unknown) {
            toast.error(formatApiError(err, "Failed to restore load."), { id: toastId });
        }
        finally {
            setRestoringId(null);
        }
    };
    const handlePermanentDelete = async () => {
        if (!permanentTarget)
            return;
        setPermanentDeleting(true);
        const toastId = toast.loading("Permanently deleting load...");
        try {
            await api.loads.permanentDelete(permanentTarget.id);
            setTrashLoads((prev) => prev.filter((row) => row.id !== permanentTarget.id));
            setDocumentsByLoadId((prev) => {
                const next = { ...prev };
                delete next[permanentTarget.id];
                return next;
            });
            setPermanentTarget(null);
            toast.success("Load permanently deleted.", { id: toastId });
        }
        catch (error: unknown) {
            toast.error(formatApiError(error, "Failed to permanently delete load."), { id: toastId });
        }
        finally {
            setPermanentDeleting(false);
        }
    };
    if (loading) {
        return (<div className="p-12 text-center text-zinc-400">
        <span className="inline-flex items-center gap-2 text-sm">
          <Loader2 size={16} className="animate-spin"/>
          Loading deleted loads...
        </span>
      </div>);
    }
    if (!trashLoads.length) {
        return (<div className="p-12 text-center">
        <Recycle className="mx-auto text-zinc-300 dark:text-zinc-600 mb-3" size={32}/>
        <p className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-1">Recycle bin is empty</p>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Soft-deleted loads appear here and can be restored or permanently erased.
        </p>
      </div>);
    }
    return (<>
      <div className="w-full overflow-x-auto">
        <table className="w-full text-sm min-w-[420px] md:min-w-0">
          <thead className="bg-zinc-50 dark:bg-[#0B0B0B] text-zinc-500 dark:text-zinc-400 text-[10px] uppercase font-bold tracking-wider border-b dark:border-zinc-800">
            <tr>
              <th className="p-4 text-left">Load ID</th>
              <th className="p-4 text-left">Broker</th>
              <th className="p-4 text-left">Lane</th>
              <th className="p-4 text-right hidden md:table-cell">Gross Pay</th>
              <th className="p-4 text-right hidden md:table-cell">Documents</th>
              <th className="p-4 text-right hidden md:table-cell">Deleted Date</th>
              <th className="p-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {trashLoads.map((load) => (<tr key={load.id} className="hover:bg-zinc-50/60 dark:hover:bg-zinc-800/30 transition-colors">
                <td className="p-4 font-mono text-xs font-bold text-zinc-900 dark:text-white">
                  {load.load_id}
                </td>
                <td className="p-4 text-zinc-700 dark:text-zinc-300">{load.broker_name}</td>
                <td className="p-4 text-zinc-500 dark:text-zinc-400">
                  {load.origin} → {load.destination}
                </td>
                <td className="p-4 text-right font-bold text-emerald-600 dark:text-emerald-400 hidden md:table-cell">
                  ${fmt(load.gross_pay)}
                </td>
                <td className="p-4 hidden md:table-cell">
                  <TrashLoadDocumentsCell documents={documentsByLoadId[load.id]} loading={documentsLoading && documentsByLoadId[load.id] === undefined}/>
                </td>
                <td className="p-4 text-right text-xs text-zinc-500 dark:text-zinc-400 hidden md:table-cell">
                  {load.deleted_at
                ? new Date(load.deleted_at).toLocaleString()
                : "—"}
                </td>
                <td className="p-4">
                  <div className="flex justify-end gap-2 flex-wrap">
                    <button type="button" onClick={() => handleRestore(load)} disabled={restoringId === load.id || permanentDeleting} className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-200 bg-transparent hover:bg-zinc-100 dark:hover:bg-zinc-800/80 transition-colors disabled:opacity-50">
                      {restoringId === load.id ? (<>
                          <Loader2 className="w-4 h-4 animate-spin" aria-hidden/>
                          Restoring...
                        </>) : (<>
                          <Undo2 className="w-4 h-4 shrink-0" aria-hidden/>
                          Restore
                        </>)}
                    </button>
                    <button type="button" onClick={() => setPermanentTarget(load)} disabled={restoringId === load.id || permanentDeleting} className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border border-transparent text-red-600 dark:text-red-400 bg-transparent hover:bg-red-50 dark:hover:bg-red-950/40 hover:border-red-200/80 dark:hover:border-red-900/50 transition-colors disabled:opacity-50">
                      <Trash2 className="w-4 h-4 shrink-0" aria-hidden/>
                      Permanent Delete
                    </button>
                  </div>
                </td>
              </tr>))}
          </tbody>
        </table>
      </div>

      {permanentTarget && (<div className="fixed inset-0 z-[90] flex items-center justify-center bg-zinc-900/60 dark:bg-[#0B0B0B]/80 p-4 backdrop-blur-sm">
          <div className="bg-white dark:bg-[#161616] border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 w-full max-w-md shadow-xl">
            <h3 className="text-lg font-bold text-zinc-900 dark:text-white mb-2">Permanent Delete</h3>
            <p className="text-sm text-zinc-600 dark:text-zinc-300 mb-6">
              Warning: This will permanently erase load{" "}
              <span className="font-mono font-bold">{permanentTarget.load_id}</span> data and files.
              This cannot be undone.
            </p>
            <div className="flex gap-3 justify-end">
              <button type="button" onClick={() => setPermanentTarget(null)} disabled={permanentDeleting} className="px-4 py-2 rounded-lg text-sm font-bold bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors disabled:opacity-50">
                Cancel
              </button>
              <button type="button" onClick={handlePermanentDelete} disabled={permanentDeleting} className="px-4 py-2 rounded-lg text-sm font-bold bg-red-600 hover:bg-red-700 text-white transition-colors disabled:opacity-50">
                {permanentDeleting ? "Deleting..." : "Permanently Delete"}
              </button>
            </div>
          </div>
        </div>)}
    </>);
}
