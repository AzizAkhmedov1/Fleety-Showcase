"use client";
import React, { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { X, Share2, Copy } from 'lucide-react';
import { buildTripShareText } from '@/lib/trip-share-text';
interface ShareTripModalProps {
    load: any | null;
    driver: any | null;
    isOpen: boolean;
    onClose: () => void;
}
const transientMessageCache = new Map<string, string>();
export default function ShareTripModal({ load, isOpen, onClose }: ShareTripModalProps) {
    const generatedText = useMemo(() => buildTripShareText(load), [load]);
    const [editedMessage, setEditedMessage] = useState<string>(() => {
        if (!load?.id)
            return generatedText || '';
        const loadKey = String(load.id);
        return transientMessageCache.get(loadKey) ?? generatedText ?? '';
    });
    useEffect(() => {
        if (!isOpen || !load)
            return;
        const loadKey = String(load.id);
        setEditedMessage(transientMessageCache.get(loadKey) ?? generatedText ?? '');
    }, [isOpen, load, generatedText]);
    const handleCopyMessage = async () => {
        try {
            await navigator.clipboard.writeText(editedMessage);
            toast.success('Dispatch text copied to clipboard!');
        }
        catch {
            toast.error('Unable to access clipboard.');
        }
    };
    if (!isOpen || !load)
        return null;
    return (<div className="fixed inset-0 bg-zinc-900/60 dark:bg-[#0B0B0B]/80 flex items-center justify-center z-[90] p-4 backdrop-blur-sm transition-colors">
      <div className="bg-white dark:bg-[#161616] border border-transparent dark:border-zinc-800 rounded-2xl w-full max-w-lg shadow-2xl animate-in zoom-in-95 duration-200 flex flex-col max-h-[92vh]">

        <div className="flex justify-between items-start p-6 border-b border-zinc-100 dark:border-zinc-800">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-xl bg-zinc-500/10 text-zinc-600 dark:text-zinc-400">
              <Share2 size={20}/>
            </div>
            <div>
              <h3 className="text-lg font-bold text-zinc-900 dark:text-white">Share Trip info</h3>
            </div>
          </div>
          <button onClick={onClose} className="text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-300 p-1.5 rounded-full transition-colors">
            <X size={20}/>
          </button>
        </div>

        <div className="p-6 overflow-y-auto">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-bold text-zinc-700 dark:text-zinc-200">Driver message</h4>
            <button type="button" onClick={() => void handleCopyMessage()} className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/60 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors">
              <Copy size={14}/> Copy message
            </button>
          </div>

          <textarea value={editedMessage} onChange={(event) => {
            const nextValue = event.target.value;
            setEditedMessage(nextValue);
            transientMessageCache.set(String(load.id), nextValue);
        }} className="w-full min-h-[420px] bg-zinc-950/60 dark:bg-zinc-950/70 text-zinc-800 dark:text-zinc-300 font-mono text-sm p-4 rounded-xl border border-zinc-200 dark:border-zinc-800/80 focus:outline-none focus:border-zinc-400 dark:focus:border-zinc-700 focus:ring-1 focus:ring-zinc-400 dark:focus:ring-zinc-700 resize-none leading-relaxed transition-all"/>
        </div>
      </div>
    </div>);
}
