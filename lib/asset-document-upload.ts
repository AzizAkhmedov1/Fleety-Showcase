export const ASSET_DOCUMENT_ACCEPT = 'application/pdf,image/jpeg,image/png,image/jpg';
const ALLOWED_MIME_TYPES = new Set([
    'application/pdf',
    'image/jpeg',
    'image/jpg',
    'image/png',
]);
const ALLOWED_EXTENSIONS = new Set(['.pdf', '.jpg', '.jpeg', '.png']);
const BLOCKED_EXTENSIONS = new Set([
    '.zip',
    '.rar',
    '.7z',
    '.tar',
    '.gz',
    '.exe',
    '.msi',
    '.bat',
    '.cmd',
    '.sh',
    '.dll',
]);
export function isAllowedAssetDocumentFile(file: File): boolean {
    const extension = getFileExtension(file.name);
    if (BLOCKED_EXTENSIONS.has(extension)) {
        return false;
    }
    const mime = (file.type || '').toLowerCase();
    if (mime && ALLOWED_MIME_TYPES.has(mime)) {
        return true;
    }
    return ALLOWED_EXTENSIONS.has(extension);
}
function getFileExtension(filename: string): string {
    const dotIndex = filename.lastIndexOf('.');
    if (dotIndex < 0)
        return '';
    return filename.slice(dotIndex).toLowerCase();
}
