"use client";
import React, { useRef, useState } from "react";
import axios from "axios";
import toast from "react-hot-toast";
import { Loader2, Paperclip, Plus, Users, X } from "lucide-react";
import { createApiClient } from "@/lib/api-client";
import { createTmsApi, DriverDocumentParseResult, } from "@/lib/tms-api";
import { formatPhoneDisplay, sanitizePhoneDigits } from "@/lib/input-formatters";
interface OnboardDriverModalProps {
    isOpen: boolean;
    token: string;
    onClose: () => void;
    onSuccess: () => void | Promise<void>;
}
const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const FIELD_CLASS = "w-full border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white p-2.5 rounded-lg text-sm mt-1 focus:ring-1 focus:ring-zinc-600 outline-none transition-colors";
const PARSEABLE_DOC_TYPES = new Set(["Driver's License", "Medical Card", "TWIC Card"]);
type DriverFormState = {
    driver_name: string;
    cdl_number: string;
    phone_number: string;
    email: string;
    pay_percentage: number;
    custom_fields: Record<string, string>;
};
type AttachedDriverDoc = {
    id: string;
    type: string;
    file: File;
    extraction?: DriverDocumentParseResult;
};
type CustomDocumentRow = {
    id: string;
    name: string;
    file: File | null;
};
const FIXED_DOCUMENT_TYPES = ["Driver's License", "Medical Card"] as const;
function applyDocumentExtraction(prev: DriverFormState, result: DriverDocumentParseResult): DriverFormState {
    const custom_fields = { ...prev.custom_fields };
    let driver_name = prev.driver_name;
    let cdl_number = prev.cdl_number;
    if (result.license) {
        if (result.license.full_name)
            driver_name = result.license.full_name;
        if (result.license.license_number)
            cdl_number = result.license.license_number;
        if (result.license.state)
            custom_fields["License State"] = result.license.state;
        if (result.license.expiration_date) {
            custom_fields["CDL Expiration"] = result.license.expiration_date;
        }
    }
    if (result.medical_card) {
        if (result.medical_card.full_name && !driver_name) {
            driver_name = result.medical_card.full_name;
        }
        if (result.medical_card.expiration_date) {
            custom_fields["Medical Card Expiration"] = result.medical_card.expiration_date;
        }
        if (result.medical_card.certificate_number) {
            custom_fields["Medical Certificate #"] = result.medical_card.certificate_number;
        }
    }
    if (result.twic_card) {
        if (result.twic_card.full_name && !driver_name) {
            driver_name = result.twic_card.full_name;
        }
        if (result.twic_card.expiration_date) {
            custom_fields["TWIC Expiration"] = result.twic_card.expiration_date;
        }
    }
    return { ...prev, driver_name, cdl_number, custom_fields };
}
function hasExtractedFields(result: DriverDocumentParseResult): boolean {
    const license = result.license;
    const medical = result.medical_card;
    const twic = result.twic_card;
    return Boolean(license?.full_name ||
        license?.license_number ||
        license?.state ||
        license?.expiration_date ||
        medical?.full_name ||
        medical?.expiration_date ||
        medical?.certificate_number ||
        twic?.full_name ||
        twic?.expiration_date);
}
export default function OnboardDriverModal({ isOpen, token, onClose, onSuccess, }: OnboardDriverModalProps) {
    const tmsApi = createTmsApi(createApiClient(token));
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [saving, setSaving] = useState(false);
    const [parsingDoc, setParsingDoc] = useState(false);
    const [newDriverField, setNewDriverField] = useState("");
    const [attachedDocs, setAttachedDocs] = useState<AttachedDriverDoc[]>([]);
    const [customDocRows, setCustomDocRows] = useState<CustomDocumentRow[]>([]);
    const [pendingDriverDocType, setPendingDriverDocType] = useState<string>(FIXED_DOCUMENT_TYPES[0]);
    const [driverForm, setDriverForm] = useState<DriverFormState>({
        driver_name: "",
        cdl_number: "",
        phone_number: "",
        email: "",
        pay_percentage: 20,
        custom_fields: {},
    });
    const clearFileInput = () => {
        if (fileInputRef.current) {
            fileInputRef.current.value = "";
        }
    };
    const resetForm = () => {
        setDriverForm({
            driver_name: "",
            cdl_number: "",
            phone_number: "",
            email: "",
            pay_percentage: 20,
            custom_fields: {},
        });
        setNewDriverField("");
        setAttachedDocs([]);
        setCustomDocRows([]);
        setPendingDriverDocType(FIXED_DOCUMENT_TYPES[0]);
        setParsingDoc(false);
        clearFileInput();
    };
    const handleClose = () => {
        resetForm();
        onClose();
    };
    const removeAttachedDoc = (id: string) => {
        setAttachedDocs((prev) => prev.filter((doc) => doc.id !== id));
    };
    const addCustomDocRow = () => {
        setCustomDocRows((prev) => [
            ...prev,
            { id: crypto.randomUUID(), name: "", file: null },
        ]);
    };
    const updateCustomDocRow = (id: string, patch: Partial<Pick<CustomDocumentRow, "name" | "file">>) => {
        setCustomDocRows((prev) => prev.map((row) => (row.id === id ? { ...row, ...patch } : row)));
    };
    const removeCustomDocRow = (id: string) => {
        setCustomDocRows((prev) => prev.filter((row) => row.id !== id));
    };
    const buildDocumentUploadPayload = () => {
        const standardUploads = attachedDocs.map(({ type, file }) => ({
            document_type: type,
            file,
        }));
        const customUploads = customDocRows
            .filter((row) => row.name.trim() && row.file)
            .map((row) => ({
            document_type: row.name.trim(),
            file: row.file as File,
        }));
        return [...standardUploads, ...customUploads];
    };
    const handleDocumentFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file)
            return;
        const documentType = pendingDriverDocType;
        setParsingDoc(true);
        const toastId = toast.loading(`Scanning ${documentType}...`);
        let extraction: DriverDocumentParseResult | undefined;
        try {
            if (PARSEABLE_DOC_TYPES.has(documentType)) {
                extraction = await tmsApi.fleet.parseDriverDocument(file, documentType);
                setDriverForm((prev) => applyDocumentExtraction(prev, extraction!));
                if (hasExtractedFields(extraction)) {
                    toast.success(`${documentType} scanned — form updated.`, { id: toastId });
                }
                else {
                    toast.success(`${documentType} attached.`, { id: toastId });
                }
            }
            else {
                toast.success(`${documentType} attached.`, { id: toastId });
            }
            setAttachedDocs((prev) => [
                ...prev,
                {
                    id: crypto.randomUUID(),
                    type: documentType,
                    file,
                    extraction,
                },
            ]);
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
            toast.error(typeof detail === "string" ? detail : "Could not parse document. File not attached.", { id: toastId });
        }
        finally {
            clearFileInput();
            setParsingDoc(false);
        }
    };
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const incompleteCustomRow = customDocRows.find((row) => (row.name.trim() && !row.file) || (!row.name.trim() && row.file));
        if (incompleteCustomRow) {
            toast.error("Each custom document needs both a name and a file.");
            return;
        }
        const documentUploads = buildDocumentUploadPayload();
        setSaving(true);
        const toastId = toast.loading("Saving driver profile...");
        try {
            const res = await axios.post(`${API_URL}/api/drivers`, {
                ...driverForm,
                phone_number: sanitizePhoneDigits(driverForm.phone_number) || "",
            }, {
                withCredentials: true,
            });
            const newDriverId = res.data?.id;
            if (documentUploads.length > 0 && newDriverId) {
                await tmsApi.fleet.uploadDriverDocuments(newDriverId, documentUploads);
            }
            resetForm();
            await onSuccess();
            toast.success(documentUploads.length > 0
                ? `Driver added with ${documentUploads.length} document${documentUploads.length === 1 ? "" : "s"}.`
                : "Driver successfully added!", { id: toastId });
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
            toast.error(typeof detail === "string" ? detail : "Error adding driver.", { id: toastId });
        }
        finally {
            setSaving(false);
        }
    };
    if (!isOpen)
        return null;
    return (<div className="fixed inset-0 z-[90] bg-zinc-900/70 dark:bg-[#0B0B0B]/85 flex items-end md:items-center justify-center p-0 md:p-4 backdrop-blur-sm">
      <div className="bg-white dark:bg-[#161616] border border-zinc-200 dark:border-zinc-800 rounded-t-xl md:rounded-2xl shadow-2xl w-full max-w-full md:max-w-2xl max-h-[calc(100svh-1rem)] md:max-h-[92vh] overflow-hidden flex flex-col">
        <div className="p-5 border-b border-zinc-100 dark:border-zinc-800 flex justify-between items-center bg-zinc-50 dark:bg-zinc-900/50 shrink-0">
          <h3 className="font-bold text-lg text-zinc-900 dark:text-white flex items-center gap-2">
            <Users className="text-zinc-500" size={20}/>
            Onboard New Driver
          </h3>
          <button onClick={handleClose} className="text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-300 p-1.5 rounded-full transition-colors">
            <X size={20}/>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
          <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                Full Name
              </label>
              <input type="text" required className={FIELD_CLASS} value={driverForm.driver_name} onChange={(e) => setDriverForm({ ...driverForm, driver_name: e.target.value })}/>
            </div>
            <div>
              <label className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                CDL License #
              </label>
              <input type="text" className={FIELD_CLASS} value={driverForm.cdl_number} onChange={(e) => setDriverForm({ ...driverForm, cdl_number: e.target.value })}/>
            </div>
            <div>
              <label className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                Phone Number
              </label>
              <input type="tel" inputMode="numeric" autoComplete="tel" maxLength={14} className={FIELD_CLASS} placeholder="(555) 555-5555" value={driverForm.phone_number} onChange={(e) => setDriverForm({
            ...driverForm,
            phone_number: formatPhoneDisplay(e.target.value),
        })}/>
            </div>
            <div>
              <label className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                Email Address
              </label>
              <input type="email" className={FIELD_CLASS} value={driverForm.email} onChange={(e) => setDriverForm({ ...driverForm, email: e.target.value })}/>
            </div>
            <div>
              <label className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                Driver Pay Percentage (%)
              </label>
              <input type="number" required className={FIELD_CLASS} value={driverForm.pay_percentage} onChange={(e) => setDriverForm({
            ...driverForm,
            pay_percentage: parseFloat(e.target.value) || 0,
        })}/>
            </div>
          </div>

          {Object.keys(driverForm.custom_fields).length > 0 && (<div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              {Object.keys(driverForm.custom_fields).map((key) => (<div key={key}>
                  <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 flex justify-between">
                    {key}
                    <button type="button" onClick={() => {
                    const newFields = { ...driverForm.custom_fields };
                    delete newFields[key];
                    setDriverForm({ ...driverForm, custom_fields: newFields });
                }} className="text-red-400 hover:text-red-600 dark:text-red-500 transition-colors">
                      ×
                    </button>
                  </label>
                  <input type="text" className={`${FIELD_CLASS} bg-zinc-100 dark:bg-[#0B0B0B]/30`} value={driverForm.custom_fields[key] || ""} onChange={(e) => setDriverForm({
                    ...driverForm,
                    custom_fields: { ...driverForm.custom_fields, [key]: e.target.value },
                })}/>
                </div>))}
            </div>)}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-zinc-100 dark:border-zinc-800 pt-4">
            <div className="flex flex-col sm:flex-row gap-2">
              <input type="text" placeholder="Add Custom Field (e.g. SSN)" className="w-full flex-1 border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white p-2 rounded-lg text-sm outline-none focus:border-zinc-700 transition-colors" value={newDriverField} onChange={(e) => setNewDriverField(e.target.value)}/>
              <button type="button" onClick={() => {
            if (newDriverField) {
                setDriverForm({
                    ...driverForm,
                    custom_fields: { ...driverForm.custom_fields, [newDriverField]: "" },
                });
                setNewDriverField("");
            }
        }} className="bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 px-3 py-2 rounded-lg text-sm font-semibold flex items-center gap-1 transition-colors shrink-0">
                <Plus size={16}/> Add
              </button>
            </div>
          </div>

          <div className="border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 bg-zinc-50 dark:bg-zinc-900/40 transition-colors">
            <label className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 block mb-2">
              Attach Documents (Optional)
            </label>
            <select className="w-full border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white p-2 rounded-lg text-sm mb-3 outline-none focus:ring-1 focus:ring-zinc-600 transition-colors" value={pendingDriverDocType} onChange={(e) => setPendingDriverDocType(e.target.value)} disabled={parsingDoc}>
              {FIXED_DOCUMENT_TYPES.map((docType) => (<option key={docType} value={docType}>
                  {docType}
                </option>))}
              <option value="TWIC Card">TWIC Card</option>
              <option value="Driver Document">Other Document</option>
            </select>
            <div className="flex items-center gap-3">
              <input ref={fileInputRef} type="file" id="onboard-driver-doc-modal" className="hidden" accept=".pdf,.png,.jpg,.jpeg" onChange={(e) => void handleDocumentFileChange(e)}/>
              <button type="button" onClick={() => fileInputRef.current?.click()} disabled={parsingDoc} className="flex items-center gap-2 text-xs font-bold bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 disabled:opacity-60 px-3 py-2 rounded-lg transition-colors">
                {parsingDoc ? <Loader2 size={14} className="animate-spin"/> : <Paperclip size={14}/>}
                Choose File
              </button>
              {parsingDoc && (<span className="text-xs text-zinc-500 dark:text-zinc-400">Scanning document...</span>)}
            </div>

            {attachedDocs.length > 0 && (<ul className="mt-3 space-y-2">
                {attachedDocs.map((doc) => (<li key={doc.id} className="flex items-center justify-between gap-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-xs">
                    <span className="font-medium text-zinc-700 dark:text-zinc-200 truncate">
                      <span className="text-zinc-500 dark:text-zinc-400">{doc.type}:</span>{" "}
                      {doc.file.name}
                    </span>
                    <button type="button" onClick={() => removeAttachedDoc(doc.id)} className="shrink-0 text-zinc-400 hover:text-red-500 transition-colors p-0.5" aria-label={`Remove ${doc.type}`}>
                      <X size={14}/>
                    </button>
                  </li>))}
              </ul>)}

            <div className="mt-4 pt-4 border-t border-zinc-200 dark:border-zinc-700 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                  Custom Documents
                </p>
                <button type="button" onClick={addCustomDocRow} disabled={parsingDoc} className="flex items-center gap-1 text-xs font-bold bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 disabled:opacity-60 px-3 py-1.5 rounded-lg transition-colors">
                  <Plus size={14}/>
                  Add Custom Document
                </button>
              </div>

              {customDocRows.length === 0 ? (<p className="text-xs text-zinc-500 dark:text-zinc-400">
                  Add labels like &quot;Safety Cert&quot; or &quot;W-2&quot; with an attached file.
                </p>) : (<ul className="space-y-3">
                  {customDocRows.map((row) => (<li key={row.id} className="grid grid-cols-1 md:grid-cols-[1fr_minmax(0,1.2fr)_auto] gap-2 items-center rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-3">
                      <input type="text" placeholder='Document name (e.g. "Safety Cert")' className="w-full border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-white p-2 rounded-lg text-sm outline-none focus:ring-1 focus:ring-zinc-600 transition-colors" value={row.name} onChange={(e) => updateCustomDocRow(row.id, { name: e.target.value })}/>
                      <input type="file" accept=".pdf,.png,.jpg,.jpeg" className="w-full text-xs text-zinc-600 dark:text-zinc-300 file:mr-3 file:rounded-md file:border-0 file:bg-zinc-100 file:dark:bg-zinc-800 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-zinc-700 file:dark:text-zinc-200 hover:file:bg-zinc-200 file:dark:hover:bg-zinc-700" onChange={(e) => updateCustomDocRow(row.id, { file: e.target.files?.[0] ?? null })}/>
                      <button type="button" onClick={() => removeCustomDocRow(row.id)} className="justify-self-end sm:justify-self-center text-zinc-400 hover:text-red-500 transition-colors p-1" aria-label="Remove custom document row">
                        <X size={16}/>
                      </button>
                    </li>))}
                </ul>)}
            </div>
          </div>
          </div>

          <div className="shrink-0 p-4 md:p-6 border-t border-zinc-100 dark:border-zinc-800">
          <button type="submit" disabled={saving || parsingDoc} className="w-full py-2.5 bg-zinc-800 dark:bg-zinc-700 hover:bg-zinc-900 disabled:opacity-60 text-white rounded-lg text-sm font-semibold shadow-sm transition-all">
            {saving ? "Saving..." : "Save Driver Profile"}
          </button>
          </div>
        </form>
      </div>
    </div>);
}
