import { getTmsSessionProfile } from './api-client';
export interface TMSJwtPayload {
    sub: string;
    user_id?: number;
    company_id?: number;
    carrier_id?: number;
    roles?: string[];
    exp?: number;
}
function decodeBase64Url(segment: string): string {
    const padded = segment.replace(/-/g, '+').replace(/_/g, '/');
    const padLen = (4 - (padded.length % 4)) % 4;
    return atob(padded + '='.repeat(padLen));
}
export function decodeAccessToken(token: string | null | undefined): TMSJwtPayload | null {
    if (!token)
        return null;
    try {
        const parts = token.split('.');
        if (parts.length < 2)
            return null;
        return JSON.parse(decodeBase64Url(parts[1])) as TMSJwtPayload;
    }
    catch {
        return null;
    }
}
export function getCarrierId(_token?: string | null | undefined): number | null {
    return getTmsSessionProfile()?.companyId ?? null;
}
export function getUserId(_token?: string | null | undefined): number | null {
    return getTmsSessionProfile()?.userId ?? null;
}
export function getStoredToken(): string | null {
    return null;
}
