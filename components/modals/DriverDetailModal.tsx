"use client";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";
import { AlertTriangle, ChevronDown, FileText, FolderOpen, Loader2, Pencil, Receipt, Route, Search, Truck, UploadCloud, User, X, } from "lucide-react";
import { createApiClient } from "@/lib/api-client";
import { ASSET_DOCUMENT_ACCEPT, isAllowedAssetDocumentFile } from "@/lib/asset-document-upload";
import { getExpirationDisplay } from "@/lib/document-expiration";
import { createTmsApi, DriverProfile, DriverProfileLoad, TruckRecord } from "@/lib/tms-api";
import { buildDriverTaskFileRows } from "@/lib/tasks-files";
import { useTMSStore } from "@/store/useTMSStore";
import EntityDetailTabs, { type EntityDetailTabId } from "@/components/entity-detail/EntityDetailTabs";
import { CUSTOM_FOLDER_OPTION, DEFAULT_DOCUMENT_TYPE_OPTIONS, resolveUploadDocumentType, } from "@/components/entity-detail/DocumentUploadControls";
import TasksAndFilesPanel from "@/components/entity-detail/TasksAndFilesPanel";
import ProfileEntityLink from "@/components/entity-detail/ProfileEntityLink";
import { ProfileFieldFallback, ProfileFieldValue, } from "@/components/entity-detail/profile-field-styles";
interface DriverDetailModalProps {
    token: string;
    driverId: number | null;
    trucks?: TruckRecord[];
    onClose: () => void;
    onOpenTruck?: (truckId: number) => void;
    onOpenTrailer?: (truckId: number) => void;
    onDocumentUploaded?: () => void;
    onProfileUpdated?: () => void;
    bare?: boolean;
}
const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const ACTION_BTN_CLASS = "text-xs bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 border border-zinc-200 dark:border-zinc-700 rounded px-2 py-1 flex items-center gap-1 text-zinc-700 dark:text-zinc-300 transition-colors whitespace-nowrap";
const INLINE_FILTER_CLASS = "flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-800/40 w-48 transition-all focus-within:border-zinc-400 dark:focus-within:border-zinc-600";
const INLINE_FILTER_INPUT_CLASS = "w-full min-w-0 bg-transparent border-0 outline-none ring-0 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500";
const PHONE_MAX_LENGTH = 10;
const TABLE_EXPAND_LIMIT = 5;
const TABLE_EXPAND_FOOTER_CLASS = "w-full text-center py-2.5 text-xs font-semibold text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/30 transition-colors cursor-pointer";
const DRIVER_TYPE_OPTIONS = ["Company Driver", "Owner Operator"] as const;
const METADATA_LABEL_CLASS = "text-[10px] uppercase text-zinc-500 dark:text-zinc-400 mb-1 block whitespace-nowrap";
const METADATA_INPUT_CLASS = "w-full bg-transparent border-0 text-zinc-900 dark:text-white px-1 py-1.5 pr-8 text-sm outline-none ring-0 focus:ring-0 placeholder:text-zinc-400 dark:placeholder:text-zinc-500";
const METADATA_TEXTAREA_CLASS = "w-full min-h-[72px] resize-y bg-transparent border-0 text-zinc-900 dark:text-white px-1 py-1.5 pr-8 text-sm outline-none ring-0 focus:ring-0 placeholder:text-zinc-400 dark:placeholder:text-zinc-500";
const METADATA_FIELD_WRAPPER_CLASS = "group relative rounded-md border border-transparent transition-colors duration-150 hover:bg-zinc-100/40 dark:hover:bg-zinc-800/30 focus-within:border-zinc-200 dark:focus-within:border-zinc-700 focus-within:bg-zinc-100/60 dark:focus-within:bg-zinc-800/40 focus-within:ring-1 focus-within:ring-blue-500/20";
const METADATA_PENCIL_CLASS = "pointer-events-none absolute right-1 top-1/2 -translate-y-1/2 text-zinc-400 dark:text-zinc-600 transition-colors duration-150 group-hover:text-zinc-600 dark:group-hover:text-zinc-400 group-focus-within:text-blue-500 dark:group-focus-within:text-blue-400";
const METADATA_TEXTAREA_PENCIL_CLASS = "pointer-events-none absolute right-1 top-2 text-zinc-400 dark:text-zinc-600 transition-colors duration-150 group-hover:text-zinc-600 dark:group-hover:text-zinc-400 group-focus-within:text-blue-500 dark:group-focus-within:text-blue-400";
const METADATA_CHEVRON_CLASS = "pointer-events-none absolute right-1 top-1/2 -translate-y-1/2 text-zinc-400 dark:text-zinc-600 transition-colors duration-150 group-hover:text-zinc-600 dark:group-hover:text-zinc-400 group-focus-within:text-blue-500 dark:group-focus-within:text-blue-400";
const METADATA_POPOVER_SEARCH_CLASS = "sticky top-0 z-10 w-full px-3 py-2 text-sm bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 outline-none placeholder:text-zinc-400 dark:placeholder:text-zinc-500 text-zinc-900 dark:text-zinc-100";
const METADATA_POPOVER_PANEL_CLASS = "absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-xl dark:border-zinc-800 dark:bg-zinc-900";
const METADATA_POPOVER_ITEM_CLASS = "w-full px-3 py-2 text-left text-sm text-zinc-900 transition-colors hover:bg-zinc-100 dark:text-zinc-100 dark:hover:bg-zinc-800";
const METADATA_POPOVER_ITEM_SELECTED_CLASS = "bg-zinc-100 dark:bg-zinc-800";
type DriverMetadataDraft = {
    cdl_number: string;
    cdl_expiration_date: string;
    phone_number: string;
    email: string;
    medical_card_expiration_date: string;
    twic_expiration_date: string;
    pay_percentage: string;
    comments: string;
    driver_type: (typeof DRIVER_TYPE_OPTIONS)[number];
};
type DriverMetadataFieldKey = keyof DriverMetadataDraft;
type DriverPatchPayload = {
    cdl_number?: string | null;
    phone_number?: string | null;
    email?: string | null;
    pay_percentage?: number;
    driver_type?: string;
    comments?: string | null;
    cdl_expiration_date?: string | null;
    medical_card_expiration_date?: string | null;
    twic_expiration_date?: string | null;
};
type PopoverSelectOption = {
    value: string;
    label: string;
};
type PopoverSelectFieldProps = {
    label?: string;
    value: string;
    onChange: (value: string) => void;
    options: PopoverSelectOption[];
    labelClassName?: string;
    showSearch?: boolean;
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
    saving?: boolean;
};
type EditableMetadataTextareaProps = {
    label: string;
    value: string;
    onChange: (value: string) => void;
    onBlur?: () => void;
    placeholder?: string;
    saving?: boolean;
};
const handleEnterBlur = (event: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        event.currentTarget.blur();
    }
};
function PopoverSelectField({ label, value, onChange, options, labelClassName = METADATA_LABEL_CLASS, showSearch = true, }: PopoverSelectFieldProps) {
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
    const wrapperClassName = isOpen
        ? `${METADATA_FIELD_WRAPPER_CLASS} border-zinc-200 bg-zinc-100/60 ring-1 ring-blue-500/20 dark:border-zinc-700 dark:bg-zinc-800/40`
        : METADATA_FIELD_WRAPPER_CLASS;
    return (<div ref={containerRef}>
      {label ? <label className={labelClassName}>{label}</label> : null}
      <div className={wrapperClassName}>
        <button type="button" role="combobox" aria-expanded={isOpen} aria-haspopup="listbox" onClick={() => setIsOpen((open) => !open)} className={`${METADATA_INPUT_CLASS} w-full cursor-pointer text-left`}>
          {displayValue}
        </button>
        <ChevronDown size={14} className={METADATA_CHEVRON_CLASS} aria-hidden/>
        {isOpen ? (<div className={METADATA_POPOVER_PANEL_CLASS}>
            {showSearch ? (<input type="text" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} autoFocus placeholder="Search..." className={METADATA_POPOVER_SEARCH_CLASS} onMouseDown={(event) => event.stopPropagation()}/>) : null}
            <div className="max-h-60 overflow-y-auto" role="listbox">
              {filteredOptions.map((option) => (<button key={option.value} type="button" role="option" aria-selected={option.value === value} onClick={() => {
                    onChange(option.value);
                    setIsOpen(false);
                }} className={`${METADATA_POPOVER_ITEM_CLASS} ${option.value === value ? METADATA_POPOVER_ITEM_SELECTED_CLASS : ""}`}>
                  {option.label}
                </button>))}
            </div>
          </div>) : null}
      </div>
    </div>);
}
function EditableMetadataField({ label, value, onChange, onBlur, placeholder, className = "", type = "text", inputMode, maxLength, saving = false, }: EditableMetadataFieldProps) {
    return (<div>
      <label className={METADATA_LABEL_CLASS}>{label}</label>
      <div className={METADATA_FIELD_WRAPPER_CLASS}>
        <input type={type} inputMode={inputMode} maxLength={maxLength} value={value} onChange={(event) => onChange(event.target.value)} onBlur={onBlur} onKeyDown={handleEnterBlur} placeholder={placeholder} disabled={saving} className={`${METADATA_INPUT_CLASS} ${className}`.trim()}/>
        {saving ? (<Loader2 size={14} className="pointer-events-none absolute right-1 top-1/2 -translate-y-1/2 animate-spin text-blue-500" aria-hidden/>) : (<Pencil size={14} className={METADATA_PENCIL_CLASS} aria-hidden/>)}
      </div>
    </div>);
}
function EditableMetadataTextarea({ label, value, onChange, onBlur, placeholder, saving = false, }: EditableMetadataTextareaProps) {
    return (<div>
      <label className={METADATA_LABEL_CLASS}>{label}</label>
      <div className={METADATA_FIELD_WRAPPER_CLASS}>
        <textarea value={value} onChange={(event) => onChange(event.target.value)} onBlur={onBlur} onKeyDown={handleEnterBlur} placeholder={placeholder} disabled={saving} rows={3} className={METADATA_TEXTAREA_CLASS}/>
        {saving ? (<Loader2 size={14} className={`${METADATA_TEXTAREA_PENCIL_CLASS} animate-spin text-blue-500`} aria-hidden/>) : (<Pencil size={14} className={METADATA_TEXTAREA_PENCIL_CLASS} aria-hidden/>)}
      </div>
    </div>);
}
function ExpirationStatusHint({ value }: {
    value: string;
}) {
    if (!value.trim())
        return null;
    const display = getExpirationDisplay(value);
    if (!display.formattedDate)
        return null;
    return (<p className={`text-[11px] mt-0.5 ${display.textClass}`}>Exp: {display.formattedDate}</p>);
}
const toDateInputValue = (value?: string | null): string => {
    if (!value)
        return "";
    const trimmed = value.trim();
    const isoMatch = trimmed.match(/^(\d{4}-\d{2}-\d{2})/);
    if (isoMatch)
        return isoMatch[1];
    const parsed = new Date(trimmed);
    if (Number.isNaN(parsed.getTime()))
        return "";
    return parsed.toISOString().slice(0, 10);
};
const parseExpirationToIso = (value: string): string | null => {
    const trimmed = value.trim();
    if (!trimmed)
        return null;
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed))
        return trimmed;
    const parsed = new Date(trimmed);
    if (Number.isNaN(parsed.getTime()))
        return null;
    return parsed.toISOString().slice(0, 10);
};
const parsePayPercentage = (value: string): number | null => {
    const cleaned = value.replace(/[^\d.]/g, "");
    if (!cleaned)
        return null;
    const parsed = parseFloat(cleaned);
    if (!Number.isFinite(parsed) || parsed < 0 || parsed > 100)
        return null;
    return parsed;
};
const sanitizePhoneNumber = (value: string): string => value.replace(/\D/g, "").slice(0, PHONE_MAX_LENGTH);
const buildMetadataDraft = (profile: DriverProfile): DriverMetadataDraft => ({
    cdl_number: profile.cdl_number || "",
    cdl_expiration_date: toDateInputValue(profile.cdl_expiration_date),
    phone_number: sanitizePhoneNumber(profile.phone_number || ""),
    email: profile.email || "",
    medical_card_expiration_date: toDateInputValue(profile.medical_card_expiration_date),
    twic_expiration_date: toDateInputValue(profile.twic_expiration_date),
    pay_percentage: profile.pay_percentage != null ? String(profile.pay_percentage) : "",
    comments: profile.comments || "",
    driver_type: profile.driver_type === "Owner Operator" ? "Owner Operator" : "Company Driver",
});
const formatCurrency = (value: number) => value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const formatMacroCurrency = (value: number) => value.toLocaleString(undefined, { maximumFractionDigits: 0 });
const formatDate = (value?: string | null) => {
    if (!value)
        return null;
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime()))
        return value;
    return parsed.toLocaleDateString("en-US", { month: "2-digit", day: "2-digit", year: "numeric" });
};
const statusBadgeClass = (status: string) => {
    switch (status) {
        case "ASSIGNED":
            return "bg-blue-950/30 border-blue-500/30 text-blue-400";
        case "INACTIVE":
            return "bg-red-950/30 border-red-500/30 text-red-400";
        default:
            return "bg-emerald-950/30 border-emerald-500/30 text-emerald-400";
    }
};
const resolveDocUrl = (fileUrl?: string | null, filePath?: string | null) => {
    if (fileUrl?.startsWith("http"))
        return fileUrl;
    if (fileUrl)
        return `${API_URL}${fileUrl}`;
    if (filePath)
        return `${API_URL}/${filePath.replace(/^\/+/, "")}`;
    return "#";
};
export default function DriverDetailModal({ token, driverId, trucks = [], onClose, onOpenTruck, onOpenTrailer, onDocumentUploaded, onProfileUpdated, bare = false, }: DriverDetailModalProps) {
    const api = useMemo(() => createTmsApi(createApiClient(token)), [token]);
    const { setActiveVaultLoad } = useTMSStore();
    const [profile, setProfile] = useState<DriverProfile | null>(null);
    const [loading, setLoading] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [openingSettlementId, setOpeningSettlementId] = useState<number | null>(null);
    const [metadataDraft, setMetadataDraft] = useState<DriverMetadataDraft | null>(null);
    const [savingField, setSavingField] = useState<DriverMetadataFieldKey | null>(null);
    const [documentType, setDocumentType] = useState("Driver's License");
    const [customFolderName, setCustomFolderName] = useState("");
    const [activeTab, setActiveTab] = useState<EntityDetailTabId>("main");
    const [docNotes, setDocNotes] = useState<Record<string, string>>({});
    const [loadQuery, setLoadQuery] = useState("");
    const [settlementQuery, setSettlementQuery] = useState("");
    const [isLoadsExpanded, setIsLoadsExpanded] = useState(false);
    const [isSettlementsExpanded, setIsSettlementsExpanded] = useState(false);
    const driverDocInputRef = useRef<HTMLInputElement>(null);
    const seedDocNotes = useCallback((documents: DriverProfile["documents"]) => {
        setDocNotes(Object.fromEntries(documents
            .filter((doc) => doc.notes)
            .map((doc) => [String(doc.id), doc.notes as string])));
    }, []);
    const loadProfile = useCallback(async (showSpinner = true) => {
        if (!driverId || !token)
            return;
        if (showSpinner)
            setLoading(true);
        try {
            const data = await api.fleet.driverProfile(driverId);
            setProfile(data);
            setMetadataDraft(buildMetadataDraft(data));
            seedDocNotes(data.documents);
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
            toast.error(message || "Failed to load driver profile.");
            if (showSpinner)
                onClose();
        }
        finally {
            if (showSpinner)
                setLoading(false);
        }
    }, [api, driverId, token, onClose, seedDocNotes]);
    useEffect(() => {
        if (!driverId || !token)
            return;
        setMetadataDraft(null);
        setActiveTab("main");
        setDocNotes({});
        setLoadQuery("");
        setSettlementQuery("");
        setIsLoadsExpanded(false);
        setIsSettlementsExpanded(false);
        loadProfile();
    }, [driverId, token, loadProfile]);
    const assignedTruck = useMemo(() => {
        if (!profile)
            return null;
        return (trucks.find((t) => t.driver_id === profile.id || t.co_driver_id === profile.id) ?? null);
    }, [trucks, profile]);
    const assignedTruckNumber = assignedTruck?.truck_number || profile?.truck_number || null;
    const assignedTrailerNumber = assignedTruck?.trailer_number && assignedTruck.trailer_number !== "N/A"
        ? assignedTruck.trailer_number
        : profile?.trailer_number && profile.trailer_number !== "N/A"
            ? profile.trailer_number
            : null;
    const assignedTrailerRecord = useMemo(() => {
        if (!assignedTrailerNumber)
            return null;
        const normalized = assignedTrailerNumber.trim().toLowerCase();
        return (trucks.find((unit) => {
            const assetType = (unit.asset_type || "truck").toLowerCase();
            if (assetType !== "standalone_trailer")
                return false;
            return String(unit.trailer_number || "").trim().toLowerCase() === normalized;
        }) ?? null);
    }, [trucks, assignedTrailerNumber]);
    const commitMetadataField = useCallback(async (field: DriverMetadataFieldKey, payload: DriverPatchPayload) => {
        if (!driverId)
            return;
        setSavingField(field);
        try {
            await api.fleet.updateDriver(driverId, payload);
            await loadProfile(false);
            onProfileUpdated?.();
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
            toast.error(message || "Failed to update profile.");
            if (profile)
                setMetadataDraft(buildMetadataDraft(profile));
        }
        finally {
            setSavingField(null);
        }
    }, [api, driverId, loadProfile, onProfileUpdated, profile]);
    const commitTextField = useCallback((field: "cdl_number" | "phone_number" | "email", draftKey: typeof field) => {
        if (!profile || !metadataDraft)
            return;
        const next = metadataDraft[draftKey].trim() || null;
        const current = profile[field]?.trim() || null;
        if (next === current)
            return;
        void commitMetadataField(field, { [field]: next });
    }, [commitMetadataField, metadataDraft, profile]);
    const commitDateField = useCallback((field: "cdl_expiration_date" | "medical_card_expiration_date" | "twic_expiration_date", draftKey: typeof field) => {
        if (!profile || !metadataDraft)
            return;
        const next = parseExpirationToIso(metadataDraft[draftKey]);
        const current = parseExpirationToIso(toDateInputValue(profile[field]));
        if (next === current)
            return;
        void commitMetadataField(field, { [field]: next });
    }, [commitMetadataField, metadataDraft, profile]);
    const commitPayPercentage = useCallback(() => {
        if (!profile || !metadataDraft)
            return;
        const parsed = parsePayPercentage(metadataDraft.pay_percentage);
        if (parsed === null) {
            toast.error("Pay % must be a number between 0 and 100.");
            setMetadataDraft((current) => current
                ? { ...current, pay_percentage: String(profile.pay_percentage ?? "") }
                : current);
            return;
        }
        if (parsed === profile.pay_percentage)
            return;
        void commitMetadataField("pay_percentage", { pay_percentage: parsed });
    }, [commitMetadataField, metadataDraft, profile]);
    const commitComments = useCallback(() => {
        if (!profile || !metadataDraft)
            return;
        const next = metadataDraft.comments.trim() || null;
        const current = profile.comments?.trim() || null;
        if (next === current)
            return;
        void commitMetadataField("comments", { comments: next });
    }, [commitMetadataField, metadataDraft, profile]);
    const handleDriverTypeChange = useCallback((value: string) => {
        const nextType = value === "Owner Operator" ? "Owner Operator" : "Company Driver";
        setMetadataDraft((current) => current ? { ...current, driver_type: nextType } : current);
        if (!profile || nextType === profile.driver_type)
            return;
        void commitMetadataField("driver_type", { driver_type: nextType });
    }, [commitMetadataField, profile]);
    const handleUpload = async (file: File) => {
        if (!driverId)
            return;
        const resolvedType = resolveUploadDocumentType(documentType, customFolderName);
        if (!resolvedType) {
            toast.error("Enter a folder name before uploading.");
            return;
        }
        setUploading(true);
        const toastId = toast.loading("Uploading document...");
        try {
            const result = await api.fleet.uploadDriverDocument(driverId, file, resolvedType);
            await loadProfile(false);
            onDocumentUploaded?.();
            if (result.scan) {
                toast.success(`${result.scan.document_type} uploaded — expires ${formatDate(result.scan.expiration_date)}`, { id: toastId });
            }
            else {
                toast.success("Document uploaded successfully.", { id: toastId });
            }
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
            toast.error(message || "Failed to upload document.", { id: toastId });
        }
        finally {
            setUploading(false);
        }
    };
    const handleNotesBlur = async (id: string | number, notes: string) => {
        const documentId = typeof id === "number" ? id : parseInt(String(id), 10);
        if (Number.isNaN(documentId))
            return;
        try {
            await api.documents.updateNotes(documentId, notes);
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
    const handleDeleteDocument = useCallback(async (documentId: number) => {
        try {
            await api.assets.deleteDocument(documentId);
            setProfile((current) => current
                ? {
                    ...current,
                    documents: current.documents.filter((doc) => doc.id !== documentId),
                }
                : current);
            setDocNotes((current) => {
                const next = { ...current };
                delete next[String(documentId)];
                return next;
            });
            toast.success("Document deleted.");
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
            toast.error(message || "Failed to delete document.");
        }
    }, [api]);
    const handleViewLoadFiles = (loadId: number) => {
        setActiveVaultLoad(loadId);
    };
    const handleViewSettlement = async (settlementId: number) => {
        setOpeningSettlementId(settlementId);
        const toastId = toast.loading("Opening settlement statement...");
        try {
            const doc = await api.settlements.document(settlementId);
            const url = doc.url || resolveDocUrl(doc.file_url, doc.file_path);
            if (!url || url === "#") {
                throw new Error("Document URL unavailable");
            }
            window.open(url, "_blank", "noopener,noreferrer");
            toast.success("Settlement statement opened.", { id: toastId });
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
            toast.error(typeof message === "string" ? message : "Failed to open settlement statement.", { id: toastId });
        }
        finally {
            setOpeningSettlementId(null);
        }
    };
    const taskFileRows = useMemo(() => (profile ? buildDriverTaskFileRows(profile, docNotes) : []), [profile, docNotes]);
    const filteredLoads = useMemo(() => {
        if (!profile)
            return [];
        const query = loadQuery.trim().toLowerCase();
        if (!query)
            return profile.loads;
        return profile.loads.filter((load) => {
            const idToken = String(load.id ?? "").toLowerCase();
            const loadNumberToken = String((load as DriverProfileLoad & {
                load_number?: string | null;
            }).load_number ?? "").toLowerCase();
            const brokerToken = String(load.broker_load_id ?? "").toLowerCase();
            const displayToken = (load.broker_load_id?.trim() || `L-${load.id}`).toLowerCase();
            const originToken = String(load.origin ?? "").toLowerCase();
            const destinationToken = String(load.destination ?? "").toLowerCase();
            return (idToken.includes(query) ||
                loadNumberToken.includes(query) ||
                brokerToken.includes(query) ||
                displayToken.includes(query) ||
                originToken.includes(query) ||
                destinationToken.includes(query));
        });
    }, [profile, loadQuery]);
    const filteredSettlements = useMemo(() => {
        if (!profile)
            return [];
        const query = settlementQuery.trim().toLowerCase();
        if (!query)
            return profile.settlements;
        return profile.settlements.filter((settlement) => settlement.statement_number.toLowerCase().includes(query));
    }, [profile, settlementQuery]);
    const visibleLoads = useMemo(() => {
        if (isLoadsExpanded)
            return filteredLoads;
        return filteredLoads.slice(0, TABLE_EXPAND_LIMIT);
    }, [filteredLoads, isLoadsExpanded]);
    const visibleSettlements = useMemo(() => {
        if (isSettlementsExpanded)
            return filteredSettlements;
        return filteredSettlements.slice(0, TABLE_EXPAND_LIMIT);
    }, [filteredSettlements, isSettlementsExpanded]);
    const documentFolderOptions = useMemo(() => [
        ...DEFAULT_DOCUMENT_TYPE_OPTIONS.map((option) => ({ value: option, label: option })),
        { value: CUSTOM_FOLDER_OPTION, label: "+ Create Custom Folder" },
    ], []);
    const processDriverUploadFile = useCallback((file: File) => {
        if (!isAllowedAssetDocumentFile(file)) {
            toast.error("Only PDF, PNG, and JPG files are accepted.");
            return;
        }
        void handleUpload(file);
    }, [handleUpload]);
    const documentUploadSlot = (<div className="space-y-3">
      <p className="text-xs text-zinc-500">
        CDL and medical card uploads are automatically scanned for expiration dates.
      </p>
      <PopoverSelectField value={documentType || DEFAULT_DOCUMENT_TYPE_OPTIONS[0]} onChange={setDocumentType} options={documentFolderOptions} showSearch={false}/>
      {documentType === CUSTOM_FOLDER_OPTION ? (<input type="text" value={customFolderName} onChange={(event) => setCustomFolderName(event.target.value)} placeholder='Folder name (e.g. "Safety Cert", "W-2")' disabled={uploading} className="w-full border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-white p-2.5 rounded-lg text-sm outline-none focus:ring-2 focus:ring-zinc-600 transition-colors disabled:opacity-60"/>) : null}
      <div onDragOver={(event) => {
            event.preventDefault();
            event.stopPropagation();
        }} onDrop={(event) => {
            event.preventDefault();
            event.stopPropagation();
            if (uploading)
                return;
            const file = event.dataTransfer.files?.[0];
            if (file)
                processDriverUploadFile(file);
        }} className="border-2 border-dashed border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl p-4 text-center transition-colors">
        <UploadCloud size={22} className="mx-auto text-zinc-400 dark:text-zinc-500 mb-2"/>
        <p className="text-sm font-semibold text-zinc-700 dark:text-zinc-200 mb-1">
          Drag & drop or browse
        </p>
        <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-3">PDF, PNG, or JPG accepted</p>
        <input ref={driverDocInputRef} type="file" id={`driver-profile-doc-${driverId}`} className="hidden" accept={ASSET_DOCUMENT_ACCEPT} onChange={(event) => {
            const file = event.target.files?.[0];
            if (file)
                processDriverUploadFile(file);
            event.target.value = "";
        }}/>
        <button type="button" onClick={() => driverDocInputRef.current?.click()} disabled={uploading} className="bg-zinc-900 hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200 text-white rounded-lg text-sm font-semibold px-4 py-2 transition-all disabled:opacity-50 shadow-sm inline-flex items-center gap-2">
          {uploading ? <Loader2 size={14} className="animate-spin"/> : null}
          {uploading ? "Uploading..." : "Browse Files"}
        </button>
      </div>
    </div>);
    if (!driverId)
        return null;
    const panelClass = bare
        ? "h-full w-full min-w-0 overflow-hidden flex flex-col bg-white dark:bg-[#161616]"
        : "bg-white dark:bg-[#161616] border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-2xl w-full max-w-6xl max-h-[92vh] overflow-hidden flex flex-col";
    const panel = (<div className={panelClass}>
        <div className="p-5 border-b border-zinc-100 dark:border-zinc-800 flex justify-between items-center bg-zinc-50 dark:bg-zinc-900/50 shrink-0">
          <div className="flex items-center gap-3 min-w-0 flex-wrap">
            <User className="text-zinc-500 shrink-0" size={22}/>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-bold text-lg text-zinc-900 dark:text-zinc-100 truncate">
                  {profile?.driver_name || "Driver Profile"}
                </h3>
                {profile ? (<span className={`text-[10px] font-bold uppercase tracking-wider border rounded-lg px-2.5 py-1 ${statusBadgeClass(profile.status)}`}>
                    {profile.status}
                  </span>) : null}
              </div>
              <div className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5 max-w-xs">
                {metadataDraft ? (<PopoverSelectField value={metadataDraft.driver_type} onChange={handleDriverTypeChange} options={DRIVER_TYPE_OPTIONS.map((type) => ({ value: type, label: type }))} showSearch={false}/>) : (profile?.driver_type || "Company Driver")}
              </div>
            </div>
          </div>
          <button onClick={onClose} className="text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-300 p-1.5 rounded-full transition-colors shrink-0">
            <X size={20}/>
          </button>
        </div>

        <EntityDetailTabs activeTab={activeTab} onChange={setActiveTab}/>

        {loading ? (<div className="flex flex-col items-center justify-center py-24 text-zinc-400 gap-2">
            <Loader2 className="animate-spin" size={28}/>
            <p className="text-sm">Loading driver profile...</p>
          </div>) : profile ? (<div className="overflow-y-auto overflow-x-hidden p-6 space-y-6 flex-1 min-w-0">
            {activeTab === "main" ? (<>
            {profile.expiration_warnings.length > 0 && (<div className="rounded-xl border border-amber-500/30 bg-amber-950/20 p-4 space-y-2">
                {profile.expiration_warnings.map((warning) => (<p key={warning} className="text-sm text-amber-400 flex items-center gap-2">
                    <AlertTriangle size={14} className="shrink-0"/>
                    {warning}
                  </p>))}
              </div>)}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 min-w-0 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 p-4">
                <div className="mb-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                    Profile Metadata
                  </h4>
                </div>
                {metadataDraft ? (<div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4 text-sm">
                    <div className="min-w-0">
                      <EditableMetadataField label="CDL" value={metadataDraft.cdl_number} onChange={(value) => setMetadataDraft((current) => current ? { ...current, cdl_number: value } : current)} onBlur={() => commitTextField("cdl_number", "cdl_number")} placeholder="CDL number" className="font-mono" saving={savingField === "cdl_number"}/>
                    </div>
                    <div className="min-w-0">
                      <EditableMetadataField label="CDL Expiration" type="date" value={metadataDraft.cdl_expiration_date} onChange={(value) => setMetadataDraft((current) => current ? { ...current, cdl_expiration_date: value } : current)} onBlur={() => commitDateField("cdl_expiration_date", "cdl_expiration_date")} saving={savingField === "cdl_expiration_date"}/>
                      <ExpirationStatusHint value={metadataDraft.cdl_expiration_date}/>
                    </div>
                    <div className="min-w-0">
                      <EditableMetadataField label="Phone" type="tel" value={metadataDraft.phone_number} onChange={(value) => setMetadataDraft((current) => current
                        ? { ...current, phone_number: sanitizePhoneNumber(value) }
                        : current)} onBlur={() => commitTextField("phone_number", "phone_number")} placeholder="Phone number" inputMode="numeric" maxLength={PHONE_MAX_LENGTH} saving={savingField === "phone_number"}/>
                    </div>
                    <div className="min-w-0">
                      <EditableMetadataField label="Email" type="email" value={metadataDraft.email} onChange={(value) => setMetadataDraft((current) => current ? { ...current, email: value } : current)} onBlur={() => commitTextField("email", "email")} placeholder="Email address" saving={savingField === "email"}/>
                    </div>
                    <div className="min-w-0">
                      <EditableMetadataField label="Medical Card Exp" type="date" value={metadataDraft.medical_card_expiration_date} onChange={(value) => setMetadataDraft((current) => current
                        ? { ...current, medical_card_expiration_date: value }
                        : current)} onBlur={() => commitDateField("medical_card_expiration_date", "medical_card_expiration_date")} saving={savingField === "medical_card_expiration_date"}/>
                      <ExpirationStatusHint value={metadataDraft.medical_card_expiration_date}/>
                    </div>
                    <div className="min-w-0">
                      <EditableMetadataField label="TWIC Card Exp" type="date" value={metadataDraft.twic_expiration_date} onChange={(value) => setMetadataDraft((current) => current ? { ...current, twic_expiration_date: value } : current)} onBlur={() => commitDateField("twic_expiration_date", "twic_expiration_date")} saving={savingField === "twic_expiration_date"}/>
                      <ExpirationStatusHint value={metadataDraft.twic_expiration_date}/>
                    </div>
                    <div className="min-w-0">
                      <EditableMetadataField label="Pay %" value={metadataDraft.pay_percentage} onChange={(value) => setMetadataDraft((current) => current
                        ? { ...current, pay_percentage: value.replace(/[^\d.]/g, "") }
                        : current)} onBlur={commitPayPercentage} placeholder="Pay %" inputMode="decimal" saving={savingField === "pay_percentage"}/>
                    </div>
                    <div className="min-w-0">
                      <p className={METADATA_LABEL_CLASS}>Assigned Assets</p>
                      <div className="flex flex-col gap-1 px-1 py-1.5">
                        {assignedTruck && onOpenTruck ? (<ProfileEntityLink label={`Truck #${assignedTruckNumber}`} onClick={() => onOpenTruck(assignedTruck.id)}/>) : (<ProfileFieldValue value={assignedTruckNumber ? `Truck #${assignedTruckNumber}` : null}/>)}
                        {assignedTrailerNumber && assignedTrailerRecord && onOpenTrailer ? (<ProfileEntityLink label={`Trailer #${assignedTrailerNumber}`} onClick={() => onOpenTrailer(assignedTrailerRecord.id)}/>) : (<p className="text-[11px] text-zinc-500">
                            Trailer#{" "}
                            {assignedTrailerNumber ? (assignedTrailerNumber) : (<ProfileFieldFallback label="None"/>)}
                          </p>)}
                      </div>
                    </div>
                  </div>) : null}
                {metadataDraft ? (<div className="mt-4 pt-4 border-t border-zinc-200 dark:border-zinc-800">
                    <EditableMetadataTextarea label="Dispatcher Notes" value={metadataDraft.comments} onChange={(value) => setMetadataDraft((current) => current ? { ...current, comments: value } : current)} onBlur={commitComments} placeholder="Add dispatcher notes..." saving={savingField === "comments"}/>
                  </div>) : null}
              </div>

              <div className="lg:col-span-1 min-w-0 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 p-4">
                <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-3 flex items-center gap-1.5">
                  <Receipt size={14}/> Lifetime Financials
                </h4>
                <div className="space-y-3 text-sm min-w-0">
                  <div className="min-w-0">
                    <p className="text-[10px] uppercase text-zinc-500">Gross Revenue</p>
                    <p className="text-xl font-semibold tracking-tight tabular-nums text-emerald-500 dark:text-emerald-400 truncate">
                      ${formatMacroCurrency(profile.financials.lifetime_gross_revenue)}
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-[10px] uppercase text-zinc-500">Loaded Mi</p>
                      <p className="font-semibold text-zinc-900 dark:text-zinc-100">
                        {profile.financials.lifetime_loaded_miles.toLocaleString()}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase text-zinc-500">Empty Mi</p>
                      <p className="font-semibold text-zinc-900 dark:text-zinc-100">
                        {profile.financials.lifetime_empty_miles.toLocaleString()}
                      </p>
                    </div>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase text-zinc-500">Total Loads</p>
                    <p className="font-semibold text-zinc-900 dark:text-zinc-100">
                      {profile.financials.load_count}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
              <div className="px-4 py-3 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/40 flex flex-wrap items-center justify-between gap-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-500 flex items-center gap-1.5">
                  <Route size={14}/> Active & Historic Loads
                </h4>
                <div className={INLINE_FILTER_CLASS}>
                  <Search className="w-3.5 h-3.5 text-zinc-400 shrink-0" aria-hidden/>
                  <input type="search" value={loadQuery} onChange={(event) => setLoadQuery(event.target.value)} placeholder="Filter loads..." className={INLINE_FILTER_INPUT_CLASS}/>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="text-[10px] uppercase font-bold text-zinc-500 border-b dark:border-zinc-800">
                    <tr>
                      <th className="p-3">Load</th>
                      <th className="p-3">Route</th>
                      <th className="p-3">Status</th>
                      <th className="p-3">Gross</th>
                      <th className="p-3">Miles</th>
                      <th className="p-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                    {profile.loads.length === 0 ? (<tr>
                        <td colSpan={6} className="p-6 text-center text-zinc-500">
                          No loads assigned to this driver yet.
                        </td>
                      </tr>) : filteredLoads.length === 0 ? (<tr>
                        <td colSpan={6} className="p-6 text-center text-zinc-500">
                          No loads match your search.
                        </td>
                      </tr>) : (visibleLoads.map((load) => (<tr key={load.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30">
                          <td className="p-3 font-mono text-xs font-bold text-zinc-900 dark:text-zinc-100">
                            {load.broker_load_id || `L-${load.id}`}
                          </td>
                          <td className="p-3 text-zinc-700 dark:text-zinc-300">
                            {load.origin} → {load.destination}
                          </td>
                          <td className="p-3">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                              {load.status}
                            </span>
                          </td>
                          <td className="p-3 font-semibold text-emerald-600 dark:text-emerald-400">
                            ${formatCurrency(load.gross_pay)}
                          </td>
                          <td className="p-3 text-zinc-600 dark:text-zinc-400">
                            {load.total_miles.toLocaleString()} mi
                          </td>
                          <td className="p-3 text-right">
                            <button type="button" onClick={() => handleViewLoadFiles(load.id)} className={`${ACTION_BTN_CLASS} ml-auto`}>
                              <FolderOpen size={12}/>
                              View Files
                            </button>
                          </td>
                        </tr>)))}
                  </tbody>
                </table>
              </div>
              {filteredLoads.length > TABLE_EXPAND_LIMIT ? (<button type="button" onClick={() => setIsLoadsExpanded((expanded) => !expanded)} className={TABLE_EXPAND_FOOTER_CLASS}>
                  {isLoadsExpanded
                        ? "Show Less"
                        : `View All (${filteredLoads.length} Loads)`}
                </button>) : null}
            </div>

            <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
              <div className="px-4 py-3 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/40 flex flex-wrap items-center justify-between gap-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-500 flex items-center gap-1.5">
                  <Truck size={14}/> Settlement Paystubs Ledger
                </h4>
                <div className={INLINE_FILTER_CLASS}>
                  <Search className="w-3.5 h-3.5 text-zinc-400 shrink-0" aria-hidden/>
                  <input type="search" value={settlementQuery} onChange={(event) => setSettlementQuery(event.target.value)} placeholder="Filter statements..." className={INLINE_FILTER_INPUT_CLASS}/>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="text-[10px] uppercase font-bold text-zinc-500 border-b dark:border-zinc-800">
                    <tr>
                      <th className="p-3">Statement</th>
                      <th className="p-3">Period</th>
                      <th className="p-3">Status</th>
                      <th className="p-3">Loads</th>
                      <th className="p-3">Gross Pay</th>
                      <th className="p-3">Net Pay</th>
                      <th className="p-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                    {profile.settlements.length === 0 ? (<tr>
                        <td colSpan={7} className="p-6 text-center text-zinc-500">
                          No settlement statements generated yet.
                        </td>
                      </tr>) : filteredSettlements.length === 0 ? (<tr>
                        <td colSpan={7} className="p-6 text-center text-zinc-500">
                          No statements match your search.
                        </td>
                      </tr>) : (visibleSettlements.map((settlement) => (<tr key={settlement.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30">
                          <td className="p-3">
                            <div className="flex flex-col gap-1.5 min-w-0">
                              <span className="font-mono text-xs font-bold text-zinc-900 dark:text-zinc-100 truncate">
                                {settlement.statement_number}
                              </span>
                            </div>
                          </td>
                          <td className="p-3 text-zinc-600 dark:text-zinc-400 text-xs">
                            {formatDate(settlement.start_date) ?? "Not Set"} –{" "}
                            {formatDate(settlement.end_date) ?? "Not Set"}
                          </td>
                          <td className="p-3">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                              {settlement.status}
                            </span>
                          </td>
                          <td className="p-3 text-zinc-600 dark:text-zinc-400">{settlement.load_count}</td>
                          <td className="p-3 text-zinc-700 dark:text-zinc-300">
                            ${formatCurrency(settlement.gross_driver_pay)}
                          </td>
                          <td className="p-3 font-semibold text-emerald-600 dark:text-emerald-400">
                            ${formatCurrency(settlement.net_driver_pay)}
                          </td>
                          <td className="p-3 text-right">
                            <button type="button" onClick={() => handleViewSettlement(settlement.id)} disabled={openingSettlementId === settlement.id} className={`${ACTION_BTN_CLASS} ml-auto disabled:opacity-50`}>
                              {openingSettlementId === settlement.id ? (<Loader2 size={12} className="animate-spin"/>) : (<FileText size={12}/>)}
                              View Settlement
                            </button>
                          </td>
                        </tr>)))}
                  </tbody>
                </table>
              </div>
              {filteredSettlements.length > TABLE_EXPAND_LIMIT ? (<button type="button" onClick={() => setIsSettlementsExpanded((expanded) => !expanded)} className={TABLE_EXPAND_FOOTER_CLASS}>
                  {isSettlementsExpanded
                        ? "Show Less"
                        : `View All (${filteredSettlements.length} Statements)`}
                </button>) : null}
            </div>
              </>) : null}

            {activeTab === "tasks-files" ? (<TasksAndFilesPanel rows={taskFileRows} uploadSlot={documentUploadSlot} notesById={docNotes} onNotesChange={(id, notes) => setDocNotes((prev) => ({ ...prev, [String(id)]: notes }))} onNotesBlur={handleNotesBlur} onDeleteDocument={handleDeleteDocument} emptyMessage="No documents or compliance tasks on file for this driver."/>) : null}
          </div>) : null}
    </div>);
    if (bare)
        return panel;
    return (<div className="fixed inset-0 z-[95] bg-black/5 dark:bg-black/30 flex items-center justify-center p-4">
      {panel}
    </div>);
}
