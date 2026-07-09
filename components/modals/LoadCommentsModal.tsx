"use client";
import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { formatApiError } from '@/lib/api-client';
import { X } from 'lucide-react';
import { LoadRecord } from '@/lib/tms-api';
interface LoadCommentsModalProps {
    load: LoadRecord | null;
    isOpen: boolean;
    onClose: () => void;
    onSave: (loadId: number, comments: string | null) => Promise<void>;
}
export default function LoadCommentsModal({ load, isOpen, onClose, onSave, }: LoadCommentsModalProps) {
    const [draft, setDraft] = useState('');
    const [saving, setSaving] = useState(false);
    useEffect(() => {
        if (load) {
            setDraft(load.comments || '');
        }
    }, [load]);
    if (!isOpen || !load)
        return null;
    const loadLabel = load.broker_load_id || String(load.id);
    const handleSave = async () => {
        setSaving(true);
        try {
            const trimmed = draft.trim();
            await onSave(load.id, trimmed || null);
            toast.success('Load comment updated');
            onClose();
        }
        catch (err) {
            toast.error(formatApiError(err, 'Failed to save load comment.'));
        }
        finally {
            setSaving(false);
        }
    };
    return (<div className="fixed inset-0 bg-zinc-900/60 dark:bg-black/70 flex items-end md:items-center justify-center z-[95] p-0 md:p-4 backdrop-blur-sm">
      <div className="bg-white dark:bg-[#161616] border border-zinc-200 dark:border-zinc-800 rounded-t-xl md:rounded-xl w-full max-w-full md:max-w-md shadow-2xl animate-in zoom-in-95 duration-200 max-h-[calc(100svh-1rem)] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-100 dark:border-zinc-800 shrink-0">
          <h3 className="text-sm font-bold text-zinc-900 dark:text-white">
            Comments for Load #{loadLabel}
          </h3>
          <button type="button" onClick={onClose} className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 p-1 rounded-full transition-colors">
            <X size={18}/>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          <textarea value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Internal dispatcher notes for this load..." className="w-full h-32 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-2 text-sm text-zinc-900 dark:text-white focus:border-emerald-500 outline-none resize-y min-h-[128px]"/>
        </div>

        <div className="flex flex-col-reverse sm:flex-row gap-2 justify-end px-5 py-4 border-t border-zinc-100 dark:border-zinc-800 shrink-0">
          <button type="button" onClick={onClose} disabled={saving} className="w-full sm:w-auto px-4 py-2 rounded-lg text-xs font-bold bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors">
            Cancel
          </button>
          <button type="button" onClick={handleSave} disabled={saving} className="w-full sm:w-auto px-4 py-2 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white transition-colors disabled:opacity-60">
            {saving ? 'Saving...' : 'Save Comment'}
          </button>
        </div>
      </div>
    </div>);
}
