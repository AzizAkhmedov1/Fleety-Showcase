"use client";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Loader2, Search, X } from "lucide-react";
import { createApiClient } from "@/lib/api-client";
import { createTmsApi, GlobalSearchResponse, GlobalSearchDriverResult, GlobalSearchInvoiceResult, GlobalSearchLoadResult, GlobalSearchTrailerResult, } from "@/lib/tms-api";
interface GlobalSearchDropdownProps {
    value: string;
    onChange: (value: string) => void;
    token: string;
    onSelectDriver: (driverId: number) => void;
    onSelectTruck: (truckId: number) => void;
    onSelectLoad: (loadId: number) => void;
    onSelectInvoice: (loadId: number) => void;
    placeholder?: string;
    ariaLabel?: string;
    suppressResults?: boolean;
}
const EMPTY_RESULTS: GlobalSearchResponse = {
    loads: [],
    drivers: [],
    trailers: [],
    invoices: [],
};
const loadStatusBadgeClass = (status: string) => {
    const normalized = status.toUpperCase();
    if (normalized === "DELIVERED") {
        return "bg-emerald-500/20 text-emerald-300 border-emerald-500/30";
    }
    if (normalized === "PAID" || normalized === "SETTLED") {
        return "bg-green-600 text-white border-green-700";
    }
    if (normalized === "DISPATCHED") {
        return "bg-amber-500/15 text-amber-300 border-amber-500/25";
    }
    if (normalized === "ASSIGNED") {
        return "bg-zinc-700 text-zinc-200 border-zinc-600";
    }
    if (normalized === "CREATED" || normalized === "AVAILABLE" || normalized === "UNASSIGNED") {
        return "bg-slate-700/40 text-slate-200 border-slate-600";
    }
    if (normalized === "BOOKED") {
        return "bg-cyan-500/15 text-cyan-300 border-cyan-500/25";
    }
    return "bg-zinc-800 text-zinc-300 border-zinc-700";
};
function ResultRow({ primary, subtext, badge, onClick, }: {
    primary: string;
    subtext?: string;
    badge?: string;
    onClick: () => void;
}) {
    return (<button type="button" onClick={onClick} className="w-full flex items-center justify-between gap-3 px-4 py-2.5 text-left hover:bg-zinc-800/80 transition-colors">
      <div className="min-w-0">
        <p className="font-bold text-white text-sm truncate">{primary}</p>
        {subtext ? (<p className="text-xs text-zinc-400 truncate mt-0.5">{subtext}</p>) : null}
      </div>
      {badge ? (<span className={`shrink-0 text-[10px] font-bold uppercase tracking-wide px-2.5 py-1 rounded-full border ${loadStatusBadgeClass(badge)}`}>
          {badge}
        </span>) : null}
    </button>);
}
function ResultSection({ title, children, }: {
    title: string;
    children: React.ReactNode;
}) {
    return (<div>
      <p className="px-4 py-2 text-xs font-bold uppercase tracking-wider text-white border-b border-zinc-800">
        {title}
      </p>
      <div className="py-1">{children}</div>
    </div>);
}
export default function GlobalSearchDropdown({ value, onChange, token, onSelectDriver, onSelectTruck, onSelectLoad, onSelectInvoice, placeholder = "Search loads, drivers, units...", ariaLabel = "Search loads, drivers, units", suppressResults = false, }: GlobalSearchDropdownProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const api = useMemo(() => createTmsApi(createApiClient(token)), [token]);
    const [focused, setFocused] = useState(false);
    const [loading, setLoading] = useState(false);
    const [results, setResults] = useState<GlobalSearchResponse>(EMPTY_RESULTS);
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const requestRef = useRef(0);
    const trimmed = value.trim();
    const showDropdown = !suppressResults && focused && trimmed.length > 0;
    const closeDropdown = useCallback(() => {
        setFocused(false);
    }, []);
    const runSearch = useCallback(async (query: string) => {
        if (!token || !query.trim()) {
            setResults(EMPTY_RESULTS);
            setLoading(false);
            return;
        }
        const requestId = ++requestRef.current;
        setLoading(true);
        try {
            const data = await api.search.global(query.trim());
            if (requestId === requestRef.current) {
                setResults(data);
            }
        }
        catch {
            if (requestId === requestRef.current) {
                setResults(EMPTY_RESULTS);
            }
        }
        finally {
            if (requestId === requestRef.current) {
                setLoading(false);
            }
        }
    }, [api, token]);
    useEffect(() => {
        if (debounceRef.current)
            clearTimeout(debounceRef.current);
        if (suppressResults || !trimmed) {
            setResults(EMPTY_RESULTS);
            setLoading(false);
            return;
        }
        debounceRef.current = setTimeout(() => {
            void runSearch(trimmed);
        }, 200);
        return () => {
            if (debounceRef.current)
                clearTimeout(debounceRef.current);
        };
    }, [trimmed, runSearch, suppressResults]);
    useEffect(() => {
        const handlePointerDown = (event: MouseEvent) => {
            if (!containerRef.current?.contains(event.target as Node)) {
                closeDropdown();
            }
        };
        document.addEventListener("mousedown", handlePointerDown);
        return () => document.removeEventListener("mousedown", handlePointerDown);
    }, [closeDropdown]);
    const hasResults = results.loads.length > 0 ||
        results.trailers.length > 0 ||
        results.invoices.length > 0 ||
        results.drivers.length > 0;
    const handleSelectLoad = (item: GlobalSearchLoadResult) => {
        closeDropdown();
        onSelectLoad(item.load_id);
    };
    const handleSelectDriver = (item: GlobalSearchDriverResult) => {
        closeDropdown();
        onSelectDriver(item.driver_id);
    };
    const handleSelectTrailer = (item: GlobalSearchTrailerResult) => {
        closeDropdown();
        onSelectTruck(item.truck_id);
    };
    const handleSelectInvoice = (item: GlobalSearchInvoiceResult) => {
        closeDropdown();
        onSelectInvoice(item.load_id);
    };
    return (<div ref={containerRef} className="relative min-w-[150px] max-w-xs w-full shrink">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 dark:text-zinc-500 pointer-events-none" size={16}/>
      <input type="text" name="tms-global-search" autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck={false} role="searchbox" aria-label={ariaLabel} placeholder={placeholder} className="pl-9 pr-9 py-2 w-full rounded-lg text-sm bg-zinc-100 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-white placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-600 transition-colors" value={value} onChange={(e) => onChange(e.target.value)} onFocus={() => setFocused(true)} onKeyDown={(e) => {
            if (e.key === "Enter") {
                closeDropdown();
            }
            if (e.key === "Escape") {
                closeDropdown();
            }
        }}/>
      {value ? (<button type="button" onClick={() => {
                onChange("");
                setResults(EMPTY_RESULTS);
            }} className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-200 p-1 rounded transition-colors" aria-label="Clear search">
          <X size={14}/>
        </button>) : null}

      {showDropdown ? (<div className="absolute z-50 right-0 mt-2 w-96 bg-[#161616] border border-zinc-800 rounded-xl shadow-2xl overflow-hidden">
          {loading ? (<div className="flex items-center justify-center gap-2 px-4 py-6 text-sm text-zinc-400">
              <Loader2 size={16} className="animate-spin"/>
              Searching...
            </div>) : !hasResults ? (<div className="px-4 py-6 text-sm text-zinc-500 text-center">
              No matches for &quot;{trimmed}&quot;
            </div>) : (<div className="max-h-[420px] overflow-y-auto divide-y divide-zinc-800">
              {results.loads.length > 0 ? (<ResultSection title="Loads">
                  {results.loads.map((item) => (<ResultRow key={`load-${item.load_id}`} primary={item.id} subtext={item.subtext} badge={item.status} onClick={() => handleSelectLoad(item)}/>))}
                </ResultSection>) : null}

              {results.trailers.length > 0 ? (<ResultSection title="Trailers">
                  {results.trailers.map((item) => (<ResultRow key={`trailer-${item.truck_id}`} primary={item.id} subtext={item.subtext} onClick={() => handleSelectTrailer(item)}/>))}
                </ResultSection>) : null}

              {results.invoices.length > 0 ? (<ResultSection title="Invoices">
                  {results.invoices.map((item) => (<ResultRow key={`invoice-${item.load_id}`} primary={item.id} subtext={item.subtext} onClick={() => handleSelectInvoice(item)}/>))}
                </ResultSection>) : null}

              {results.drivers.length > 0 ? (<ResultSection title="Drivers">
                  {results.drivers.map((item) => (<ResultRow key={`driver-${item.driver_id}`} primary={item.id} subtext={item.subtext} onClick={() => handleSelectDriver(item)}/>))}
                </ResultSection>) : null}
            </div>)}
        </div>) : null}
    </div>);
}
