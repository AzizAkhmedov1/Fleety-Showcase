"use client";
import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import dynamic from 'next/dynamic';
import toast from 'react-hot-toast';
import { createApiClient, formatApiError } from '@/lib/api-client';
import { formatTitleCaseLabel } from '@/lib/display-labels';
import { createTmsApi, LoadRecord } from '@/lib/tms-api';
import { formatLoadDateLabel, getFallbackDate } from '@/lib/load-dates';
import { computeLoadGrossRate, computeLoadTotalRpm } from '@/lib/load-financials';
import { countIntermediateDrops, formatManifestInlineTime, formatManifestLocationLine, getIntermediateDropStops, parseLocationFromAddress, resolveManifestStops, type ManifestStopView, } from '@/lib/load-manifest-stops';
import { Trash2, Share2, Flag, MessageSquare, MoreVertical, ChevronLeft, ChevronRight } from 'lucide-react';
import StatusDropdown from '@/components/ui/StatusDropdown';
import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover';
import LoadTableColumnHeader from '@/components/tables/LoadTableColumnHeader';
import { buildDefaultLoadTableColumnOrder, matchesLoadTableFilters, sortLoadTableRows, type LoadTableColumnFilters, type LoadTableColumnId, type LoadTableSortDirection, } from '@/lib/load-table-columns';
import { FINALIZED_RECORD_TOAST, isLoadFinanciallyFinalized, resolveLoadDisplayUiStatus, resolveLoadStatusBadgeClass, SETTLED_UI_STATUS, SETTLED_STATUS_BADGE_CLASS, } from '@/lib/load-operational-status';
import { UNASSIGNED_STATUS_BADGE_CLASS } from '@/types/load';
const AssignUnitModal = dynamic(() => import('../modals/AssignUnitModal'), { ssr: false });
const ShareTripModal = dynamic(() => import('../modals/ShareTripModal'), { ssr: false });
const LoadCommentsModal = dynamic(() => import('../modals/LoadCommentsModal'), { ssr: false });
interface LoadTableProps {
    loads: LoadRecord[];
    trucks: any[];
    drivers: any[];
    customers: any[];
    token: string;
    refreshData: () => Promise<void>;
    loading?: boolean;
    columnFilters: LoadTableColumnFilters;
    onColumnFilterChange: (columnId: Exclude<LoadTableColumnId, 'actions'>, value: string) => void;
    pagination?: {
        page: number;
        limit: number;
        totalPages: number;
        totalCount: number;
        onPrevious: () => void;
        onNext: () => void;
        onLimitChange: (limit: number) => void;
    };
    activeDrawerLoadId?: number | null;
    onSelectLoad?: (loadId: number) => void;
    onOpenDriverProfile?: (driverId: number) => void;
    onOpenTruckProfile?: (truckId: number) => void;
    onOpenTrailerProfile?: (truckId: number) => void;
    onOpenBrokerWorkspace?: (customerId: number) => void;
    canViewOperationalFinancials?: boolean;
    canViewNetProfit?: boolean;
}
const normalizeLoadStatus = (status?: string | null) => {
    const raw = (status || 'created').trim().toUpperCase().replace(/[\s-]+/g, '_');
    if (raw === 'INTRANSIT')
        return 'IN_TRANSIT';
    return raw;
};
const STATUS_BADGE_STYLES: Record<string, string> = {
    UNASSIGNED: UNASSIGNED_STATUS_BADGE_CLASS,
    AVAILABLE: UNASSIGNED_STATUS_BADGE_CLASS,
    CREATED: UNASSIGNED_STATUS_BADGE_CLASS,
    BOOKED: 'bg-cyan-50 dark:bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 border-cyan-200 dark:border-cyan-500/30',
    ASSIGNED: 'bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-500/20',
    DISPATCHED: 'bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-500/20',
    IN_TRANSIT: 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20',
    DELIVERED: 'bg-zinc-100 dark:bg-zinc-800/50 text-zinc-700 dark:text-zinc-400 border-zinc-300 dark:border-zinc-700/60',
    DELAYED: 'bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-500/20',
    SETTLED: SETTLED_STATUS_BADGE_CLASS,
};
export const statusBadgeClass = (status?: string | null) => STATUS_BADGE_STYLES[normalizeLoadStatus(status)] || STATUS_BADGE_STYLES.CREATED;
const STATUS_DROPDOWN_OPTIONS = [
    'UNASSIGNED',
    'BOOKED',
    'ASSIGNED',
    'IN_TRANSIT',
    'DELIVERED',
    'DELAYED',
] as const;
export const loadStatusToUi = (status?: string | null) => {
    const normalized = normalizeLoadStatus(status);
    if (normalized === 'SETTLED')
        return SETTLED_UI_STATUS;
    if (normalized === 'CREATED' || normalized === 'STAGED' || normalized === 'AVAILABLE') {
        return 'UNASSIGNED';
    }
    if (normalized === 'BOOKED')
        return 'BOOKED';
    if (normalized === 'DISPATCHED')
        return 'IN_TRANSIT';
    return normalized;
};
const statusUiToApi = (uiStatus: string) => {
    switch (uiStatus) {
        case 'UNASSIGNED':
        case 'AVAILABLE':
            return 'created';
        case 'BOOKED':
            return 'booked';
        case 'IN_TRANSIT':
            return 'dispatched';
        default:
            return uiStatus.toLowerCase();
    }
};
export const statusOptionLabel = (option: string) => formatTitleCaseLabel(option);
const computeRpm = (load: LoadRecord) => computeLoadTotalRpm(load);
function IntermediateDropsBadge({ dropCount, stops, }: {
    dropCount: number;
    stops: ManifestStopView[];
}) {
    const [open, setOpen] = useState(false);
    const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const showTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const triggerHoveredRef = useRef(false);
    const contentHoveredRef = useRef(false);
    const clearHideTimer = useCallback(() => {
        if (hideTimerRef.current) {
            clearTimeout(hideTimerRef.current);
            hideTimerRef.current = null;
        }
    }, []);
    const clearShowTimer = useCallback(() => {
        if (showTimerRef.current) {
            clearTimeout(showTimerRef.current);
            showTimerRef.current = null;
        }
    }, []);
    const scheduleClose = useCallback(() => {
        clearHideTimer();
        hideTimerRef.current = setTimeout(() => {
            hideTimerRef.current = null;
            setOpen(false);
        }, 175);
    }, [clearHideTimer]);
    const syncOpenState = useCallback(() => {
        if (triggerHoveredRef.current || contentHoveredRef.current) {
            clearHideTimer();
            setOpen(true);
            return;
        }
        scheduleClose();
    }, [clearHideTimer, scheduleClose]);
    const handleTriggerEnter = useCallback(() => {
        clearShowTimer();
        clearHideTimer();
        triggerHoveredRef.current = true;
        setOpen(true);
    }, [clearHideTimer, clearShowTimer]);
    const handleTriggerLeave = useCallback(() => {
        clearShowTimer();
        triggerHoveredRef.current = false;
        syncOpenState();
    }, [clearShowTimer, syncOpenState]);
    const handleContentEnter = useCallback(() => {
        clearHideTimer();
        contentHoveredRef.current = true;
        setOpen(true);
    }, [clearHideTimer]);
    const handleContentLeave = useCallback(() => {
        contentHoveredRef.current = false;
        syncOpenState();
    }, [syncOpenState]);
    const handleOpenChange = useCallback((next: boolean) => {
        if (next)
            return;
        clearShowTimer();
        clearHideTimer();
        triggerHoveredRef.current = false;
        contentHoveredRef.current = false;
        setOpen(false);
    }, [clearHideTimer, clearShowTimer]);
    useEffect(() => {
        return () => {
            clearHideTimer();
            clearShowTimer();
        };
    }, [clearHideTimer, clearShowTimer]);
    return (<Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverAnchor asChild>
        <button type="button" onMouseEnter={handleTriggerEnter} onMouseLeave={handleTriggerLeave} className="relative z-[1] inline-flex items-center justify-center text-[10px] font-bold px-1.5 py-0.5 rounded-md tracking-wide whitespace-nowrap cursor-default bg-amber-100/60 text-amber-950 border border-amber-200/80 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-900/50 outline-none focus-visible:ring-1 focus-visible:ring-amber-500/40">
          +{dropCount} Drop{dropCount === 1 ? '' : 's'}
        </button>
      </PopoverAnchor>
      <PopoverContent align="center" side="bottom" sideOffset={8} className="z-50 w-72 border-zinc-800 !bg-zinc-950 dark:!bg-zinc-950 p-3 shadow-2xl" onMouseEnter={handleContentEnter} onMouseLeave={handleContentLeave}>
        <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-2">
          Intermediate Stops
        </p>
        <ol className="space-y-2">
          {stops.map((stop) => (<li key={`drop-${stop.sequence}`} className="text-xs leading-snug">
              <div className="flex items-start gap-2">
                <span className="mt-0.5 shrink-0 rounded bg-zinc-900 px-1.5 py-0.5 text-[10px] font-bold text-amber-500">
                  {stop.sequence}
                </span>
                <div className="min-w-0 space-y-0.5">
                  <p className="font-semibold text-zinc-100 truncate">{stop.companyName}</p>
                  <p className="text-zinc-400">{stop.locationLine}</p>
                  <p className="text-zinc-500 break-words whitespace-normal">{stop.scheduleLabel}</p>
                </div>
              </div>
            </li>))}
        </ol>
      </PopoverContent>
    </Popover>);
}
const SECONDARY_COL = 'hidden md:table-cell';
const SECONDARY_COL_LG = 'hidden lg:table-cell';
const ENTITY_LINK_CLASS = 'text-sm font-medium text-sky-600 dark:text-sky-400 hover:text-sky-700 dark:hover:text-sky-300 hover:underline underline-offset-2 transition-colors';
const PLACEHOLDER_CLASS = 'text-sm text-zinc-400 dark:text-zinc-500';
const resolveDriverId = (load: LoadRecord, truck?: {
    driver_id?: number | null;
}) => load.driver_id ?? truck?.driver_id ?? null;
const resolveDriverName = (load: LoadRecord, driver?: {
    driver_name?: string | null;
} | null, truck?: {
    driver_name?: string | null;
} | null) => load.driver_name?.trim() || driver?.driver_name?.trim() || truck?.driver_name?.trim() || null;
const resolveTruckLabel = (load: LoadRecord, truck?: {
    truck_number?: string | null;
}) => truck?.truck_number?.trim() || load.truck_number?.trim() || null;
const resolveTrailerLabel = (load: LoadRecord, truck?: {
    trailer_number?: string | null;
}) => {
    const label = truck?.trailer_number?.trim() || load.trailer_number?.trim();
    if (!label || label.toUpperCase() === 'N/A')
        return null;
    return label;
};
const resolveTrailerProfileTruckId = (load: LoadRecord, trucks: LoadTableProps['trucks']) => {
    const assignedTruck = trucks.find((truck) => truck.id === load.truck_id);
    const trailerNumber = resolveTrailerLabel(load, assignedTruck);
    if (!trailerNumber)
        return null;
    const normalized = trailerNumber.toUpperCase();
    const standalone = trucks.find((truck) => ['standalone_trailer', 'trailer'].includes(String(truck.asset_type || '').toLowerCase()) &&
        String(truck.trailer_number || '').toUpperCase() === normalized);
    if (standalone)
        return standalone.id;
    const host = trucks.find((truck) => String(truck.trailer_number || '').toUpperCase() === normalized);
    return host?.id ?? load.truck_id ?? null;
};
const ACTION_MENU_ITEM_HEIGHT_PX = 36;
const ACTION_MENU_PADDING_PX = 8;
const ACTION_MENU_MIN_WIDTH_PX = 192;
const ACTION_MENU_GAP_PX = 4;
const ACTION_MENU_ITEM_COUNT = 4;
export default function LoadTable({ loads, trucks, drivers, customers, token, refreshData, loading = false, columnFilters, onColumnFilterChange, pagination, activeDrawerLoadId = null, onSelectLoad, onOpenDriverProfile, onOpenTruckProfile, onOpenTrailerProfile, onOpenBrokerWorkspace, canViewOperationalFinancials = true, canViewNetProfit = true, }: LoadTableProps) {
    const api = useMemo(() => createTmsApi(createApiClient(token)), [token]);
    const [isDeleting, setIsDeleting] = useState<number | null>(null);
    const [loadToDeleteId, setLoadToDeleteId] = useState<number | null>(null);
    const isDeleteDialogOpen = loadToDeleteId != null;
    const [assigningLoad, setAssigningLoad] = useState<any | null>(null);
    const [sharingLoad, setSharingLoad] = useState<any | null>(null);
    const [commentsLoad, setCommentsLoad] = useState<LoadRecord | null>(null);
    const [localLoads, setLocalLoads] = useState<LoadRecord[]>(loads);
    const [flaggingId, setFlaggingId] = useState<number | null>(null);
    const [activeActionsLoadId, setActiveActionsLoadId] = useState<number | null>(null);
    const [updatingStatusId, setUpdatingStatusId] = useState<number | null>(null);
    const [actionsMenuMounted, setActionsMenuMounted] = useState(false);
    const [actionsMenuPosition, setActionsMenuPosition] = useState<{
        top: number;
        left: number;
    } | null>(null);
    const actionsTriggerRef = useRef<HTMLButtonElement | null>(null);
    const actionsMenuRef = useRef<HTMLDivElement | null>(null);
    const [sortColumn, setSortColumn] = useState<LoadTableColumnId | null>(null);
    const [sortDirection, setSortDirection] = useState<LoadTableSortDirection>('asc');
    useEffect(() => {
        setLocalLoads(loads);
    }, [loads]);
    const rowContext = useMemo(() => ({ trucks, drivers, customers: customers ?? [] }), [trucks, drivers, customers]);
    const visibleColumns = useMemo(() => buildDefaultLoadTableColumnOrder(canViewOperationalFinancials), [canViewOperationalFinancials]);
    const processedLoads = useMemo(() => {
        const filtered = localLoads.filter((load) => matchesLoadTableFilters(load, columnFilters, rowContext));
        return sortLoadTableRows(filtered, sortColumn, sortDirection, rowContext);
    }, [localLoads, columnFilters, sortColumn, sortDirection, rowContext]);
    const handleColumnSort = useCallback((columnId: LoadTableColumnId) => {
        setSortColumn((previous) => {
            if (previous === columnId) {
                setSortDirection((direction) => (direction === 'asc' ? 'desc' : 'asc'));
                return previous;
            }
            setSortDirection('asc');
            return columnId;
        });
    }, []);
    const headerColumnClass = useCallback((columnId: LoadTableColumnId) => {
        switch (columnId) {
            case 'broker':
            case 'pickupDate':
            case 'deliveryDate':
            case 'truck':
                return SECONDARY_COL;
            case 'rate':
            case 'rpm':
            case 'trailer':
                return SECONDARY_COL_LG;
            default:
                return '';
        }
    }, []);
    const headerColumnAlign = useCallback((columnId: LoadTableColumnId): 'left' | 'right' | 'center' => {
        if (columnId === 'rate' || columnId === 'rpm')
            return 'right';
        if (columnId === 'actions')
            return 'center';
        return 'left';
    }, []);
    useEffect(() => {
        setActionsMenuMounted(true);
    }, []);
    const activeActionsLoad = useMemo(() => localLoads.find((load) => load.id === activeActionsLoadId) ?? null, [localLoads, activeActionsLoadId]);
    const updateActionsMenuPosition = useCallback(() => {
        const trigger = actionsTriggerRef.current;
        if (!trigger || activeActionsLoadId === null || !activeActionsLoad)
            return;
        const menuHeight = ACTION_MENU_ITEM_COUNT * ACTION_MENU_ITEM_HEIGHT_PX + ACTION_MENU_PADDING_PX;
        const menuWidth = Math.max(ACTION_MENU_MIN_WIDTH_PX, trigger.getBoundingClientRect().width);
        const rect = trigger.getBoundingClientRect();
        const spaceBelow = window.innerHeight - rect.bottom;
        const spaceAbove = rect.top;
        const opensUp = spaceBelow < menuHeight && spaceAbove >= spaceBelow;
        let top = opensUp ? rect.top - menuHeight - ACTION_MENU_GAP_PX : rect.bottom + ACTION_MENU_GAP_PX;
        let left = rect.right - menuWidth;
        left = Math.max(8, Math.min(left, window.innerWidth - menuWidth - 8));
        top = Math.max(8, Math.min(top, window.innerHeight - menuHeight - 8));
        setActionsMenuPosition({ top, left });
    }, [activeActionsLoad, activeActionsLoadId]);
    useLayoutEffect(() => {
        if (activeActionsLoadId === null) {
            setActionsMenuPosition(null);
            return;
        }
        updateActionsMenuPosition();
    }, [activeActionsLoadId, updateActionsMenuPosition]);
    useEffect(() => {
        if (activeActionsLoadId === null)
            return;
        const handleReposition = () => updateActionsMenuPosition();
        window.addEventListener('resize', handleReposition);
        window.addEventListener('scroll', handleReposition, true);
        return () => {
            window.removeEventListener('resize', handleReposition);
            window.removeEventListener('scroll', handleReposition, true);
        };
    }, [activeActionsLoadId, updateActionsMenuPosition]);
    useEffect(() => {
        if (!isDeleteDialogOpen || isDeleting != null)
            return;
        const handleEscape = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                setLoadToDeleteId(null);
            }
        };
        document.addEventListener('keydown', handleEscape);
        return () => document.removeEventListener('keydown', handleEscape);
    }, [isDeleteDialogOpen, isDeleting]);
    useEffect(() => {
        if (activeActionsLoadId === null)
            return;
        const handleClickOutside = (event: MouseEvent) => {
            const target = event.target as HTMLElement;
            if (!target.closest('[data-actions-dropdown]') &&
                !target.closest('[data-load-actions-menu]')) {
                setActiveActionsLoadId(null);
            }
        };
        const handleEscape = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                setActiveActionsLoadId(null);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        document.addEventListener('keydown', handleEscape);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('keydown', handleEscape);
        };
    }, [activeActionsLoadId]);
    const patchLoadLocal = (loadId: number, patch: Partial<LoadRecord>) => {
        setLocalLoads((prev) => prev.map((row) => (row.id === loadId ? { ...row, ...patch } : row)));
    };
    const applyPatchedLoad = (loadId: number, updated: LoadRecord | null | undefined, fallback: Partial<LoadRecord> = {}) => {
        setLocalLoads((prev) => prev.map((row) => {
            if (row.id !== loadId)
                return row;
            if (updated && typeof updated === 'object' && updated.id === loadId) {
                return { ...row, ...updated };
            }
            return { ...row, ...fallback };
        }));
    };
    const toggleFlag = async (load: LoadRecord) => {
        const nextFlagged = !load.is_flagged;
        patchLoadLocal(load.id, { is_flagged: nextFlagged });
        setFlaggingId(load.id);
        try {
            const updated = await api.loads.patch(load.id, { is_flagged: nextFlagged });
            applyPatchedLoad(load.id, updated, { is_flagged: nextFlagged });
        }
        catch (err: unknown) {
            patchLoadLocal(load.id, { is_flagged: !nextFlagged });
            toast.error(formatApiError(err, 'Failed to update flag.'));
        }
        finally {
            setFlaggingId(null);
        }
    };
    const saveLoadComments = async (loadId: number, comments: string | null) => {
        const updated = await api.loads.patch(loadId, { comments });
        applyPatchedLoad(loadId, updated, { comments });
    };
    const updateLoadStatus = async (loadId: number, uiStatus: string) => {
        const load = localLoads.find((row) => row.id === loadId);
        if (!load)
            return;
        if (isLoadFinanciallyFinalized(load)) {
            toast.error(FINALIZED_RECORD_TOAST);
            return;
        }
        const apiStatus = statusUiToApi(uiStatus);
        const previousStatus = load.status;
        patchLoadLocal(loadId, { status: apiStatus });
        setUpdatingStatusId(loadId);
        try {
            const response = await api.loads.updateStatus(loadId, apiStatus);
            const newStatus = response?.data?.new_status != null ? String(response.data.new_status) : apiStatus;
            patchLoadLocal(loadId, { status: newStatus });
            await refreshData();
        }
        catch (err: any) {
            patchLoadLocal(loadId, { status: previousStatus });
            toast.error(err.response?.data?.detail || err.message || 'Failed to update load status.');
        }
        finally {
            setUpdatingStatusId(null);
        }
    };
    const sharingDriver = (() => {
        if (!sharingLoad)
            return null;
        const truck = trucks.find((t) => t.id === sharingLoad.truck_id);
        return truck ? drivers.find((d) => d.id === truck.driver_id) || null : null;
    })();
    const closeDeleteDialog = () => {
        if (isDeleting != null)
            return;
        setLoadToDeleteId(null);
    };
    const confirmDeleteLoad = async () => {
        if (loadToDeleteId == null || isDeleting != null)
            return;
        const id = loadToDeleteId;
        setIsDeleting(id);
        const toastId = toast.loading("Moving load to Deleted Loads history...");
        try {
            await api.loads.remove(id);
            await refreshData();
            setLoadToDeleteId(null);
            toast.success("Load moved to Deleted Loads history", { id: toastId });
        }
        catch (err: any) {
            console.error(err);
            toast.error(err.response?.data?.detail || "Error deleting load. Please try again.", { id: toastId });
        }
        finally {
            setIsDeleting(null);
        }
    };
    const actionMenuItemClass = 'w-full flex items-center gap-2 px-3 py-2 text-left text-xs text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap';
    const actionMenuIconClass = 'shrink-0 text-zinc-500 dark:text-zinc-400';
    const runRowAction = (loadId: number, action: () => void) => (event: React.MouseEvent) => {
        event.stopPropagation();
        setActiveActionsLoadId(null);
        action();
    };
    const renderActionsMenu = (load: LoadRecord) => {
        const hasComments = Boolean((load.comments || '').trim());
        const isFlagged = Boolean(load.is_flagged);
        return (<>
        <button type="button" onClick={runRowAction(load.id, () => setSharingLoad(load))} className={actionMenuItemClass}>
          <Share2 size={14} className={actionMenuIconClass}/>
          Share Trip Info
        </button>
        <button type="button" disabled={flaggingId === load.id} onClick={runRowAction(load.id, () => toggleFlag(load))} className={`${actionMenuItemClass} ${isFlagged ? 'text-amber-600 dark:text-amber-400' : ''}`}>
          <Flag size={14} className={`${actionMenuIconClass} ${isFlagged ? 'fill-current' : ''}`}/>
          {isFlagged ? 'Unflag Load' : 'Flag Load'}
        </button>
        <button type="button" onClick={runRowAction(load.id, () => setCommentsLoad(load))} className={`${actionMenuItemClass} ${hasComments ? 'text-amber-600 dark:text-amber-400' : ''}`}>
          <MessageSquare size={14} className={actionMenuIconClass}/>
          {hasComments ? 'View Comments' : 'Comments'}
        </button>
        <button type="button" disabled={isDeleting === load.id} onClick={runRowAction(load.id, () => setLoadToDeleteId(load.id))} className={`${actionMenuItemClass} text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30`}>
          <Trash2 size={14} className={actionMenuIconClass}/>
          Delete
        </button>
      </>);
    };
    const actionsMenuPortal = actionsMenuMounted &&
        activeActionsLoad &&
        actionsMenuPosition &&
        activeActionsLoadId === activeActionsLoad.id
        ? createPortal(<div ref={actionsMenuRef} data-load-actions-menu className="fixed z-50 w-max min-w-[12rem] bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-xl py-1" style={{
                top: actionsMenuPosition.top,
                left: actionsMenuPosition.left,
            }}>
            {renderActionsMenu(activeActionsLoad)}
          </div>, document.body)
        : null;
    return (<>
      <div className="w-full overflow-hidden">
        <div className="w-full overflow-x-auto overscroll-x-contain">
        <table className="w-full min-w-[520px] lg:min-w-[1000px] text-left border-collapse text-zinc-700 dark:text-zinc-300 outline-none transition-colors">
          <thead className="border-b border-zinc-200 dark:border-zinc-800/60">
            <tr>
              {visibleColumns.map((columnId) => (<LoadTableColumnHeader key={columnId} columnId={columnId} className={headerColumnClass(columnId)} align={headerColumnAlign(columnId)} filterValue={columnId === 'actions' ? '' : columnFilters[columnId]} onFilterChange={(value) => {
                if (columnId !== 'actions') {
                    onColumnFilterChange(columnId, value);
                }
            }} sortColumn={sortColumn} onSort={handleColumnSort}/>))}
            </tr>
          </thead>
          <tbody>
            {processedLoads.length === 0 ? (<tr>
                <td colSpan={visibleColumns.length} className="p-12 text-center text-zinc-500 dark:text-zinc-400">
                  No matching loads found. Click &quot;New Detailed Load&quot; to begin.
                </td>
              </tr>) : (processedLoads.map((load) => {
            const assignedTruck = trucks.find((truck) => truck.id === load.truck_id);
            const driverObj = assignedTruck
                ? drivers.find((driver) => driver.id === assignedTruck.driver_id)
                : load.driver_id
                    ? drivers.find((driver) => driver.id === load.driver_id)
                    : null;
            const driverId = resolveDriverId(load, assignedTruck);
            const driverName = resolveDriverName(load, driverObj, assignedTruck);
            const truckLabel = resolveTruckLabel(load, assignedTruck);
            const trailerLabel = resolveTrailerLabel(load, assignedTruck);
            const trailerProfileTruckId = resolveTrailerProfileTruckId(load, trucks);
            const pickupDateLabel = formatLoadDateLabel(getFallbackDate(load, 'pickup')) ||
                formatLoadDateLabel(load.created_at);
            const deliveryDateLabel = formatLoadDateLabel(getFallbackDate(load, 'delivery'));
            const assignedBroker = customers ? customers.find(c => c.id == load.customer_id) : null;
            const brokerLabel = assignedBroker?.name || load.broker_name || '—';
            const manifestStops = resolveManifestStops(load);
            const originStop = manifestStops[0];
            const terminalStop = manifestStops[manifestStops.length - 1];
            const originLocationLine = originStop?.locationLine ||
                formatManifestLocationLine(parseLocationFromAddress(load.origin).city, parseLocationFromAddress(load.origin).state);
            const terminalLocationLine = terminalStop?.locationLine ||
                formatManifestLocationLine(parseLocationFromAddress(load.destination).city, parseLocationFromAddress(load.destination).state);
            const originInlineTime = formatManifestInlineTime(originStop?.timeLabel ?? '—', originStop?.windowLabel);
            const terminalInlineTime = formatManifestInlineTime(terminalStop?.timeLabel ?? '—', terminalStop?.windowLabel);
            const intermediateDropCount = countIntermediateDrops(manifestStops);
            const intermediateDropStops = getIntermediateDropStops(manifestStops);
            const rpm = computeRpm(load);
            const isFlagged = Boolean(load.is_flagged);
            return (<tr key={load.id} className={`border-b border-zinc-200 dark:border-zinc-800/60 bg-transparent hover:bg-zinc-50 dark:hover:bg-zinc-900/20 transition-colors ${activeDrawerLoadId === load.id ? 'bg-sky-50/70 dark:bg-sky-950/20' : ''}`}>
                  {visibleColumns.map((columnId) => {
                    const responsive = headerColumnClass(columnId);
                    switch (columnId) {
                        case 'loadId':
                            return (<td key={columnId} className="px-4 py-3 align-middle">
                            <button type="button" onClick={() => onSelectLoad?.(load.id)} className="text-sky-600 dark:text-sky-500 hover:underline font-medium text-sm">
                              {load.broker_load_id || `L-${load.id}`}
                            </button>
                          </td>);
                        case 'broker':
                            return (<td key={columnId} className={`px-4 py-3 align-middle text-sm max-w-[160px] ${responsive}`}>
                            {load.customer_id && assignedBroker ? (<button type="button" onClick={(event) => {
                                        event.stopPropagation();
                                        onOpenBrokerWorkspace?.(load.customer_id!);
                                    }} className={`${ENTITY_LINK_CLASS} line-clamp-2 text-left`} title={brokerLabel}>
                                {brokerLabel}
                              </button>) : (<span className="line-clamp-2 text-zinc-700 dark:text-zinc-300" title={brokerLabel}>
                                {brokerLabel}
                              </span>)}
                          </td>);
                        case 'route':
                            return (<td key={columnId} className={`px-4 py-3 align-middle min-w-[176px] max-w-[240px]`}>
                            <div className="relative isolate text-sm leading-tight">
                              <span className="pointer-events-none absolute top-2 bottom-2 left-2 z-0 w-[2px] -translate-x-1/2 bg-zinc-800 dark:bg-zinc-800" aria-hidden/>
                              <div className="relative z-[1] space-y-1.5">
                                <div className="flex gap-3 items-start">
                                  <div className="relative z-[1] flex w-4 shrink-0 justify-center pt-[0.35rem]">
                                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-[#161616]" aria-hidden/>
                                  </div>
                                  <div className="min-w-0 flex-1 flex flex-wrap items-baseline gap-x-1 gap-y-0.5">
                                    <span className="text-zinc-500 font-medium shrink-0 text-[11px]">PU:</span>
                                    <span className="font-semibold text-zinc-800 dark:text-zinc-200 break-words min-w-0">
                                      {originLocationLine}
                                    </span>
                                    {originInlineTime ? (<span className="text-zinc-500 text-[11px] font-normal break-words whitespace-normal min-w-0">
                                        @ {originInlineTime}
                                      </span>) : null}
                                  </div>
                                </div>
                                {intermediateDropCount > 0 ? (<div className="flex gap-3 items-center py-0.5">
                                    <div className="w-4 shrink-0" aria-hidden/>
                                    <div className="min-w-0">
                                      <IntermediateDropsBadge dropCount={intermediateDropCount} stops={intermediateDropStops}/>
                                    </div>
                                  </div>) : null}
                                <div className="flex gap-3 items-start">
                                  <div className="relative z-[1] flex w-4 shrink-0 justify-center pt-[0.35rem]">
                                    <span className="h-1.5 w-1.5 rounded-full bg-sky-500 ring-2 ring-white dark:ring-[#161616]" aria-hidden/>
                                  </div>
                                  <div className="min-w-0 flex-1 flex flex-wrap items-baseline gap-x-1 gap-y-0.5">
                                    <span className="text-zinc-500 font-medium shrink-0 text-[11px]">DEL:</span>
                                    <span className="font-semibold text-zinc-800 dark:text-zinc-200 break-words min-w-0">
                                      {terminalLocationLine}
                                    </span>
                                    {terminalInlineTime ? (<span className="text-zinc-500 text-[11px] font-normal break-words whitespace-normal min-w-0">
                                        @ {terminalInlineTime}
                                      </span>) : null}
                                  </div>
                                </div>
                              </div>
                            </div>
                          </td>);
                        case 'pickupDate':
                            return (<td key={columnId} className={`px-4 py-3 align-middle text-sm text-zinc-400 dark:text-zinc-500 whitespace-nowrap ${responsive}`}>
                            {pickupDateLabel || '—'}
                          </td>);
                        case 'deliveryDate':
                            return (<td key={columnId} className={`px-4 py-3 align-middle text-sm text-zinc-400 dark:text-zinc-500 whitespace-nowrap ${responsive}`}>
                            {deliveryDateLabel || 'TBD'}
                          </td>);
                        case 'rate':
                            return (<td key={columnId} className={`px-4 py-3 align-middle text-right text-sm font-medium text-zinc-900 dark:text-zinc-100 whitespace-nowrap ${responsive}`}>
                            ${computeLoadGrossRate(load).toFixed(2)}
                          </td>);
                        case 'rpm':
                            return (<td key={columnId} className={`px-4 py-3 align-middle text-right text-sm font-medium text-zinc-900 dark:text-zinc-100 whitespace-nowrap ${responsive}`}>
                            ${rpm.toFixed(2)}
                          </td>);
                        case 'status':
                            return (<td key={columnId} className="px-4 py-3 align-middle">
                            {isLoadFinanciallyFinalized(load) ? (<span className={`px-2.5 py-1 rounded-full text-xs font-semibold tracking-wide text-center border inline-block whitespace-nowrap ${resolveLoadStatusBadgeClass(load, statusBadgeClass)}`}>
                                {statusOptionLabel(SETTLED_UI_STATUS)}
                              </span>) : (<StatusDropdown value={resolveLoadDisplayUiStatus(load)} options={STATUS_DROPDOWN_OPTIONS} onSelect={(option) => void updateLoadStatus(load.id, option)} badgeClass={statusBadgeClass(load.status)} formatLabel={statusOptionLabel} disabled={updatingStatusId === load.id}/>)}
                          </td>);
                        case 'driver':
                            return (<td key={columnId} className="px-4 py-3 align-middle min-w-[120px]">
                            {driverId && driverName ? (<button type="button" onClick={(event) => {
                                        event.stopPropagation();
                                        onOpenDriverProfile?.(driverId);
                                    }} className={`${ENTITY_LINK_CLASS} truncate max-w-[140px] block text-left`} title={driverName}>
                                {driverName}
                              </button>) : (<span className={PLACEHOLDER_CLASS}>—</span>)}
                          </td>);
                        case 'truck':
                            return (<td key={columnId} className={`px-4 py-3 align-middle min-w-[100px] ${responsive}`}>
                            {load.truck_id && truckLabel ? (<button type="button" onClick={(event) => {
                                        event.stopPropagation();
                                        onOpenTruckProfile?.(load.truck_id!);
                                    }} className={`${ENTITY_LINK_CLASS} font-mono`} title={`Truck #${truckLabel}`}>
                                #{truckLabel}
                              </button>) : load.truck_id ? (<span className={PLACEHOLDER_CLASS}>—</span>) : isLoadFinanciallyFinalized(load) ? (<span className={PLACEHOLDER_CLASS}>—</span>) : (<button type="button" onClick={() => setAssigningLoad(load)} className="text-xs font-semibold text-amber-600 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300 transition-colors">
                                + Assign Unit
                              </button>)}
                          </td>);
                        case 'trailer':
                            return (<td key={columnId} className={`px-4 py-3 align-middle min-w-[100px] ${responsive}`}>
                            {trailerLabel && trailerProfileTruckId ? (<button type="button" onClick={(event) => {
                                        event.stopPropagation();
                                        onOpenTrailerProfile?.(trailerProfileTruckId);
                                    }} className={`${ENTITY_LINK_CLASS} font-mono`} title={`Trailer ${trailerLabel}`}>
                                {trailerLabel}
                              </button>) : (<span className={PLACEHOLDER_CLASS}>—</span>)}
                          </td>);
                        case 'actions':
                            return (<td key={columnId} className="px-4 py-3 align-middle whitespace-nowrap">
                            <div className="flex items-center justify-end gap-x-3 w-full" data-actions-dropdown>
                              {isFlagged ? (<Flag size={14} className="text-amber-500 fill-amber-500 shrink-0 mr-2" aria-label="Load flagged"/>) : null}
                              <div className="relative inline-block shrink-0">
                                <button ref={(element) => {
                                    if (activeActionsLoadId === load.id) {
                                        actionsTriggerRef.current = element;
                                    }
                                }} type="button" onClick={(e) => {
                                    e.stopPropagation();
                                    setActiveActionsLoadId((prev) => prev === load.id ? null : load.id);
                                }} className="p-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 bg-zinc-50 hover:bg-zinc-100 dark:bg-zinc-900/40 dark:hover:bg-zinc-800 transition-colors" title="Load actions" aria-label="Load actions">
                                  <MoreVertical size={16}/>
                                </button>
                              </div>
                            </div>
                          </td>);
                        default:
                            return null;
                    }
                })}
                </tr>);
        }))}
          </tbody>
        </table>
        </div>
      </div>

      {pagination ? (<div className="flex flex-col gap-3 border-t border-zinc-200 dark:border-zinc-800 px-4 py-3 bg-zinc-50/80 dark:bg-zinc-900/40 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
              Page {pagination.page} of {pagination.totalPages}
              <span className="hidden sm:inline"> · {pagination.totalCount.toLocaleString()} loads</span>
            </p>
            <div className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
              <span>Rows per page:</span>
              <select value={pagination.limit} onChange={(e) => pagination.onLimitChange(Number(e.target.value))} disabled={loading} aria-label="Rows per page" className="bg-transparent dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg px-2 py-1 outline-none cursor-pointer hover:border-zinc-300 dark:hover:border-zinc-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed">
                {[10, 25, 50, 100].map((size) => (<option key={size} value={size}>
                    {size}
                  </option>))}
              </select>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={pagination.onPrevious} disabled={loading || pagination.page <= 1} className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
              <ChevronLeft size={14} aria-hidden="true"/>
              Previous
            </button>
            <button type="button" onClick={pagination.onNext} disabled={loading || pagination.page >= pagination.totalPages} className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
              Next
              <ChevronRight size={14} aria-hidden="true"/>
            </button>
          </div>
        </div>) : null}

      <AssignUnitModal load={assigningLoad} isOpen={!!assigningLoad} onClose={() => setAssigningLoad(null)} onSuccess={refreshData} trucks={trucks} drivers={drivers}/>

      <ShareTripModal load={sharingLoad} driver={sharingDriver} isOpen={!!sharingLoad} onClose={() => setSharingLoad(null)}/>

      <LoadCommentsModal load={commentsLoad} isOpen={!!commentsLoad} onClose={() => setCommentsLoad(null)} onSave={saveLoadComments}/>

      {actionsMenuPortal}

      {isDeleteDialogOpen
            ? createPortal(<div className="fixed inset-0 z-[100] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="delete-load-title">
              <button type="button" className="absolute inset-0 bg-zinc-900/60 dark:bg-[#0B0B0B]/80 backdrop-blur-sm" onClick={closeDeleteDialog} aria-label="Close delete confirmation" disabled={isDeleting != null}/>
              <div className="relative z-10 w-full max-w-md rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/95 shadow-2xl p-6 animate-in fade-in zoom-in-95 duration-150">
                <h3 id="delete-load-title" className="text-lg font-bold text-zinc-900 dark:text-white">
                  Delete Load Assignment
                </h3>
                <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
                  Are you sure you want to move this load to your Deleted Loads history? It will be
                  cleared from your active trackers immediately and can be recovered later if needed.
                </p>
                <div className="mt-6 flex flex-col-reverse sm:flex-row sm:justify-end gap-2 sm:gap-3">
                  <button type="button" onClick={closeDeleteDialog} disabled={isDeleting != null} className="w-full sm:w-auto px-4 py-2.5 rounded-xl text-sm font-semibold bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                    Cancel
                  </button>
                  <button type="button" onClick={() => void confirmDeleteLoad()} disabled={isDeleting != null} className="w-full sm:w-auto px-4 py-2.5 rounded-xl text-sm font-semibold bg-red-600 hover:bg-red-700 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                    {isDeleting != null ? 'Deleting...' : 'Confirm Delete'}
                  </button>
                </div>
              </div>
            </div>, document.body)
            : null}
    </>);
}
