'use client';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { FileEdit, Info, Loader2, UploadCloud, X } from 'lucide-react';
import { createApiClient, getApiBaseUrl } from '@/lib/api-client';
import { createTmsApi } from '@/lib/tms-api';
export interface FinancialBreakdown {
    gross_pay: number;
    fuel_surcharge: number;
    accessorials: number;
}
export interface RevisionAnalysisResponse {
    load_id: number;
    original_financials: FinancialBreakdown;
    revised_financials: FinancialBreakdown;
    has_changes: boolean;
}
export interface UploadRevisionModalProps {
    isOpen: boolean;
    onClose: () => void;
    loadId: number | string | null;
    onApplied?: () => void | Promise<void>;
}
const ACCEPTED_EXTENSIONS = ['.pdf', '.png', '.jpg', '.jpeg'] as const;
const ACCEPTED_MIME_TYPES = new Set(['application/pdf', 'image/png', 'image/jpeg', 'image/jpg']);
const USD_FORMATTER = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
});
function isAcceptedRevisionFile(file: File): boolean {
    const lowerName = file.name.toLowerCase();
    const hasValidExtension = ACCEPTED_EXTENSIONS.some((ext) => lowerName.endsWith(ext));
    const hasValidMime = ACCEPTED_MIME_TYPES.has(file.type);
    return hasValidExtension || hasValidMime;
}
function formatUsd(value: number): string {
    return USD_FORMATTER.format(value);
}
function totalRevenue(breakdown: FinancialBreakdown): number {
    return breakdown.gross_pay + breakdown.fuel_surcharge + breakdown.accessorials;
}
function formatDelta(delta: number): {
    label: string;
    className: string;
} {
    const rounded = Math.round(delta * 100) / 100;
    if (rounded > 0) {
        return {
            label: `+${formatUsd(rounded)}`,
            className: 'text-emerald-600 dark:text-emerald-400 font-semibold',
        };
    }
    if (rounded < 0) {
        return {
            label: `-${formatUsd(Math.abs(rounded))}`,
            className: 'text-rose-600 dark:text-rose-400 font-semibold',
        };
    }
    return {
        label: '$0.00',
        className: 'text-zinc-400 dark:text-zinc-500 font-medium',
    };
}
type ComparisonRow = {
    key: string;
    label: string;
    original: number;
    revised: number;
};
export default function UploadRevisionModal({ isOpen, onClose, loadId, onApplied, }: UploadRevisionModalProps) {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const api = useMemo(() => createTmsApi(createApiClient()), []);
    const [isDragging, setIsDragging] = useState(false);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [processing, setProcessing] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [responseData, setResponseData] = useState<RevisionAnalysisResponse | null>(null);
    const resetLocalState = useCallback(() => {
        setIsDragging(false);
        setSelectedFile(null);
        setProcessing(false);
        setIsSubmitting(false);
        setResponseData(null);
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    }, []);
    const handleCancel = useCallback(() => {
        resetLocalState();
        onClose();
    }, [onClose, resetLocalState]);
    useEffect(() => {
        if (!isOpen) {
            resetLocalState();
        }
    }, [isOpen, resetLocalState]);
    const submitRevision = useCallback(async (file: File) => {
        if (loadId == null)
            return;
        setProcessing(true);
        try {
            const formData = new FormData();
            formData.append('file', file);
            const response = await fetch(`${getApiBaseUrl()}/api/loads/${loadId}/process-revision`, {
                method: 'POST',
                credentials: 'include',
                body: formData,
            });
            if (!response.ok) {
                let detail = 'Unable to process revised rate confirmation.';
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
            const payload = (await response.json()) as RevisionAnalysisResponse;
            setResponseData(payload);
        }
        catch (err: unknown) {
            const message = err instanceof Error && err.message.trim()
                ? err.message
                : 'Failed to upload revised rate confirmation.';
            toast.error(message);
        }
        finally {
            setProcessing(false);
        }
    }, [loadId]);
    const handleApplyChanges = useCallback(async () => {
        if (loadId == null || !responseData)
            return;
        const numericLoadId = typeof loadId === 'string' ? Number(loadId) : loadId;
        if (!Number.isFinite(numericLoadId)) {
            toast.error('Invalid load identifier.');
            return;
        }
        const { revised_financials: revised } = responseData;
        setIsSubmitting(true);
        try {
            await api.loads.patch(numericLoadId, {
                linehaul_rate: revised.gross_pay,
                fuel_surcharge: revised.fuel_surcharge,
                accessorial_charge: revised.accessorials,
            });
            toast.success('Financial amendments applied successfully.');
            resetLocalState();
            onClose();
            await onApplied?.();
        }
        catch (err: unknown) {
            const message = err instanceof Error && err.message.trim()
                ? err.message
                : 'Failed to apply financial amendments.';
            toast.error(message);
            setIsSubmitting(false);
        }
    }, [api, loadId, onApplied, onClose, resetLocalState, responseData]);
    const handleFileSelection = useCallback((file: File | null | undefined) => {
        if (!file || processing || isSubmitting || responseData)
            return;
        if (!isAcceptedRevisionFile(file)) {
            toast.error('Please upload a PDF, PNG, or JPG file.');
            return;
        }
        setSelectedFile(file);
        void submitRevision(file);
    }, [isSubmitting, processing, responseData, submitRevision]);
    const handleDragOver = useCallback((event: React.DragEvent<HTMLDivElement>) => {
        event.preventDefault();
        event.stopPropagation();
        if (!processing && !responseData)
            setIsDragging(true);
    }, [processing, responseData]);
    const handleDragLeave = useCallback((event: React.DragEvent<HTMLDivElement>) => {
        event.preventDefault();
        event.stopPropagation();
        setIsDragging(false);
    }, []);
    const handleDrop = useCallback((event: React.DragEvent<HTMLDivElement>) => {
        event.preventDefault();
        event.stopPropagation();
        setIsDragging(false);
        if (processing || responseData)
            return;
        handleFileSelection(event.dataTransfer.files?.[0]);
    }, [handleFileSelection, processing, responseData]);
    const comparisonRows = useMemo<ComparisonRow[]>(() => {
        if (!responseData)
            return [];
        const { original_financials: original, revised_financials: revised } = responseData;
        return [
            {
                key: 'gross_pay',
                label: 'Gross Pay (Linehaul Rate)',
                original: original.gross_pay,
                revised: revised.gross_pay,
            },
            {
                key: 'fuel_surcharge',
                label: 'Fuel Surcharge',
                original: original.fuel_surcharge,
                revised: revised.fuel_surcharge,
            },
            {
                key: 'accessorials',
                label: 'Accessorials',
                original: original.accessorials,
                revised: revised.accessorials,
            },
            {
                key: 'total_revenue',
                label: 'Total Revenue',
                original: totalRevenue(original),
                revised: totalRevenue(revised),
            },
        ];
    }, [responseData]);
    if (!isOpen)
        return null;
    const loadLabel = loadId != null ? String(loadId) : '—';
    const actionsDisabled = processing || isSubmitting;
    const showComparison = responseData != null;
    return (<div className="fixed inset-0 z-[110] flex items-end md:items-center justify-center bg-zinc-900/60 p-0 md:p-4 backdrop-blur-sm dark:bg-[#0B0B0B]/80" role="dialog" aria-modal="true" aria-labelledby="upload-revision-title">
      <div className={`w-full max-w-full rounded-t-xl md:rounded-2xl border border-transparent bg-white shadow-xl transition-colors dark:border-zinc-800 dark:bg-[#161616] animate-in zoom-in-95 duration-200 max-h-[calc(100svh-1rem)] flex flex-col overflow-hidden ${showComparison ? 'md:max-w-2xl' : 'md:max-w-lg'}`}>
        <div className="shrink-0 p-4 md:p-8 pb-4 md:pb-6 border-b border-zinc-100 dark:border-zinc-800">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-2">
            <FileEdit className="shrink-0 text-zinc-700 dark:text-zinc-300" size={22}/>
            <div>
              <h2 id="upload-revision-title" className="text-lg font-bold text-zinc-900 dark:text-white">
                Upload Revised Rate Confirmation
              </h2>
              <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                Load ID:{' '}
                <span className="font-mono font-semibold text-zinc-700 dark:text-zinc-200">
                  {loadLabel}
                </span>
              </p>
            </div>
          </div>
          <button type="button" onClick={handleCancel} disabled={actionsDisabled} className="rounded-full p-1.5 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-600 disabled:opacity-50 dark:hover:bg-zinc-800 dark:hover:text-zinc-300" aria-label="Close revised rate confirmation upload">
            <X size={20}/>
          </button>
        </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 md:p-8 pt-4 md:pt-6">
        {!showComparison ? (<>
            <div className="mb-6 text-center">
              <h3 className="text-2xl font-bold text-zinc-900 dark:text-white">AI Smart Assist Mode</h3>
              <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
                Drop or click to upload a revised rate confirmation.
              </p>
            </div>

            <div className={`flex w-full flex-col items-center justify-center rounded-3xl border-2 border-dashed p-6 md:p-12 transition-all ${processing
                ? 'cursor-wait border-emerald-400 bg-emerald-50/50 dark:border-emerald-600 dark:bg-emerald-900/10'
                : isDragging
                    ? 'cursor-copy border-sky-400 bg-sky-50/50 dark:border-sky-600 dark:bg-sky-900/10'
                    : selectedFile
                        ? 'cursor-pointer border-zinc-500 bg-zinc-100 shadow-inner dark:border-zinc-500 dark:bg-zinc-900/60'
                        : 'cursor-pointer border-zinc-300 bg-white hover:border-zinc-500 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-800 dark:hover:border-zinc-500 dark:hover:bg-zinc-800/80'}`} onClick={() => {
                if (!processing)
                    fileInputRef.current?.click();
            }} onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}>
              <input ref={fileInputRef} type="file" accept=".pdf,.png,.jpg,.jpeg" className="hidden" disabled={processing} onChange={(event) => {
                handleFileSelection(event.target.files?.[0]);
                event.target.value = '';
            }}/>

              {processing ? (<>
                  <Loader2 className="mb-4 animate-spin text-emerald-500 dark:text-emerald-400" size={48}/>
                  {selectedFile ? (<p className="w-full truncate px-4 text-center text-base font-bold text-zinc-900 dark:text-white">
                      {selectedFile.name}
                    </p>) : null}
                  <p className="mt-3 text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                    AI analyzing document changes...
                  </p>
                </>) : (<>
                  <UploadCloud className="mb-4 text-zinc-400 dark:text-zinc-500" size={48}/>
                  <p className="text-base font-bold text-zinc-600 dark:text-zinc-300">
                    Attach Revised Rate Con
                  </p>
                  <p className="mt-2 text-xs font-medium text-zinc-400 dark:text-zinc-500">
                    PDF, PNG, or JPG — drop to auto-fill
                  </p>
                </>)}
            </div>
          </>) : (<div className="space-y-5 animate-in fade-in duration-200">
            {selectedFile ? (<p className="truncate text-xs text-zinc-500 dark:text-zinc-400">
                Document:{' '}
                <span className="font-medium text-zinc-700 dark:text-zinc-300">{selectedFile.name}</span>
              </p>) : null}

            {!responseData.has_changes ? (<div className="flex items-start gap-3 rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900/50">
                <Info className="mt-0.5 shrink-0 text-sky-500 dark:text-sky-400" size={18}/>
                <p className="text-sm text-zinc-600 dark:text-zinc-300">
                  No financial modifications detected in this document.
                </p>
              </div>) : (<div className="overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900/60">
                      <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                        Line Item
                      </th>
                      <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                        Original
                      </th>
                      <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                        Revised
                      </th>
                      <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                        Delta
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {comparisonRows.map((row) => {
                    const delta = row.revised - row.original;
                    const deltaDisplay = formatDelta(delta);
                    const isTotal = row.key === 'total_revenue';
                    return (<tr key={row.key} className={`border-b border-zinc-100 last:border-0 dark:border-zinc-800 ${isTotal ? 'bg-zinc-50/80 dark:bg-zinc-900/40' : ''}`}>
                          <td className={`px-4 py-3 text-zinc-700 dark:text-zinc-200 ${isTotal ? 'font-bold' : 'font-medium'}`}>
                            {row.label}
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-zinc-600 dark:text-zinc-300">
                            {formatUsd(row.original)}
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-zinc-900 dark:text-white">
                            {formatUsd(row.revised)}
                          </td>
                          <td className={`px-4 py-3 text-right font-mono ${deltaDisplay.className}`}>
                            {deltaDisplay.label}
                          </td>
                        </tr>);
                })}
                  </tbody>
                </table>
              </div>)}

            <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2 sm:gap-3 pt-2">
              <button type="button" onClick={handleCancel} disabled={isSubmitting} className="w-full sm:w-auto rounded-lg border border-zinc-200 px-4 py-2 text-sm font-semibold text-zinc-600 transition-colors hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800">
                Cancel
              </button>
              <button type="button" onClick={() => void handleApplyChanges()} disabled={isSubmitting} className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-sky-500 disabled:opacity-50">
                {isSubmitting ? <Loader2 size={16} className="animate-spin"/> : null}
                Apply Financial Changes
              </button>
            </div>
          </div>)}
        </div>
      </div>
    </div>);
}
