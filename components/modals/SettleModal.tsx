"use client";
import React, { useState } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { X, Calculator } from 'lucide-react';
interface SettleModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    loadId: number | null;
}
export default function SettleModal({ isOpen, onClose, onSuccess, loadId }: SettleModalProps) {
    const [fuel, setFuel] = useState('');
    const [tolls, setTolls] = useState('');
    const [customPay, setCustomPay] = useState('');
    const [loading, setLoading] = useState(false);
    if (!isOpen || !loadId)
        return null;
    const handleSettle = async () => {
        setLoading(true);
        const toastId = toast.loading("Processing settlement...");
        try {
            const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
            const payload = {
                fuel_cost: fuel ? parseFloat(fuel) : 0,
                toll_cost: tolls ? parseFloat(tolls) : 0,
                driver_pay_override: customPay ? parseFloat(customPay) : null
            };
            await axios.post(`${API_URL}/api/loads/${loadId}/settle`, payload);
            toast.success("Load settled successfully!", { id: toastId });
            if (onSuccess)
                await onSuccess();
            onClose();
        }
        catch (error: any) {
            console.error(error);
            toast.error(error.response?.data?.detail || "Failed to settle load.", { id: toastId });
        }
        finally {
            setLoading(false);
        }
    };
    return (<div className="fixed inset-0 !bg-zinc-900/60 dark:!bg-[#0B0B0B]/80 flex items-end md:items-center justify-center z-[80] p-0 md:p-4 backdrop-blur-sm">
      <div className="!bg-white dark:!bg-zinc-900 border border-transparent dark:!border-zinc-800 rounded-t-xl md:rounded-2xl w-full max-w-full md:max-w-md shadow-xl animate-in zoom-in-95 duration-200 max-h-[calc(100svh-1rem)] flex flex-col overflow-hidden">
        
        <div className="shrink-0 flex justify-between items-start p-4 md:p-6 border-b border-zinc-100 dark:border-zinc-800">
          <h2 className="text-xl font-bold !text-zinc-900 dark:!text-white flex items-center gap-2">
            <Calculator className="!text-emerald-600 dark:!text-emerald-500" size={20}/> 
            Settle Load
          </h2>
          <button onClick={onClose} className="!text-zinc-400 hover:!bg-zinc-100 hover:!text-zinc-600 dark:hover:!bg-zinc-800 dark:hover:!text-zinc-300 p-1.5 rounded-full transition-colors">
            <X size={20}/>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 md:px-6 py-4 space-y-4">
          <div>
            <label className="block text-xs font-bold uppercase !text-zinc-500 dark:!text-zinc-400 mb-2">
              Fuel Expenses ($)
            </label>
            <input type="number" className="w-full !bg-zinc-100 dark:!bg-[#0B0B0B] border !border-zinc-200 dark:!border-zinc-800 rounded-lg p-2.5 text-sm font-medium !text-zinc-900 dark:!text-white focus:ring-2 focus:ring-emerald-500 outline-none transition-colors" value={fuel} onChange={(e) => setFuel(e.target.value)} placeholder="0" min="0" step="0.01"/>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase !text-zinc-500 dark:!text-zinc-400 mb-2">
              Tolls & Lumper ($)
            </label>
            <input type="number" className="w-full !bg-zinc-100 dark:!bg-[#0B0B0B] border !border-zinc-200 dark:!border-zinc-800 rounded-lg p-2.5 text-sm font-medium !text-zinc-900 dark:!text-white focus:ring-2 focus:ring-emerald-500 outline-none transition-colors" value={tolls} onChange={(e) => setTolls(e.target.value)} placeholder="0" min="0" step="0.01"/>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase !text-zinc-500 dark:!text-zinc-400 mb-2">
              Custom Driver Pay ($) <span className="!text-zinc-400 dark:!text-zinc-500 lowercase font-normal ml-1">- optional override</span>
            </label>
            <input type="number" className="w-full !bg-zinc-100 dark:!bg-[#0B0B0B] border !border-zinc-200 dark:!border-zinc-800 rounded-lg p-2.5 text-sm font-medium !text-zinc-900 dark:!text-white focus:ring-2 focus:ring-emerald-500 outline-none transition-colors" value={customPay} onChange={(e) => setCustomPay(e.target.value)} placeholder="Leave blank to use default %" min="0" step="0.01"/>
          </div>
        </div>

        <div className="shrink-0 p-4 md:p-6 border-t border-zinc-100 dark:border-zinc-800">
        <button onClick={handleSettle} disabled={loading} className="w-full py-3 !bg-emerald-600 !text-white rounded-lg font-bold text-sm hover:!bg-emerald-700 disabled:!bg-zinc-300 dark:disabled:!bg-zinc-800 dark:disabled:!text-zinc-500 transition-colors shadow-sm">
          {loading ? 'Processing...' : 'Process Settlement'}
        </button>
        </div>
        
      </div>
    </div>);
}
