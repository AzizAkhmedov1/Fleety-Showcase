"use client";
import React, { useEffect, useMemo, useState } from "react";
import { ChevronDown, ExternalLink, FileText, Folder, FolderOpen, Trash2, } from "lucide-react";
import { groupTaskFileRows, statusBadgeClass, type TaskFileRow, } from "@/lib/tasks-files";
import { ProfileFieldFallback, ProfileFieldValue, isEmptyProfileValue, } from "@/components/entity-detail/profile-field-styles";
const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
function resolveFileUrl(fileUrl?: string | null, filePath?: string | null): string | null {
    if (fileUrl?.startsWith("http"))
        return fileUrl;
    if (fileUrl)
        return `${API_URL}${fileUrl}`;
    if (filePath)
        return `${API_URL}/${filePath.replace(/^\/+/, "")}`;
    return null;
}
function canPersistDocumentNotes(row: TaskFileRow): boolean {
    if (row.isTask)
        return false;
    if (typeof row.id === "number")
        return true;
    return /^\d+$/.test(String(row.id));
}
interface TasksAndFilesPanelProps {
    rows: TaskFileRow[];
    emptyMessage?: string;
    uploadSlot?: React.ReactNode;
    notesById?: Record<string, string>;
    onNotesChange?: (id: string | number, notes: string) => void;
    onNotesBlur?: (id: string | number, notes: string) => void | Promise<void>;
    readOnlyNotes?: boolean;
    deletableFolderIds?: Record<string, number>;
    onDeleteFolder?: (folderId: number, folderName: string) => void | Promise<void>;
    onDeleteDocument?: (documentId: number) => void | Promise<void>;
}
export default function TasksAndFilesPanel({ rows, emptyMessage = "No files or tasks on record.", uploadSlot, notesById = {}, onNotesChange, onNotesBlur, readOnlyNotes = false, deletableFolderIds, onDeleteFolder, onDeleteDocument, }: TasksAndFilesPanelProps) {
    const grouped = useMemo(() => groupTaskFileRows(rows), [rows]);
    const [expandedFolders, setExpandedFolders] = useState<Set<string>>(() => new Set());
    const [savingNoteIds, setSavingNoteIds] = useState<Set<string>>(() => new Set());
    useEffect(() => {
        setExpandedFolders(new Set(grouped.keys()));
    }, [grouped]);
    const toggleFolder = (folder: string) => {
        setExpandedFolders((prev) => {
            const next = new Set(prev);
            if (next.has(folder))
                next.delete(folder);
            else
                next.add(folder);
            return next;
        });
    };
    const handleNotesBlur = async (row: TaskFileRow, notes: string) => {
        if (!onNotesBlur || !canPersistDocumentNotes(row))
            return;
        const rowKey = String(row.id);
        setSavingNoteIds((prev) => new Set(prev).add(rowKey));
        try {
            await onNotesBlur(row.id, notes);
        }
        finally {
            setSavingNoteIds((prev) => {
                const next = new Set(prev);
                next.delete(rowKey);
                return next;
            });
        }
    };
    return (<div className="rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden bg-white dark:bg-zinc-900/20">
      {uploadSlot ? (<div className="p-4 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/40">
          {uploadSlot}
        </div>) : null}

      {rows.length === 0 ? (<p className="p-8 text-sm text-zinc-500 text-center">{emptyMessage}</p>) : (<div className="overflow-x-auto">
          <table className="w-full text-left text-sm min-w-[920px]">
            <thead className="bg-zinc-50 dark:bg-zinc-950 text-[10px] font-bold uppercase tracking-wider text-zinc-500 border-b border-zinc-200 dark:border-zinc-800">
              <tr>
                <th className="py-1.5 px-2 pl-4 min-w-[220px]">File Name</th>
                <th className="py-1.5 px-2">Issue Date</th>
                <th className="py-1.5 px-2">Exp. Date</th>
                <th className="py-1.5 px-2">Uploaded Date</th>
                <th className="py-1.5 px-2">Status</th>
                <th className="py-1.5 px-2 min-w-[180px]">Notes</th>
                <th className="py-1.5 px-2 text-right">Open</th>
                <th className="py-1.5 px-2 pr-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {Array.from(grouped.entries()).map(([folderName, folderRows]) => {
                const isExpanded = expandedFolders.has(folderName);
                const FolderIcon = isExpanded ? FolderOpen : Folder;
                const deletableFolderId = deletableFolderIds?.[folderName];
                return (<React.Fragment key={folderName}>
                    <tr className="bg-zinc-50/80 dark:bg-zinc-950/50">
                      <td colSpan={8} className="p-0">
                        <div className="flex items-center w-full">
                          <button type="button" onClick={() => toggleFolder(folderName)} className="flex-1 flex items-center gap-2 py-1.5 px-2 text-left text-xs font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-900/60 transition-colors">
                            <span className={`shrink-0 text-zinc-400 transition-transform duration-150 ${isExpanded ? "rotate-0" : "-rotate-90"}`}>
                              <ChevronDown size={14} aria-hidden/>
                            </span>
                            <FolderIcon size={14} className="shrink-0 text-amber-500/80"/>
                            <span>{folderName}</span>
                            <span className="text-zinc-400 dark:text-zinc-500 font-semibold normal-case">
                              ({folderRows.length})
                            </span>
                          </button>
                          {deletableFolderId != null && onDeleteFolder ? (<button type="button" aria-label={`Delete ${folderName}`} onClick={(event) => {
                            event.stopPropagation();
                            void onDeleteFolder(deletableFolderId, folderName);
                        }} className="shrink-0 mr-2 p-1 text-zinc-400 hover:text-red-500 dark:text-zinc-600 dark:hover:text-red-400 transition-colors">
                              <Trash2 size={14}/>
                            </button>) : null}
                        </div>
                      </td>
                    </tr>
                    {isExpanded
                        ? folderRows.map((row) => {
                            const noteValue = notesById[String(row.id)] ?? row.notes ?? "";
                            const fileHref = resolveFileUrl(row.fileUrl, row.filePath);
                            return (<tr key={String(row.id)} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-900/40 transition-colors">
                              <td className="py-1.5 px-2 pl-6">
                                <div className="flex items-center gap-2 min-w-0">
                                  <FileText size={14} className="shrink-0 text-zinc-400"/>
                                  <span className="font-medium text-zinc-900 dark:text-white truncate">
                                    {row.fileName}
                                  </span>
                                </div>
                              </td>
                              <td className="py-1.5 px-2 text-zinc-600 dark:text-zinc-400">
                                <ProfileFieldValue value={row.issueDate} fallback="None"/>
                              </td>
                              <td className="py-1.5 px-2 text-zinc-600 dark:text-zinc-400">
                                <ProfileFieldValue value={row.expirationDate} fallback="None"/>
                              </td>
                              <td className="py-1.5 px-2 text-zinc-600 dark:text-zinc-400">
                                <ProfileFieldValue value={row.uploadedDate} fallback="None"/>
                              </td>
                              <td className="py-1.5 px-2">
                                <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${statusBadgeClass(row.status)}`}>
                                  {row.statusLabel}
                                </span>
                              </td>
                              <td className="py-1.5 px-2">
                                {readOnlyNotes || !onNotesChange ? (<span className="text-xs text-zinc-500 dark:text-zinc-400 line-clamp-2">
                                    {isEmptyProfileValue(noteValue) ? (<ProfileFieldFallback label="None"/>) : (noteValue)}
                                  </span>) : (<input type="text" value={noteValue} onChange={(e) => onNotesChange(row.id, e.target.value)} onBlur={(e) => void handleNotesBlur(row, e.target.value)} placeholder="Add note..." disabled={savingNoteIds.has(String(row.id))} className="w-full bg-transparent border border-transparent text-zinc-900 dark:text-zinc-100 rounded px-1 py-0.5 text-xs outline-none transition-colors hover:bg-zinc-100/60 dark:hover:bg-zinc-800/40 focus:bg-white dark:focus:bg-zinc-900/80 focus:border-zinc-200 dark:focus:border-zinc-700 focus:ring-1 focus:ring-sky-500/30 disabled:opacity-60"/>)}
                              </td>
                              <td className="py-1.5 px-2 text-right">
                                {!row.isTask && fileHref ? (<a href={fileHref} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs font-bold text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white transition-colors">
                                    View
                                    <ExternalLink size={12}/>
                                  </a>) : (<ProfileFieldFallback label="None"/>)}
                              </td>
                              <td className="py-1.5 px-2 pr-4 text-right">
                                {!row.isTask &&
                                    onDeleteDocument &&
                                    canPersistDocumentNotes(row) ? (<button type="button" aria-label={`Delete ${row.fileName}`} onClick={() => {
                                        const documentId = typeof row.id === "number"
                                            ? row.id
                                            : parseInt(String(row.id), 10);
                                        if (!Number.isNaN(documentId)) {
                                            void onDeleteDocument(documentId);
                                        }
                                    }} className="inline-flex items-center justify-center text-zinc-400 hover:text-red-500 cursor-pointer transition-colors duration-150">
                                    <Trash2 className="w-4 h-4" aria-hidden/>
                                  </button>) : null}
                              </td>
                            </tr>);
                        })
                        : null}
                  </React.Fragment>);
            })}
            </tbody>
          </table>
        </div>)}
    </div>);
}
