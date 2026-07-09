"use client";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";
import { ChevronDown, Loader2, Pencil, Search, Trash2, Truck, X } from "lucide-react";
import { createApiClient } from "@/lib/api-client";
import { createTmsApi, DriverRecord, LoadRecord, TruckRecord } from "@/lib/tms-api";
import { computeLoadGrossRate } from "@/lib/load-financials";
import { extractTrailerMetadata, findPowerUnitForTrailer, formatMakeModel, mergeTrailerMetadataIntoCustomFields, normalizeOwnershipType, resolveAssignedTruckDisplay, TRAILER_OWNERSHIP_TYPES, } from "@/lib/trailer-metadata";
import { buildDocumentRowsFromRecords } from "@/lib/tasks-files";
import EntityDetailTabs, { type EntityDetailTabId } from "@/components/entity-detail/EntityDetailTabs";
import TasksAndFilesPanel from "@/components/entity-detail/TasksAndFilesPanel";
import DocumentUploadControls, { CUSTOM_FOLDER_OPTION, resolveUploadDocumentType, } from "@/components/entity-detail/DocumentUploadControls";
import ProfileEntityLink from "@/components/entity-detail/ProfileEntityLink";
import { ProfileFieldFallback, ProfileFieldValue, } from "@/components/entity-detail/profile-field-styles";
import { sanitizePlateNumberInput, sanitizeVinInput } from "@/lib/input-formatters";
import { sanitizeMakeModelTitleCase } from "@/lib/fleet-display";
import { baselineCategoriesForEntity, type AssetEntityType, } from "@/lib/asset-document-categories";
import { buildDocumentNotesMap } from "@/lib/driver-documents-cache";
import { useAssetDocumentsQuery } from "@/hooks/useAssetDocumentsQuery";
import { useEntityCustomFolders } from "@/hooks/useEntityCustomFolders";
import { resolveAssetUploadTarget } from "@/lib/asset-upload-target";
import { isAllowedAssetDocumentFile } from "@/lib/asset-document-upload";
interface TruckDetailModalProps {
    token: string;
    truck: TruckRecord | null;
    drivers: DriverRecord[];
    trucks: TruckRecord[];
    loads?: LoadRecord[];
    onClose: () => void;
    onOpenDriver?: (driverId: number) => void;
    onOpenTrailer?: (truckId: number) => void;
    onSuccess: () => void | Promise<void>;
    onRemoveLoad?: (loadId: string) => void;
    bare?: boolean;
    workspaceLayout?: boolean;
}
const METADATA_LABEL_CLASS = "text-[10px] uppercase text-zinc-500 dark:text-zinc-400 mb-1 block";
const METADATA_INPUT_CLASS = "w-full bg-transparent border-0 text-zinc-900 dark:text-white px-1 py-1.5 pr-8 text-sm outline-none ring-0 focus:ring-0 placeholder:text-zinc-400 dark:placeholder:text-zinc-500";
const METADATA_FIELD_WRAPPER_CLASS = "group relative rounded-md border border-transparent transition-colors duration-150 hover:bg-zinc-100/40 dark:hover:bg-zinc-800/30 focus-within:border-zinc-200 dark:focus-within:border-zinc-700 focus-within:bg-zinc-100/60 dark:focus-within:bg-zinc-800/40 focus-within:ring-1 focus-within:ring-blue-500/20";
const METADATA_PENCIL_CLASS = "pointer-events-none absolute right-1 top-1/2 -translate-y-1/2 text-zinc-400 dark:text-zinc-600 transition-colors duration-150 group-hover:text-zinc-600 dark:group-hover:text-zinc-400 group-focus-within:text-blue-500 dark:group-focus-within:text-blue-400";
const METADATA_CHEVRON_CLASS = "pointer-events-none absolute right-1 top-1/2 -translate-y-1/2 text-zinc-400 dark:text-zinc-600 transition-colors duration-150 group-hover:text-zinc-600 dark:group-hover:text-zinc-400 group-focus-within:text-blue-500 dark:group-focus-within:text-blue-400";
const METADATA_POPOVER_SEARCH_CLASS = "sticky top-0 z-10 w-full px-3 py-2 text-sm bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 outline-none placeholder:text-zinc-400 dark:placeholder:text-zinc-500 text-zinc-900 dark:text-zinc-100";
const METADATA_POPOVER_PANEL_CLASS = "absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-xl dark:border-zinc-800 dark:bg-zinc-900";
const METADATA_POPOVER_ITEM_CLASS = "w-full px-3 py-2 text-left text-sm text-zinc-900 transition-colors hover:bg-zinc-100 dark:text-zinc-100 dark:hover:bg-zinc-800";
const METADATA_POPOVER_ITEM_SELECTED_CLASS = "bg-zinc-100 dark:bg-zinc-800";
const ASSIGNMENT_FIELD_LABEL_CLASS = "text-[10px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400";
const WORKSPACE_PANEL_SHELL = "bg-white dark:bg-[#161616] border border-zinc-200 dark:border-zinc-800/80 rounded-xl p-5 shadow-sm w-full grid grid-cols-1 xl:grid-cols-3 gap-0 items-stretch";
const WORKSPACE_INNER_SECTION_DIVIDER = "border-t border-zinc-200 dark:border-zinc-800/60 pt-6 mt-6";
const WORKSPACE_COLUMN_DIVIDER_CLASS = "border-zinc-200 dark:border-zinc-800/60";
type PopoverSelectOption = {
    value: string;
    label: string;
};
type PopoverSelectFieldProps = {
    label: string;
    value: string;
    onChange: (value: string) => void;
    options: PopoverSelectOption[];
    labelClassName?: string;
    showSearch?: boolean;
    disabled?: boolean;
};
function PopoverSelectField({ label, value, onChange, options, labelClassName = METADATA_LABEL_CLASS, showSearch = true, disabled = false, }: PopoverSelectFieldProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const containerRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
        if (!isOpen) {
            setSearchQuery("");
            return;
        }
        const handlePointerDown = (event: MouseEvent) => {
            if (!containerRef.current?.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener("mousedown", handlePointerDown);
        return () => document.removeEventListener("mousedown", handlePointerDown);
    }, [isOpen]);
    const filteredOptions = useMemo(() => {
        const query = searchQuery.trim().toLowerCase();
        if (!query)
            return options;
        return options.filter((option) => option.label.toLowerCase().includes(query));
    }, [options, searchQuery]);
    const selectedOption = options.find((option) => option.value === value);
    const displayValue = selectedOption?.label ?? value;
    if (disabled) {
        return (<div className="flex flex-col gap-1 min-w-0">
        <label className={labelClassName}>{label}</label>
        <ProfileFieldValue value={displayValue || null} fallback="None" className={WORKSPACE_FIELD_VALUE_CLASS}/>
      </div>);
    }
    const handleSelect = (nextValue: string) => {
        onChange(nextValue);
        setIsOpen(false);
    };
    const wrapperClassName = isOpen
        ? `${METADATA_FIELD_WRAPPER_CLASS} border-zinc-200 bg-zinc-100/60 ring-1 ring-blue-500/20 dark:border-zinc-700 dark:bg-zinc-800/40`
        : METADATA_FIELD_WRAPPER_CLASS;
    return (<div ref={containerRef} className="flex flex-col gap-1 min-w-0">
      <label className={labelClassName}>{label}</label>
      <div className={wrapperClassName}>
        <button type="button" role="combobox" aria-expanded={isOpen} aria-haspopup="listbox" onClick={() => setIsOpen((open) => !open)} className={`${METADATA_INPUT_CLASS} w-full cursor-pointer text-left`}>
          {displayValue}
        </button>
        <ChevronDown size={14} className={METADATA_CHEVRON_CLASS} aria-hidden/>
        {isOpen ? (<div className={METADATA_POPOVER_PANEL_CLASS}>
            {showSearch ? (<input type="text" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} autoFocus placeholder="Search..." className={METADATA_POPOVER_SEARCH_CLASS} onMouseDown={(event) => event.stopPropagation()}/>) : null}
            <div role="listbox" className="max-h-60 overflow-y-auto">
              {filteredOptions.length === 0 ? (<p className="px-3 py-2 text-sm text-zinc-400 dark:text-zinc-500">No options found</p>) : (filteredOptions.map((option) => (<button key={option.value || `empty-${option.label}`} type="button" role="option" aria-selected={option.value === value} onClick={() => handleSelect(option.value)} className={`${METADATA_POPOVER_ITEM_CLASS} ${option.value === value ? METADATA_POPOVER_ITEM_SELECTED_CLASS : ""}`.trim()}>
                    {option.label}
                  </button>)))}
            </div>
          </div>) : null}
      </div>
    </div>);
}
const SECTION_CARD_CLASS = "border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 bg-zinc-50 dark:bg-zinc-900/50";
const readTruckMetadata = (truck: TruckRecord) => {
    const customFields = truck.custom_fields || {};
    const make = (truck.make || customFields.Make || customFields.make || "").trim();
    const model = (truck.model || customFields.Model || customFields.model || "").trim();
    const plate = customFields["Plate Number"] || customFields.Plate || customFields.plate || "";
    const mileage = customFields.Mileage || customFields.Odometer || customFields.mileage || "";
    return {
        vin: truck.vin || "",
        plate_number: plate,
        make_model: [make, model].filter(Boolean).join(" ").trim(),
        mileage: mileage ? String(mileage).replace(/[^\d]/g, "") : "",
    };
};
const parseMileageValue = (value: string): number | null => {
    const cleaned = value.replace(/[^\d]/g, "");
    if (!cleaned)
        return null;
    const parsed = parseInt(cleaned, 10);
    if (!Number.isFinite(parsed) || parsed < 0)
        return null;
    return parsed;
};
const splitMakeModel = (value: string): {
    make: string;
    model: string;
} => {
    const tokens = value.trim().split(/\s+/).filter(Boolean);
    return {
        make: tokens[0] || "",
        model: tokens.slice(1).join(" "),
    };
};
const buildMetadataCustomFields = (base: Record<string, string>, plate_number: string, mileage: string) => {
    const next = { ...base };
    delete next.make;
    delete next.model;
    delete next.Make;
    delete next.Model;
    delete next["Make / Model"];
    delete next.mileage;
    delete next.Odometer;
    next["Plate Number"] = plate_number.trim();
    const mileageValue = parseMileageValue(mileage);
    if (mileageValue != null) {
        next.Mileage = String(mileageValue);
    }
    else {
        delete next.Mileage;
    }
    return next;
};
type TrailerFormData = {
    vin: string;
    plate_number: string;
    make_model: string;
    year: string;
    ownership_type: string;
};
const EMPTY_TRAILER_FORM: TrailerFormData = {
    vin: "",
    plate_number: "",
    make_model: "",
    year: "",
    ownership_type: "Company",
};
type EditableMetadataFieldProps = {
    label: string;
    value: string;
    onChange: (value: string) => void;
    onBlur?: () => void;
    placeholder?: string;
    className?: string;
    type?: string;
    inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
    maxLength?: number;
};
function EditableMetadataField({ label, value, onChange, onBlur, placeholder, className = "", type = "text", inputMode, maxLength, }: EditableMetadataFieldProps) {
    return (<div>
      <label className={METADATA_LABEL_CLASS}>{label}</label>
      <div className={METADATA_FIELD_WRAPPER_CLASS}>
        <input type={type} inputMode={inputMode} maxLength={maxLength} value={value} onChange={(event) => onChange(event.target.value)} onBlur={onBlur} placeholder={placeholder} className={`${METADATA_INPUT_CLASS} ${className}`.trim()}/>
        <Pencil size={14} className={METADATA_PENCIL_CLASS} aria-hidden/>
      </div>
    </div>);
}
type EditableMetadataSelectProps = {
    label: string;
    value: string;
    onChange: (value: string) => void;
    options: readonly string[];
    showSearch?: boolean;
};
function EditableMetadataSelect({ label, value, onChange, options, showSearch, }: EditableMetadataSelectProps) {
    return (<PopoverSelectField label={label} value={value} onChange={onChange} options={options.map((option) => ({ value: option, label: option }))} showSearch={showSearch}/>);
}
const parseTrailerYear = (value: string): number | null => {
    const digits = value.replace(/[^\d]/g, "");
    if (!digits)
        return null;
    const parsed = parseInt(digits, 10);
    if (!Number.isFinite(parsed) || parsed < 1900 || parsed > 2100)
        return null;
    return parsed;
};
const buildTrailerFormData = (record: TruckRecord): TrailerFormData => {
    const metadata = extractTrailerMetadata(record);
    const columnMake = (record.make || "").trim();
    const columnModel = (record.model || "").trim();
    const makeModelFromColumns = [columnMake, columnModel].filter(Boolean).join(" ");
    const formattedMetadata = formatMakeModel(metadata);
    const makeModel = makeModelFromColumns || (formattedMetadata === "—" ? "" : formattedMetadata);
    return {
        vin: (record.vin || "").trim(),
        plate_number: metadata.plateNumber,
        make_model: makeModel === "—" ? "" : makeModel,
        year: record.year != null && Number.isFinite(record.year)
            ? String(record.year)
            : metadata.year,
        ownership_type: metadata.ownershipType,
    };
};
type TrailerOption = {
    key: string;
    label: string;
    trailer_number: string;
    equipment_type: string;
};
const TRUCK_STATUS_STYLES: Record<string, string> = {
    AVAILABLE: "bg-zinc-100 text-zinc-600 border border-zinc-200/80 dark:bg-zinc-900/40 dark:text-zinc-400 dark:border-zinc-800/40",
    LOADED: "bg-emerald-50 text-emerald-700 border border-emerald-200/80 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-900/40",
    MAINTENANCE: "bg-amber-50 text-amber-700 border border-amber-200/80 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-900/40",
    "OUT OF SERVICE": "bg-red-50 text-red-700 border border-red-200/80 dark:bg-red-950/40 dark:text-red-400 dark:border-red-900/40",
};
const WORKSPACE_SECTION_TITLE_CLASS = "text-zinc-500 dark:text-zinc-400 font-semibold text-xs";
const WORKSPACE_LOADS_PAGE_SIZE = 8;
const WORKSPACE_FIELD_LABEL_CLASS = "text-zinc-500 dark:text-zinc-400 font-semibold text-xs";
const WORKSPACE_FIELD_VALUE_CLASS = "text-zinc-900 dark:text-zinc-100 font-medium";
const WORKSPACE_LOAD_CARD_CLASS = "bg-zinc-500/5 dark:bg-zinc-900/30 border border-zinc-200/80 dark:border-zinc-800/50 rounded-xl p-4 flex items-center justify-between hover:border-zinc-300 dark:hover:border-zinc-700/80 transition-all shrink-0 w-full";
const WORKSPACE_LOAD_ID_CLASS = "text-zinc-900 dark:text-zinc-100 font-medium text-sm";
const WORKSPACE_LOAD_ROUTE_CLASS = "text-zinc-500 dark:text-zinc-400 text-xs";
const WORKSPACE_LOAD_PAYOUT_CLASS = "text-emerald-600 dark:text-emerald-500 font-semibold text-right";
const WORKSPACE_INPUT_CLASS = "w-full rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50 px-3 py-1.5 text-sm text-zinc-900 dark:text-white outline-none focus:border-zinc-400 dark:focus:border-zinc-600 transition-colors";
const formatLoadStatus = (status: string) => status
    .trim()
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
const normalizeTruckStatus = (status?: string | null) => {
    const raw = (status || "").trim().toLowerCase().replace(/_/g, " ");
    if (raw === "waiting" || raw === "available")
        return "AVAILABLE";
    if (raw === "loaded" || raw === "dispatched")
        return "LOADED";
    if (raw === "maintenance")
        return "MAINTENANCE";
    if (raw === "out of service")
        return "OUT OF SERVICE";
    return status?.toUpperCase() || "AVAILABLE";
};
const truckStatusClass = (status?: string | null) => TRUCK_STATUS_STYLES[normalizeTruckStatus(status)] || TRUCK_STATUS_STYLES.AVAILABLE;
const isActiveDriver = (driver: DriverRecord, truck: TruckRecord | null) => {
    if (!truck)
        return false;
    return driver.id === truck.driver_id || driver.id === truck.co_driver_id;
};
const isEligibleDriver = (driver: DriverRecord, truck: TruckRecord | null) => {
    const status = (driver.status || "AVAILABLE").toUpperCase();
    if (status === "INACTIVE")
        return isActiveDriver(driver, truck);
    return status === "AVAILABLE" || status === "ASSIGNED" || isActiveDriver(driver, truck);
};
const formatDriverOptionLabel = (driver: DriverRecord) => `${driver.driver_name}${driver.status ? ` (${driver.status})` : ""}`;
const appendSelectedDriverOption = (options: PopoverSelectOption[], selectedId: string, drivers: DriverRecord[]): PopoverSelectOption[] => {
    if (!selectedId || options.some((option) => option.value === selectedId)) {
        return options;
    }
    const driver = drivers.find((record) => String(record.id) === selectedId);
    if (!driver)
        return options;
    return [...options, { value: selectedId, label: formatDriverOptionLabel(driver) }];
};
const isStandaloneTrailer = (record: TruckRecord) => (record.asset_type || "truck").toLowerCase() === "standalone_trailer";
const normalizeTrailerNumberForMatch = (value?: string | null) => String(value || "")
    .trim()
    .toUpperCase();
