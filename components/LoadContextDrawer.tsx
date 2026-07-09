"use client";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { createPortal } from "react-dom";
import toast from "react-hot-toast";
import { ChevronDown, X, Pencil } from "lucide-react";
import { createApiClient, formatApiError } from "@/lib/api-client";
import { LoadRecord, TeamDispatcher } from "@/lib/tms-api";
import { computeLoadGrossRate } from "@/lib/load-financials";
import { filterPowerUnits } from "@/lib/trailer-metadata";
import { buildApiStopsFromEditStops, deriveEndpointsFromEditStops, parseEditStopsFromLoad, type EditRouteStop, } from "@/lib/load-edit-stops";
import { SECTION_LABEL_CLASS, formatTitleCaseLabel, } from "@/lib/display-labels";
import { FINALIZED_RECORD_TOAST, isLoadFinanciallyFinalized, resolveLoadDisplayUiStatus, resolveLoadStatusBadgeClass, } from "@/lib/load-operational-status";
import LoadWorkspaceDocumentsPane from "@/components/load/workspace/LoadWorkspaceDocumentsPane";
import LoadWorkspaceInvoicingPane from "@/components/load/workspace/LoadWorkspaceInvoicingPane";
import LoadInfoRouteSection, { LoadInfoBrokerSection, LoadInfoCommoditySection, LoadInfoDispatcherNotesSection, LoadInfoFinancialSummary, LOAD_INFO_COLUMN_CLASS, LOAD_INFO_MASTER_SHEET_CLASS, LOAD_INFO_SECTION_SLOT_CLASS, buildCommoditiesPayload, buildReeferTemperaturePayload, parseTemperatureFahrenheit, resolveCommodityDraftFromLoad, resolveCommoditySummary, resolveCommodityWeight, resolveReeferMode, resolveReeferTemperature, } from "@/components/load-management/LoadInfoTab";
type LoadWorkspaceTab = "info" | "documents" | "invoicing";
const WORKSPACE_TABS: {
    id: LoadWorkspaceTab;
    label: string;
}[] = [
    { id: "info", label: "Load Info" },
    { id: "documents", label: "Documents" },
    { id: "invoicing", label: "Invoicing" },
];
const LoadRouteMiniMap = dynamic(() => import("./LoadRouteMiniMap"), {
    ssr: false,
    loading: () => (<div className="relative w-full h-[260px] rounded-xl overflow-hidden border border-zinc-200 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-800 animate-pulse"/>),
});
interface LoadContextDrawerProps {
    load: LoadRecord;
    trucks: any[];
    drivers: any[];
    customers: any[];
    dispatchers?: TeamDispatcher[];
    dispatchersLoading?: boolean;
    token: string;
    statusBadgeClass: (status?: string | null) => string;
    statusLabel: (status?: string | null) => string;
    onClose: () => void;
    onRefresh: () => Promise<void>;
    onLoadPatched: (loadId: number, patch: Partial<LoadRecord>) => void;
    currentUserId?: number | null;
    canViewOperationalFinancials?: boolean;
    canViewNetProfit?: boolean;
}
const headerActionClass = "rounded-lg px-3 py-2 text-xs font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed";
const normalizeContactValue = (value?: string | null) => value?.trim() || "";
const sectionLabelClass = SECTION_LABEL_CLASS;
interface ComboboxOption {
    value: string | number;
    label: string;
}
interface SearchableComboboxProps {
    label: string;
    value: string | number | null;
    options: ComboboxOption[];
    placeholder: string;
    onChange: (value: string) => void;
    disabled?: boolean;
}
function SearchableCombobox({ label, value, options, placeholder, onChange, disabled = false, }: SearchableComboboxProps) {
    const [open, setOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [menuRect, setMenuRect] = useState<DOMRect | null>(null);
    const triggerRef = useRef<HTMLButtonElement>(null);
    const menuRef = useRef<HTMLDivElement>(null);
    const searchInputRef = useRef<HTMLInputElement>(null);
    const normalizedValue = value === null || value === undefined || value === "" ? "" : String(value);
    const selectedOption = useMemo(() => options.find((option) => String(option.value) === normalizedValue), [options, normalizedValue]);
    const filteredOptions = useMemo(() => {
        const query = searchQuery.trim().toLowerCase();
        if (!query)
            return options;
        return options.filter((option) => option.label.toLowerCase().includes(query));
    }, [options, searchQuery]);
    const closeMenu = () => {
        setOpen(false);
        setSearchQuery("");
        setMenuRect(null);
    };
    const openMenu = () => {
        if (disabled)
            return;
        const rect = triggerRef.current?.getBoundingClientRect();
        if (!rect)
            return;
        setSearchQuery("");
        setMenuRect(rect);
        setOpen(true);
    };
    const toggleMenu = () => {
        if (open) {
            closeMenu();
            return;
        }
        openMenu();
    };
    useEffect(() => {
        if (!open)
            return;
        const frame = requestAnimationFrame(() => {
            searchInputRef.current?.focus();
        });
        return () => cancelAnimationFrame(frame);
    }, [open]);
    useEffect(() => {
        if (!open)
            return;
        const handleClickOutside = (event: MouseEvent) => {
            const target = event.target as Node;
            if (triggerRef.current?.contains(target) || menuRef.current?.contains(target)) {
                return;
            }
            setOpen(false);
            setSearchQuery("");
            setMenuRect(null);
        };
        const handleReposition = () => {
            const rect = triggerRef.current?.getBoundingClientRect();
            if (rect)
                setMenuRect(rect);
        };
        const listenerFrame = window.requestAnimationFrame(() => {
            document.addEventListener("mousedown", handleClickOutside);
        });
        window.addEventListener("resize", handleReposition);
        window.addEventListener("scroll", handleReposition, true);
        return () => {
            window.cancelAnimationFrame(listenerFrame);
            document.removeEventListener("mousedown", handleClickOutside);
            window.removeEventListener("resize", handleReposition);
            window.removeEventListener("scroll", handleReposition, true);
        };
    }, [open]);
    const handleSelect = (nextValue: string | number) => {
        onChange(String(nextValue));
        closeMenu();
    };
    const triggerClass = "w-full bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-lg text-sm text-left px-3 py-2 flex items-center justify-between gap-2 transition-colors focus:outline-none focus:ring-2 focus:ring-sky-500/40 disabled:opacity-50 disabled:cursor-not-allowed";
    const dropdown = open && menuRect && typeof document !== "undefined"
        ? createPortal(<div ref={menuRef} className="z-[100] rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xl overflow-hidden" style={{
                position: "fixed",
                top: menuRect.bottom + 4,
                left: menuRect.left,
                width: menuRect.width,
            }}>
            <div className="sticky top-0 z-10 border-b border-zinc-200 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800">
              <input ref={searchInputRef} type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search..." className="w-full bg-zinc-100 dark:bg-zinc-800 border-0 p-2 text-xs text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 outline-none"/>
            </div>
            <ul className="max-h-52 overflow-y-auto py-1">
              {filteredOptions.length === 0 ? (<li className="px-3 py-3 text-center text-xs text-zinc-500 dark:text-zinc-400">
                  No options found
                </li>) : (filteredOptions.map((option) => {
                const isSelected = String(option.value) === normalizedValue;
                return (<li key={String(option.value)}>
                      <button type="button" onClick={() => handleSelect(option.value)} className={`w-full px-3 py-2 text-left text-sm transition-colors ${isSelected
                        ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-semibold"
                        : "text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800"}`}>
                        {option.label}
                      </button>
                    </li>);
            }))}
            </ul>
          </div>, document.body)
        : null;
    return (<div className="relative">
      <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
        {label}
      </label>
      <button ref={triggerRef} type="button" onClick={toggleMenu} disabled={disabled} aria-haspopup="listbox" aria-expanded={open} className={triggerClass}>
        <span className={`min-w-0 truncate ${selectedOption
            ? "text-zinc-900 dark:text-zinc-100 font-medium"
            : "text-zinc-400 dark:text-zinc-500"}`}>
          {selectedOption?.label || placeholder}
        </span>
        <ChevronDown size={16} className={`shrink-0 text-zinc-500 dark:text-zinc-400 transition-transform ${open ? "rotate-180" : ""}`} aria-hidden/>
      </button>
      {dropdown}
    </div>);
}
export default function LoadContextDrawer({ load, trucks, drivers, customers, dispatchers = [], dispatchersLoading = false, token, statusBadgeClass, statusLabel, onClose, onRefresh, onLoadPatched, currentUserId = null, canViewOperationalFinancials = true, canViewNetProfit = true, }: LoadContextDrawerProps) {
    const assignedBroker = customers.find((c) => c.id == load.customer_id);
    const isFinalized = isLoadFinanciallyFinalized(load);
    const displayStatusBadgeClass = resolveLoadStatusBadgeClass(load, statusBadgeClass);
    const displayStatusLabel = formatTitleCaseLabel(resolveLoadDisplayUiStatus(load));
    const [selectedDriverId, setSelectedDriverId] = useState("");
    const [selectedTruckId, setSelectedTruckId] = useState("");
    const [selectedTrailer, setSelectedTrailer] = useState("");
    const [selectedDispatcherId, setSelectedDispatcherId] = useState("");
    const [notes, setNotes] = useState("");
    const [savedNotes, setSavedNotes] = useState("");
    const [savingNotes, setSavingNotes] = useState(false);
    const [workspaceTab, setWorkspaceTab] = useState<LoadWorkspaceTab>("info");
    const [isEditingWorkspace, setIsEditingWorkspace] = useState(false);
    const [savingWorkspace, setSavingWorkspace] = useState(false);
    const [routeStops, setRouteStops] = useState<EditRouteStop[]>([]);
    const [pickupReference, setPickupReference] = useState("");
    const [draftGrossRate, setDraftGrossRate] = useState(0);
    const [draftFuelCost, setDraftFuelCost] = useState(0);
    const [draftAccessorialCharge, setDraftAccessorialCharge] = useState(0);
    const [draftDriverPay, setDraftDriverPay] = useState(0);
    const [draftTotalMiles, setDraftTotalMiles] = useState(0);
    const [draftCommodity, setDraftCommodity] = useState("");
    const [draftWeight, setDraftWeight] = useState(0);
    const [draftBrokerName, setDraftBrokerName] = useState("");
    const [draftBillingEmail, setDraftBillingEmail] = useState("");
    const [draftBrokerAddress, setDraftBrokerAddress] = useState("");
    const [draftBrokerPhone, setDraftBrokerPhone] = useState("");
    const [draftBrokerLoadId, setDraftBrokerLoadId] = useState("");
    const [draftTargetTemperature, setDraftTargetTemperature] = useState("");
    const [draftReeferMode, setDraftReeferMode] = useState("N/A (Dry Van)");
    const resetWorkspaceDraft = useCallback(() => {
        const assignedBroker = customers.find((c) => c.id == load.customer_id);
        setRouteStops(parseEditStopsFromLoad(load));
        setPickupReference(load.pickup_number?.trim() ?? "");
        setDraftGrossRate(computeLoadGrossRate(load));
        setDraftFuelCost(load.fuel_cost ??
            (load.total_miles && load.total_miles > 0 ? load.total_miles * 0.65 : 0));
        setDraftAccessorialCharge(load.accessorial_charge ?? 0);
        setDraftDriverPay(load.driver_pay ?? 0);
        setDraftTotalMiles(load.total_miles ?? 0);
        setDraftCommodity(resolveCommodityDraftFromLoad(load));
        setDraftWeight(resolveCommodityWeight(load.commodities));
        setDraftBrokerName(assignedBroker?.name || load.broker_name || "");
        setDraftBillingEmail(normalizeContactValue(load.broker_email) || normalizeContactValue(assignedBroker?.email));
        setDraftBrokerAddress(load.broker_address?.trim() ?? "");
        setDraftBrokerPhone(normalizeContactValue(load.broker_phone) || normalizeContactValue(assignedBroker?.phone));
        setDraftBrokerLoadId(load.broker_load_id?.trim() ?? "");
        setDraftTargetTemperature(parseTemperatureFahrenheit(resolveReeferTemperature(load)));
        setDraftReeferMode(resolveReeferMode(load));
        const truck = trucks.find((t) => t.id === load.truck_id);
        setSelectedDriverId(truck?.driver_id ? String(truck.driver_id) : "");
        setSelectedTruckId(load.truck_id ? String(load.truck_id) : "");
        setSelectedTrailer(truck?.trailer_number && truck.trailer_number !== "N/A"
            ? truck.trailer_number
            : load.trailer_number || "");
        setSelectedDispatcherId(load.dispatcher_id ? String(load.dispatcher_id) : "");
    }, [load, trucks, customers]);
    useEffect(() => {
        setWorkspaceTab("info");
        setIsEditingWorkspace(false);
        resetWorkspaceDraft();
    }, [load.id, resetWorkspaceDraft]);
    useEffect(() => {
        setIsEditingWorkspace(false);
    }, [workspaceTab]);
    useEffect(() => {
        const nextNotes = load.comments || load.load_notes || "";
        setNotes(nextNotes);
        setSavedNotes(nextNotes);
    }, [load.id, load.comments, load.load_notes]);
    const updateRouteStop = (id: number, patch: Partial<EditRouteStop>) => {
        setRouteStops((previous) => previous.map((stop) => (stop.id === id ? { ...stop, ...patch } : stop)));
    };
    const dispatcherOptions = useMemo(() => {
        const options = [...dispatchers];
        if (load.dispatcher_id &&
            !options.some((dispatcher) => dispatcher.id === load.dispatcher_id)) {
            options.unshift({
                id: load.dispatcher_id,
                email: '',
                display_name: `Dispatcher #${load.dispatcher_id}`,
            });
        }
        return options;
    }, [dispatchers, load.dispatcher_id]);
    const fleetTrucks = useMemo(() => filterPowerUnits(trucks), [trucks]);
    const trailerOptions = useMemo(() => {
        const values = new Set<string>();
        for (const truck of trucks) {
            const num = truck.trailer_number;
            if (num && num !== "N/A")
                values.add(num);
        }
        if (load.trailer_number)
            values.add(load.trailer_number);
        return Array.from(values).sort();
    }, [trucks, load.trailer_number]);
    const driverFilteredTrucks = useMemo(() => {
        if (!selectedDriverId)
            return fleetTrucks;
        return fleetTrucks.filter((t) => String(t.driver_id) === selectedDriverId);
    }, [fleetTrucks, selectedDriverId]);
    const driverComboboxOptions = useMemo<ComboboxOption[]>(() => drivers.map((driver) => ({
        value: driver.id,
        label: driver.driver_name || `Driver #${driver.id}`,
    })), [drivers]);
    const truckComboboxOptions = useMemo<ComboboxOption[]>(() => driverFilteredTrucks.map((truck) => ({
        value: truck.id,
        label: `Unit #${truck.truck_number}`,
    })), [driverFilteredTrucks]);
    const trailerComboboxOptions = useMemo<ComboboxOption[]>(() => trailerOptions.map((trailer) => ({
        value: trailer,
        label: `#${trailer}`,
    })), [trailerOptions]);
    const dispatcherComboboxOptions = useMemo<ComboboxOption[]>(() => dispatcherOptions.map((dispatcher) => ({
        value: dispatcher.id,
        label: dispatcher.display_name || dispatcher.email || `Dispatcher #${dispatcher.id}`,
    })), [dispatcherOptions]);
    const viewGrossRate = computeLoadGrossRate(load);
    const viewFuelCost = load.fuel_cost ??
        (load.total_miles && load.total_miles > 0 ? load.total_miles * 0.65 : 0);
    const viewAccessorialCharge = load.accessorial_charge ?? 0;
    const viewDriverPay = load.driver_pay ?? 0;
    const viewCommoditySummary = resolveCommoditySummary(load.commodities);
    const viewWeight = resolveCommodityWeight(load.commodities);
    const viewBrokerName = assignedBroker?.name || load.broker_name || "";
    const viewBillingEmail = normalizeContactValue(load.broker_email) || normalizeContactValue(assignedBroker?.email);
    const viewBrokerAddress = load.broker_address?.trim() ?? "";
    const viewBrokerPhone = normalizeContactValue(load.broker_phone) || normalizeContactValue(assignedBroker?.phone);
    const viewBrokerLoadId = load.broker_load_id?.trim() ?? "";
    const viewPickupNumber = load.pickup_number?.trim() ?? "";
    const viewTargetTemperature = resolveReeferTemperature(load);
    const viewReeferMode = resolveReeferMode(load);
    const handleDriverChange = (driverId: string) => {
        setSelectedDriverId(driverId);
        const match = fleetTrucks.find((t) => String(t.driver_id) === driverId);
        if (match) {
            setSelectedTruckId(String(match.id));
            if (match.trailer_number && match.trailer_number !== "N/A") {
                setSelectedTrailer(match.trailer_number);
            }
        }
    };
    const handleTruckChange = (truckId: string) => {
        setSelectedTruckId(truckId);
        const truck = fleetTrucks.find((t) => String(t.id) === truckId);
        if (truck?.driver_id)
            setSelectedDriverId(String(truck.driver_id));
        if (truck?.trailer_number && truck.trailer_number !== "N/A") {
            setSelectedTrailer(truck.trailer_number);
        }
    };
    const handleTrailerChange = (trailerNumber: string) => {
        setSelectedTrailer(trailerNumber);
        const match = fleetTrucks.find((t) => t.trailer_number === trailerNumber);
        if (match) {
            setSelectedTruckId(String(match.id));
            if (match.driver_id)
                setSelectedDriverId(String(match.driver_id));
        }
    };
    const handleCancelWorkspace = () => {
        resetWorkspaceDraft();
        setIsEditingWorkspace(false);
    };
    const handleSaveWorkspace = async () => {
        if (isFinalized) {
            toast.error(FINALIZED_RECORD_TOAST);
            return;
        }
        const { origin, destination } = deriveEndpointsFromEditStops(routeStops);
        if (routeStops.length === 0) {
            toast.error("At least one route stop is required.");
            return;
        }
        if (!origin) {
            toast.error("Pickup address is required.");
            return;
        }
        if (!destination) {
            toast.error("Delivery address is required.");
            return;
        }
        setSavingWorkspace(true);
        const toastId = toast.loading("Saving changes...");
        try {
            const apiStops = buildApiStopsFromEditStops(routeStops);
            const linehaulRate = draftGrossRate - (load.fuel_surcharge ?? 0) - draftAccessorialCharge;
            const truckId = selectedTruckId ? parseInt(selectedTruckId, 10) : null;
            const dispatcherId = selectedDispatcherId
                ? parseInt(selectedDispatcherId, 10)
                : null;
            const commoditiesPayload = buildCommoditiesPayload(draftCommodity, draftWeight);
            const reeferTemperature = buildReeferTemperaturePayload(draftTargetTemperature);
            await createApiClient(token).put(`/api/loads/${load.id}`, {
                origin,
                destination,
                stops: apiStops,
                pickup_number: pickupReference.trim() || null,
                truck_id: truckId,
                dispatcher_id: dispatcherId,
                linehaul_rate: linehaulRate,
                rate: linehaulRate,
                accessorial_charge: draftAccessorialCharge,
                fuel_cost: draftFuelCost,
                driver_pay: draftDriverPay,
                total_miles: draftTotalMiles,
                weight: draftWeight,
                commodities: commoditiesPayload,
                broker_name: draftBrokerName.trim() || null,
                broker_email: draftBillingEmail.trim() || null,
                broker_address: draftBrokerAddress.trim() || null,
                broker_phone: draftBrokerPhone.trim() || null,
                broker_load_id: draftBrokerLoadId.trim() || null,
                reefer_temperature: reeferTemperature,
                reefer_mode: draftReeferMode.trim() || null,
            });
            const truck = truckId ? fleetTrucks.find((t) => t.id === truckId) : undefined;
            const nextRequirements = {
                ...(load.requirements ?? {}),
                ...(reeferTemperature ? { reefer_temperature: reeferTemperature } : {}),
                reefer_mode: draftReeferMode.trim() || "N/A (Dry Van)",
            };
            if (!reeferTemperature) {
                delete (nextRequirements as Record<string, unknown>).reefer_temperature;
            }
            onLoadPatched(load.id, {
                origin,
                destination,
                pickup_number: pickupReference.trim() || null,
                detailed_stops: apiStops as LoadRecord["detailed_stops"],
                truck_id: truckId,
                truck_number: truck?.truck_number ?? load.truck_number,
                trailer_number: selectedTrailer || truck?.trailer_number || load.trailer_number,
                dispatcher_id: dispatcherId,
                linehaul_rate: linehaulRate,
                accessorial_charge: draftAccessorialCharge,
                fuel_cost: draftFuelCost,
                driver_pay: draftDriverPay,
                total_miles: draftTotalMiles,
                commodities: commoditiesPayload,
                broker_name: draftBrokerName.trim() || null,
                broker_email: draftBillingEmail.trim() || null,
                broker_address: draftBrokerAddress.trim() || null,
                broker_phone: draftBrokerPhone.trim() || null,
                broker_load_id: draftBrokerLoadId.trim() || null,
                requirements: nextRequirements,
            });
            await onRefresh();
            toast.success("Load updated successfully.", { id: toastId });
            setIsEditingWorkspace(false);
        }
        catch (err: unknown) {
            toast.error(formatApiError(err, "Failed to save changes."), { id: toastId });
        }
        finally {
            setSavingWorkspace(false);
        }
    };
    const handleNotesBlur = async () => {
        const trimmed = notes.trim();
        const normalizedSaved = savedNotes.trim();
        if (trimmed === normalizedSaved || savingNotes)
            return;
        setSavingNotes(true);
        try {
            const client = createApiClient(token);
            const response = await client.patch<LoadRecord>(`/api/loads/${load.id}`, {
                comments: trimmed || null,
            });
            const savedComments = response.data?.comments ?? (trimmed || null);
            const nextSaved = savedComments || "";
            setSavedNotes(nextSaved);
            setNotes(nextSaved);
            onLoadPatched(load.id, { comments: savedComments });
        }
        catch (err: unknown) {
            setNotes(savedNotes);
            toast.error(formatApiError(err, "Failed to save comment."));
        }
        finally {
            setSavingNotes(false);
        }
    };
    return (<div className="flex flex-col flex-1 min-h-0 w-full animate-in fade-in duration-200" aria-label="Load details workspace">
      <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 md:p-6 lg:p-8">
        <div className="mx-auto w-full max-w-[1600px] space-y-6">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 truncate">
                {load.broker_load_id || `L-${load.id}`}
              </h2>
              <span className={`mt-2 inline-block px-2.5 py-1 rounded-full text-xs font-semibold tracking-wide border ${displayStatusBadgeClass}`}>
                {displayStatusLabel}
              </span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {workspaceTab === "info" && !isFinalized ? (isEditingWorkspace ? (<>
                    <button type="button" onClick={handleCancelWorkspace} disabled={savingWorkspace} className={`${headerActionClass} border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800`}>
                      Cancel
                    </button>
                    <button type="button" onClick={() => void handleSaveWorkspace()} disabled={savingWorkspace} className={`${headerActionClass} bg-zinc-900 dark:bg-white text-white dark:text-black hover:bg-zinc-800 dark:hover:bg-zinc-200`}>
                      {savingWorkspace ? "Saving..." : "Save Changes"}
                    </button>
                  </>) : (<button type="button" onClick={() => {
                resetWorkspaceDraft();
                setIsEditingWorkspace(true);
            }} className={`${headerActionClass} inline-flex items-center gap-1.5 border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800`} aria-label="Edit load info">
                    <Pencil size={14} aria-hidden/>
                    Edit
                  </button>)) : null}
              <button type="button" onClick={onClose} className="p-2 rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors" aria-label="Close load panel">
                <X size={20}/>
              </button>
            </div>
          </div>

          <nav className="flex flex-wrap gap-1 border-b border-zinc-200 dark:border-zinc-800" aria-label="Load workspace sections">
            {WORKSPACE_TABS.map((tab) => {
            const isActive = workspaceTab === tab.id;
            return (<button key={tab.id} type="button" onClick={() => setWorkspaceTab(tab.id)} className={`px-3 py-2.5 text-xs font-bold tracking-wide transition-colors border-b-2 -mb-px ${isActive
                    ? "border-zinc-900 text-zinc-900 dark:border-white dark:text-white"
                    : "border-transparent text-zinc-500 dark:text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"}`}>
                  {tab.label}
                </button>);
        })}
          </nav>

          {workspaceTab === "info" ? (<div className={LOAD_INFO_MASTER_SHEET_CLASS}>
            <div className={`xl:col-span-5 ${LOAD_INFO_COLUMN_CLASS}`}>
              <LoadInfoBrokerSection isEditingWorkspace={isEditingWorkspace} brokerName={isEditingWorkspace ? draftBrokerName : viewBrokerName} billingEmail={isEditingWorkspace ? draftBillingEmail : viewBillingEmail} brokerAddress={isEditingWorkspace ? draftBrokerAddress : viewBrokerAddress} brokerPhone={isEditingWorkspace ? draftBrokerPhone : viewBrokerPhone} brokerLoadId={isEditingWorkspace ? draftBrokerLoadId : viewBrokerLoadId} pickupNumber={isEditingWorkspace ? pickupReference : viewPickupNumber} onBrokerNameChange={setDraftBrokerName} onBillingEmailChange={setDraftBillingEmail} onBrokerAddressChange={setDraftBrokerAddress} onBrokerPhoneChange={setDraftBrokerPhone} onBrokerLoadIdChange={setDraftBrokerLoadId} onPickupNumberChange={setPickupReference}/>

              <LoadInfoRouteSection load={load} isEditingWorkspace={isEditingWorkspace} routeStops={routeStops} pickupReference={pickupReference} totalMiles={isEditingWorkspace ? draftTotalMiles : load.total_miles ?? 0} onRouteStopChange={updateRouteStop} onPickupReferenceChange={setPickupReference} onTotalMilesChange={setDraftTotalMiles}/>

              <div className={LOAD_INFO_SECTION_SLOT_CLASS}>
                <p className={`${sectionLabelClass} mb-3`}>Route Map</p>
                <LoadRouteMiniMap load={load} className="min-h-[260px] w-full"/>
              </div>

              <LoadInfoDispatcherNotesSection notes={notes} onNotesChange={setNotes} onBlur={() => void handleNotesBlur()}/>
            </div>

            <div className={`xl:col-span-7 ${LOAD_INFO_COLUMN_CLASS}`}>
              <div className={LOAD_INFO_SECTION_SLOT_CLASS}>
                <p className={`${sectionLabelClass} mb-3`}>Assignment</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-1 gap-3 overflow-visible">
                  <SearchableCombobox label="Driver" value={selectedDriverId || null} options={driverComboboxOptions} placeholder="— Select driver —" onChange={handleDriverChange} disabled={!isEditingWorkspace || isFinalized}/>

                  <SearchableCombobox label="Truck" value={selectedTruckId || null} options={truckComboboxOptions} placeholder="— Select truck —" onChange={handleTruckChange} disabled={!isEditingWorkspace || isFinalized}/>

                  <SearchableCombobox label="Trailer" value={selectedTrailer || null} options={trailerComboboxOptions} placeholder="— Select trailer —" onChange={handleTrailerChange} disabled={!isEditingWorkspace || isFinalized}/>

                  <SearchableCombobox label="Dispatcher" value={selectedDispatcherId || null} options={dispatcherComboboxOptions} placeholder={dispatchersLoading
                ? "Loading dispatchers…"
                : dispatcherComboboxOptions.length === 0
                    ? "No dispatchers available"
                    : "— Select dispatcher —"} onChange={setSelectedDispatcherId} disabled={!isEditingWorkspace ||
                isFinalized ||
                dispatchersLoading ||
                dispatcherComboboxOptions.length === 0}/>
                </div>
              </div>

              {canViewOperationalFinancials ? (<LoadInfoFinancialSummary load={load} isEditingWorkspace={isEditingWorkspace} grossRate={isEditingWorkspace ? draftGrossRate : viewGrossRate} fuelCost={isEditingWorkspace ? draftFuelCost : viewFuelCost} accessorialCharge={isEditingWorkspace ? draftAccessorialCharge : viewAccessorialCharge} driverPay={isEditingWorkspace ? draftDriverPay : viewDriverPay} onGrossRateChange={setDraftGrossRate} onFuelCostChange={setDraftFuelCost} onAccessorialChange={setDraftAccessorialCharge} onDriverPayChange={setDraftDriverPay} canViewNetProfit={canViewNetProfit}/>) : null}

              <LoadInfoCommoditySection commoditySummary={isEditingWorkspace ? draftCommodity : viewCommoditySummary} weight={isEditingWorkspace ? draftWeight : viewWeight} targetTemperature={isEditingWorkspace ? draftTargetTemperature : viewTargetTemperature} reeferMode={isEditingWorkspace ? draftReeferMode : viewReeferMode} isEditingWorkspace={isEditingWorkspace} onCommodityChange={setDraftCommodity} onWeightChange={setDraftWeight} onTargetTemperatureChange={setDraftTargetTemperature} onReeferModeChange={setDraftReeferMode}/>
            </div>
          </div>) : null}

          {workspaceTab === "documents" ? (<LoadWorkspaceDocumentsPane loadId={load.id} token={token} hasIngestPdf={load.ingest_has_pdf === 1} onRefresh={onRefresh}/>) : null}

          {workspaceTab === "invoicing" ? (<LoadWorkspaceInvoicingPane load={load} token={token} onRefresh={onRefresh}/>) : null}
        </div>
      </div>
    </div>);
}
