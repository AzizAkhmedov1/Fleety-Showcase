"use client";
import React, { useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import { Plus, Truck, X } from "lucide-react";
import { createApiClient } from "@/lib/api-client";
import { createTmsApi, DriverRecord, TruckRecord } from "@/lib/tms-api";
import { TRAILER_OWNERSHIP_TYPES, TRAILER_STATUS_OPTIONS, mergeTrailerMetadataIntoCustomFields, normalizeOwnershipType, normalizeTrailerStatus, type TrailerOwnershipType, type TrailerStatusOption, } from "@/lib/trailer-metadata";
import { sanitizePlateNumberInput, sanitizeVinInput, VIN_CHARACTER_LIMIT } from "@/lib/input-formatters";
interface RegisterEquipmentModalProps {
    isOpen: boolean;
    token: string;
    drivers: DriverRecord[];
    truckId?: number | null;
    initialTruck?: TruckRecord | null;
    onClose: () => void;
    onSuccess: () => void | Promise<void>;
}
const FIELD_CLASS = "w-full border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white p-2.5 rounded-lg text-sm mt-1 focus:ring-1 focus:ring-zinc-600 outline-none transition-colors";
const SAMSARA_INPUT_CLASS = "w-full rounded-lg border border-zinc-200 dark:border-zinc-800 bg-transparent px-3 py-2 text-sm mt-1 focus:ring-1 focus:ring-zinc-600 outline-none transition-colors";
const READONLY_FIELD_CLASS = "w-full border border-zinc-200 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-900/60 text-zinc-700 dark:text-zinc-300 p-2.5 rounded-lg text-sm mt-1 outline-none cursor-not-allowed";
type RegistrationMode = "truck" | "standalone_trailer";
type TruckFormState = {
    truck_number: string;
    trailer_number: string;
    vin: string;
    make: string;
    model: string;
    year: string;
    plate_number: string;
    ownership_type: TrailerOwnershipType;
    trailer_status: TrailerStatusOption;
    assigned_truck: string;
    trailer_notes: string;
    truck_notes: string;
    equipment_type: string;
    driver_id: string;
    co_driver_id: string;
    samsara_vehicle_id: string;
    custom_fields: Record<string, string>;
};
const emptyTruckForm = (): TruckFormState => ({
    truck_number: "",
    trailer_number: "",
    vin: "",
    make: "",
    model: "",
    year: "",
    plate_number: "",
    ownership_type: "Company",
    trailer_status: "Available",
    assigned_truck: "",
    trailer_notes: "",
    truck_notes: "",
    equipment_type: "Dry Van",
    driver_id: "",
    co_driver_id: "",
    samsara_vehicle_id: "",
    custom_fields: {} as Record<string, string>,
});
function readSamsaraVehicleId(customFields: Record<string, string> | undefined) {
    if (!customFields)
        return "";
    return String(customFields.samsara_vehicle_id || customFields.samsaraVehicleId || "").trim();
}
function buildCustomFieldsPayload(customFields: Record<string, string>, make: string, model: string, year: string, samsaraVehicleId: string, trailerMeta: {
    plateNumber: string;
    ownershipType: string;
    trailerStatus: string;
    assignedTruck: string;
    notes: string;
}) {
    const { samsara_vehicle_id: _a, samsaraVehicleId: _b, ...rest } = customFields;
    const payload = mergeTrailerMetadataIntoCustomFields(rest, {
        make,
        model,
        year,
        plateNumber: trailerMeta.plateNumber,
        ownershipType: normalizeOwnershipType(trailerMeta.ownershipType),
        trailerStatus: normalizeTrailerStatus(trailerMeta.trailerStatus),
        assignedTruck: trailerMeta.assignedTruck,
        notes: trailerMeta.notes,
    });
    const trimmedSamsara = samsaraVehicleId.trim();
    if (trimmedSamsara) {
        payload.samsara_vehicle_id = trimmedSamsara;
    }
    return payload;
}
export default function RegisterEquipmentModal({ isOpen, token, drivers, truckId = null, initialTruck = null, onClose, onSuccess, }: RegisterEquipmentModalProps) {
    const tmsApi = createTmsApi(createApiClient(token));
    const driverSelectRef = useRef<HTMLSelectElement>(null);
    const [saving, setSaving] = useState(false);
    const [registrationMode, setRegistrationMode] = useState<RegistrationMode>("truck");
    const [newTruckField, setNewTruckField] = useState("");
    const [truckForm, setTruckForm] = useState<TruckFormState>(emptyTruckForm);
    const isAssignMode = Boolean(truckId);
    const resetForm = () => {
        setTruckForm(emptyTruckForm());
        setNewTruckField("");
        setRegistrationMode("truck");
    };
    const populateFromTruck = (truck: TruckRecord) => {
        const customFields = { ...(truck.custom_fields || {}) };
        const samsaraVehicleId = readSamsaraVehicleId(customFields);
        delete customFields.samsara_vehicle_id;
        delete customFields.samsaraVehicleId;
        const { Make, Model, Year, plate_number, ownership_type, trailer_status, assigned_truck, trailer_notes, truck_notes, truckNotes, ...remainingCustomFields } = customFields;
        setTruckForm({
            truck_number: truck.truck_number || "",
            trailer_number: truck.trailer_number === "N/A" ? "" : truck.trailer_number || "",
            vin: sanitizeVinInput(truck.vin || ""),
            make: Make || "",
            model: Model || "",
            year: Year || "",
            plate_number: sanitizePlateNumberInput(plate_number || ""),
            ownership_type: normalizeOwnershipType(ownership_type),
            trailer_status: normalizeTrailerStatus(trailer_status),
            assigned_truck: assigned_truck || truck.truck_number || "",
            trailer_notes: trailer_notes || "",
            truck_notes: String(truck_notes || truckNotes || trailer_notes || "").trim(),
            equipment_type: truck.equipment_type || "Dry Van",
            driver_id: truck.driver_id ? String(truck.driver_id) : "",
            co_driver_id: truck.co_driver_id ? String(truck.co_driver_id) : "",
            samsara_vehicle_id: samsaraVehicleId,
            custom_fields: remainingCustomFields,
        });
    };
    useEffect(() => {
        if (!isOpen)
            return;
        if (initialTruck) {
            populateFromTruck(initialTruck);
        }
        else {
            resetForm();
        }
    }, [isOpen, initialTruck]);
    useEffect(() => {
        if (!isOpen || !isAssignMode)
            return;
        const timer = window.setTimeout(() => driverSelectRef.current?.focus(), 50);
        return () => window.clearTimeout(timer);
    }, [isOpen, isAssignMode]);
    const handleClose = () => {
        resetForm();
        onClose();
    };
    const isStandaloneMode = !isAssignMode && registrationMode === "standalone_trailer";
    const isTruckMode = !isStandaloneMode;
    const buildPayload = () => {
        if (isStandaloneMode) {
            const trailerNumber = truckForm.trailer_number.trim();
            const vin = truckForm.vin.trim();
            return {
                unitNumber: "",
                vin,
                make: truckForm.make.trim(),
                model: truckForm.model.trim(),
                year: truckForm.year.trim(),
                payload: {
                    asset_type: "standalone_trailer" as const,
                    trailer_number: trailerNumber,
                    vin,
                    equipment_type: truckForm.equipment_type || "Dry Van",
                    driver_id: null,
                    co_driver_id: null,
                    custom_fields: buildCustomFieldsPayload(truckForm.custom_fields, truckForm.make.trim(), truckForm.model.trim(), truckForm.year.trim(), "", {
                        plateNumber: truckForm.plate_number.trim(),
                        ownershipType: truckForm.ownership_type,
                        trailerStatus: truckForm.trailer_status,
                        assignedTruck: truckForm.assigned_truck.trim(),
                        notes: truckForm.trailer_notes.trim(),
                    }),
                },
            };
        }
        const unitNumber = truckForm.truck_number.trim();
        const vin = truckForm.vin.trim();
        const make = truckForm.make.trim();
        const model = truckForm.model.trim();
        const year = truckForm.year.trim();
        return {
            unitNumber,
            vin,
            make,
            model,
            year,
            payload: {
                asset_type: "truck" as const,
                truck_number: unitNumber,
                trailer_number: "N/A",
                vin,
                equipment_type: truckForm.equipment_type || "Dry Van",
                driver_id: truckForm.driver_id ? parseInt(truckForm.driver_id, 10) : null,
                co_driver_id: truckForm.co_driver_id ? parseInt(truckForm.co_driver_id, 10) : null,
                custom_fields: {
                    ...buildCustomFieldsPayload(truckForm.custom_fields, make, model, year, truckForm.samsara_vehicle_id, {
                        plateNumber: truckForm.plate_number.trim(),
                        ownershipType: truckForm.ownership_type,
                        trailerStatus: "Available",
                        assignedTruck: unitNumber,
                        notes: truckForm.truck_notes.trim(),
                    }),
                    truck_notes: truckForm.truck_notes.trim(),
                },
            },
        };
    };
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const { unitNumber, vin, make, model, year, payload } = buildPayload();
        if (isStandaloneMode) {
            if (!truckForm.trailer_number.trim()) {
                return toast.error("Trailer number is required.");
            }
            if (!isAssignMode) {
                if (!truckForm.make.trim())
                    return toast.error("Make is required.");
                if (!truckForm.model.trim())
                    return toast.error("Model is required.");
                if (!truckForm.year.trim())
                    return toast.error("Year is required.");
            }
        }
        else {
            if (!unitNumber)
                return toast.error("Unit number is required.");
            if (!vin)
                return toast.error("VIN is required.");
            if (!isAssignMode) {
                if (!make)
                    return toast.error("Make is required.");
                if (!model)
                    return toast.error("Model is required.");
                if (!year)
                    return toast.error("Year is required.");
            }
        }
        if (isAssignMode && !truckForm.driver_id) {
            return toast.error("Select a driver to assign to this unit.");
        }
        if (truckForm.driver_id &&
            truckForm.co_driver_id &&
            truckForm.driver_id === truckForm.co_driver_id) {
            return toast.error("Primary driver and co-driver must be different.");
        }
        setSaving(true);
        const toastId = toast.loading(isAssignMode
            ? "Saving assignment..."
            : isStandaloneMode
                ? "Registering trailer..."
                : "Registering truck...");
        try {
            if (isAssignMode && truckId) {
                await tmsApi.fleet.updateTruck(truckId, payload);
                resetForm();
                await onSuccess();
                toast.success("Driver assigned to unit successfully.", { id: toastId });
                onClose();
                return;
            }
            await tmsApi.fleet.createTruck(payload);
            resetForm();
            toast.success(isStandaloneMode ? "Trailer registered successfully." : "Truck registered successfully.", { id: toastId });
            await onSuccess();
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
            toast.error(typeof detail === "string"
                ? detail
                : isAssignMode
                    ? "Error saving driver assignment."
                    : "Error adding truck.", { id: toastId });
        }
        finally {
            setSaving(false);
        }
    };
    if (!isOpen)
        return null;
    const identityFieldClass = isAssignMode ? READONLY_FIELD_CLASS : FIELD_CLASS;
    return (<div className="fixed inset-0 z-[90] bg-zinc-900/70 dark:bg-[#0B0B0B]/85 flex items-end md:items-center justify-center p-0 md:p-4 backdrop-blur-sm">
      <div className="bg-white dark:bg-[#161616] border border-zinc-200 dark:border-zinc-800 rounded-t-xl md:rounded-2xl shadow-2xl w-full max-w-full md:max-w-2xl max-h-[calc(100svh-1rem)] md:max-h-[92vh] overflow-hidden flex flex-col">
        <div className="p-5 border-b border-zinc-100 dark:border-zinc-800 flex justify-between items-center bg-zinc-50 dark:bg-zinc-900/50 shrink-0">
          <div>
            <h3 className="font-bold text-lg text-zinc-900 dark:text-white flex items-center gap-2">
              <Truck className="text-zinc-500" size={20}/>
              {isAssignMode ? "Assign Driver to Unit" : "Register Equipment"}
            </h3>
            {isAssignMode && truckForm.truck_number ? (<p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                Unit #{truckForm.truck_number} needs a primary driver assignment.
              </p>) : null}
          </div>
          <button onClick={handleClose} className="text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-300 p-1.5 rounded-full transition-colors">
            <X size={20}/>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
          <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4">
          {!isAssignMode ? (<div className="flex rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-900/60 p-1 gap-1">
              <button type="button" onClick={() => setRegistrationMode("truck")} className={`flex-1 py-2 px-3 rounded-md text-xs font-semibold transition-all ${registrationMode === "truck"
                ? "bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-sm"
                : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"}`}>
                Truck
              </button>
              <button type="button" onClick={() => setRegistrationMode("standalone_trailer")} className={`flex-1 py-2 px-3 rounded-md text-xs font-semibold transition-all ${registrationMode === "standalone_trailer"
                ? "bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-sm"
                : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"}`}>
                Standalone Trailer
              </button>
            </div>) : null}

          {isTruckMode ? (<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                  Unit Number
                </label>
                <input type="text" required readOnly={isAssignMode} className={identityFieldClass} value={truckForm.truck_number} onChange={(e) => setTruckForm({ ...truckForm, truck_number: e.target.value })}/>
              </div>
              <div>
                <label className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                  VIN
                </label>
                <input type="text" required readOnly={isAssignMode} maxLength={VIN_CHARACTER_LIMIT} className={`${identityFieldClass} uppercase`} placeholder="17-character VIN" value={truckForm.vin} onChange={(e) => setTruckForm({ ...truckForm, vin: sanitizeVinInput(e.target.value) })}/>
              </div>
            </div>) : (<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                  Trailer Number
                </label>
                <input type="text" required className={FIELD_CLASS} value={truckForm.trailer_number} onChange={(e) => setTruckForm({ ...truckForm, trailer_number: e.target.value })}/>
              </div>
              <div>
                <label className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                  VIN
                </label>
                <input type="text" maxLength={VIN_CHARACTER_LIMIT} className={`${FIELD_CLASS} uppercase`} placeholder="17-character VIN" value={truckForm.vin} onChange={(e) => setTruckForm({ ...truckForm, vin: sanitizeVinInput(e.target.value) })}/>
              </div>
              <div>
                <label className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                  Equipment Type
                </label>
                <select className={FIELD_CLASS} value={truckForm.equipment_type} onChange={(e) => setTruckForm({ ...truckForm, equipment_type: e.target.value })}>
                  <option value="Dry Van">Dry Van</option>
                  <option value="Reefer">Reefer</option>
                  <option value="Flatbed">Flatbed</option>
                  <option value="Step Deck">Step Deck</option>
                </select>
              </div>
            </div>)}

          {!isAssignMode ? (<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                  Make
                </label>
                <input type="text" required className={FIELD_CLASS} value={truckForm.make} onChange={(e) => setTruckForm({ ...truckForm, make: e.target.value })}/>
              </div>
              <div>
                <label className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                  Model
                </label>
                <input type="text" required className={FIELD_CLASS} value={truckForm.model} onChange={(e) => setTruckForm({ ...truckForm, model: e.target.value })}/>
              </div>
              <div>
                <label className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                  Year
                </label>
                <input type="text" required inputMode="numeric" className={FIELD_CLASS} value={truckForm.year} onChange={(e) => setTruckForm({ ...truckForm, year: e.target.value })}/>
              </div>
            </div>) : isAssignMode ? (<div>
              <label className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                Equipment Type
              </label>
              <input type="text" readOnly className={READONLY_FIELD_CLASS} value={truckForm.equipment_type}/>
            </div>) : null}

          {!isAssignMode ? (<div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1 border-t border-zinc-100 dark:border-zinc-800">
              <div>
                <label className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                  Plate Number
                </label>
                <input type="text" className={`${FIELD_CLASS} uppercase`} placeholder="e.g., PA-9876X" value={truckForm.plate_number} onChange={(e) => setTruckForm({
                ...truckForm,
                plate_number: sanitizePlateNumberInput(e.target.value),
            })}/>
              </div>
              <div>
                <label className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                  Ownership Type
                </label>
                <select className={FIELD_CLASS} value={truckForm.ownership_type} onChange={(e) => setTruckForm({
                ...truckForm,
                ownership_type: normalizeOwnershipType(e.target.value),
            })}>
                  {TRAILER_OWNERSHIP_TYPES.map((option) => (<option key={option} value={option}>
                      {option}
                    </option>))}
                </select>
              </div>

              {isStandaloneMode ? (<>
                  <div>
                    <label className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                      Trailer Status
                    </label>
                    <select className={FIELD_CLASS} value={truckForm.trailer_status} onChange={(e) => setTruckForm({
                    ...truckForm,
                    trailer_status: normalizeTrailerStatus(e.target.value),
                })}>
                      {TRAILER_STATUS_OPTIONS.map((option) => (<option key={option} value={option}>
                          {option}
                        </option>))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                      Assigned Truck
                    </label>
                    <input type="text" className={FIELD_CLASS} placeholder="Unit # cross-reference" value={truckForm.assigned_truck} onChange={(e) => setTruckForm({ ...truckForm, assigned_truck: e.target.value })}/>
                  </div>
                  <div className="md:col-span-2">
                    <label className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                      Trailer Notes
                    </label>
                    <textarea rows={3} className={`${FIELD_CLASS} resize-y min-h-[80px]`} placeholder="Dispatcher notes for this trailer..." value={truckForm.trailer_notes} onChange={(e) => setTruckForm({ ...truckForm, trailer_notes: e.target.value })}/>
                  </div>
                </>) : (<div className="md:col-span-2">
                  <label className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                    Truck Notes
                  </label>
                  <textarea rows={3} className={`${FIELD_CLASS} resize-y min-h-[80px]`} placeholder="Dispatcher notes for this truck..." value={truckForm.truck_notes} onChange={(e) => setTruckForm({ ...truckForm, truck_notes: e.target.value })}/>
                </div>)}
            </div>) : null}

          {isTruckMode ? (<div>
              <label className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                Samsara Vehicle ID (Optional)
              </label>
              <input type="text" placeholder="e.g., 2834792374" className={SAMSARA_INPUT_CLASS} value={truckForm.samsara_vehicle_id || ""} onChange={(e) => setTruckForm({ ...truckForm, samsara_vehicle_id: e.target.value })}/>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1.5 italic">
                Optional. Used to explicitly tie this truck to its physical Samsara hardware if the
                truck number doesn&apos;t match the Samsara vehicle name.
              </p>
            </div>) : null}

          {isTruckMode ? (<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                Assign Active Driver
              </label>
              <select ref={driverSelectRef} className={FIELD_CLASS} value={truckForm.driver_id} onChange={(e) => setTruckForm({ ...truckForm, driver_id: e.target.value })}>
                <option value="">Unassigned / Solo Pool</option>
                {drivers
                .filter((d) => String(d.id) !== truckForm.co_driver_id)
                .map((d) => (<option key={d.id} value={d.id}>
                      {d.driver_name}
                    </option>))}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                Assign Co-Driver (Team Pool)
              </label>
              <select className={FIELD_CLASS} value={truckForm.co_driver_id} onChange={(e) => setTruckForm({ ...truckForm, co_driver_id: e.target.value })}>
                <option value="">Unassigned / Solo Pool</option>
                {drivers
                .filter((d) => String(d.id) !== truckForm.driver_id)
                .map((d) => (<option key={d.id} value={d.id}>
                      {d.driver_name}
                    </option>))}
              </select>
            </div>
          </div>) : null}

          {isTruckMode && !isAssignMode && Object.keys(truckForm.custom_fields).length > 0 && (<div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              {Object.keys(truckForm.custom_fields).map((key) => (<div key={key}>
                  <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 flex justify-between">
                    {key}
                    <button type="button" onClick={() => {
                    const newFields = { ...truckForm.custom_fields };
                    delete newFields[key];
                    setTruckForm({ ...truckForm, custom_fields: newFields });
                }} className="text-red-400 hover:text-red-600 transition-colors">
                      ×
                    </button>
                  </label>
                  <input type="text" className={`${FIELD_CLASS} bg-zinc-100 dark:bg-[#0B0B0B]/30`} value={truckForm.custom_fields[key] || ""} onChange={(e) => setTruckForm({
                    ...truckForm,
                    custom_fields: { ...truckForm.custom_fields, [key]: e.target.value },
                })}/>
                </div>))}
            </div>)}

          {isTruckMode && !isAssignMode && (<div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-zinc-100 dark:border-zinc-800 pt-4">
              <div className="flex flex-col sm:flex-row gap-2">
                <input type="text" placeholder="Add Custom Field (e.g. IFTA #)" className="flex-1 border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white p-2 rounded-lg text-sm outline-none focus:border-zinc-700 transition-colors" value={newTruckField} onChange={(e) => setNewTruckField(e.target.value)}/>
                <button type="button" onClick={() => {
                if (newTruckField) {
                    setTruckForm({
                        ...truckForm,
                        custom_fields: { ...truckForm.custom_fields, [newTruckField]: "" },
                    });
                    setNewTruckField("");
                }
            }} className="bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 px-3 py-2 rounded-lg text-sm font-semibold flex items-center gap-1 transition-colors shrink-0">
                  <Plus size={16}/> Add
                </button>
              </div>
            </div>)}

          </div>

          <div className="shrink-0 p-4 md:p-6 border-t border-zinc-100 dark:border-zinc-800">
          <button type="submit" disabled={saving} className="w-full py-2.5 bg-zinc-800 dark:bg-zinc-700 hover:bg-zinc-900 disabled:opacity-60 text-white rounded-lg text-sm font-semibold shadow-sm transition-all">
            {saving
            ? isAssignMode
                ? "Saving..."
                : isStandaloneMode
                    ? "Registering..."
                    : "Registering..."
            : isAssignMode
                ? "Save Assignment"
                : isStandaloneMode
                    ? "Register Trailer"
                    : "Register Asset"}
          </button>
          </div>
        </form>
      </div>
    </div>);
}
