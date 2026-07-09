export const PHONE_DIGIT_LIMIT = 10;
export const MC_NUMBER_DIGIT_LIMIT = 8;
export const VIN_CHARACTER_LIMIT = 17;
export function sanitizePhoneDigits(value: string, maxDigits: number = PHONE_DIGIT_LIMIT): string {
    return value.replace(/\D/g, "").slice(0, maxDigits);
}
export function formatPhoneDisplay(value: string): string {
    const digits = sanitizePhoneDigits(value);
    if (!digits)
        return "";
    if (digits.length <= 3)
        return `(${digits}`;
    if (digits.length <= 6)
        return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}
export function sanitizeMcNumberDigits(value: string, maxDigits: number = MC_NUMBER_DIGIT_LIMIT): string {
    return value.replace(/\D/g, "").slice(0, maxDigits);
}
export function sanitizeVinInput(value: string): string {
    return value
        .toUpperCase()
        .replace(/[^A-HJ-NPR-Z0-9]/g, "")
        .slice(0, VIN_CHARACTER_LIMIT);
}
export function sanitizePlateNumberInput(value: string, maxLength = 12): string {
    return value.toUpperCase().slice(0, maxLength);
}
