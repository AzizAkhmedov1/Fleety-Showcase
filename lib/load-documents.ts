import type { LoadDocumentRecord } from "@/lib/tms-api";
import { resolveLoadDocumentUrl as resolveStoredDocumentFileUrl } from "@/utils/document";
export const UPLOADED_DOCS_STATIC_PREFIX = "/uploaded_docs";
export const UPLOADS_STATIC_PREFIX = "/uploads";
const BACKEND_API_FALLBACK = "http://localhost:8000";
function backendApiBaseUrl(): string {
    const baseUrl = process.env.NEXT_PUBLIC_API_URL?.trim() || BACKEND_API_FALLBACK;
    if (!/^https?:\/\//i.test(baseUrl)) {
        return BACKEND_API_FALLBACK.replace(/\/+$/, "");
    }
    return baseUrl.replace(/\/+$/, "");
}
function isAbsoluteHttpUrl(value: string): boolean {
    return /^https?:\/\//i.test(value);
}
export function toStaticServePath(rawPath: string): string {
    const trimmed = rawPath.trim().replace(/\\/g, "/");
    if (isAbsoluteHttpUrl(trimmed)) {
        return trimmed;
    }
    if (trimmed.startsWith(UPLOADED_DOCS_STATIC_PREFIX) || trimmed.startsWith(UPLOADS_STATIC_PREFIX)) {
        return trimmed;
    }
    const withoutLeading = trimmed.replace(/^\.?\/*/, "");
    if (withoutLeading.startsWith("uploaded_docs/") ||
        withoutLeading.startsWith("uploads/")) {
        return `/${withoutLeading}`;
    }
    const uploadedIdx = withoutLeading.indexOf("uploaded_docs/");
    if (uploadedIdx >= 0) {
        return `/${withoutLeading.slice(uploadedIdx)}`;
    }
    const uploadsIdx = withoutLeading.indexOf("uploads/");
    if (uploadsIdx >= 0) {
        return `/${withoutLeading.slice(uploadsIdx)}`;
    }
    return `/${withoutLeading}`;
}
function toAbsoluteDocumentUrl(pathOrUrl: string): string {
    const trimmed = pathOrUrl.trim();
    if (!trimmed) {
        return backendApiBaseUrl();
    }
    if (isAbsoluteHttpUrl(trimmed)) {
        return trimmed;
    }
    const baseUrl = backendApiBaseUrl();
    const staticPath = trimmed.startsWith("/") ? trimmed : toStaticServePath(trimmed);
    const normalizedPath = staticPath.startsWith("/") ? staticPath : `/${staticPath}`;
    const absoluteUrl = `${baseUrl}${normalizedPath}`;
    if (!isAbsoluteHttpUrl(absoluteUrl)) {
        return `${baseUrl}/${normalizedPath.replace(/^\/+/, "")}`;
    }
    return absoluteUrl;
}
export function resolveLoadDocumentUrl(doc: LoadDocumentRecord): string | null {
    const fileUrl = resolveStoredDocumentFileUrl(doc);
    if (fileUrl) {
        return fileUrl;
    }
    const filePath = doc.file_path?.trim();
    if (!filePath) {
        return null;
    }
    if (filePath.startsWith('http://') || filePath.startsWith('https://')) {
        return filePath;
    }
    console.warn(`CRITICAL: Local relative reference leaked to frontend: ${filePath}`);
    return null;
}
export function loadDocumentDisplayName(doc: LoadDocumentRecord): string {
    return doc.file_name?.trim() || doc.document_type?.trim() || "Document";
}
export function isRateConfirmationDocument(doc: LoadDocumentRecord): boolean {
    const docType = (doc.document_type ?? "").trim().toLowerCase();
    if (docType === "rate confirmation" ||
        docType.includes("rate confirmation") ||
        docType.includes("rate con")) {
        return true;
    }
    const fileName = (doc.file_name ?? "").trim().toLowerCase();
    if (/rate[\s_-]?con(firmation)?/.test(fileName)) {
        return true;
    }
    if (/rc\d/i.test(fileName)) {
        return true;
    }
    return false;
}
const BILLING_DOCUMENT_TYPES = new Set([
    "invoice",
    "factoring submission",
    "factoring_manifest",
    "factoring manifest",
    "pod",
    "bol",
    "lumper",
    "scale",
    "scale_ticket",
]);
const BILLING_FILENAME_PREFIXES = ["invoice", "factoring_manifest", "factoring submission"];
const SETTLEMENT_DOCUMENT_TYPES = new Set(["settlement", "driver settlement"]);
function normalizedDocumentType(doc: LoadDocumentRecord): string {
    return (doc.document_type ?? "").trim().toLowerCase();
}
function normalizedFileName(doc: LoadDocumentRecord): string {
    return (doc.file_name ?? "").trim().toLowerCase();
}
export function isSettlementDocument(doc: LoadDocumentRecord): boolean {
    const category = (doc.category ?? "").trim().toLowerCase();
    const docType = normalizedDocumentType(doc);
    if (category === "billing" && docType === "settlement") {
        return true;
    }
    if (SETTLEMENT_DOCUMENT_TYPES.has(docType)) {
        return true;
    }
    if (docType === "settlement") {
        return true;
    }
    return normalizedFileName(doc).startsWith("driver_settlement_");
}
export function isOperationalExcludedDocument(doc: LoadDocumentRecord): boolean {
    if (normalizedDocumentType(doc) === "settlement") {
        return true;
    }
    if ((doc.category ?? "").trim().toLowerCase() === "billing") {
        return true;
    }
    if (normalizedFileName(doc).startsWith("driver_settlement_")) {
        return true;
    }
    return isSettlementDocument(doc);
}
function matchesBillingFileName(fileName: string): boolean {
    if (fileName.startsWith("driver_settlement_")) {
        return true;
    }
    if (BILLING_FILENAME_PREFIXES.some((prefix) => fileName.startsWith(prefix))) {
        return true;
    }
    if (/\binvoice\b/.test(fileName) || fileName.includes("factoring")) {
        return true;
    }
    if (/\bpod\b/.test(fileName) || fileName.startsWith("pod_") || fileName.endsWith("_pod.pdf")) {
        return true;
    }
    if (/\bbol\b/.test(fileName) || fileName.startsWith("bol_") || fileName.endsWith("_bol.pdf")) {
        return true;
    }
    if (fileName.includes("lumper") || fileName.includes("scale_ticket") || /\bscale\b/.test(fileName)) {
        return true;
    }
    return false;
}
export function isBillingDomainDocument(doc: LoadDocumentRecord): boolean {
    if (isRateConfirmationDocument(doc)) {
        return false;
    }
    if (isSettlementDocument(doc)) {
        return true;
    }
    const docType = normalizedDocumentType(doc);
    if (BILLING_DOCUMENT_TYPES.has(docType)) {
        return true;
    }
    return matchesBillingFileName(normalizedFileName(doc));
}
export function filterBillingDocuments(docs: LoadDocumentRecord[]): LoadDocumentRecord[] {
    return docs.filter(isBillingDomainDocument);
}
export function filterOperationalDocuments(docs: LoadDocumentRecord[]): LoadDocumentRecord[] {
    return docs.filter((doc) => !isOperationalExcludedDocument(doc));
}
export function inferBillingDocumentType(fileName: string): string {
    const lower = fileName.toLowerCase();
    if (lower.includes("invoice"))
        return "Invoice";
    if (lower.includes("factoring"))
        return "factoring_manifest";
    if (/\bpod\b/.test(lower) || lower.startsWith("pod_"))
        return "POD";
    if (/\bbol\b/.test(lower) || lower.startsWith("bol_"))
        return "BOL";
    if (lower.includes("lumper"))
        return "LUMPER";
    if (lower.includes("scale"))
        return "SCALE_TICKET";
    return "Other";
}
export function loadDocumentsPopoverTitle(docs: LoadDocumentRecord[]): string {
    if (docs.length === 0)
        return "Attached Files";
    if (docs.length === 1) {
        const only = docs[0];
        if (isRateConfirmationDocument(only))
            return "Rate Confirmation";
        return only.document_type?.trim() || "Attached Files";
    }
    const rateConfirmationCount = docs.filter((doc: LoadDocumentRecord) => isRateConfirmationDocument(doc)).length;
    if (rateConfirmationCount === docs.length)
        return "Rate Confirmation";
    return "Attached Files";
}