const resolveLoadTrailerAssetId = (load: LoadRecord, fleet: TruckRecord[]): number | null => {
    if (load.trailer_id != null)
        return load.trailer_id;
    const assignedTruck = fleet.find((unit) => unit.id === load.truck_id);
    const trailerNumber = load.trailer_number?.trim() || assignedTruck?.trailer_number?.trim();
    if (!trailerNumber || normalizeTrailerNumberForMatch(trailerNumber) === "N/A") {
        return null;
    }
    const normalized = normalizeTrailerNumberForMatch(trailerNumber);
    const standalone = fleet.find((unit) => isStandaloneTrailer(unit) &&
        normalizeTrailerNumberForMatch(unit.trailer_number) === normalized);
    if (standalone)
        return standalone.id;
    const host = fleet.find((unit) => normalizeTrailerNumberForMatch(unit.trailer_number) === normalized);
    return host?.id ?? null;
};
const loadMatchesAsset = (load: LoadRecord, asset: TruckRecord, fleet: TruckRecord[], trailerContext: boolean) => {
    if (trailerContext) {
        if (load.trailer_id != null)
            return load.trailer_id === asset.id;
        return resolveLoadTrailerAssetId(load, fleet) === asset.id;
    }
    return load.truck_id === asset.id;
};
const formatAssignedTruckRef = (truckNumber?: string | null) => {
    const trimmed = (truckNumber || "").trim().replace(/^#/, "");
    return trimmed ? `#${trimmed}` : "";
};
const buildTruckUpdatePayload = (record: TruckRecord, customFields: Record<string, string>, trailerNumber?: string, year?: number | null) => ({
    truck_number: record.truck_number,
    trailer_number: trailerNumber ?? record.trailer_number ?? "N/A",
    vin: record.vin ?? null,
    year: year ?? record.year ?? null,
    equipment_type: record.equipment_type || "Dry Van",
    driver_id: record.driver_id ?? null,
    co_driver_id: record.co_driver_id ?? null,
    custom_fields: customFields,
});
export default function TruckDetailModal({ token, truck, drivers, trucks, loads = [], onClose, onOpenDriver, onOpenTrailer, onSuccess, onRemoveLoad, bare = false, workspaceLayout = false, }: TruckDetailModalProps) {
    const tmsApi = useMemo(() => createTmsApi(createApiClient(token)), [token]);
    const [saving, setSaving] = useState(false);
    const [driverId, setDriverId] = useState("");
    const [coDriverId, setCoDriverId] = useState("");
    const [trailerKey, setTrailerKey] = useState("");
    const [vin, setVin] = useState("");
    const [plateNumber, setPlateNumber] = useState("");
    const [makeModel, setMakeModel] = useState("");
    const [mileage, setMileage] = useState("");
    const [ownershipType, setOwnershipType] = useState("Company");
    const [formData, setFormData] = useState<TrailerFormData>(EMPTY_TRAILER_FORM);
    const [activeTab, setActiveTab] = useState<EntityDetailTabId>("main");
    const [docNotes, setDocNotes] = useState<Record<string, string>>({});
    const [documentType, setDocumentType] = useState<string>("");
    const [customFolderName, setCustomFolderName] = useState("");
    const [uploadingDocument, setUploadingDocument] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [loadSearchQuery, setLoadSearchQuery] = useState("");
    const [loadsPage, setLoadsPage] = useState(1);
    const [assignedLoads, setAssignedLoads] = useState<LoadRecord[]>([]);
    const isTrailer = isStandaloneTrailer(truck ?? ({} as TruckRecord));
    const assetEntityType: AssetEntityType = isTrailer ? "TRAILER" : "TRUCK";
    const { documents: assetDocuments, isInitialLoading: loadingDocuments, refreshDocuments, deleteDocument } = useAssetDocumentsQuery(truck?.id, assetEntityType, token, tmsApi);
    const { folders: customFolders, createFolder, deleteFolder } = useEntityCustomFolders(assetEntityType, truck?.id, token, tmsApi);
    const documentTypeOptions = useMemo(() => baselineCategoriesForEntity(assetEntityType), [assetEntityType]);
    const deletableFolderMap = useMemo(() => {
        const map: Record<string, number> = {};
        for (const folder of customFolders) {
            map[folder.folder_name] = folder.id;
        }
        return map;
    }, [customFolders]);
    const trailerMetadata = useMemo(() => (truck ? extractTrailerMetadata(truck) : null), [truck]);
    const trailerOptions = useMemo<TrailerOption[]>(() => {
        const seen = new Set<string>();
        const options = trucks
            .filter((t) => t.trailer_number && t.trailer_number !== "N/A")
            .reduce<TrailerOption[]>((acc, t) => {
            const equipment = t.equipment_type || "Dry Van";
            const key = `${equipment}::${t.trailer_number}`;
            if (seen.has(key))
                return acc;
            seen.add(key);
            acc.push({
                key,
                label: `${equipment} - Trailer# ${t.trailer_number}`,
                trailer_number: t.trailer_number!,
                equipment_type: equipment,
            });
            return acc;
        }, []);
        if (truck?.trailer_number &&
            truck.trailer_number !== "N/A" &&
            !options.some((option) => option.trailer_number === truck.trailer_number)) {
            const equipment = truck.equipment_type || "Dry Van";
            options.unshift({
                key: `${equipment}::${truck.trailer_number}`,
                label: `${equipment} - Trailer# ${truck.trailer_number}`,
                trailer_number: truck.trailer_number,
                equipment_type: equipment,
            });
        }
        return options;
    }, [trucks, truck]);
    const eligibleDrivers = useMemo(() => drivers.filter((driver) => isEligibleDriver(driver, truck)), [drivers, truck]);
    const primaryDriverOptions = useMemo(() => {
        const options: PopoverSelectOption[] = [{ value: "", label: "None / Solo Pool" }];
        for (const driver of eligibleDrivers) {
            if (String(driver.id) === coDriverId)
                continue;
            options.push({
                value: String(driver.id),
                label: formatDriverOptionLabel(driver),
            });
        }
        return options;
    }, [coDriverId, eligibleDrivers]);
    const coDriverOptions = useMemo(() => {
        const options: PopoverSelectOption[] = [{ value: "", label: "None / Solo" }];
        for (const driver of eligibleDrivers) {
            if (String(driver.id) === driverId)
                continue;
            options.push({
                value: String(driver.id),
                label: formatDriverOptionLabel(driver),
            });
        }
        return options;
    }, [driverId, eligibleDrivers]);
    const assignedTrailerOptions = useMemo(() => [
        { value: "", label: "No trailer selected" },
        ...trailerOptions.map((option) => ({
            value: option.key,
            label: option.label,
        })),
    ], [trailerOptions]);
    const displayTrailerNumber = useMemo(() => {
        if (!truck)
            return "Bobtail";
        if (trailerKey === "")
            return "Bobtail";
        return (trailerOptions.find((option) => option.key === trailerKey)?.trailer_number ||
            truck.trailer_number ||
            "Bobtail");
    }, [trailerKey, trailerOptions, truck]);
    const linkedTrailerRecord = useMemo(() => {
        if (!truck)
            return null;
        if (isTrailer)
            return truck;
        if (displayTrailerNumber === "Bobtail")
            return null;
        const normalized = displayTrailerNumber.trim().toLowerCase();
        return (trucks.find((unit) => {
            if (!isStandaloneTrailer(unit))
                return false;
            return String(unit.trailer_number || "").trim().toLowerCase() === normalized;
        }) ?? null);
    }, [displayTrailerNumber, isTrailer, truck, trucks]);
    const linkedPowerUnit = useMemo(() => {
        if (!truck || !isTrailer)
            return null;
        return findPowerUnitForTrailer(trucks, truck.trailer_number);
    }, [isTrailer, truck, trucks]);
    const assignedTruckDisplay = useMemo(() => {
        if (!truck || !isTrailer || !trailerMetadata) {
            return { text: "None", isUnassigned: true };
        }
        return resolveAssignedTruckDisplay(truck, trailerMetadata, trucks);
    }, [isTrailer, trailerMetadata, truck, trucks]);
    const assignmentPrimaryDriverId = useMemo(() => {
        if (isTrailer && linkedPowerUnit?.driver_id)
            return String(linkedPowerUnit.driver_id);
        return driverId;
    }, [driverId, isTrailer, linkedPowerUnit]);
    const assignmentCoDriverId = useMemo(() => {
        if (isTrailer && linkedPowerUnit?.co_driver_id)
            return String(linkedPowerUnit.co_driver_id);
        return coDriverId;
    }, [coDriverId, isTrailer, linkedPowerUnit]);
    const assignmentPrimaryDriver = useMemo(() => assignmentPrimaryDriverId
        ? drivers.find((driver) => String(driver.id) === assignmentPrimaryDriverId) ?? null
        : null, [assignmentPrimaryDriverId, drivers]);
    const assignmentCoDriver = useMemo(() => assignmentCoDriverId
        ? drivers.find((driver) => String(driver.id) === assignmentCoDriverId) ?? null
        : null, [assignmentCoDriverId, drivers]);
    const workspacePrimaryDriverOptions = useMemo(() => appendSelectedDriverOption(primaryDriverOptions, assignmentPrimaryDriverId, drivers), [assignmentPrimaryDriverId, drivers, primaryDriverOptions]);
    const workspaceCoDriverOptions = useMemo(() => appendSelectedDriverOption(coDriverOptions, assignmentCoDriverId, drivers), [assignmentCoDriverId, coDriverOptions, drivers]);
    const truckLoads = useMemo(() => {
        if (!truck)
            return [];
        return loads.filter((load) => loadMatchesAsset(load, truck, trucks, isTrailer));
    }, [isTrailer, loads, truck, trucks]);
    useEffect(() => {
        if (!isEditing) {
            setAssignedLoads(truckLoads);
        }
    }, [truckLoads, isEditing]);
    const handleRemoveLoad = (loadId: string) => {
        setAssignedLoads((prev) => prev.filter((item) => String(item.id) !== loadId));
        onRemoveLoad?.(loadId);
    };
    const filteredTruckLoads = useMemo(() => {
        const query = loadSearchQuery.trim().toLowerCase();
        if (!query)
            return assignedLoads;
        return assignedLoads.filter((load) => {
            const haystack = [
                load.broker_load_id || `L-${load.id}`,
                load.origin,
                load.destination,
                load.status,
            ]
                .filter(Boolean)
                .join(" ")
                .toLowerCase();
            return haystack.includes(query);
        });
    }, [assignedLoads, loadSearchQuery]);
    const loadsTotalPages = Math.max(1, Math.ceil(filteredTruckLoads.length / WORKSPACE_LOADS_PAGE_SIZE));
    const paginatedTruckLoads = useMemo(() => {
        const start = (loadsPage - 1) * WORKSPACE_LOADS_PAGE_SIZE;
        return filteredTruckLoads.slice(start, start + WORKSPACE_LOADS_PAGE_SIZE);
    }, [filteredTruckLoads, loadsPage]);
    useEffect(() => {
        setLoadsPage(1);
    }, [loadSearchQuery, truck?.id]);
    const syncFormFromTruck = useCallback(() => {
        if (!truck)
            return;
        setDriverId(truck.driver_id ? String(truck.driver_id) : "");
        setCoDriverId(truck.co_driver_id ? String(truck.co_driver_id) : "");
        if (isStandaloneTrailer(truck)) {
            setFormData(buildTrailerFormData(truck));
            setVin("");
            setPlateNumber("");
            setMakeModel("");
            setMileage("");
        }
        else {
            const metadata = readTruckMetadata(truck);
            setVin(metadata.vin);
            setPlateNumber(metadata.plate_number);
            setMakeModel(metadata.make_model);
            setMileage(metadata.mileage);
            setOwnershipType(normalizeOwnershipType(truck.custom_fields?.["Ownership Type"] ||
                truck.custom_fields?.ownership_type ||
                "Company"));
            setFormData(EMPTY_TRAILER_FORM);
        }
        const hasTrailer = truck.trailer_number && truck.trailer_number !== "N/A" && truck.trailer_number.trim() !== "";
        if (!hasTrailer) {
            setTrailerKey("");
            return;
        }
        const currentTrailerKey = trailerOptions.find((option) => option.trailer_number === truck.trailer_number)?.key;
        setTrailerKey(currentTrailerKey || "");
    }, [truck, trailerOptions]);
    useEffect(() => {
        syncFormFromTruck();
    }, [syncFormFromTruck]);
    useEffect(() => {
        if (!truck)
            return;
        setActiveTab("main");
        setDocNotes({});
        setIsEditing(false);
        setLoadSearchQuery("");
        setLoadsPage(1);
    }, [truck?.id]);
    useEffect(() => {
        const baseline = baselineCategoriesForEntity(assetEntityType);
        const customNames = customFolders.map((folder) => folder.folder_name);
        setDocumentType((current) => current && (baseline.includes(current) || customNames.includes(current))
            ? current
            : baseline[0] || "");
    }, [assetEntityType, customFolders]);
    useEffect(() => {
        if (assetDocuments.length === 0)
            return;
        setDocNotes(buildDocumentNotesMap(assetDocuments));
    }, [assetDocuments, truck?.id]);
    const taskFileRows = useMemo(() => {
        const rows = buildDocumentRowsFromRecords(assetDocuments, docNotes);
        if (trailerMetadata?.notes?.trim()) {
            rows.unshift({
                id: "asset-notes",
                fileName: "Dispatcher Notes",
                folderName: "Asset Notes",
                issueDate: null,
                expirationDate: null,
                uploadedDate: null,
                status: "on_file",
                statusLabel: "On File",
                notes: trailerMetadata.notes,
                isTask: true,
            });
        }
        return rows;
    }, [assetDocuments, docNotes, trailerMetadata?.notes]);
    const handleDocumentUpload = async (file: File) => {
        if (!isAllowedAssetDocumentFile(file)) {
            toast.error("Invalid file type. Only PDFs and images are accepted.");
            return;
        }
        const uploadTarget = resolveAssetUploadTarget(assetEntityType, truck);
        if (!uploadTarget) {
            toast.error("Unable to upload: asset record is unavailable.");
            return;
        }
        const resolvedType = resolveUploadDocumentType(documentType, customFolderName);
        if (!resolvedType) {
            toast.error("Enter a folder name before uploading.");
            return;
        }
        setUploadingDocument(true);
        const toastId = toast.loading("Uploading document...");
        try {
            if (documentType === CUSTOM_FOLDER_OPTION) {
                await createFolder(resolvedType);
            }
            await tmsApi.assets.uploadDocument(assetEntityType === "TRAILER" ? "TRAILER" : "TRUCK", uploadTarget.assetId, file, resolvedType);
            await refreshDocuments();
            toast.success("Document uploaded successfully.", { id: toastId });
        }
        catch (err: unknown) {
            const detail = err && typeof err === "object" && "response" in err
                ? (err as {
                    response?: {
                        data?: {
                            detail?: string;
                        };
                    };
                }).response?.data?.detail
                : null;
            toast.error(typeof detail === "string" ? detail : "Failed to upload document.", {
                id: toastId,
            });
        }
        finally {
            setUploadingDocument(false);
        }
    };
    const handleDeleteCustomFolder = async (folderId: number, folderName?: string) => {
        try {
            await deleteFolder(folderId);
            await refreshDocuments();
            if (folderName && documentType === folderName) {
                setDocumentType(documentTypeOptions[0] || "");
            }
            toast.success("Custom folder removed.");
        }
        catch {
            toast.error("Failed to delete custom folder.");
        }
    };
    const handleDeleteDocument = async (documentId: number) => {
        try {
            await deleteDocument(documentId);
            setDocNotes((prev) => {
                const next = { ...prev };
                delete next[String(documentId)];
                return next;
            });
            toast.success("Document deleted.");
        }
        catch (err: unknown) {
            const detail = err && typeof err === "object" && "response" in err
                ? (err as {
                    response?: {
                        data?: {
                            detail?: string;
                        };
                    };
                }).response?.data?.detail
                : null;
            toast.error(typeof detail === "string" ? detail : "Failed to delete document.");
        }
    };
    const handleNotesBlur = async (id: string | number, notes: string) => {
        const documentId = typeof id === "number" ? id : parseInt(String(id), 10);
        if (Number.isNaN(documentId))
            return;
        try {
            await tmsApi.documents.updateNotes(documentId, notes);
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
            toast.error(message || "Failed to save note.");
        }
    };
    const handleBeginEdit = () => {
        syncFormFromTruck();
        setAssignedLoads(truckLoads);
        setIsEditing(true);
    };
    const handleCancelEdit = () => {
        syncFormFromTruck();
        setAssignedLoads(truckLoads);
        setIsEditing(false);
    };
    const persistRemovedLoads = async () => {
        const removedLoads = truckLoads.filter((load) => !assignedLoads.some((item) => item.id === load.id));
        if (removedLoads.length === 0)
            return;
        await Promise.all(removedLoads.map((load) => tmsApi.loads.patch(load.id, { truck_id: null })));
    };
    const handleSave = async () => {
        if (!truck)
            return;
        if (isTrailer) {
            setSaving(true);
            const toastId = toast.loading("Saving asset details...");
            try {
                const yearValue = parseTrailerYear(formData.year);
                const { make, model } = splitMakeModel(formData.make_model);
                const customFields = mergeTrailerMetadataIntoCustomFields(truck.custom_fields || {}, {
                    year: yearValue != null ? String(yearValue) : "",
                    plateNumber: formData.plate_number.trim(),
                    ownershipType: normalizeOwnershipType(formData.ownership_type),
                });
                delete customFields.make;
                delete customFields.model;
                delete customFields.Make;
                delete customFields.Model;
                delete customFields["Make / Model"];
                delete customFields.Mileage;
                delete customFields.mileage;
                delete customFields.Odometer;
                await tmsApi.fleet.updateTruck(truck.id, {
                    truck_number: truck.truck_number ?? null,
                    trailer_number: truck.trailer_number || "N/A",
                    vin: formData.vin.trim() || null,
                    year: yearValue,
                    make: make || null,
                    model: model || null,
                    equipment_type: truck.equipment_type || "Dry Van",
                    driver_id: null,
                    co_driver_id: null,
                    custom_fields: customFields,
                });
                if (workspaceLayout) {
                    await persistRemovedLoads();
                }
                await onSuccess();
                toast.success("Asset details saved successfully.", { id: toastId });
                if (workspaceLayout)
                    setIsEditing(false);
                if (!workspaceLayout)
                    onClose();
            }
            catch (err: unknown) {
                const detail = err && typeof err === "object" && "response" in err
                    ? (err as {
                        response?: {
                            data?: {
                                detail?: string;
                            };
                        };
                    }).response?.data?.detail
                    : null;
                toast.error(typeof detail === "string" ? detail : "Failed to update asset details.", {
                    id: toastId,
                });
            }
            finally {
                setSaving(false);
            }
            return;
        }
        if (driverId && coDriverId && driverId === coDriverId) {
            toast.error("Primary driver and co-driver must be different.");
            return;
        }
        const selectedTrailer = trailerKey
            ? trailerOptions.find((option) => option.key === trailerKey)
            : null;
        const trailerNumber = selectedTrailer ? selectedTrailer.trailer_number : "N/A";
        const equipmentType = selectedTrailer?.equipment_type || truck.equipment_type || "Dry Van";
        const previousTrailerNumber = truck.trailer_number;
        setSaving(true);
        const toastId = toast.loading("Saving asset details...");
        try {
            const { make, model } = splitMakeModel(makeModel);
            await tmsApi.fleet.updateTruck(truck.id, {
                truck_number: truck.truck_number,
                trailer_number: trailerNumber,
                vin: vin.trim(),
                make: make || null,
                model: model || null,
                equipment_type: equipmentType,
                driver_id: driverId ? parseInt(driverId, 10) : null,
                co_driver_id: coDriverId ? parseInt(coDriverId, 10) : null,
                custom_fields: {
                    ...buildMetadataCustomFields(truck.custom_fields || {}, plateNumber, mileage),
                    "Ownership Type": ownershipType,
                    ownership_type: ownershipType,
                },
            });
            const syncStandaloneAssignment = async (standaloneTrailerNumber: string, assignedTruckRef: string) => {
                const standalone = trucks.find((record) => isStandaloneTrailer(record) && record.trailer_number === standaloneTrailerNumber);
                if (!standalone)
                    return;
                await tmsApi.fleet.updateTruck(standalone.id, buildTruckUpdatePayload(standalone, mergeTrailerMetadataIntoCustomFields(standalone.custom_fields, {
                    assignedTruck: assignedTruckRef,
                })));
            };
            if (previousTrailerNumber &&
                previousTrailerNumber !== "N/A" &&
                previousTrailerNumber !== trailerNumber) {
                await syncStandaloneAssignment(previousTrailerNumber, "");
            }
            if (trailerNumber !== "N/A") {
                await syncStandaloneAssignment(trailerNumber, formatAssignedTruckRef(truck.truck_number));
            }
            else if (previousTrailerNumber && previousTrailerNumber !== "N/A") {
                await syncStandaloneAssignment(previousTrailerNumber, "");
            }
            if (workspaceLayout) {
                await persistRemovedLoads();
            }
            await onSuccess();
            toast.success("Asset details saved successfully.", { id: toastId });
            if (workspaceLayout)
                setIsEditing(false);
            if (!workspaceLayout)
                onClose();
        }
        catch (err: unknown) {
            const detail = err && typeof err === "object" && "response" in err
                ? (err as {
                    response?: {
                        data?: {
                            detail?: string;
                        };
                    };
                }).response?.data?.detail
                : null;
            toast.error(typeof detail === "string" ? detail : "Failed to update asset details.", {
                id: toastId,
            });
        }
        finally {
            setSaving(false);
        }
    };
    if (!truck)
        return null;
    const statusLabel = normalizeTruckStatus(truck.status);
    const statusBadgeClass = truckStatusClass(truck.status);
    const formatLoadCurrency = (value: number) => value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const resolveLoadLabel = (load: LoadRecord) => load.broker_load_id || `L-${load.id}`;
    if (workspaceLayout && bare) {
        return (<div className="flex flex-col flex-1 min-h-0 w-full animate-in fade-in duration-200" aria-label="Truck profile workspace">
        <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 md:p-6 lg:p-8">
          <div className="mx-auto w-full max-w-[1600px] flex flex-col gap-6">
            <div className="flex items-center justify-between w-full min-h-12 gap-4">
              <div className="flex items-center gap-3 min-w-0">
                <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 truncate">
                  {isTrailer ? `Trailer ${truck.trailer_number || "N/A"}` : `Truck #${truck.truck_number}`}
                </h1>
                <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider select-none shrink-0 ${statusBadgeClass}`}>
                  {statusLabel}
                </span>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                {isEditing ? (<>
                    <button type="button" disabled={saving} onClick={handleCancelEdit} className="px-4 py-2 text-sm font-medium text-zinc-700 bg-zinc-100 hover:bg-zinc-200 dark:text-zinc-300 dark:bg-zinc-800 dark:hover:bg-zinc-700 rounded-lg transition-colors disabled:opacity-50">
                      Cancel
                    </button>
                    <button type="button" disabled={saving} onClick={() => void handleSave()} className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-4 py-1.5 rounded-lg text-sm transition-colors disabled:opacity-50">
                      {saving ? "Saving..." : "Save"}
                    </button>
                  </>) : (<button type="button" onClick={handleBeginEdit} className="border border-zinc-200 dark:border-zinc-800 text-xs px-3 py-1.5 rounded-lg flex items-center gap-1.5 font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors">
                    <Pencil className="w-3.5 h-3.5 shrink-0" aria-hidden/>
                    Edit
                  </button>)}
                <button type="button" onClick={onClose} className="p-2 text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 rounded-lg transition-colors" aria-label="Close truck profile">
                  <X size={20}/>
                </button>
              </div>
            </div>

            <div className={`mt-6 ${WORKSPACE_PANEL_SHELL}`}>
              <div className="xl:col-span-1 flex flex-col">
                <section>
                  <p className={`${WORKSPACE_SECTION_TITLE_CLASS} mb-3`}>Assignment Controls</p>
                  <div className="flex flex-col gap-4">
                    <PopoverSelectField label="Primary Driver" labelClassName={ASSIGNMENT_FIELD_LABEL_CLASS} value={assignmentPrimaryDriverId} onChange={setDriverId} options={workspacePrimaryDriverOptions} disabled={!isEditing || isTrailer}/>
                    <PopoverSelectField label="Co-Driver" labelClassName={ASSIGNMENT_FIELD_LABEL_CLASS} value={assignmentCoDriverId} onChange={setCoDriverId} options={workspaceCoDriverOptions} disabled={!isEditing || isTrailer}/>
                    {isTrailer ? (<div className="flex flex-col gap-1 min-w-0">
                        <label className={ASSIGNMENT_FIELD_LABEL_CLASS}>Assigned Truck</label>
                        <ProfileFieldValue value={assignedTruckDisplay.isUnassigned ? null : assignedTruckDisplay.text} fallback="None" className={WORKSPACE_FIELD_VALUE_CLASS}/>
                      </div>) : (<PopoverSelectField label="Assigned Trailer" labelClassName={ASSIGNMENT_FIELD_LABEL_CLASS} value={trailerKey} onChange={setTrailerKey} options={assignedTrailerOptions} disabled={!isEditing}/>)}
                  </div>
                </section>

                <section className={WORKSPACE_INNER_SECTION_DIVIDER}>
                  <p className={`${WORKSPACE_SECTION_TITLE_CLASS} mb-4`}>
                    {isTrailer ? "Trailer Metadata" : "Asset Metadata"}
                  </p>
                  <div className="grid grid-cols-2 gap-x-6 gap-y-4 text-sm">
                    {isTrailer ? (<>
                        <div className="flex flex-col gap-1 min-w-0">
                          <label className={WORKSPACE_FIELD_LABEL_CLASS}>VIN</label>
                          {isEditing ? (<input type="text" value={formData.vin} onChange={(event) => setFormData((prev) => ({
                        ...prev,
                        vin: sanitizeVinInput(event.target.value),
                    }))} maxLength={17} className={`${WORKSPACE_INPUT_CLASS} font-mono uppercase`}/>) : (<ProfileFieldValue value={formData.vin} fallback="None" className={WORKSPACE_FIELD_VALUE_CLASS}/>)}
                        </div>
                        <div className="flex flex-col gap-1 min-w-0">
                          <label className={WORKSPACE_FIELD_LABEL_CLASS}>Plate Number</label>
                          {isEditing ? (<input type="text" value={formData.plate_number} onChange={(event) => setFormData((prev) => ({
                        ...prev,
                        plate_number: sanitizePlateNumberInput(event.target.value),
                    }))} className={`${WORKSPACE_INPUT_CLASS} uppercase`}/>) : (<ProfileFieldValue value={formData.plate_number} fallback="None" className={WORKSPACE_FIELD_VALUE_CLASS}/>)}
                        </div>
                        <div className="flex flex-col gap-1 min-w-0">
                          <label className={WORKSPACE_FIELD_LABEL_CLASS}>Make / Model</label>
                          {isEditing ? (<input type="text" value={formData.make_model} onChange={(event) => setFormData((prev) => ({ ...prev, make_model: event.target.value }))} onBlur={() => setFormData((prev) => ({
                        ...prev,
                        make_model: sanitizeMakeModelTitleCase(prev.make_model),
                    }))} className={WORKSPACE_INPUT_CLASS}/>) : (<ProfileFieldValue value={formData.make_model} fallback="None" className={WORKSPACE_FIELD_VALUE_CLASS}/>)}
                        </div>
                        <div className="flex flex-col gap-1 min-w-0">
                          <label className={WORKSPACE_FIELD_LABEL_CLASS}>Year</label>
                          {isEditing ? (<input type="text" inputMode="numeric" maxLength={4} value={formData.year || ""} onChange={(event) => setFormData((prev) => ({
                        ...prev,
                        year: event.target.value.replace(/[^\d]/g, "").slice(0, 4),
                    }))} className={WORKSPACE_INPUT_CLASS}/>) : (<ProfileFieldValue value={formData.year} fallback="None" className={WORKSPACE_FIELD_VALUE_CLASS}/>)}
                        </div>
                      </>) : (<>
                        <div className="flex flex-col gap-1 min-w-0">
                          <label className={WORKSPACE_FIELD_LABEL_CLASS}>VIN</label>
                          {isEditing ? (<input type="text" value={vin} onChange={(event) => setVin(sanitizeVinInput(event.target.value))} maxLength={17} className={`${WORKSPACE_INPUT_CLASS} font-mono uppercase`}/>) : (<ProfileFieldValue value={vin} fallback="None" className={WORKSPACE_FIELD_VALUE_CLASS}/>)}
                        </div>
                        <div className="flex flex-col gap-1 min-w-0">
                          <label className={WORKSPACE_FIELD_LABEL_CLASS}>Plate Number</label>
                          {isEditing ? (<input type="text" value={plateNumber} onChange={(event) => setPlateNumber(sanitizePlateNumberInput(event.target.value))} className={`${WORKSPACE_INPUT_CLASS} uppercase`}/>) : (<ProfileFieldValue value={plateNumber} fallback="None" className={WORKSPACE_FIELD_VALUE_CLASS}/>)}
                        </div>
                        <div className="flex flex-col gap-1 min-w-0">
                          <label className={WORKSPACE_FIELD_LABEL_CLASS}>Make / Model</label>
                          {isEditing ? (<input type="text" value={makeModel} onChange={(event) => setMakeModel(event.target.value)} onBlur={() => setMakeModel((current) => sanitizeMakeModelTitleCase(current))} className={WORKSPACE_INPUT_CLASS}/>) : (<ProfileFieldValue value={makeModel} fallback="None" className={WORKSPACE_FIELD_VALUE_CLASS}/>)}
                        </div>
                        <div className="flex flex-col gap-1 min-w-0">
                          <label className={WORKSPACE_FIELD_LABEL_CLASS}>Mileage</label>
                          {isEditing ? (<input type="text" inputMode="numeric" value={mileage} onChange={(event) => setMileage(event.target.value.replace(/[^\d]/g, ""))} className={WORKSPACE_INPUT_CLASS}/>) : (<ProfileFieldValue value={mileage} fallback="None" className={WORKSPACE_FIELD_VALUE_CLASS}/>)}
                        </div>
                      </>)}
                    {!isTrailer ? (<>
                        <div className="flex flex-col gap-1 min-w-0">
                          <label className={WORKSPACE_FIELD_LABEL_CLASS}>Equipment Type</label>
                          <ProfileFieldValue value={truck.equipment_type} fallback="None" className={WORKSPACE_FIELD_VALUE_CLASS}/>
                        </div>
                        <div className="flex flex-col gap-1 min-w-0">
                          <label className={WORKSPACE_FIELD_LABEL_CLASS}>Current Trailer #</label>
                          {linkedTrailerRecord && onOpenTrailer ? (<ProfileEntityLink label={displayTrailerNumber} onClick={() => onOpenTrailer(linkedTrailerRecord.id)}/>) : (<ProfileFieldValue value={displayTrailerNumber === "Bobtail" ? null : displayTrailerNumber} fallback="None" className={WORKSPACE_FIELD_VALUE_CLASS}/>)}
                        </div>
                      </>) : (<div className="flex flex-col gap-1 min-w-0">
                        <label className={WORKSPACE_FIELD_LABEL_CLASS}>Trailer Status</label>
                        <ProfileFieldValue value={trailerMetadata?.trailerStatus} fallback="Not Set" className={WORKSPACE_FIELD_VALUE_CLASS}/>
                      </div>)}
                  </div>
                </section>

                <section className={WORKSPACE_INNER_SECTION_DIVIDER}>
                  <p className={`${WORKSPACE_SECTION_TITLE_CLASS} mb-4`}>Classification</p>
                  {isTrailer ? (<PopoverSelectField label="Ownership Type" labelClassName={WORKSPACE_FIELD_LABEL_CLASS} value={formData.ownership_type} onChange={(value) => setFormData((prev) => ({ ...prev, ownership_type: value }))} options={TRAILER_OWNERSHIP_TYPES.map((option) => ({
                    value: option,
                    label: option,
                }))} showSearch={false} disabled={!isEditing}/>) : (<PopoverSelectField label="Ownership Type" labelClassName={WORKSPACE_FIELD_LABEL_CLASS} value={ownershipType} onChange={setOwnershipType} options={TRAILER_OWNERSHIP_TYPES.map((option) => ({
                    value: option,
                    label: option,
                }))} showSearch={false} disabled={!isEditing}/>)}
                </section>
              </div>

              <div className={`xl:col-span-2 flex flex-col min-h-[600px] pt-6 mt-6 border-t ${WORKSPACE_COLUMN_DIVIDER_CLASS} xl:mt-0 xl:pt-0 xl:border-t-0 xl:border-l xl:pl-6`}>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 w-full shrink-0 mb-6">
                  <p className={WORKSPACE_SECTION_TITLE_CLASS}>
                    Active &amp; Historic Loads ({filteredTruckLoads.length})
                  </p>
                  <div className="relative w-full sm:w-60">
                    <Search size={16} className="absolute left-2.5 top-2.5 text-zinc-400 pointer-events-none" aria-hidden/>
                    <input type="search" placeholder="Filter loads..." value={loadSearchQuery} onChange={(event) => setLoadSearchQuery(event.target.value)} aria-label="Filter truck loads" className="h-9 w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 pl-9 text-sm text-zinc-900 dark:text-white outline-none placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:border-zinc-400 dark:focus:border-zinc-600 transition-colors"/>
                  </div>
                </div>

                <div className="flex-1 flex flex-col gap-3 mb-4 min-h-0">
                  {assignedLoads.length === 0 ? (<div className="flex-1 flex items-center justify-center border border-dashed border-zinc-200 dark:border-zinc-800 rounded-xl text-sm text-zinc-700 dark:text-zinc-300">
                      No loads assigned to this unit yet.
                    </div>) : filteredTruckLoads.length === 0 ? (<div className="flex-1 flex items-center justify-center border border-dashed border-zinc-200 dark:border-zinc-800 rounded-xl text-sm text-zinc-700 dark:text-zinc-300">
                      No loads match your search.
                    </div>) : (paginatedTruckLoads.map((load) => (<div key={load.id} className={WORKSPACE_LOAD_CARD_CLASS}>
                        <div className="flex flex-col gap-1.5 min-w-0 flex-1 pr-4">
                          <div className="flex items-center gap-2 min-w-0 flex-wrap">
                            <span className={`${WORKSPACE_LOAD_ID_CLASS} truncate`}>
                              {resolveLoadLabel(load)}
                            </span>
                            <span className={`${WORKSPACE_LOAD_ID_CLASS} shrink-0`}>
                              {formatLoadStatus(load.status)}
                            </span>
                          </div>
                          <p className={`${WORKSPACE_LOAD_ROUTE_CLASS} break-words line-clamp-2`}>
                            {load.origin} → {load.destination}
                          </p>
                        </div>
                        <div className="flex items-center shrink-0">
                          <div className="flex flex-col items-end gap-1 min-w-[5.5rem]">
                            <span className={`${WORKSPACE_LOAD_PAYOUT_CLASS} tabular-nums`}>
                              ${formatLoadCurrency(computeLoadGrossRate(load))}
                            </span>
                            <span className={`${WORKSPACE_LOAD_ROUTE_CLASS} text-right tabular-nums`}>
                              {(load.total_miles ?? 0).toLocaleString()} mi
                            </span>
                          </div>
                          {isEditing ? (<button type="button" onClick={() => handleRemoveLoad(String(load.id))} className="p-1.5 rounded-md text-zinc-400 hover:text-red-500 hover:bg-zinc-100 dark:hover:bg-zinc-800/60 transition-colors shrink-0 ml-4 animate-in fade-in zoom-in-95 duration-150" aria-label={`Remove load ${resolveLoadLabel(load)}`}>
                              <Trash2 className="w-4 h-4" aria-hidden/>
                            </button>) : null}
                        </div>
                      </div>)))}
                </div>

                {loadsTotalPages > 1 ? (<div className="flex items-center justify-end gap-2 text-xs shrink-0 mt-auto">
                    <button type="button" disabled={loadsPage === 1} onClick={() => setLoadsPage((page) => page - 1)} className="px-3 py-1.5 border border-zinc-200 dark:border-zinc-800 rounded-md disabled:opacity-40 text-zinc-700 dark:text-zinc-300 bg-white dark:bg-[#161616] hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors">
                      Previous
                    </button>
                    <span className="text-zinc-700 dark:text-zinc-300 px-1 tabular-nums">
                      Page {loadsPage} of {loadsTotalPages}
                    </span>
                    <button type="button" disabled={loadsPage === loadsTotalPages} onClick={() => setLoadsPage((page) => page + 1)} className="px-3 py-1.5 border border-zinc-200 dark:border-zinc-800 rounded-md disabled:opacity-40 text-zinc-700 dark:text-zinc-300 bg-white dark:bg-[#161616] hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors">
                      Next
                    </button>
                  </div>) : null}
              </div>
            </div>
          </div>
        </div>
      </div>);
    }
    const panelClass = bare
        ? "h-full w-full min-w-0 overflow-hidden flex flex-col bg-white dark:bg-[#161616]"
        : "bg-white dark:bg-[#161616] border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-2xl w-full max-w-6xl max-h-[92vh] overflow-hidden flex flex-col";
    const panel = (<div className={panelClass}>
        <div className="p-5 border-b border-zinc-200 dark:border-zinc-800 flex justify-between items-start bg-zinc-50 dark:bg-zinc-900/50 shrink-0">
          <div className="space-y-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-bold text-lg text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                <Truck className="text-zinc-500 dark:text-zinc-400" size={20}/>
                {isTrailer
            ? `Trailer ${truck.trailer_number || "N/A"}`
            : `Truck #${truck.truck_number}`}
              </h3>
              <span className={`inline-flex items-center rounded-lg border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${truckStatusClass(truck.status)}`}>
                {statusLabel}
              </span>
            </div>
          </div>
          <button onClick={onClose} className="text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200 p-1.5 rounded-full transition-colors">
            <X size={20}/>
          </button>
        </div>

        <EntityDetailTabs activeTab={activeTab} onChange={setActiveTab}/>

        <div className="overflow-y-auto overflow-x-hidden p-6 flex-1 min-w-0">
          <div className={activeTab === "main" ? "space-y-6" : "hidden"} aria-hidden={activeTab !== "main"}>
          <section className={SECTION_CARD_CLASS}>
            <h4 className="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-4">
              Assignment Controls
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                {assignmentPrimaryDriver && onOpenDriver ? (<div className="mb-2">
                    <ProfileEntityLink label={assignmentPrimaryDriver.driver_name} onClick={() => onOpenDriver(assignmentPrimaryDriver.id)}/>
                  </div>) : assignmentPrimaryDriver ? (<div className="mb-2">
                    <ProfileFieldValue value={assignmentPrimaryDriver.driver_name}/>
                  </div>) : null}
                <PopoverSelectField label="Primary Driver" labelClassName={ASSIGNMENT_FIELD_LABEL_CLASS} value={assignmentPrimaryDriverId} onChange={setDriverId} options={workspacePrimaryDriverOptions} disabled={isTrailer}/>
              </div>
              <div>
                {assignmentCoDriver && onOpenDriver ? (<div className="mb-2">
                    <ProfileEntityLink label={assignmentCoDriver.driver_name} onClick={() => onOpenDriver(assignmentCoDriver.id)}/>
                  </div>) : assignmentCoDriver ? (<div className="mb-2">
                    <ProfileFieldValue value={assignmentCoDriver.driver_name}/>
                  </div>) : null}
                <PopoverSelectField label="Co-Driver" labelClassName={ASSIGNMENT_FIELD_LABEL_CLASS} value={assignmentCoDriverId} onChange={setCoDriverId} options={workspaceCoDriverOptions} disabled={isTrailer}/>
              </div>
              <div className="sm:col-span-2">
                {isTrailer ? (<div className="flex flex-col gap-1 min-w-0">
                    <label className={ASSIGNMENT_FIELD_LABEL_CLASS}>Assigned Truck</label>
                    <ProfileFieldValue value={assignedTruckDisplay.isUnassigned ? null : assignedTruckDisplay.text} fallback="None"/>
                  </div>) : (<PopoverSelectField label="Assigned Trailer" labelClassName={ASSIGNMENT_FIELD_LABEL_CLASS} value={trailerKey} onChange={setTrailerKey} options={assignedTrailerOptions}/>)}
              </div>
            </div>
          </section>

          <section className={SECTION_CARD_CLASS}>
            <h4 className="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-4">
              {isTrailer ? "Trailer Metadata" : "Asset Metadata"}
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              {isTrailer ? (<>
                  <EditableMetadataField label="VIN" value={formData.vin} onChange={(value) => setFormData((prev) => ({
                ...prev,
                vin: sanitizeVinInput(value),
            }))} placeholder="Enter VIN" className="font-mono uppercase" maxLength={17}/>
                  <EditableMetadataField label="Plate Number" value={formData.plate_number} onChange={(value) => setFormData((prev) => ({
                ...prev,
                plate_number: sanitizePlateNumberInput(value),
            }))} placeholder="Enter plate number" className="uppercase"/>
                  <EditableMetadataField label="Make / Model" value={formData.make_model} onChange={(value) => setFormData((prev) => ({ ...prev, make_model: value }))} onBlur={() => setFormData((prev) => ({
                ...prev,
                make_model: sanitizeMakeModelTitleCase(prev.make_model),
            }))} placeholder="Enter make and model"/>
                  <EditableMetadataField label="Year" value={formData.year || ""} onChange={(value) => setFormData((prev) => ({
                ...prev,
                year: value.replace(/[^\d]/g, "").slice(0, 4),
            }))} placeholder="Enter model year" inputMode="numeric" maxLength={4}/>
                </>) : (<>
                  <EditableMetadataField label="VIN" value={vin} onChange={(value) => setVin(sanitizeVinInput(value))} placeholder="Enter VIN" className="font-mono uppercase" maxLength={17}/>
                  <EditableMetadataField label="Plate Number" value={plateNumber} onChange={(value) => setPlateNumber(sanitizePlateNumberInput(value))} placeholder="Enter plate number" className="uppercase"/>
                  <EditableMetadataField label="Make / Model" value={makeModel} onChange={setMakeModel} onBlur={() => setMakeModel((current) => sanitizeMakeModelTitleCase(current))} placeholder="Enter make and model"/>
                  <EditableMetadataField label="Mileage" value={mileage} onChange={(value) => setMileage(value.replace(/[^\d]/g, ""))} placeholder="Current odometer" inputMode="numeric"/>
                </>)}
              {!isTrailer ? (<>
              <div>
                <p className={METADATA_LABEL_CLASS}>Equipment Type</p>
                <ProfileFieldValue value={truck.equipment_type} fallback="None"/>
              </div>
              <div>
                <p className={METADATA_LABEL_CLASS}>Current Trailer #</p>
                {linkedTrailerRecord && onOpenTrailer ? (<ProfileEntityLink label={displayTrailerNumber} onClick={() => onOpenTrailer(linkedTrailerRecord.id)}/>) : (<ProfileFieldValue value={displayTrailerNumber === "Bobtail" ? null : displayTrailerNumber} fallback="None"/>)}
              </div>
              </>) : (<>
              <div>
                <p className={METADATA_LABEL_CLASS}>Trailer Status</p>
                <ProfileFieldValue value={trailerMetadata?.trailerStatus} fallback="Not Set"/>
              </div>
              <EditableMetadataSelect label="Ownership" value={formData.ownership_type} onChange={(value) => setFormData((prev) => ({
                ...prev,
                ownership_type: value,
            }))} options={TRAILER_OWNERSHIP_TYPES} showSearch={false}/>
              </>)}
            </div>
          </section>

          <section className={SECTION_CARD_CLASS}>
            <h4 className="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-4">
              Integration & Classification
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              {isTrailer ? (<div>
                  <p className={METADATA_LABEL_CLASS}>Ownership Type</p>
                  <ProfileFieldValue value={normalizeOwnershipType(formData.ownership_type)} fallback="Not Set"/>
                </div>) : (<EditableMetadataSelect label="Ownership Type" value={ownershipType} onChange={setOwnershipType} options={TRAILER_OWNERSHIP_TYPES} showSearch={false}/>)}
            </div>
          </section>

          <button type="button" onClick={() => void handleSave()} disabled={saving} className="w-full py-2.5 bg-zinc-900 hover:bg-zinc-800 dark:bg-white dark:hover:bg-zinc-200 disabled:opacity-60 text-white dark:text-zinc-900 rounded-lg text-sm font-semibold shadow-sm transition-all flex items-center justify-center gap-2">
            {saving ? <Loader2 size={16} className="animate-spin"/> : null}
            {saving ? "Saving..." : isTrailer ? "Save Trailer Details" : "Save Assignments"}
          </button>
          </div>

          <div className={activeTab === "tasks-files" ? "" : "hidden"} aria-hidden={activeTab !== "tasks-files"}>
            <TasksAndFilesPanel rows={taskFileRows} uploadSlot={<DocumentUploadControls inputId={`asset-document-upload-${truck.id}`} documentType={documentType} onDocumentTypeChange={setDocumentType} customFolderName={customFolderName} onCustomFolderNameChange={setCustomFolderName} onFileSelected={handleDocumentUpload} uploading={uploadingDocument} documentTypeOptions={documentTypeOptions} managedCustomFolders={customFolders} onDeleteCustomFolder={handleDeleteCustomFolder} onInvalidFile={() => toast.error("Invalid file type. Only PDFs and images are accepted.")} scanHint={null}/>} notesById={docNotes} onNotesChange={(id, notes) => setDocNotes((prev) => ({ ...prev, [String(id)]: notes }))} onNotesBlur={handleNotesBlur} deletableFolderIds={deletableFolderMap} onDeleteFolder={handleDeleteCustomFolder} onDeleteDocument={handleDeleteDocument} emptyMessage={loadingDocuments && assetDocuments.length === 0
            ? "Loading linked documents..."
            : "No asset documents on file for this unit."}/>
          </div>
        </div>
    </div>);
    if (bare)
        return panel;
    return (<div className="fixed inset-0 z-[90] bg-black/5 dark:bg-black/30 flex items-center justify-center p-4">
      {panel}
    </div>);
}
