import type { LoadDocumentRecord } from '@/lib/tms-api';
export function resolveLoadDocumentUrl(doc: LoadDocumentRecord): string {
    if (!doc.file_url)
        return '';
    if (doc.file_url.startsWith('http://') || doc.file_url.startsWith('https://')) {
        return doc.file_url;
    }
    console.warn(`CRITICAL: Local relative reference leaked to frontend: ${doc.file_url}`);
    return '';
}
