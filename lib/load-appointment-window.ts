const readString = (value: unknown) => String(value ?? '').trim();
export interface AppointmentWindowSource {
    appointment_time_start?: string | null;
    appointment_time_end?: string | null;
    is_fcfs?: boolean | null;
    raw_appointment_window?: string | null;
    appointment_window?: string | null;
}
const ISO_DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;
const US_DATE_ONLY = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;
const ISO_DATE_LEADING = /^(\d{4}-\d{2}-\d{2})(?:[ T](.+))?$/;
const US_DATE_LEADING = /^(\d{1,2}\/\d{1,2}\/\d{4})(?:\s+(?:@\s*)?(.+))?$/i;
const AT_SPLIT = /^(.+?)\s+@\s+(.+)$/;
const TIME_TOKEN = /(?:\d{1,2}:\d{2}|\b(?:AM|PM)\b)/i;
const TIME_RANGE_PATTERN = /(\d{1,2}:\d{2}(?:\s*(?:AM|PM))?)\s*[-–]\s*(\d{1,2}:\d{2}(?:\s*(?:AM|PM))?(?:\s*\(FCFS\))?)/i;
export function isStandaloneDateString(value: string): boolean {
    const trimmed = value.trim();
    return ISO_DATE_ONLY.test(trimmed) || US_DATE_ONLY.test(trimmed);
}
export function normalizeEditDateString(value: string): string {
    const trimmed = value.trim();
    if (!trimmed)
        return '';
    const isoMatch = trimmed.match(ISO_DATE_ONLY);
    if (isoMatch)
        return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
    const usMatch = trimmed.match(US_DATE_ONLY);
    if (usMatch) {
        const month = usMatch[1].padStart(2, '0');
        const day = usMatch[2].padStart(2, '0');
        return `${usMatch[3]}-${month}-${day}`;
    }
    const isoLeading = trimmed.match(/^(\d{4}-\d{2}-\d{2})/);
    if (isoLeading?.[1])
        return isoLeading[1];
    const usLeading = trimmed.match(/^(\d{1,2}\/\d{1,2}\/\d{4})/);
    if (usLeading?.[1]) {
        const parts = usLeading[1].split('/');
        if (parts.length === 3) {
            const month = parts[0].padStart(2, '0');
            const day = parts[1].padStart(2, '0');
            return `${parts[2]}-${month}-${day}`;
        }
    }
    return '';
}
export function isPlausibleAppointmentWindow(value: string): boolean {
    const trimmed = value.trim();
    if (!trimmed)
        return false;
    if (isStandaloneDateString(trimmed))
        return false;
    if (ISO_DATE_LEADING.test(trimmed) && !trimmed.match(ISO_DATE_LEADING)?.[2]?.trim())
        return false;
    return TIME_TOKEN.test(trimmed);
}
export function compileAppointmentWindow(source: AppointmentWindowSource): string | null {
    const preset = readString(source.appointment_window);
    const start = readString(source.appointment_time_start);
    const end = readString(source.appointment_time_end);
    const raw = readString(source.raw_appointment_window);
    let window = preset;
    if (!window || !isPlausibleAppointmentWindow(window)) {
        if (start && end)
            window = `${start} - ${end}`;
        else if (start && isPlausibleAppointmentWindow(start))
            window = start;
        else if (end && isPlausibleAppointmentWindow(end))
            window = end;
        else if (raw && isPlausibleAppointmentWindow(raw))
            window = raw;
        else
            return null;
    }
    if (!isPlausibleAppointmentWindow(window))
        return null;
    if (source.is_fcfs === true && !/\(FCFS\)\s*$/i.test(window)) {
        window = `${window} (FCFS)`;
    }
    return window;
}
export function compileAppointmentWindowFromStop(stop: Record<string, unknown>): string | null {
    return compileAppointmentWindow({
        appointment_time_start: readString(stop.appointment_time_start) || null,
        appointment_time_end: readString(stop.appointment_time_end) || null,
        is_fcfs: stop.is_fcfs === true ? true : stop.is_fcfs === false ? false : null,
        raw_appointment_window: readString(stop.raw_appointment_window) || null,
        appointment_window: readString(stop.appointment_window) || null,
    });
}
function extractDateAndRemainder(raw: string): {
    date: string;
    remainder: string;
} {
    if (!raw)
        return { date: '', remainder: '' };
    const atSplit = raw.match(AT_SPLIT);
    if (atSplit) {
        const date = normalizeEditDateString(atSplit[1]);
        const remainder = readString(atSplit[2]);
        if (date)
            return { date, remainder };
    }
    const isoMatch = raw.match(ISO_DATE_LEADING);
    if (isoMatch?.[1]) {
        return {
            date: isoMatch[1],
            remainder: readString(isoMatch[2]),
        };
    }
    const usMatch = raw.match(US_DATE_LEADING);
    if (usMatch?.[1]) {
        return {
            date: normalizeEditDateString(usMatch[1]),
            remainder: readString(usMatch[2]),
        };
    }
    if (isStandaloneDateString(raw)) {
        return { date: normalizeEditDateString(raw), remainder: '' };
    }
    return { date: '', remainder: raw };
}
function extractWindowFromRemainder(remainder: string, raw: string): string {
    const trimmed = remainder.trim();
    if (trimmed && isPlausibleAppointmentWindow(trimmed))
        return trimmed;
    const rangeMatch = raw.match(TIME_RANGE_PATTERN);
    if (rangeMatch?.[0] && isPlausibleAppointmentWindow(rangeMatch[0])) {
        return rangeMatch[0].trim();
    }
    return '';
}
export function splitStopScheduleForEdit(value?: string | null, stop?: Record<string, unknown>): {
    date: string;
    window: string;
} {
    const raw = readString(value);
    const { date: parsedDate, remainder } = extractDateAndRemainder(raw);
    const storedWindow = stop ? readString(stop.appointment_window) : '';
    if (storedWindow && isPlausibleAppointmentWindow(storedWindow)) {
        return {
            date: parsedDate || normalizeEditDateString(raw),
            window: storedWindow,
        };
    }
    const remainderWindow = extractWindowFromRemainder(remainder, raw);
    if (remainderWindow) {
        return { date: parsedDate, window: remainderWindow };
    }
    const compiled = stop ? compileAppointmentWindowFromStop(stop) : null;
    if (compiled) {
        return { date: parsedDate || normalizeEditDateString(raw), window: compiled };
    }
    return { date: parsedDate, window: '' };
}
export function combineEditDateWithWindow(date: string, window: string): string {
    const cleanDate = normalizeEditDateString(date);
    const cleanWindow = window.trim();
    if (cleanDate && cleanWindow && isPlausibleAppointmentWindow(cleanWindow)) {
        return `${cleanDate} ${cleanWindow}`;
    }
    if (cleanDate)
        return cleanDate;
    if (cleanWindow && isPlausibleAppointmentWindow(cleanWindow))
        return cleanWindow;
    return cleanWindow;
}
