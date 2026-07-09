"use client";
import React, { useMemo, useState } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { X, Truck } from 'lucide-react';
import { filterPowerUnits } from '@/lib/trailer-metadata';
import { FINALIZED_RECORD_TOAST, isLoadFinanciallyFinalized, } from '@/lib/load-operational-status';
import type { LoadRecord } from '@/lib/tms-api';
interface AssignUnitModalProps {
    load: LoadRecord;
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    trucks: any[];
    drivers?: any[];
}
const resolveDriverLabel = (truck: any, drivers?: any[]) => {
    const driverName = truck.driver_name || drivers?.find((d) => d.id === truck.driver_id)?.driver_name;
    if (driverName)
        return `(${driverName})`;
    if (truck.driver_id)
        return '(Assigned)';
    return '(No Driver)';
};
export default function AssignUnitModal({ load, isOpen, onClose, onSuccess, trucks, drivers }: AssignUnitModalProps) {
    const [selectedTruck, setSelectedTruck] = useState<string>('');
    const [loading, setLoading] = useState(false);
    const assignableTrucks = useMemo(() => filterPowerUnits(trucks), [trucks]);
    if (!isOpen || !load)
        return null;
    const handleAssign = async () => {
        if (isLoadFinanciallyFinalized(load)) {
            toast.error(FINALIZED_RECORD_TOAST);
            return;
        }
        if (!selectedTruck)
            return;
        setLoading(true);
        const toastId = toast.loading("Assigning unit to load...");
        try {
            const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
            await axios.put(`${API_URL}/api/loads/${load.id}`, { truck_id: parseInt(selectedTruck) });
            toast.success("Unit assigned successfully!", { id: toastId });
            onSuccess();
            onClose();
        }
        catch (error: unknown) {
            const detail = typeof error === 'object' &&
                error != null &&
                'response' in error &&
                typeof (error as {
                    response?: {
                        data?: {
                            detail?: string;
                        };
                    };
                }).response?.data?.detail ===
                    'string'
                ? (error as {
                    response: {
                        data: {
                            detail: string;
                        };
                    };
                }).response.data.detail
                : null;
            toast.error(isLoadFinanciallyFinalized(load) ? FINALIZED_RECORD_TOAST : detail || 'Failed to assign unit.', { id: toastId });
        }
        finally {
            setLoading(false);
        }
    };
    return (<div className="fixed inset-0 bg-zinc-900/60 dark:bg-[#0B0B0B]/80 flex items-end md:items-center justify-center z-[80] p-0 md:p-4 backdrop-blur-sm transition-colors">
      <div className="bg-white dark:bg-[#161616] border border-transparent dark:border-zinc-800 rounded-t-xl md:rounded-2xl w-full max-w-full md:max-w-md shadow-xl animate-in zoom-in-95 duration-200 transition-colors max-h-[calc(100svh-1rem)] flex flex-col overflow-hidden">
        <div className="shrink-0 p-4 md:p-6 border-b border-zinc-100 dark:border-zinc-800">
        <div className="flex justify-between items-start">
          <div>
            <h2 className="text-xl font-bold text-zinc-900 dark:text-white flex items-center gap-2">
              <Truck className="text-zinc-700 dark:text-zinc-400" size={20}/> Assign Unit
            </h2>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
              {load.broker_load_id || `L-${load.id}`} • {load.origin} ➔ {load.destination}
            </p>
          </div>
          <button onClick={onClose} className="text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-300 p-1 rounded-full transition-colors">
            <X size={20}/>
          </button>
        </div>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 md:p-6">
        <div className="mb-6 bg-zinc-50 dark:bg-zinc-800/50 p-4 rounded-xl border border-zinc-100 dark:border-zinc-800/50 transition-colors">
          <label className="block text-xs font-bold uppercase text-zinc-500 dark:text-zinc-400 mb-2">Select Active Truck</label>
          <select className="w-full border border-zinc-200 dark:border-zinc-800 rounded-lg p-2.5 text-sm font-medium focus:ring-2 focus:ring-zinc-600 outline-none bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white transition-colors" value={selectedTruck} onChange={(e) => setSelectedTruck(e.target.value)}>
            <option value="">-- Choose a Truck --</option>
            {assignableTrucks.map((truck) => {
            const driverLabel = resolveDriverLabel(truck, drivers);
            return (<option key={truck.id} value={truck.id}>
                  Unit #{truck.truck_number} {driverLabel}
                </option>);
        })}
          </select>
        </div>
        </div>

        <div className="shrink-0 flex flex-col-reverse sm:flex-row gap-2 justify-end p-4 md:p-6 border-t border-zinc-100 dark:border-zinc-800">
          <button onClick={onClose} className="w-full sm:w-auto px-4 py-2 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg font-bold text-sm transition-colors">
            Cancel
          </button>
          <button onClick={handleAssign} disabled={!selectedTruck || loading} className="w-full sm:w-auto px-4 py-2 bg-zinc-900 dark:bg-white dark:text-black text-white rounded-lg font-bold text-sm hover:bg-zinc-800 dark:hover:bg-zinc-200 disabled:bg-zinc-300 dark:disabled:bg-zinc-800 dark:disabled:text-zinc-500 transition-colors shadow-sm">
            {loading ? 'Assigning...' : 'Confirm Assignment'}
          </button>
        </div>
      </div>
    </div>);
}
