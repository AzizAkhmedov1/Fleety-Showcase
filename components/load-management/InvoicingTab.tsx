'use client';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { FileText, Loader2, ReceiptText, ShieldCheck, UploadCloud } from 'lucide-react';
import { createApiClient } from '@/lib/api-client';
import { filterBillingDocuments, inferBillingDocumentType, loadDocumentDisplayName, resolveLoadDocumentUrl, } from '@/lib/load-documents';
import { CARD_SECTION_LABEL_CLASS, paymentStatusLabel } from '@/lib/display-labels';
import { computeLoadGrossRate } from '@/lib/load-financials';
import { createTmsApi, type LoadDocumentRecord, type LoadRecord } from '@/lib/tms-api';
import { useTMSStore } from '@/store/useTMSStore';
import { LOAD_INFO_COLUMN_CLASS, LOAD_INFO_MASTER_SHEET_CLASS, LOAD_INFO_SECTION_SLOT_CLASS, } from '@/components/load-management/LoadInfoTab';
interface InvoicingTabProps {
    load: LoadRecord;
    token: string;
    onRefresh: () => Promise<void>;
}
const formatCurrency = (value: number) => value.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
export default function InvoicingTab({ load, token, onRefresh }: InvoicingTabProps) {
    const { setSettleModalId } = useTMSStore();
    const api = useMemo(() => createTmsApi(createApiClient(token)), [token]);
    const uploadInputRef = useRef<HTMLInputElement>(null);
    const [generating, setGenerating] = useState(false);
    const [submittingFactoring, setSubmittingFactoring] = useState(false);
    const [documents, setDocuments] = useState<LoadDocumentRecord[]>([]);
    const [documentsLoading, setDocumentsLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const isSettled = load.payment_status === 'Settled';
    const isFactoringPending = load.payment_status === 'Factoring Pending';
    const canGenerateInvoice = isSettled && !isFactoringPending;
    const showFactoringWorkflow = isSettled || isFactoringPending;
    const grossRate = computeLoadGrossRate(load);
    const billingDocuments = useMemo(() => filterBillingDocuments(documents), [documents]);
    const fetchDocuments = useCallback(async () => {
        setDocumentsLoading(true);
        try {
            const docs = await api.loads.documents(load.id);
            setDocuments(docs);
        }
        catch {
            setDocuments([]);
        }
        finally {
            setDocumentsLoading(false);
        }
    }, [api, load.id, load.payment_status]);
    useEffect(() => {
        void fetchDocuments();
    }, [fetchDocuments]);
    const refreshBillingState = useCallback(async () => {
        await onRefresh();
        await fetchDocuments();
    }, [fetchDocuments, onRefresh]);
    const openDocument = (event: React.MouseEvent, href: string) => {
        event.preventDefault();
        event.stopPropagation();
        window.open(href, '_blank', 'noopener,noreferrer');
    };
    const handleUploadChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const files = event.target.files ? Array.from(event.target.files) : [];
        if (files.length === 0)
            return;
        setUploading(true);
        const toastId = toast.loading(files.length === 1 ? 'Uploading document...' : `Uploading ${files.length} documents...`);
        try {
            for (const file of files) {
                const formData = new FormData();
                formData.append('file', file, file.name);
                formData.append('document_type', inferBillingDocumentType(file.name));
                await api.loads.postDocumentForm(load.id, formData);
            }
            await fetchDocuments();
            await onRefresh();
            toast.success(files.length === 1 ? 'Document uploaded.' : `${files.length} documents uploaded.`, { id: toastId });
        }
        catch (err: unknown) {
            const message = err && typeof err === 'object' && 'response' in err
                ? (err as {
                    response?: {
                        data?: {
                            detail?: string;
                        };
                    };
                }).response?.data?.detail
                : null;
            toast.error(typeof message === 'string' ? message : 'Failed to upload document.', {
                id: toastId,
            });
        }
        finally {
            event.target.value = '';
            setUploading(false);
        }
    };
    const handleSubmitFactoring = async () => {
        setSubmittingFactoring(true);
        const toastId = toast.loading('Submitting to factoring...');
        try {
            await api.loads.factor(load.id);
            await refreshBillingState();
            toast.success('Load billing bundle securely transmitted to Triumph Business Capital!', {
                id: toastId,
            });
        }
        catch (err: unknown) {
            const message = err && typeof err === 'object' && 'response' in err
                ? (err as {
                    response?: {
                        data?: {
                            detail?: string;
                        };
                    };
                }).response?.data?.detail
                : null;
            toast.error(typeof message === 'string' ? message : 'Failed to submit factoring.', {
                id: toastId,
            });
        }
        finally {
            setSubmittingFactoring(false);
        }
    };
    const handleGenerateInvoice = async () => {
        setGenerating(true);
        const toastId = toast.loading('Generating professional invoice...');
        try {
            await api.loads.generateInvoice(load.id);
            await refreshBillingState();
            toast.success('Invoice generated and saved to vault!', { id: toastId });
        }
        catch (err: unknown) {
            const message = err && typeof err === 'object' && 'response' in err
                ? (err as {
                    response?: {
                        data?: {
                            detail?: string;
                        };
                    };
                }).response?.data?.detail
                : null;
            toast.error(typeof message === 'string' ? message : 'Failed to generate invoice.', {
                id: toastId,
            });
        }
        finally {
            setGenerating(false);
        }
    };
    return (<div className="w-full">
      <input ref={uploadInputRef} type="file" multiple accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx" className="hidden" onChange={(event) => void handleUploadChange(event)}/>

      <div className={LOAD_INFO_MASTER_SHEET_CLASS}>
        <div className={`xl:col-span-5 ${LOAD_INFO_COLUMN_CLASS}`}>
          <div className={LOAD_INFO_SECTION_SLOT_CLASS}>
            <p className={`${CARD_SECTION_LABEL_CLASS} mb-3`}>Invoice Status</p>
            <dl className="space-y-3 text-sm">
              <div className="flex items-center justify-between gap-4">
                <dt className="text-zinc-500 dark:text-zinc-400">Payment Status</dt>
                <dd className="font-semibold text-zinc-900 dark:text-zinc-100">
                  {paymentStatusLabel(load.payment_status)}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-4">
                <dt className="text-zinc-500 dark:text-zinc-400">Gross Rate</dt>
                <dd className="font-semibold text-zinc-900 dark:text-zinc-100">
                  {formatCurrency(grossRate)}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-4 min-w-0">
                <dt className="text-zinc-500 dark:text-zinc-400 shrink-0">Broker Load ID</dt>
                <dd className="font-medium text-zinc-800 dark:text-zinc-200 truncate min-w-0">
                  {load.broker_load_id || '—'}
                </dd>
              </div>
            </dl>
          </div>

          <div className={LOAD_INFO_SECTION_SLOT_CLASS}>
            <p className={`${CARD_SECTION_LABEL_CLASS} mb-3`}>Create Invoice</p>
            {canGenerateInvoice ? (<>
                <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-4">
                  Generate a professional invoice PDF for this settled load and attach it to the load
                  vault.
                </p>
                <button type="button" disabled={generating} onClick={() => void handleGenerateInvoice()} className="w-full min-h-11 flex items-center justify-center gap-2 py-2.5 rounded-lg bg-zinc-900 dark:bg-white text-white dark:text-black text-sm font-bold hover:bg-zinc-800 dark:hover:bg-zinc-200 disabled:opacity-50 transition-colors">
                  {generating ? (<Loader2 size={16} className="animate-spin" aria-hidden/>) : (<ReceiptText size={16} aria-hidden/>)}
                  {generating ? 'Generating...' : 'Create Invoice'}
                </button>
              </>) : isFactoringPending ? (<p className="text-sm text-zinc-500 dark:text-zinc-400">
                This load is pending factoring submission. Invoice generation is unavailable.
              </p>) : (<button type="button" onClick={() => setSettleModalId(load.id)} className="flex items-center justify-center px-4 py-2.5 text-sm font-semibold rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white transition-colors w-full cursor-pointer">
                Settle Load
              </button>)}
          </div>

          {showFactoringWorkflow ? (<div className={LOAD_INFO_SECTION_SLOT_CLASS}>
              <p className={`${CARD_SECTION_LABEL_CLASS} mb-3`}>Submit Factoring</p>
              {isFactoringPending ? (<p className="text-sm text-zinc-500 dark:text-zinc-400">
                  Factoring submission is in progress. No further action is required.
                </p>) : (<>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-4">
                    Transmit the billing bundle for this settled load to your factoring partner.
                  </p>
                  <button type="button" disabled={submittingFactoring} onClick={() => void handleSubmitFactoring()} className="w-full min-h-11 flex items-center justify-center gap-2 py-2.5 rounded-lg border border-emerald-200 dark:border-emerald-800/40 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 text-sm font-bold hover:bg-emerald-100 dark:hover:bg-emerald-900/30 disabled:opacity-50 transition-colors">
                    {submittingFactoring ? (<Loader2 size={16} className="animate-spin" aria-hidden/>) : (<ShieldCheck size={16} aria-hidden/>)}
                    {submittingFactoring ? 'Submitting...' : 'Submit Factoring'}
                  </button>
                </>)}
            </div>) : null}
        </div>

        <div className={`xl:col-span-7 ${LOAD_INFO_COLUMN_CLASS}`}>
          <div className={LOAD_INFO_SECTION_SLOT_CLASS}>
            <p className={`${CARD_SECTION_LABEL_CLASS} mb-3`}>Invoice & Billing Documents</p>
            {documentsLoading ? (<div className="flex items-center justify-center gap-2 py-8 text-sm text-zinc-500">
                <Loader2 size={16} className="animate-spin" aria-hidden/>
                Loading billing files...
              </div>) : billingDocuments.length === 0 ? (<p className="text-sm text-zinc-500 dark:text-zinc-400 text-center py-8">
                No billing documents on file yet.
              </p>) : (<ul className="space-y-2 mb-4">
                {billingDocuments.map((doc) => {
                const href = resolveLoadDocumentUrl(doc);
                const label = loadDocumentDisplayName(doc);
                return (<li key={doc.id} className="min-w-0">
                      {href ? (<button type="button" onClick={(event) => openDocument(event, href)} className="w-full min-h-11 flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors text-left">
                          <FileText size={16} className="shrink-0 text-zinc-400" aria-hidden/>
                          <span className="flex-1 min-w-0 break-all truncate">{label}</span>
                        </button>) : (<div className="flex min-h-11 items-center gap-2 rounded-lg px-3 py-2.5 text-sm text-zinc-500 dark:text-zinc-400">
                          <FileText size={16} className="shrink-0" aria-hidden/>
                          <span className="flex-1 min-w-0 break-all truncate">{label}</span>
                        </div>)}
                    </li>);
            })}
              </ul>)}
            <button type="button" disabled={uploading} onClick={() => uploadInputRef.current?.click()} className="w-full min-h-11 flex items-center justify-center gap-2 py-2.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900/40 text-sm font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-50 transition-colors">
              {uploading ? (<Loader2 size={16} className="animate-spin" aria-hidden/>) : (<UploadCloud size={16} aria-hidden/>)}
              {uploading ? 'Uploading...' : 'Upload Document'}
            </button>
          </div>
        </div>
      </div>
    </div>);
}
