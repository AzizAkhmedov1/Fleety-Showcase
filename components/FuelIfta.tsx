"use client";
import React, { useMemo } from "react";
import { Map as MapIcon } from "lucide-react";
import type { FuelEntryRecord } from "@/lib/tms-api";
interface FuelIftaProps {
    fuelHistory: FuelEntryRecord[];
}
export default function FuelIfta({ fuelHistory }: FuelIftaProps) {
    const stateBreakdown = useMemo(() => {
        const totals = new Map<string, number>();
        for (const entry of fuelHistory) {
            const state = (entry.state || "").trim().toUpperCase();
            if (!state)
                continue;
            totals.set(state, (totals.get(state) || 0) + (entry.gallons || 0));
        }
        return Array.from(totals.entries())
            .map(([state, gallons]) => ({ state, gallons }))
            .sort((a, b) => b.gallons - a.gallons);
    }, [fuelHistory]);
    return (<section className="lg:col-span-2 bg-white dark:bg-[#161616] rounded-2xl shadow-sm p-6 border border-zinc-200 dark:border-zinc-800 flex flex-col transition-colors">
      <h2 className="text-lg font-bold mb-4 flex items-center gap-2 text-zinc-900 dark:text-white">
        <MapIcon className="text-emerald-500 dark:text-emerald-400" size={20}/>
        IFTA Tax Liability Breakdown
      </h2>
      <div className="flex-grow bg-zinc-50 dark:bg-[#0B0B0B]/50 rounded-xl border border-zinc-100 dark:border-zinc-800 p-4 overflow-y-auto transition-colors">
        {stateBreakdown.length === 0 ? (<div className="text-center text-zinc-400 dark:text-zinc-500 py-10 text-sm">
            No fuel purchased this quarter.
          </div>) : (<div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {stateBreakdown.map((row) => (<div key={row.state} className="bg-white dark:bg-zinc-800/50 p-4 rounded-lg shadow-sm border border-zinc-200 dark:border-zinc-800 text-center transition-colors">
                <p className="text-xl font-black text-zinc-900 dark:text-white">{row.state}</p>
                <p className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 mt-1">
                  {row.gallons.toFixed(2)} gal
                </p>
              </div>))}
          </div>)}
      </div>
    </section>);
}
