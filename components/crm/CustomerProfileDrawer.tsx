"use client";
import React from "react";
import { Building2, Mail, Phone, X } from "lucide-react";
import type { LoadRecord } from "@/lib/tms-api";
import { formatLoadDateLabel } from "@/lib/load-dates";
export interface CrmCustomerRecord {
    id: number;
    name: string;
    mc?: string | null;
    phone?: string | null;
    email?: string | null;
    rating?: string | null;
    status?: string | null;
}
interface CustomerProfileDrawerProps {
    customer: CrmCustomerRecord;
    loads?: LoadRecord[];
    onClose: () => void;
}
const LABEL = "text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400";
export default function CustomerProfileDrawer({ customer, loads = [], onClose, }: CustomerProfileDrawerProps) {
    const relatedLoads = loads.filter((load) => load.customer_id === customer.id);
    return (<div className="h-full flex flex-col min-w-0 bg-white dark:bg-[#161616]">
      <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-zinc-200 dark:border-zinc-800 shrink-0">
        <div className="min-w-0">
          <h2 className="text-lg font-bold text-zinc-900 dark:text-white flex items-center gap-2">
            <Building2 size={18} className="text-zinc-500 shrink-0"/>
            <span className="truncate">{customer.name}</span>
          </h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">CRM Broker Profile</p>
        </div>
        <button type="button" onClick={onClose} className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors shrink-0" aria-label="Close broker profile">
          <X size={18}/>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto overflow-x-hidden p-5 space-y-5 min-w-0">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/40 p-3">
            <p className={LABEL}>Status</p>
            <p className="text-sm font-semibold text-zinc-900 dark:text-white mt-1">
              {customer.status || "Active"}
            </p>
          </div>
          <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/40 p-3">
            <p className={LABEL}>Credit Rating</p>
            <p className="text-sm font-semibold text-zinc-900 dark:text-white mt-1">
              {customer.rating || "Pending"}
            </p>
          </div>
        </div>

        <section className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-4 space-y-3">
          <p className={LABEL}>Contact Details</p>
          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-2 text-zinc-700 dark:text-zinc-300">
              <Phone size={14} className="text-zinc-400 shrink-0"/>
              <span>{customer.phone?.trim() || "—"}</span>
            </div>
            <div className="flex items-center gap-2 text-zinc-700 dark:text-zinc-300 min-w-0">
              <Mail size={14} className="text-zinc-400 shrink-0"/>
              <span className="truncate">{customer.email?.trim() || "—"}</span>
            </div>
            <div className="flex items-center justify-between gap-2 text-sm">
              <span className="text-zinc-500 dark:text-zinc-400">MC Number</span>
              <span className="font-mono font-medium text-zinc-800 dark:text-zinc-200">
                {customer.mc?.trim() || "—"}
              </span>
            </div>
          </div>
        </section>

        <section>
          <p className={`${LABEL} mb-2`}>Associated Loads ({relatedLoads.length})</p>
          {relatedLoads.length === 0 ? (<p className="text-sm text-zinc-500 dark:text-zinc-400 rounded-xl border border-dashed border-zinc-200 dark:border-zinc-800 px-4 py-8 text-center">
              No loads linked to this broker yet.
            </p>) : (<ul className="space-y-2 max-h-[320px] overflow-y-auto pr-1">
              {relatedLoads.slice(0, 25).map((load) => (<li key={load.id} className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-900/30 px-3 py-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
                      {load.broker_load_id || `L-${load.id}`}
                    </span>
                    <span className="text-[10px] uppercase font-semibold text-zinc-500">
                      {load.status}
                    </span>
                  </div>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 truncate">
                    {load.origin || "—"} → {load.destination || "—"}
                  </p>
                  <p className="text-[10px] text-zinc-400 mt-1">
                    {formatLoadDateLabel(load.pickup_date || load.created_at) || "—"}
                  </p>
                </li>))}
            </ul>)}
        </section>
      </div>
    </div>);
}
