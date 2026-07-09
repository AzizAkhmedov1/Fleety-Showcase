'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Bell, Calendar, Check, ChevronDown, ChevronLeft, ChevronRight, FileText, List, Loader2, MapPin, Paperclip, Share2, Trash2, Upload, User, X, } from 'lucide-react';
import { createApiClient } from '@/lib/api-client';
import { isRateConfirmationDocument, loadDocumentDisplayName, resolveLoadDocumentUrl, } from '@/lib/load-documents';
import { createTmsApi } from '@/lib/tms-api';
import { isPlanningWhoStructuralPlaceholder, resolvePlanningCustomWhoHydration, resolveStoredPlanningCustomWho, sanitizePlanningWhoDisplayValue, } from '@/lib/planning-display';
import { toInputDate } from '@/lib/planning-timeline';
export type PlanningEventStatus = 'covered' | 'empty' | 'maintenance' | 'on_hold' | 'open';
export interface PlanningEvent {
    id?: string | number;
    title: string;
    start_date: string;
    end_date: string;
    is_all_day: boolean;
    repeats: boolean;
    status: string;
    assigned_unit: string;
    location: string;
    description: string;
    rcUrl?: string | null;
    rcFileName?: string | null;
    custom_driver_name?: string | null;
    branding_color?: string | null;
    driver_id?: number;
    unit_code?: string | null;
    unit_id?: string | number | null;
    duty_storage_date_key?: string | null;
}
export interface PlanningEventFormInput {
    title: string;
    start_date: string;
    end_date: string;
    is_all_day: boolean;
    repeats: boolean;
    status: string;
    status_bg_class?: string | null;
    assigned_unit: string;
    location: string;
    description: string;
    rcUrl?: string | null;
    rcFileName?: string | null;
    load_id?: number | null;
    driver_id?: number | null;
    custom_driver_name?: string | null;
}
export interface PlanningUnitOption {
    value: string;
    label: string;
}
export interface PlanningEventModalProps {
    isOpen: boolean;
    onClose: () => void;
    eventData?: PlanningEvent | null;
    createDateKey?: string;
    onSave: (payload: PlanningEventFormInput) => Promise<void>;
    onDelete?: () => Promise<void>;
    unitOptions?: PlanningUnitOption[];
}
export interface PlanningCustomStatus {
    id: string;
    name: string;
    bgClass: string;
}
const CALENDAR_STATUS_TAG = /^@status:([a-zA-Z0-9_-]+)\|([\s\S]*)$/;
export const PLANNING_DEFAULT_CUSTOM_STATUSES: PlanningCustomStatus[] = [
    { id: 'covered', name: 'Covered', bgClass: 'bg-emerald-700 text-white' },
    { id: 'empty', name: 'Empty', bgClass: 'bg-red-700 text-white' },
    { id: 'maintenance', name: 'Maintenance', bgClass: 'bg-amber-500 text-zinc-950' },
    { id: 'on_hold', name: 'On Hold', bgClass: 'bg-zinc-950 text-zinc-300 border border-zinc-800' },
    { id: 'open', name: 'Open', bgClass: 'bg-blue-700 text-white' },
];
export function findPlanningCustomStatus(statuses: PlanningCustomStatus[], statusId: string): PlanningCustomStatus | undefined {
    const trimmed = statusId.trim();
    const direct = statuses.find((status) => status.id === trimmed);
    if (direct)
        return direct;
    const lower = trimmed.toLowerCase();
    return statuses.find((status) => status.id.toLowerCase() === lower);
}
export function embedCalendarStatusInDescription(statusId: string, description: string): string {
    const body = stripCalendarStatusTag(description);
    const trimmedStatus = statusId.trim();
    if (!trimmedStatus)
        return body;
    return `@status:${trimmedStatus}|${body}`;
}
export function parseCalendarStatusFromDescription(description: string | null | undefined): {
    statusId: string | null;
    body: string;
} {
    if (!description)
        return { statusId: null, body: '' };
    const match = description.match(CALENDAR_STATUS_TAG);
    if (!match)
        return { statusId: null, body: description.trim() };
    return { statusId: match[1], body: match[2].trim() };
}
const CALENDAR_TITLE_TAG = /^@title:([^|]+)\|([\s\S]*)$/;
const CALENDAR_WHO_TAG = /^@who:([^|]+)\|([\s\S]*)$/;
const CALENDAR_METADATA_TAG_PATTERN = /@(?:color|title|who):[^|]*\|?/gi;
export function stripCalendarMetadataTags(description: string | null | undefined): string {
    if (!description)
        return '';
    return description.replace(CALENDAR_METADATA_TAG_PATTERN, '').trim();
}
function parseCalendarWhoFromInnerBody(innerBody: string): {
    who: string | null;
    body: string;
} {
    const match = innerBody.match(CALENDAR_WHO_TAG);
    if (!match)
        return { who: null, body: innerBody };
    return { who: match[1].trim(), body: match[2].trim() };
}
export function parseCalendarDutyPayload(description: string | null | undefined): {
    statusId: string | null;
    title: string | null;
    who: string | null;
    body: string;
} {
    const { statusId, body: statusBody } = parseCalendarStatusFromDescription(description);
    if (!statusBody)
        return { statusId, title: null, who: null, body: '' };
    const titleMatch = statusBody.match(CALENDAR_TITLE_TAG);
    const innerAfterTitle = titleMatch ? titleMatch[2].trim() : statusBody;
    const title = titleMatch ? titleMatch[1].trim() : null;
    const whoParsed = parseCalendarWhoFromInnerBody(innerAfterTitle);
    return {
        statusId,
        title,
        who: whoParsed.who,
        body: stripCalendarMetadataTags(whoParsed.body),
    };
}
export function embedCalendarDutyPayload(statusId: string, title: string, description: string, customWho?: string | null): string {
    const descPart = stripCalendarMetadataTags(stripCalendarStatusTag(description));
    const titlePart = title.trim();
    const whoPart = customWho?.trim() ?? '';
    let innerBody = descPart;
    if (whoPart) {
        innerBody = `@who:${whoPart}|${innerBody}`;
    }
    if (titlePart) {
        innerBody = `@title:${titlePart}|${innerBody}`;
    }
    return embedCalendarStatusInDescription(statusId, innerBody);
}
export function stripCalendarStatusTag(description: string | null | undefined): string {
    return parseCalendarStatusFromDescription(description).body;
}
export function stripCalendarDutyBody(description: string | null | undefined): string {
    return stripCalendarMetadataTags(stripCalendarStatusTag(description));
}
const CUSTOM_STATUS_COLORS = [
    { name: 'emerald', bg: 'bg-emerald-500' },
    { name: 'green', bg: 'bg-green-500' },
    { name: 'blue', bg: 'bg-blue-500' },
    { name: 'sky', bg: 'bg-sky-500' },
    { name: 'teal', bg: 'bg-teal-500' },
    { name: 'purple', bg: 'bg-purple-500' },
    { name: 'violet', bg: 'bg-violet-500' },
    { name: 'pink', bg: 'bg-pink-500' },
    { name: 'rose', bg: 'bg-rose-500' },
    { name: 'amber', bg: 'bg-amber-500' },
    { name: 'orange', bg: 'bg-orange-500' },
    { name: 'red', bg: 'bg-red-500' },
] as const;
function buildCustomStatusBgClass(colorName: string, bg: string): string {
    if (colorName === 'amber' || colorName === 'orange') {
        return `${bg} text-zinc-950`;
    }
    return `${bg} text-white`;
}
const CREATOR_COLOR_SWATCHES = CUSTOM_STATUS_COLORS.map((color) => ({
    name: color.name,
    bg: color.bg,
    bgClass: buildCustomStatusBgClass(color.name, color.bg),
}));
const WEEKDAY_LABELS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const FIELD_ROW_CLASS = 'flex items-start gap-3';
const FIELD_ICON_WRAP_CLASS = 'flex items-start pt-1 shrink-0 text-zinc-400 dark:text-zinc-500';
const FIELD_LABEL_CLASS = 'text-sm font-medium text-zinc-500 dark:text-zinc-400 mb-1.5';
const INPUT_FIELD_CLASS = 'w-full bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 outline-none focus:border-zinc-400 dark:focus:border-zinc-700 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 transition-colors';
const DATE_TRIGGER_CLASS = 'w-full bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 outline-none focus:border-zinc-400 dark:focus:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors text-left';
const RC_MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const PLANNING_CUSTOM_ASSIGNED_UNIT_PREFIX = 'custom::';
export function formatPlanningCustomAssignedUnit(name: string): string {
    return `${PLANNING_CUSTOM_ASSIGNED_UNIT_PREFIX}${name.trim()}`;
}
export function parsePlanningCustomAssignedUnit(value: string): string | null {
    if (!value.startsWith(PLANNING_CUSTOM_ASSIGNED_UNIT_PREFIX))
        return null;
    const parsed = value.slice(PLANNING_CUSTOM_ASSIGNED_UNIT_PREFIX.length).trim();
    return parsed || null;
}
function resolveDriverIdFromUnitValue(value: string): number | null {
    const match = value.match(/::(\d+)$/);
    if (!match)
        return null;
    const id = Number.parseInt(match[1], 10);
    return Number.isFinite(id) ? id : null;
}
function createDefaultForm(referenceDate = new Date()): PlanningEventFormInput {
    const dateKey = toInputDate(referenceDate);
    return {
        title: '',
        start_date: dateKey,
        end_date: dateKey,
        is_all_day: true,
        repeats: false,
        status: 'open',
        assigned_unit: '',
        location: '',
        description: '',
        rcUrl: null,
        rcFileName: null,
        load_id: null,
        driver_id: null,
        custom_driver_name: null,
    };
}
function slugifyStatusId(name: string): string {
    const base = name
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
    return base || `status-${Date.now()}`;
}
function resolveAssignedUnitValue(event: PlanningEvent): string {
    if (event.assigned_unit && event.assigned_unit.includes('::'))
        return event.assigned_unit;
    if (event.driver_id != null) {
        const truckToken = typeof event.unit_id === 'string' && event.unit_id
            ? event.unit_id
            : event.unit_code?.match(/#(\d+)/)?.[1] || 'unassigned';
        return `${truckToken}::${event.driver_id}`;
    }
    return (event.assigned_unit ||
        event.unit_code ||
        (event.unit_id != null ? String(event.unit_id) : '') ||
        '');
}
function eventToForm(event: PlanningEvent): PlanningEventFormInput {
    const embedded = parseCalendarDutyPayload(event.description);
    const numericId = event.id != null ? Number(event.id) : Number.NaN;
    const loadId = Number.isFinite(numericId) ? numericId : null;
    const customDriverName = resolvePlanningCustomWhoHydration(event.custom_driver_name) ||
        resolvePlanningCustomWhoHydration(parsePlanningCustomAssignedUnit(event.assigned_unit ?? '')) ||
        resolvePlanningCustomWhoHydration(embedded.who) ||
        resolveStoredPlanningCustomWho(embedded, { location: event.location });
    return {
        title: event.title,
        start_date: event.start_date,
        end_date: event.end_date,
        is_all_day: event.is_all_day,
        repeats: event.repeats,
        status: embedded.statusId ?? event.status,
        assigned_unit: customDriverName
            ? formatPlanningCustomAssignedUnit(customDriverName)
            : resolveAssignedUnitValue(event),
        location: event.location,
        description: embedded.body,
        rcUrl: event.rcUrl ?? null,
        rcFileName: event.rcFileName ?? null,
        load_id: loadId,
        driver_id: customDriverName ? null : event.driver_id ?? null,
        custom_driver_name: customDriverName,
    };
}
function resolveEffectiveEndDate(startKey: string, endKey: string): string {
    if (!endKey || endKey < startKey)
        return startKey;
    return endKey;
}
function parseInputDate(value: string): Date {
    const [year, month, day] = value.split('-').map(Number);
    return new Date(year, month - 1, day);
}
function formatDisplayDate(dateKey: string): string {
    if (!dateKey)
        return 'Select date';
    const [year, month, day] = dateKey.split('-');
    if (!year || !month || !day)
        return dateKey;
    return `${month}/${day}/${year}`;
}
function isSameDay(left: Date, right: Date): boolean {
    return (left.getFullYear() === right.getFullYear() &&
        left.getMonth() === right.getMonth() &&
        left.getDate() === right.getDate());
}
function isDateWithinBounds(dateKey: string, min?: string, max?: string): boolean {
    if (min && dateKey < min)
        return false;
    if (max && dateKey > max)
        return false;
    return true;
}
interface ToggleSwitchProps {
    checked: boolean;
    disabled?: boolean;
    label: string;
    onChange: (checked: boolean) => void;
}
function ToggleSwitch({ checked, disabled, label, onChange }: ToggleSwitchProps) {
    return (<button type="button" role="switch" aria-checked={checked} aria-label={label} disabled={disabled} onClick={() => onChange(!checked)} className="inline-flex items-center gap-2.5 text-sm text-zinc-700 dark:text-zinc-300 select-none disabled:opacity-50">
      <span className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full transition-colors duration-200 focus:outline-none ${checked ? 'bg-lime-600' : 'bg-zinc-300 dark:bg-zinc-800'}`}>
        <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-sm transition duration-200 ${checked ? 'translate-x-4' : 'translate-x-1'}`}/>
      </span>
      {label}
    </button>);
}
interface PlanningEventDateFieldProps {
    id: string;
    label: string;
    value: string;
    min?: string;
    max?: string;
    disabled?: boolean;
    onChange: (value: string) => void;
}
function PlanningEventDateField({ id, label, value, min, max, disabled, onChange, }: PlanningEventDateFieldProps) {
    const [open, setOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const selectedDate = useMemo(() => (value ? parseInputDate(value) : new Date()), [value]);
    const [viewDate, setViewDate] = useState(() => selectedDate);
    useEffect(() => {
        setViewDate(selectedDate);
    }, [selectedDate, open]);
    useEffect(() => {
        if (!open)
            return;
        const handlePointerDown = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setOpen(false);
            }
        };
        document.addEventListener('mousedown', handlePointerDown);
        return () => document.removeEventListener('mousedown', handlePointerDown);
    }, [open]);
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();
    const calendarCells = useMemo(() => {
        const firstWeekday = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const daysInPrevMonth = new Date(year, month, 0).getDate();
        const cells: Array<{
            date: Date;
            inMonth: boolean;
        }> = [];
        for (let index = firstWeekday - 1; index >= 0; index -= 1) {
            const day = daysInPrevMonth - index;
            cells.push({ date: new Date(year, month - 1, day), inMonth: false });
        }
        for (let day = 1; day <= daysInMonth; day += 1) {
            cells.push({ date: new Date(year, month, day), inMonth: true });
        }
        while (cells.length % 7 !== 0) {
            const nextDay = cells.length - firstWeekday - daysInMonth + 1;
            cells.push({ date: new Date(year, month + 1, nextDay), inMonth: false });
        }
        return cells;
    }, [month, year]);
    const monthLabel = viewDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    const handleSelect = (date: Date) => {
        const nextValue = toInputDate(date);
        if (!isDateWithinBounds(nextValue, min, max))
            return;
        onChange(nextValue);
        setOpen(false);
    };
    return (<div ref={containerRef} className="relative">
      <label htmlFor={id} className={FIELD_LABEL_CLASS}>
        {label}
      </label>
      <button id={id} type="button" disabled={disabled} onClick={() => setOpen((current) => !current)} className={`${DATE_TRIGGER_CLASS} flex items-center justify-between gap-2 disabled:opacity-50`}>
        <span className="inline-flex items-center gap-2 min-w-0">
          <Calendar className="w-4 h-4 text-zinc-400 dark:text-zinc-500 shrink-0" aria-hidden/>
          <span>{formatDisplayDate(value)}</span>
        </span>
        <ChevronDown className="w-4 h-4 text-zinc-400 dark:text-zinc-500 shrink-0" aria-hidden/>
      </button>

      {open ? (<div className="absolute left-0 top-full z-50 mt-2 w-[18rem] bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 shadow-2xl text-sm text-zinc-900 dark:text-zinc-100">
          <div className="flex items-center justify-between mb-3">
            <button type="button" onClick={() => setViewDate(new Date(year, month - 1, 1))} className="text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-900 rounded-lg p-1 transition-colors" aria-label="Previous month">
              <ChevronLeft className="w-4 h-4" aria-hidden/>
            </button>
            <button type="button" className="text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-900 rounded-lg px-2 py-1 transition-colors font-medium inline-flex items-center gap-1">
              {monthLabel}
              <ChevronDown className="w-3.5 h-3.5 opacity-70" aria-hidden/>
            </button>
            <button type="button" onClick={() => setViewDate(new Date(year, month + 1, 1))} className="text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-900 rounded-lg p-1 transition-colors" aria-label="Next month">
              <ChevronRight className="w-4 h-4" aria-hidden/>
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1 mb-1">
            {WEEKDAY_LABELS.map((weekday) => (<div key={weekday} className="h-8 flex items-center justify-center text-[10px] font-semibold text-zinc-500 dark:text-zinc-500">
                {weekday}
              </div>))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {calendarCells.map(({ date, inMonth }) => {
                const dateKey = toInputDate(date);
                const isSelected = isSameDay(date, selectedDate);
                const isDisabled = !isDateWithinBounds(dateKey, min, max);
                return (<button key={dateKey} type="button" disabled={isDisabled} onClick={() => handleSelect(date)} className={`h-8 w-8 text-xs transition-colors disabled:opacity-30 disabled:cursor-not-allowed ${isSelected
                        ? 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-950 font-semibold rounded-lg'
                        : inMonth
                            ? 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-900 rounded-lg'
                            : 'text-zinc-400 dark:text-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-900 rounded-lg'}`}>
                  {date.getDate()}
                </button>);
            })}
          </div>

          <div className="mt-3 pt-3 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
            <button type="button" onClick={() => {
                onChange('');
                setOpen(false);
            }} className="text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-900 rounded-lg px-2 py-1 transition-colors">
              Clear
            </button>
            <button type="button" onClick={() => {
                const today = toInputDate(new Date());
                if (isDateWithinBounds(today, min, max)) {
                    onChange(today);
                    setOpen(false);
                }
            }} className="text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-900 rounded-lg px-2 py-1 transition-colors">
              Today
            </button>
          </div>
        </div>) : null}
    </div>);
}
export default function PlanningEventModal({ isOpen, onClose, eventData, createDateKey, onSave, onDelete, unitOptions = [], }: PlanningEventModalProps) {
    const [form, setForm] = useState<PlanningEventFormInput>(() => eventData ? eventToForm(eventData) : createDefaultForm());
    const [saving, setSaving] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [statusMenuOpen, setStatusMenuOpen] = useState(false);
    const [unitQuery, setUnitQuery] = useState('');
    const [unitMenuOpen, setUnitMenuOpen] = useState(false);
    const [customStatuses, setCustomStatuses] = useState<PlanningCustomStatus[]>(PLANNING_DEFAULT_CUSTOM_STATUSES);
    const [showStatusCreator, setShowStatusCreator] = useState(false);
    const [newStatusName, setNewStatusName] = useState('');
    const [newStatusColorClass, setNewStatusColorClass] = useState(CREATOR_COLOR_SWATCHES[0].bgClass);
    const [isMounted, setIsMounted] = useState(false);
    const [copied, setCopied] = useState(false);
    const [rcUploading, setRcUploading] = useState(false);
    const copiedResetRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const statusMenuRef = useRef<HTMLDivElement>(null);
    const unitMenuRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
        setIsMounted(true);
        return () => {
            setIsMounted(false);
            if (copiedResetRef.current)
                clearTimeout(copiedResetRef.current);
        };
    }, []);
    useEffect(() => {
        if (!isOpen)
            return;
        const referenceDate = createDateKey ? parseInputDate(createDateKey) : new Date();
        const nextForm = eventData ? eventToForm(eventData) : createDefaultForm(referenceDate);
        setForm(nextForm);
        if (nextForm.status) {
            setCustomStatuses((prev) => {
                if (findPlanningCustomStatus(prev, nextForm.status))
                    return prev;
                return [
                    ...prev,
                    {
                        id: nextForm.status,
                        name: nextForm.status.replace(/_/g, ' '),
                        bgClass: 'bg-zinc-700 text-white',
                    },
                ];
            });
        }
        setUnitQuery(() => {
            const explicitCustom = resolvePlanningCustomWhoHydration(eventData?.custom_driver_name) ||
                resolvePlanningCustomWhoHydration(parsePlanningCustomAssignedUnit(nextForm.assigned_unit ?? '')) ||
                resolvePlanningCustomWhoHydration(nextForm.custom_driver_name);
            if (explicitCustom)
                return explicitCustom;
            const whoContext = {
                location: eventData?.location ?? nextForm.location,
                eventTitle: eventData?.title ?? nextForm.title,
            };
            const matched = unitOptions.find((option) => option.value === nextForm.assigned_unit);
            const raw = matched?.label ?? eventData?.unit_code ?? nextForm.assigned_unit ?? '';
            return sanitizePlanningWhoDisplayValue(raw, whoContext);
        });
        setStatusMenuOpen(false);
        setUnitMenuOpen(false);
        setShowStatusCreator(false);
        setNewStatusName('');
        setNewStatusColorClass(CREATOR_COLOR_SWATCHES[0].bgClass);
        setCopied(false);
        setRcUploading(false);
        if (copiedResetRef.current) {
            clearTimeout(copiedResetRef.current);
            copiedResetRef.current = null;
        }
    }, [isOpen, eventData, createDateKey, unitOptions]);
    useEffect(() => {
        if (!isOpen)
            return;
        if (eventData?.rcUrl) {
            setForm((current) => ({
                ...current,
                rcUrl: eventData.rcUrl ?? null,
                rcFileName: eventData.rcFileName ?? null,
            }));
            return;
        }
        const loadId = eventData?.id != null ? Number(eventData.id) : Number.NaN;
        if (!Number.isFinite(loadId))
            return;
        let cancelled = false;
        const api = createTmsApi(createApiClient());
        void (async () => {
            try {
                const docs = await api.loads.documents(loadId);
                if (cancelled)
                    return;
                const rcDoc = docs.find(isRateConfirmationDocument);
                if (!rcDoc)
                    return;
                const url = resolveLoadDocumentUrl(rcDoc);
                if (!url)
                    return;
                setForm((current) => ({
                    ...current,
                    rcUrl: url,
                    rcFileName: loadDocumentDisplayName(rcDoc),
                }));
            }
            catch {
                return;
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [isOpen, eventData?.id, eventData?.rcUrl, eventData?.rcFileName]);
    useEffect(() => {
        const handlePointerDown = (event: MouseEvent) => {
            const target = event.target as Node;
            if (statusMenuRef.current && !statusMenuRef.current.contains(target)) {
                setStatusMenuOpen(false);
            }
            if (unitMenuRef.current && !unitMenuRef.current.contains(target)) {
                setUnitMenuOpen(false);
            }
        };
        document.addEventListener('mousedown', handlePointerDown);
        return () => document.removeEventListener('mousedown', handlePointerDown);
    }, []);
    const filteredUnitOptions = useMemo(() => {
        const query = unitQuery.trim().toLowerCase();
        if (!query)
            return unitOptions;
        return unitOptions.filter((option) => option.label.toLowerCase().includes(query) ||
            option.value.toLowerCase().includes(query));
    }, [unitOptions, unitQuery]);
    const showCreatableOption = useMemo(() => {
        const trimmed = unitQuery.trim();
        if (!trimmed)
            return false;
        if (isPlanningWhoStructuralPlaceholder(trimmed, {
            location: form.location,
            eventTitle: form.title,
        })) {
            return false;
        }
        return !unitOptions.some((option) => option.label.toLowerCase() === trimmed.toLowerCase());
    }, [unitOptions, unitQuery, form.location, form.title]);
    const applyCustomDriverSelection = useCallback((name: string) => {
        const trimmed = name.trim();
        if (!trimmed)
            return;
        setUnitQuery(trimmed);
        setForm((current) => ({
            ...current,
            assigned_unit: formatPlanningCustomAssignedUnit(trimmed),
            driver_id: null,
            custom_driver_name: trimmed,
        }));
        setUnitMenuOpen(false);
    }, []);
    const applyRegisteredUnitSelection = useCallback((option: PlanningUnitOption) => {
        setUnitQuery(option.label);
        setForm((current) => ({
            ...current,
            assigned_unit: option.value,
            driver_id: resolveDriverIdFromUnitValue(option.value),
            custom_driver_name: null,
        }));
        setUnitMenuOpen(false);
    }, []);
    const activeStatus = useMemo(() => {
        const match = findPlanningCustomStatus(customStatuses, form.status);
        if (match)
            return match;
        if (form.status) {
            return {
                id: form.status,
                name: form.status.replace(/_/g, ' '),
                bgClass: 'bg-zinc-700 text-white',
            };
        }
        return customStatuses[0];
    }, [customStatuses, form.status]);
    const updateForm = useCallback(<K extends keyof PlanningEventFormInput>(key: K, value: PlanningEventFormInput[K]) => {
        setForm((current) => ({ ...current, [key]: value }));
    }, []);
    const handleRemoveStatus = useCallback((targetId: string) => {
        setCustomStatuses((prev) => {
            const next = prev.filter((status) => status.id !== targetId);
            if (form.status === targetId) {
                const fallback = next[0]?.id ?? 'open';
                updateForm('status', fallback);
            }
            return next;
        });
    }, [form.status, updateForm]);
    const handleCommitNewStatus = useCallback(() => {
        const trimmed = newStatusName.trim();
        if (!trimmed)
            return;
        let nextId = slugifyStatusId(trimmed);
        setCustomStatuses((prev) => {
            const taken = new Set(prev.map((status) => status.id));
            while (taken.has(nextId)) {
                nextId = `${nextId}-${Date.now()}`;
            }
            return [...prev, { id: nextId, name: trimmed, bgClass: newStatusColorClass }];
        });
        setNewStatusName('');
        setNewStatusColorClass(CREATOR_COLOR_SWATCHES[0].bgClass);
        setShowStatusCreator(false);
    }, [newStatusColorClass, newStatusName]);
    const isFreightLoadEvent = eventData?.id != null && Number.isFinite(Number(eventData.id));
    const handleRcFileUploadPipeline = useCallback(async (file: File, loadId?: number | null): Promise<unknown> => {
        if (file.size > RC_MAX_UPLOAD_BYTES) {
            throw new Error('File exceeds 10MB limit');
        }
        const api = createTmsApi(createApiClient());
        const resolvedLoadId = loadId != null && Number.isFinite(Number(loadId))
            ? Number(loadId)
            : eventData?.id != null && Number.isFinite(Number(eventData.id))
                ? Number(eventData.id)
                : Number.NaN;
        const response = Number.isFinite(resolvedLoadId)
            ? await api.loads.attachDocument(resolvedLoadId, file, 'Rate Confirmation')
            : await api.documents.uploadPlanning(file, 'Rate Confirmation');
        return response.data;
    }, [eventData?.id]);
    const handleSave = async () => {
        if (saving || deleting)
            return;
        if (isFreightLoadEvent && !form.assigned_unit.trim() && !form.custom_driver_name?.trim()) {
            return;
        }
        setSaving(true);
        try {
            await onSave({
                ...form,
                driver_id: form.driver_id ?? null,
                custom_driver_name: form.custom_driver_name?.trim() || null,
                status_bg_class: activeStatus.bgClass,
                description: stripCalendarMetadataTags(stripCalendarStatusTag(form.description)),
                rcUrl: form.rcUrl ?? null,
                rcFileName: form.rcFileName ?? null,
            });
            onClose();
        }
        catch {
            return;
        }
        finally {
            setSaving(false);
        }
    };
    const handleDelete = async () => {
        if (saving || deleting)
            return;
        setDeleting(true);
        try {
            if (onDelete) {
                await onDelete();
            }
            else {
                onClose();
            }
        }
        catch {
            return;
        }
        finally {
            setDeleting(false);
        }
    };
    const handleShare = async () => {
        const summary = [
            form.title || 'Planning Event',
            `Status: ${activeStatus?.name ?? form.status}`,
            `Unit: ${form.assigned_unit || '—'}`,
            `Location: ${form.location || '—'}`,
            '',
            form.description || '',
        ].join('\n');
        try {
            await navigator.clipboard.writeText(summary);
            setCopied(true);
            if (copiedResetRef.current)
                clearTimeout(copiedResetRef.current);
            copiedResetRef.current = setTimeout(() => setCopied(false), 2000);
        }
        catch {
            return;
        }
    };
    if (!isOpen || !isMounted)
        return null;
    const isBusy = saving || deleting || rcUploading;
    return createPortal(<div className="fixed inset-0 w-screen h-screen z-[9999] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="planning-event-title">
      <div className="fixed inset-0 bg-black/40 dark:bg-black/75 backdrop-blur-md" onClick={() => {
            if (!isBusy)
                onClose();
        }} aria-hidden/>
      <div className="relative z-10 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-start gap-4 p-6 border-b border-zinc-200 dark:border-zinc-800/80">
          <div className="flex-1 min-w-0">
            <input id="planning-event-title" type="text" value={form.title} onChange={(event) => updateForm('title', event.target.value)} placeholder="Enter the event title..." disabled={isBusy} className="w-full bg-transparent text-2xl font-semibold text-zinc-900 dark:text-zinc-50 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 border-b border-zinc-200 dark:border-zinc-800 pb-3 focus:outline-none focus:border-zinc-400 dark:focus:border-zinc-700"/>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button type="button" disabled={isBusy} onClick={() => void handleSave()} className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium transition-colors disabled:opacity-50">
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden/> : <Check className="w-3.5 h-3.5" aria-hidden/>}
              Save
            </button>
            <button type="button" disabled={isBusy} onClick={() => void handleShare()} className={`flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-50 ${copied
            ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-500/30'
            : 'bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200'}`}>
              {!copied ? <Share2 className="w-3.5 h-3.5" aria-hidden/> : null}
              {copied ? 'Copied!' : 'Share'}
            </button>
            <button type="button" disabled={isBusy} onClick={() => void handleDelete()} className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-50 hover:bg-red-100 dark:bg-red-950/40 dark:hover:bg-red-900/40 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900/30 text-xs font-medium transition-colors disabled:opacity-50">
              {deleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden/> : <Trash2 className="w-3.5 h-3.5" aria-hidden/>}
              Delete
            </button>
            <button type="button" disabled={isBusy} onClick={onClose} className="p-2 rounded-lg text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 transition-colors disabled:opacity-50" aria-label="Close">
              <X className="w-4 h-4" aria-hidden/>
            </button>
          </div>
        </div>

        <div className="p-6 space-y-5 max-h-[calc(92vh-8rem)] overflow-y-auto">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <PlanningEventDateField id="planning-event-from" label="From" value={form.start_date} max={form.end_date} disabled={isBusy} onChange={(nextStart) => {
            const resolved = nextStart || toInputDate(new Date());
            updateForm('start_date', resolved);
            updateForm('end_date', resolveEffectiveEndDate(resolved, form.end_date));
        }}/>
            <PlanningEventDateField id="planning-event-to" label="To" value={form.end_date} min={form.start_date} disabled={isBusy} onChange={(nextEnd) => {
            const resolved = nextEnd || form.start_date || toInputDate(new Date());
            updateForm('end_date', resolveEffectiveEndDate(form.start_date, resolved));
        }}/>
          </div>

          <div className="flex flex-wrap items-center gap-6">
            <ToggleSwitch checked={form.is_all_day} disabled={isBusy} label="All day" onChange={(checked) => updateForm('is_all_day', checked)}/>
            <ToggleSwitch checked={form.repeats} disabled={isBusy} label="Repeats" onChange={(checked) => updateForm('repeats', checked)}/>
          </div>

          <div className={FIELD_ROW_CLASS}>
            <div className={FIELD_ICON_WRAP_CLASS}>
              <Bell size={18} aria-hidden/>
            </div>
            <div className="flex-1 min-w-0 pt-1">
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                Reminders: <span className="text-zinc-900 dark:text-zinc-50">0</span>
              </p>
            </div>
          </div>

          <div className={FIELD_ROW_CLASS}>
            <div className={FIELD_ICON_WRAP_CLASS}>
              <List size={18} aria-hidden/>
            </div>
            <div className="flex-1 min-w-0" ref={statusMenuRef}>
              <p className={FIELD_LABEL_CLASS}>Calendar</p>
              <button type="button" disabled={isBusy} onClick={() => setStatusMenuOpen((open) => !open)} className={`w-full flex items-center justify-between gap-2 ${INPUT_FIELD_CLASS} disabled:opacity-50`}>
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold select-none ${activeStatus?.bgClass ?? 'bg-blue-700 text-white'}`}>
                  {activeStatus?.name ?? form.status}
                </span>
                <ChevronDown className="w-4 h-4 text-zinc-400 dark:text-zinc-500 shrink-0" aria-hidden/>
              </button>
              {statusMenuOpen ? (<div className="mt-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-3 shadow-xl space-y-3">
                  <div className="flex flex-wrap gap-2">
                    {customStatuses.map((status) => (<button key={status.id} type="button" onClick={() => {
                    updateForm('status', status.id);
                    setStatusMenuOpen(false);
                }} className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold select-none group ${status.bgClass}`}>
                        {status.name}
                        <span role="button" tabIndex={0} onClick={(event) => {
                    event.stopPropagation();
                    handleRemoveStatus(status.id);
                }} onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        event.stopPropagation();
                        handleRemoveStatus(status.id);
                    }
                }} className="text-white/40 hover:text-white ml-1.5 font-bold transition-colors cursor-pointer text-sm leading-none" aria-label={`Remove ${status.name}`}>
                          ×
                        </span>
                      </button>))}
                  </div>
                  {showStatusCreator ? (<div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/40 p-3 space-y-3">
                      <input type="text" value={newStatusName} disabled={isBusy} onChange={(event) => setNewStatusName(event.target.value)} placeholder="Status name" className="w-full bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 focus:border-zinc-400 dark:focus:border-zinc-700 text-xs rounded-lg px-3 py-1.5 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:outline-none"/>
                      <div className="flex flex-wrap items-center gap-2">
                        {CREATOR_COLOR_SWATCHES.map((color) => {
                    const isSelected = newStatusColorClass === color.bgClass;
                    return (<button key={color.name} type="button" aria-label={color.name} aria-pressed={isSelected} disabled={isBusy} onClick={() => setNewStatusColorClass(color.bgClass)} className={`h-5 w-5 rounded-full border-2 transition-transform hover:scale-110 ${color.bg} ${isSelected ? 'border-white' : 'border-transparent'}`}/>);
                })}
                      </div>
                      <div className="flex items-center gap-2">
                        <button type="button" disabled={isBusy || !newStatusName.trim()} onClick={handleCommitNewStatus} className="text-xs text-lime-500 hover:text-lime-400 font-medium cursor-pointer px-2 py-1 disabled:opacity-50 disabled:cursor-not-allowed">
                          Add
                        </button>
                        <button type="button" disabled={isBusy} onClick={() => {
                    setShowStatusCreator(false);
                    setNewStatusName('');
                    setNewStatusColorClass(CREATOR_COLOR_SWATCHES[0].bgClass);
                }} className="text-xs text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-300 font-medium cursor-pointer px-2 py-1">
                          Cancel
                        </button>
                      </div>
                    </div>) : (<button type="button" disabled={isBusy} onClick={() => setShowStatusCreator(true)} className="text-xs text-zinc-500 dark:text-zinc-400 hover:text-lime-600 dark:hover:text-lime-500 font-medium cursor-pointer transition-colors">
                      + Add Custom Status
                    </button>)}
                </div>) : null}
            </div>
          </div>

          <div className={FIELD_ROW_CLASS}>
            <div className={FIELD_ICON_WRAP_CLASS}>
              <User size={18} aria-hidden/>
            </div>
            <div className="flex-1 min-w-0 relative" ref={unitMenuRef}>
              <p className={FIELD_LABEL_CLASS}>Who</p>
              <input type="search" value={unitQuery} disabled={isBusy} onChange={(event) => {
            const next = event.target.value;
            setUnitQuery(next);
            const matched = unitOptions.find((option) => option.label === next || option.value === next);
            if (matched) {
                setForm((current) => ({
                    ...current,
                    assigned_unit: matched.value,
                    driver_id: resolveDriverIdFromUnitValue(matched.value),
                    custom_driver_name: null,
                }));
            }
            else {
                setForm((current) => ({
                    ...current,
                    driver_id: null,
                    custom_driver_name: null,
                }));
            }
            setUnitMenuOpen(true);
        }} onKeyDown={(event) => {
            if (event.key !== 'Enter')
                return;
            const trimmed = unitQuery.trim();
            if (!trimmed)
                return;
            const exactMatch = unitOptions.find((option) => option.label.toLowerCase() === trimmed.toLowerCase());
            event.preventDefault();
            if (exactMatch) {
                applyRegisteredUnitSelection(exactMatch);
                return;
            }
            applyCustomDriverSelection(trimmed);
        }} onBlur={() => {
            const matched = unitOptions.find((option) => option.label === unitQuery.trim());
            if (matched) {
                applyRegisteredUnitSelection(matched);
            }
        }} onFocus={() => setUnitMenuOpen(true)} placeholder="Search drivers or unit codes..." className={INPUT_FIELD_CLASS}/>
              {unitMenuOpen && (filteredUnitOptions.length > 0 || showCreatableOption) ? (<div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-44 overflow-y-auto rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 shadow-xl p-1">
                  {showCreatableOption ? (<button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => applyCustomDriverSelection(unitQuery)} className="w-full text-left px-3 py-2 text-xs text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-900 font-medium border-b border-zinc-100 dark:border-zinc-900 transition-colors">
                      Use{' '}
                      <span className="font-bold text-emerald-600 dark:text-emerald-400">
                        &quot;{unitQuery.trim()}&quot;
                      </span>{' '}
                      as custom name
                    </button>) : null}
                  {filteredUnitOptions.map((option) => (<button key={option.value} type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => applyRegisteredUnitSelection(option)} className="w-full px-3 py-2 text-left text-xs text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-900 rounded-md transition-colors">
                      {option.label}
                    </button>))}
                </div>) : null}
            </div>
          </div>

          <div className={FIELD_ROW_CLASS}>
            <div className={FIELD_ICON_WRAP_CLASS}>
              <MapPin size={18} aria-hidden/>
            </div>
            <div className="flex-1 min-w-0">
              <p className={FIELD_LABEL_CLASS}>Where</p>
              <input type="text" value={form.location} disabled={isBusy} onChange={(event) => updateForm('location', event.target.value)} placeholder="City, facility, or terminal..." className={INPUT_FIELD_CLASS}/>
            </div>
          </div>

          <div className={FIELD_ROW_CLASS}>
            <div className={FIELD_ICON_WRAP_CLASS}>
              <FileText size={18} aria-hidden/>
            </div>
            <div className="flex-1 min-w-0">
              <p className={FIELD_LABEL_CLASS}>Description</p>
              <textarea value={form.description} disabled={isBusy} onChange={(event) => updateForm('description', event.target.value)} placeholder="Enter additional event details, notes, or operational dispatcher instructions..." className="w-full bg-zinc-50 dark:bg-zinc-900/50 text-zinc-900 dark:text-zinc-100 font-mono text-xs p-3 border border-zinc-200 dark:border-zinc-800 rounded-xl h-44 focus:outline-none focus:border-zinc-400 dark:focus:border-zinc-700 resize-none leading-relaxed placeholder:text-zinc-400 dark:placeholder:text-zinc-500 transition-colors"/>
            </div>
          </div>

          <div className="flex items-start gap-3 mt-6">
            <Paperclip className="w-5 h-5 text-zinc-400 dark:text-zinc-500 mt-0.5"/>
            <div className="flex-1 min-w-0">
              <p className={FIELD_LABEL_CLASS}>Rate Confirmation (RC)</p>
              {form.rcUrl ? (<div className="mt-2 flex items-center gap-3 p-3 rounded-lg border border-emerald-500/20 bg-emerald-500/5 dark:bg-emerald-950/10">
                  <div className="flex flex-1 flex-col">
                    <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-200 truncate">
                      {form.rcFileName || 'rate_confirmation.pdf'}
                    </span>
                    <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
                      Attached Automatically
                    </span>
                  </div>
                  <a href={form.rcUrl} target="_blank" rel="noopener noreferrer" className="px-2.5 py-1.5 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-sm transition-colors cursor-pointer">
                    View RC
                  </a>
                </div>) : (<label htmlFor="manual-rc-upload-trigger" className="mt-2 flex flex-col items-center justify-center border border-dashed border-zinc-300 dark:border-zinc-800 hover:border-zinc-400 dark:hover:border-zinc-600 rounded-lg p-5 cursor-pointer transition-all bg-zinc-50/50 dark:bg-zinc-900/20 hover:bg-zinc-100/50 dark:hover:bg-zinc-900/40 group">
                  <input id="manual-rc-upload-trigger" type="file" accept=".pdf,.png,.jpg,.jpeg" className="hidden" disabled={isBusy} onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file)
                    return;
                setRcUploading(true);
                try {
                    const response = await handleRcFileUploadPipeline(file, form.load_id ?? null);
                    const payload = response as string | {
                        file_url?: string | null;
                        url?: string | null;
                        file_path?: string | null;
                        file_name?: string | null;
                        data?: {
                            file_url?: string | null;
                        };
                    } | null;
                    let actualUrl = typeof payload === 'string'
                        ? payload
                        : payload?.file_url ||
                            payload?.url ||
                            payload?.data?.file_url ||
                            null;
                    if (!actualUrl && payload && typeof payload === 'object') {
                        actualUrl =
                            resolveLoadDocumentUrl({
                                id: 0,
                                file_url: payload.file_url,
                                file_path: payload.file_path,
                                file_name: payload.file_name ?? file.name,
                            }) ?? null;
                    }
                    if (!actualUrl)
                        return;
                    setForm((current) => ({
                        ...current,
                        rcUrl: actualUrl,
                        rcFileName: file.name,
                    }));
                }
                catch {
                    return;
                }
                finally {
                    setRcUploading(false);
                    e.target.value = '';
                }
            }}/>
                  {rcUploading ? (<Loader2 className="w-4 h-4 text-zinc-400 dark:text-zinc-500 animate-spin mb-1"/>) : (<Upload className="w-4 h-4 text-zinc-400 dark:text-zinc-500 group-hover:text-zinc-600 dark:group-hover:text-zinc-300 transition-colors mb-1"/>)}
                  <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400 group-hover:text-zinc-700 dark:group-hover:text-zinc-200 transition-colors">
                    Upload Rate Confirmation document
                  </span>
                  <span className="text-[10px] text-zinc-400 dark:text-zinc-500 mt-0.5">
                    PDF, PNG, or JPG up to 10MB
                  </span>
                </label>)}
            </div>
          </div>
        </div>
      </div>
    </div>, document.body);
}
