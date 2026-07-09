"use client";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";
import { FolderOpen, Loader2, MessageSquare, Users, } from "lucide-react";
import { formatTitleCaseLabel } from "@/lib/display-labels";
import StatusDropdown from "@/components/ui/StatusDropdown";
import { createApiClient } from "@/lib/api-client";
import { createTmsApi, DriverPlanningRow, TruckRecord } from "@/lib/tms-api";
import { matchesDriverSearchQuery, matchesSearchField, matchesTruckSearchQuery } from "@/lib/global-search";
import { getExpirationDisplay } from "@/lib/document-expiration";
import { getFleetPlanningWindow } from "@/lib/fleet-planning-window";
import DriverDetailModal from "@/components/modals/DriverDetailModal";
export { getFleetPlanningWindow };
interface DriverPlanningBoardProps {
    token: string;
    trucks?: TruckRecord[];
    searchQuery?: string;
    onViewDocuments: (driverId: number) => void;
    refreshKey?: number;
    startDate: string;
    endDate: string;
}
const DRIVER_STATUS_OPTIONS = ["AVAILABLE", "ASSIGNED", "INACTIVE"] as const;
const STATUS_STYLES: Record<string, string> = {
    AVAILABLE: "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20",
    ASSIGNED: "bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-500/20",
    INACTIVE: "bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-500/20",
};
const SECONDARY_COL_LG = "hidden lg:table-cell";
const formatCurrency = (value: number) => value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
function ExpirationBadge({ label, value }: {
    label: string;
    value?: string | null;
}) {
    const display = getExpirationDisplay(value);
    if (!display.formattedDate)
        return null;
    return (<span className={`inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium ${display.badgeClass}`}>
      {label}: {display.formattedDate}
    </span>);
}
const formatAssetLabel = (value?: string | null) => {
    const cleaned = value?.trim();
    if (!cleaned || cleaned === "-" || cleaned === "N/A" || cleaned === "#" || cleaned === "#-") {
        return "—";
    }
    return cleaned;
};
const formatDeliveryDateTime = (value?: string | null) => {
    if (!value)
        return null;
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime()))
        return null;
    return parsed.toLocaleString("en-US", {
        month: "2-digit",
        day: "2-digit",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
    });
};
export default function DriverPlanningBoard({ token, trucks = [], searchQuery = "", onViewDocuments, refreshKey = 0, startDate, endDate, }: DriverPlanningBoardProps) {
    const api = useMemo(() => createTmsApi(createApiClient(token)), [token]);
    const commentTimers = useRef<Record<number, ReturnType<typeof setTimeout>>>({});
    const [rows, setRows] = useState<DriverPlanningRow[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [updatingStatusId, setUpdatingStatusId] = useState<number | null>(null);
    const [savingCommentsId, setSavingCommentsId] = useState<number | null>(null);
    const [selectedDriverId, setSelectedDriverId] = useState<number | null>(null);
    const fetchBoard = useCallback(async (showSpinner = true) => {
        if (!token || !startDate || !endDate)
            return;
        if (showSpinner) {
            setLoading(true);
            setError(null);
        }
        try {
            const data = await api.fleet.planningBoard({
                start_date: startDate,
                end_date: endDate,
            });
            setRows(data);
        }
        catch (err: unknown) {
            const message = err && typeof err === "object" && "response" in err
                ? (err as {
                    response?: {
                        data?: {
                            detail?: string;
                        };
                    };
                }).response?.data?.detail
                : null;
            if (showSpinner) {
                setError(message || "Failed to load driver planning board.");
                setRows([]);
            }
        }
        finally {
            if (showSpinner)
                setLoading(false);
        }
    }, [api, token, startDate, endDate]);
    useEffect(() => {
        fetchBoard();
    }, [fetchBoard]);
    useEffect(() => {
        if (refreshKey > 0) {
            fetchBoard(false);
        }
    }, [refreshKey, fetchBoard]);
    useEffect(() => {
        return () => {
            Object.values(commentTimers.current).forEach(clearTimeout);
        };
    }, []);
    const visibleRows = useMemo(() => {
        const trimmed = searchQuery.trim();
        if (!trimmed)
            return rows;
        return rows.filter((driver) => {
            if (matchesDriverSearchQuery({
                driver_name: driver.driver_name,
                cdl_number: driver.cdl_number || undefined,
                phone_number: driver.phone_number || undefined,
                email: undefined,
            }, trimmed)) {
                return true;
            }
            const assignedTruck = trucks.find((truck) => truck.driver_id === driver.id || truck.co_driver_id === driver.id);
            if (assignedTruck && matchesTruckSearchQuery(assignedTruck, [], trimmed)) {
                return true;
            }
            const q = trimmed.toLowerCase();
            return (matchesSearchField(driver.truck_number, q) ||
                matchesSearchField(driver.trailer_number, q));
        });
    }, [rows, searchQuery, trucks]);
    const handleStatusChange = async (driverId: number, nextStatus: string) => {
        const previous = rows.find((row) => row.id === driverId);
        if (!previous || previous.status === nextStatus)
            return;
        setUpdatingStatusId(driverId);
        setRows((current) => current.map((row) => (row.id === driverId ? { ...row, status: nextStatus } : row)));
        try {
            await api.fleet.updateDriverStatus(driverId, nextStatus);
            toast.success(`Status updated to ${nextStatus}`);
        }
        catch (err: unknown) {
            setRows((current) => current.map((row) => (row.id === driverId ? { ...row, status: previous.status } : row)));
            const message = err && typeof err === "object" && "response" in err
                ? (err as {
                    response?: {
                        data?: {
                            detail?: string;
                        };
                    };
                }).response?.data?.detail
                : null;
            toast.error(message || "Failed to update driver status.");
        }
        finally {
            setUpdatingStatusId(null);
        }
    };
    const persistComments = async (driverId: number, comments: string) => {
        setSavingCommentsId(driverId);
        try {
            await api.fleet.updateDriverComments(driverId, comments);
        }
        catch (err: unknown) {
            const message = err && typeof err === "object" && "response" in err
                ? (err as {
                    response?: {
                        data?: {
                            detail?: string;
                        };
                    };
                }).response?.data?.detail
                : null;
            toast.error(message || "Failed to save comments.");
        }
        finally {
            setSavingCommentsId(null);
        }
    };
    const handleCommentsChange = (driverId: number, comments: string) => {
        setRows((current) => current.map((row) => (row.id === driverId ? { ...row, comments } : row)));
        if (commentTimers.current[driverId]) {
            clearTimeout(commentTimers.current[driverId]);
        }
        commentTimers.current[driverId] = setTimeout(() => {
            persistComments(driverId, comments);
        }, 800);
    };
    const handleDocumentUploaded = useCallback(() => {
        fetchBoard(false);
    }, [fetchBoard]);
    const handleProfileUpdated = useCallback(() => {
        fetchBoard(false);
    }, [fetchBoard]);
    return (<>
      <section className="bg-white dark:bg-[#161616] rounded-2xl shadow-sm border border-zinc-200 dark:border-zinc-800 transition-colors">
        <div className="p-5 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/80 transition-colors">
          <h2 className="font-bold text-base text-zinc-900 dark:text-white flex items-center gap-2">
            <Users className="text-zinc-500" size={18}/>
            Driver Planning & Dispatch Board
          </h2>
        </div>

        {loading ? (<div className="flex flex-col items-center justify-center py-16 text-zinc-400 dark:text-zinc-500 gap-2">
            <Loader2 className="animate-spin" size={24}/>
            <p className="text-sm">Loading driver planning metrics...</p>
          </div>) : error ? (<div className="p-8 text-center text-rose-500 dark:text-rose-400 text-sm">{error}</div>) : visibleRows.length === 0 ? (<div className="p-8 text-center text-zinc-400 dark:text-zinc-500 text-sm">
            {searchQuery.trim()
                ? "No drivers match your search."
                : "No drivers onboarded yet."}
          </div>) : (<div className="w-full overflow-x-auto overscroll-x-contain rounded-b-2xl">
            <table className="w-full text-left min-w-[480px] lg:min-w-[1100px] dark:bg-[#161616]">
              <thead className="bg-zinc-50 dark:bg-zinc-950 text-zinc-500 dark:text-zinc-400 text-xs font-semibold border-b border-zinc-200 dark:border-zinc-800 transition-colors">
                <tr>
                  <th className="p-4">Driver</th>
                  <th className="p-4">Status</th>
                  <th className="p-4">Est. Empty</th>
                  <th className={`p-4 ${SECONDARY_COL_LG}`}>Gross & RPM</th>
                  <th className={`p-4 ${SECONDARY_COL_LG}`}>Assigned Assets</th>
                  <th className={`p-4 ${SECONDARY_COL_LG}`}>Comments</th>
                  <th className={`p-4 ${SECONDARY_COL_LG}`}>Contact & Docs</th>
                  <th className="p-4 text-right">Files</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800 text-sm transition-colors dark:bg-[#161616]">
                {visibleRows.map((driver) => {
                const statusClass = STATUS_STYLES[driver.status] || STATUS_STYLES.AVAILABLE;
                const deliveryLabel = formatDeliveryDateTime(driver.delivery_date);
                const hasActiveLoad = Boolean(driver.active_load_id && driver.est_empty_location);
                const isUpdating = updatingStatusId === driver.id;
                const isSavingComments = savingCommentsId === driver.id;
                return (<tr key={driver.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-900/60 dark:bg-zinc-950/20 transition-colors align-top">
                      <td className="p-4">
                        <div className="flex flex-col">
                          <button type="button" onClick={() => setSelectedDriverId(driver.id)} className="font-bold text-zinc-900 dark:text-white text-left hover:text-blue-400 dark:hover:text-blue-300 transition-colors">
                            {driver.driver_name}
                          </button>
                          <span className="text-[11px] text-zinc-400 dark:text-zinc-500 mt-0.5">
                            {driver.driver_type || "Company Driver"}
                          </span>
                        </div>
                      </td>
                      <td className="p-4">
                        <StatusDropdown value={DRIVER_STATUS_OPTIONS.includes(driver.status as (typeof DRIVER_STATUS_OPTIONS)[number])
                        ? driver.status
                        : "AVAILABLE"} options={DRIVER_STATUS_OPTIONS} onSelect={(nextStatus) => void handleStatusChange(driver.id, nextStatus)} badgeClass={statusClass} formatLabel={formatTitleCaseLabel} disabled={isUpdating} minWidthClass="min-w-[148px]"/>
                      </td>
                      <td className="p-4">
                        {hasActiveLoad ? (<div className="flex flex-col">
                            <span className="font-semibold text-zinc-900 dark:text-white">
                              {driver.est_empty_location}
                            </span>
                            {deliveryLabel ? (<span className="text-[11px] text-zinc-400 dark:text-zinc-500 mt-0.5">
                                {deliveryLabel}
                              </span>) : (<span className="text-[11px] text-zinc-400 dark:text-zinc-500 mt-0.5">
                                Delivery TBD
                              </span>)}
                          </div>) : (<span className="font-semibold text-emerald-500 dark:text-emerald-400">
                            Available Now
                          </span>)}
                      </td>
                      <td className={`p-4 ${SECONDARY_COL_LG}`}>
                        <div className="flex flex-col">
                          <span className="font-bold text-emerald-600 dark:text-emerald-400">
                            ${formatCurrency(driver.gross_pay)}
                          </span>
                          <span className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                            ${driver.avg_rpm.toFixed(2)}/mi
                          </span>
                        </div>
                      </td>
                      <td className={`p-4 ${SECONDARY_COL_LG}`}>
                        <div className="flex flex-col gap-0.5 text-xs text-zinc-600 dark:text-zinc-300">
                          <span>
                            <span className="text-zinc-400 dark:text-zinc-500">Truck: </span>
                            <span className={formatAssetLabel(driver.truck_number) === "—"
                        ? "text-zinc-500"
                        : "text-zinc-800 dark:text-zinc-300 font-semibold font-mono"}>
                              {formatAssetLabel(driver.truck_number)}
                            </span>
                          </span>
                          <span>
                            <span className="text-zinc-400 dark:text-zinc-500">Trailer: </span>
                            <span className={formatAssetLabel(driver.trailer_number) === "—"
                        ? "text-zinc-500"
                        : "text-zinc-800 dark:text-zinc-300 font-semibold font-mono"}>
                              {formatAssetLabel(driver.trailer_number)}
                            </span>
                          </span>
                        </div>
                      </td>
                      <td className={`p-4 min-w-[180px] ${SECONDARY_COL_LG}`}>
                        <div className="relative">
                          <MessageSquare size={12} className="absolute left-2.5 top-2.5 text-zinc-500 pointer-events-none"/>
                          <textarea value={driver.comments || ""} onChange={(e) => handleCommentsChange(driver.id, e.target.value)} placeholder="Comments" rows={2} className="w-full border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-200 text-xs rounded-lg pl-8 pr-2 py-2 outline-none focus:ring-2 focus:ring-zinc-600/40 resize-none transition-colors"/>
                          {isSavingComments && (<span className="text-[10px] text-zinc-500 mt-1 block">Saving...</span>)}
                        </div>
                      </td>
                      <td className={`p-4 min-w-[200px] ${SECONDARY_COL_LG}`}>
                        <div className="flex flex-col gap-1.5 text-xs text-zinc-600 dark:text-zinc-200">
                          <span>
                            <span className="text-zinc-400 dark:text-zinc-500">CDL </span>
                            <span className="font-mono">{driver.cdl_number || "—"}</span>
                          </span>
                          <span>
                            <span className="text-zinc-400 dark:text-zinc-500">Phone </span>
                            <span>{driver.phone_number || "—"}</span>
                          </span>
                          <ExpirationBadge label="CDL Exp" value={driver.cdl_expiration_date}/>
                          <ExpirationBadge label="Med Exp" value={driver.medical_card_expiration_date}/>
                          <ExpirationBadge label="TWIC Exp" value={driver.twic_expiration_date}/>
                        </div>
                      </td>
                      <td className="p-4 text-right">
                        <button onClick={() => onViewDocuments(driver.id)} className="text-xs font-bold bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 hover:text-zinc-900 dark:hover:text-white px-3 py-2 rounded-lg transition-colors inline-flex items-center gap-1 shadow-sm border border-zinc-200 dark:border-zinc-800">
                          <FolderOpen size={14}/> View File
                        </button>
                      </td>
                    </tr>);
            })}
              </tbody>
            </table>
          </div>)}
      </section>

      <DriverDetailModal token={token} driverId={selectedDriverId} trucks={trucks} onClose={() => setSelectedDriverId(null)} onDocumentUploaded={handleDocumentUploaded} onProfileUpdated={handleProfileUpdated}/>
    </>);
}
