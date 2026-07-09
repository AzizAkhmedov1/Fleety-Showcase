export function formatOdometerReading(value: unknown): string {
    if (value == null)
        return '—';
    if (typeof value === 'string' && value.trim() === '')
        return '—';
    if (Array.isArray(value) && value.length === 0)
        return '—';
    const numeric = typeof value === 'number' ? value : Number(String(value).replace(/,/g, '').trim());
    if (!Number.isFinite(numeric) || numeric <= 0)
        return '—';
    return numeric.toLocaleString();
}
export function sanitizeMakeModelTitleCase(value: string): string {
    return value
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ');
}
export const DEFAULT_MAP_CENTER = { lat: 39.8283, lng: -98.5795 } as const;
