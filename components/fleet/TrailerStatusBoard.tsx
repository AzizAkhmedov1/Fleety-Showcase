'use client';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import toast from 'react-hot-toast';
import StatusDropdown from '@/components/ui/StatusDropdown';
import { formatTitleCaseLabel } from '@/lib/display-labels';
import type { TruckRecord } from '@/lib/tms-api';
import { TRAILER_OWNERSHIP_TYPES, TRAILER_STATUS_OPTIONS, TRAILER_STATUS_STYLES, dedupeTrailerBoardRecords, extractTrailerMetadata, formatMakeModel, getRawAssignedTruck, mergeTrailerMetadataIntoCustomFields, resolveAssignedTruckDisplay, type TrailerMetadata, type TrailerOwnershipType, type TrailerStatusOption, } from '@/lib/trailer-metadata';
export type UpdateTruckPayload = {
    truck_number?: string | null;
    trailer_number: string;
    vin?: string | null;
    year?: number | null;
    equipment_type: string;
    driver_id: number | null;
    co_driver_id?: number | null;
    custom_fields: Record<string, string>;
    samsara_vehicle_id?: string | null;
};
interface TrailerStatusBoardProps {
    trucks: TruckRecord[];
    updateTruck: (id: number, payload: UpdateTruckPayload) => Promise<void>;
}
const INPUT_CLASS = 'bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 rounded-lg p-1.5 text-sm w-full outline-none focus:ring-2 focus:ring-blue-500/40 transition-colors';
const SELECT_CLASS = 'bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 rounded-lg p-1.5 text-sm w-full outline-none focus:ring-2 focus:ring-blue-500/40 transition-colors';
const NOTES_TEXTAREA_CLASS = 'w-full rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-200 text-sm p-3 outline-none focus:ring-2 focus:ring-zinc-600/40 resize-y min-h-[120px] transition-colors';
const SAVE_DEBOUNCE_MS = 800;
export interface TrailerFormDraft {
    make: string;
    model: string;
    year: string;
    vin: string;
    plateNumber: string;
    ownershipType: TrailerOwnershipType;
    assignedTruck: string;
    notes: string;
}
function metadataToDraft(truck: TruckRecord, metadata: TrailerMetadata): TrailerFormDraft {
    const yearValue = truck.year != null && Number.isFinite(truck.year) ? String(truck.year) : metadata.year;
    return {
        make: metadata.make,
        model: metadata.model,
        year: yearValue,
        vin: metadata.vin,
        plateNumber: metadata.plateNumber,
        ownershipType: metadata.ownershipType,
        assignedTruck: getRawAssignedTruck(truck),
        notes: metadata.notes,
    };
}
function parseTrailerYearValue(value: string): number | null {
    const digits = value.replace(/[^\d]/g, '');
    if (!digits)
        return null;
    const parsed = parseInt(digits, 10);
    if (!Number.isFinite(parsed) || parsed < 1900 || parsed > 2100)
        return null;
    return parsed;
}
function AssignedTruckDisplay({ truck, metadata, fleet, }: {
    truck: TruckRecord;
    metadata: TrailerMetadata;
    fleet: TruckRecord[];
}) {
    const { text, isUnassigned } = resolveAssignedTruckDisplay(truck, metadata, fleet);
    return (<span className={isUnassigned
            ? 'text-zinc-400 dark:text-zinc-500 font-normal'
            : 'font-medium text-zinc-900 dark:text-zinc-200'}>
      {text}
    </span>);
}
function AssignedTruckDetailField({ truck, metadata, fleet, }: {
    truck: TruckRecord;
    metadata: TrailerMetadata;
    fleet: TruckRecord[];
}) {
    const { text, isUnassigned } = resolveAssignedTruckDisplay(truck, metadata, fleet);
    return (<div>
      <p className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 mb-1">
        Assigned Truck
      </p>
      <p className={`text-sm break-words ${isUnassigned
            ? 'text-zinc-400 dark:text-zinc-500 font-normal'
            : 'font-medium text-zinc-900 dark:text-zinc-100'}`}>
        {text}
      </p>
    </div>);
}
function EditableField({ label, value, onChange, placeholder, }: {
    label: string;
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
}) {
    return (<div onClick={(e) => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()}>
      <label className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 mb-1 block">
        {label}
      </label>
      <input type="text" value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} onClick={(e) => e.stopPropagation()} className={INPUT_CLASS}/>
    </div>);
}
function DetailField({ label, value }: {
    label: string;
    value: string;
}) {
    return (<div>
      <p className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 mb-1">
        {label}
      </p>
      <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100 break-words">{value || '—'}</p>
    </div>);
}
function ExpandedTrailerPanel({ truck, metadata, fleet, onDraftChange, }: {
    truck: TruckRecord;
    metadata: TrailerMetadata;
    fleet: TruckRecord[];
    onDraftChange: (draft: TrailerFormDraft) => void;
}) {
    const [draft, setDraft] = useState<TrailerFormDraft>(() => metadataToDraft(truck, metadata));
    useEffect(() => {
        setDraft(metadataToDraft(truck, metadata));
    }, [truck.id]);
    const patchDraft = useCallback((patch: Partial<TrailerFormDraft>) => {
        setDraft((prev) => {
            const next = { ...prev, ...patch };
            onDraftChange(next);
            return next;
        });
    }, [onDraftChange]);
    return (<div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 border-t border-b border-zinc-200 dark:border-zinc-800/60 bg-zinc-50/50 dark:bg-zinc-950/40 transition-colors" onClick={(e) => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()}>
      <div className="space-y-3">
        <p className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">
          Specifications
        </p>
        <EditableField label="Make" value={draft.make} onChange={(make) => patchDraft({ make })} placeholder="Utility"/>
        <EditableField label="Model" value={draft.model} onChange={(model) => patchDraft({ model })} placeholder="3000R"/>
        <EditableField label="Year" value={draft.year} onChange={(year) => patchDraft({ year })} placeholder="2022"/>
        <EditableField label="VIN" value={draft.vin} onChange={(vin) => patchDraft({ vin })} placeholder="17-character VIN"/>
        <EditableField label="Plate Number" value={draft.plateNumber} onChange={(plateNumber) => patchDraft({ plateNumber })} placeholder="PA-9876X"/>
      </div>

      <div className="space-y-3">
        <p className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">
          Logistics & Registry
        </p>
        <div onClick={(e) => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()}>
          <label className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 mb-1 block">
            Ownership Type
          </label>
          <select value={draft.ownershipType} onChange={(e) => patchDraft({ ownershipType: e.target.value as TrailerOwnershipType })} onClick={(e) => e.stopPropagation()} className={SELECT_CLASS}>
            {TRAILER_OWNERSHIP_TYPES.map((option) => (<option key={option} value={option}>
                {option}
              </option>))}
          </select>
        </div>
        <AssignedTruckDetailField truck={truck} metadata={metadata} fleet={fleet}/>
        <EditableField label="Link Power Unit" value={draft.assignedTruck} onChange={(assignedTruck) => patchDraft({ assignedTruck })} placeholder="#22333"/>
        <DetailField label="Equipment Type" value={truck.equipment_type || '—'}/>
      </div>

      <div className="space-y-3">
        <p className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">
          Internal Status
        </p>
        <DetailField label="Trailer Status" value={metadata.trailerStatus}/>
      </div>

      <div className="space-y-2 col-span-2 md:col-span-1">
        <p className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">
          Dispatcher Notes
        </p>
        <textarea rows={5} value={draft.notes} onChange={(e) => patchDraft({ notes: e.target.value })} onClick={(e) => e.stopPropagation()} placeholder="Add trailer notes for dispatch..." className={NOTES_TEXTAREA_CLASS}/>
      </div>
    </div>);
}
function buildUpdatePayload(truck: TruckRecord, customFields: Record<string, string>, vin?: string | null, year?: number | null): UpdateTruckPayload {
    return {
        truck_number: truck.truck_number ?? null,
        trailer_number: truck.trailer_number || 'N/A',
        vin: vin !== undefined ? vin : truck.vin ?? null,
        year: year !== undefined ? year : truck.year ?? null,
        equipment_type: truck.equipment_type || 'Dry Van',
        driver_id: truck.driver_id ?? null,
        co_driver_id: truck.co_driver_id ?? null,
        custom_fields: customFields,
    };
}
export default function TrailerStatusBoard({ trucks, updateTruck }: TrailerStatusBoardProps) {
    const trailerRows = useMemo(() => dedupeTrailerBoardRecords(trucks), [trucks]);
    const [expandedRowIds, setExpandedRowIds] = useState<Set<number>>(() => new Set());
    const [updatingTrailerStatusId, setUpdatingTrailerStatusId] = useState<number | null>(null);
    const fieldSaveTimers = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());
    const pendingDrafts = useRef<Map<number, TrailerFormDraft>>(new Map());
    const savingIds = useRef<Set<number>>(new Set());
    const toggleRow = useCallback((truckId: number) => {
        setExpandedRowIds((prev) => {
            const next = new Set(prev);
            if (next.has(truckId)) {
                next.delete(truckId);
            }
            else {
                next.add(truckId);
            }
            return next;
        });
    }, []);
    const persistTrailerDraft = useCallback(async (truck: TruckRecord, draft: TrailerFormDraft) => {
        if (savingIds.current.has(truck.id))
            return;
        savingIds.current.add(truck.id);
        try {
            const customFields = mergeTrailerMetadataIntoCustomFields(truck.custom_fields, {
                make: draft.make,
                model: draft.model,
                year: draft.year,
                plateNumber: draft.plateNumber,
                ownershipType: draft.ownershipType,
                assignedTruck: draft.assignedTruck,
                notes: draft.notes,
            });
            delete customFields.Mileage;
            delete customFields.mileage;
            await updateTruck(truck.id, buildUpdatePayload(truck, customFields, draft.vin.trim() || null, parseTrailerYearValue(draft.year)));
        }
        catch {
            toast.error('Failed to save trailer record.');
        }
        finally {
            savingIds.current.delete(truck.id);
        }
    }, [updateTruck]);
    const persistCustomFields = useCallback(async (truck: TruckRecord, patch: Parameters<typeof mergeTrailerMetadataIntoCustomFields>[1]) => {
        if (savingIds.current.has(truck.id))
            return;
        savingIds.current.add(truck.id);
        try {
            const customFields = mergeTrailerMetadataIntoCustomFields(truck.custom_fields, patch);
            await updateTruck(truck.id, buildUpdatePayload(truck, customFields));
        }
        catch {
            toast.error('Failed to save trailer record.');
        }
        finally {
            savingIds.current.delete(truck.id);
        }
    }, [updateTruck]);
    const scheduleTrailerDraftSave = useCallback((truck: TruckRecord, draft: TrailerFormDraft) => {
        pendingDrafts.current.set(truck.id, draft);
        const existing = fieldSaveTimers.current.get(truck.id);
        if (existing)
            clearTimeout(existing);
        fieldSaveTimers.current.set(truck.id, setTimeout(() => {
            fieldSaveTimers.current.delete(truck.id);
            const snapshot = pendingDrafts.current.get(truck.id);
            if (snapshot) {
                void persistTrailerDraft(truck, snapshot);
            }
        }, SAVE_DEBOUNCE_MS));
    }, [persistTrailerDraft]);
    const handleTrailerStatusChange = useCallback(async (truck: TruckRecord, status: TrailerStatusOption) => {
        setUpdatingTrailerStatusId(truck.id);
        try {
            await persistCustomFields(truck, { trailerStatus: status });
        }
        finally {
            setUpdatingTrailerStatusId(null);
        }
    }, [persistCustomFields]);
    useEffect(() => {
        const timers = fieldSaveTimers.current;
        return () => {
            timers.forEach((timer) => clearTimeout(timer));
            timers.clear();
        };
    }, []);
    return (<section id="trailer-status-board" className="bg-white dark:bg-[#161616] rounded-2xl shadow-sm border border-zinc-200 dark:border-zinc-800 overflow-hidden transition-colors">
      <div className="p-5 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/80 transition-colors">
        <h2 className="font-bold text-base text-zinc-900 dark:text-white">Trailer Status Board</h2>
        <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
          {trailerRows.length} trailer{trailerRows.length === 1 ? '' : 's'} on roster
        </p>
      </div>

      {trailerRows.length === 0 ? (<div className="p-8 text-center text-zinc-400 dark:text-zinc-500 text-sm dark:bg-[#161616]">
          No trailers registered in system yet.
        </div>) : (<div className="w-full overflow-x-auto">
          <table className="w-full text-left dark:bg-[#161616] min-w-[520px] lg:min-w-[1020px]">
            <thead className="bg-zinc-50 dark:bg-zinc-950 text-zinc-500 dark:text-zinc-400 text-xs font-semibold border-b border-zinc-200 dark:border-zinc-800 transition-colors">
              <tr>
                <th className="p-4 w-40">Trailer ID</th>
                <th className="p-4 hidden md:table-cell">Type</th>
                <th className="p-4">Trailer Status</th>
                <th className="p-4 hidden lg:table-cell">Assigned Truck</th>
                <th className="p-4 hidden md:table-cell">Ownership</th>
                <th className="p-4 hidden md:table-cell">Make / Model</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800 text-sm transition-colors dark:bg-[#161616]">
              {trailerRows.map((truck) => {
                const metadata = extractTrailerMetadata(truck);
                const isExpanded = expandedRowIds.has(truck.id);
                const assignedTruckKey = getRawAssignedTruck(truck).trim() || 'unassigned';
                return (<React.Fragment key={`${truck.id}-${assignedTruckKey}`}>
                    <tr role="button" tabIndex={0} aria-expanded={isExpanded} onClick={() => toggleRow(truck.id)} onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            toggleRow(truck.id);
                        }
                    }} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-900/60 dark:bg-zinc-950/20 transition-colors cursor-pointer">
                      <td className="p-4 font-bold text-zinc-900 dark:text-white">
                        <div className="flex items-center gap-2">
                          <ChevronDown size={16} className={`shrink-0 text-zinc-400 dark:text-zinc-500 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} aria-hidden/>
                          <span className="font-mono">{truck.trailer_number || 'N/A'}</span>
                        </div>
                      </td>
                      <td className="p-4 hidden md:table-cell">
                        <span className="text-xs font-semibold bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 px-2 py-0.5 rounded-md border border-zinc-300 dark:border-zinc-700">
                          {formatTitleCaseLabel(truck.equipment_type || '—')}
                        </span>
                      </td>
                      <td className="p-4" onClick={(e) => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()}>
                        <div className="inline-block" onClick={(e) => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()}>
                          <StatusDropdown value={metadata.trailerStatus} options={TRAILER_STATUS_OPTIONS} onSelect={(status) => void handleTrailerStatusChange(truck, status as TrailerStatusOption)} badgeClass={TRAILER_STATUS_STYLES[metadata.trailerStatus]} formatLabel={formatTitleCaseLabel} disabled={updatingTrailerStatusId === truck.id} minWidthClass="min-w-[168px]"/>
                        </div>
                      </td>
                      <td className="p-4 hidden lg:table-cell">
                        <AssignedTruckDisplay truck={truck} metadata={metadata} fleet={trucks}/>
                      </td>
                      <td className="p-4 text-zinc-700 dark:text-zinc-200 hidden md:table-cell">
                        <span className="text-xs font-semibold tracking-wide bg-zinc-100 dark:bg-zinc-800/80 text-zinc-700 dark:text-zinc-200 px-2 py-0.5 rounded-md border border-zinc-200 dark:border-zinc-700">
                          {metadata.ownershipType}
                        </span>
                      </td>
                      <td className="p-4 text-zinc-600 dark:text-zinc-300 hidden md:table-cell">{formatMakeModel(metadata)}</td>
                    </tr>
                    {isExpanded ? (<tr className="animate-in fade-in slide-in-from-top-1 duration-200">
                        <td colSpan={6} className="p-0">
                          <ExpandedTrailerPanel truck={truck} metadata={metadata} fleet={trucks} onDraftChange={(draft) => scheduleTrailerDraftSave(truck, draft)}/>
                        </td>
                      </tr>) : null}
                  </React.Fragment>);
            })}
            </tbody>
          </table>
        </div>)}
    </section>);
}
