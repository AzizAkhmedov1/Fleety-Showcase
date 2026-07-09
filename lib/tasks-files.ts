import { getExpirationDisplay, type ExpirationUrgency } from "@/lib/document-expiration";
import type { DriverDocumentRecord, DriverProfile } from "@/lib/tms-api";
export type TaskFileStatus = ExpirationUrgency | "on_file";
export interface TaskFileRow {
    id: string | number;
    fileName: string;
    folderName: string;
    issueDate: string | null;
    expirationDate: string | null;
    uploadedDate: string | null;
    status: TaskFileStatus;
    statusLabel: string;
    notes: string;
    fileUrl?: string | null;
    filePath?: string | null;
    isTask?: boolean;
}
export function formatTaskFileDate(value?: string | null): string | null {
    if (!value)
        return null;
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime()))
        return value;
    return parsed.toLocaleDateString("en-US", {
        month: "2-digit",
        day: "2-digit",
        year: "numeric",
    });
}
export function statusLabelFromUrgency(urgency: TaskFileStatus): string {
    switch (urgency) {
        case "critical":
            return "Expired / Due";
        case "warning":
            return "Expiring Soon";
        case "ok":
            return "Valid";
        case "on_file":
            return "On File";
        default:
            return "—";
    }
}
export function statusBadgeClass(status: TaskFileStatus): string {
    switch (status) {
        case "critical":
            return "bg-red-500/10 text-red-500 border-red-500/20";
        case "warning":
            return "bg-amber-500/10 text-amber-500 border-amber-500/20";
        case "ok":
            return "bg-emerald-500/10 text-emerald-500 border-emerald-500/20";
        default:
            return "bg-zinc-500/10 text-zinc-400 border-zinc-600/30";
    }
}
function resolveDriverDocExpiration(profile: Pick<DriverProfile, "cdl_expiration_date" | "medical_card_expiration_date" | "twic_expiration_date">, documentType?: string | null): string | null {
    const normalized = (documentType || "").toLowerCase();
    if (normalized.includes("license") || normalized.includes("cdl")) {
        return profile.cdl_expiration_date ?? null;
    }
    if (normalized.includes("medical")) {
        return profile.medical_card_expiration_date ?? null;
    }
    if (normalized.includes("twic")) {
        return profile.twic_expiration_date ?? null;
    }
    return null;
}
export function buildDriverTaskFileRows(profile: DriverProfile, notesById: Record<string, string> = {}): TaskFileRow[] {
    const documentRows: TaskFileRow[] = profile.documents.map((doc) => {
        const expirationRaw = resolveDriverDocExpiration(profile, doc.document_type);
        const expiration = getExpirationDisplay(expirationRaw);
        const urgency: TaskFileStatus = expiration.urgency === "unknown" ? "on_file" : expiration.urgency;
        return {
            id: doc.id,
            fileName: doc.file_name || doc.document_type || "Document",
            folderName: doc.document_type || "Other Documents",
            issueDate: null,
            expirationDate: expiration.formattedDate,
            uploadedDate: formatTaskFileDate(doc.uploaded_at),
            status: urgency,
            statusLabel: statusLabelFromUrgency(urgency),
            notes: notesById[String(doc.id)] ?? doc.notes ?? "",
            fileUrl: doc.file_url,
            filePath: doc.file_path,
        };
    });
    const taskRows: TaskFileRow[] = profile.expiration_warnings.map((warning, index) => {
        const isExpired = warning.toLowerCase().includes("expired");
        return {
            id: `warning-${index}`,
            fileName: warning.split(" on ")[0] || "Compliance Task",
            folderName: "Compliance Tasks",
            issueDate: null,
            expirationDate: warning.includes(" on ") ? warning.split(" on ").pop() ?? null : null,
            uploadedDate: null,
            status: isExpired ? "critical" : "warning",
            statusLabel: isExpired ? "Action Required" : "Upcoming",
            notes: warning,
            isTask: true,
        };
    });
    return [...taskRows, ...documentRows];
}
export function buildDocumentRowsFromRecords(documents: DriverDocumentRecord[], notesById: Record<string, string> = {}, expirationByType: Record<string, string | null> = {}): TaskFileRow[] {
    return documents.map((doc) => {
        const typeKey = (doc.document_type || "").toLowerCase();
        const expirationRaw = expirationByType[typeKey] ??
            expirationByType[doc.document_type || ""] ??
            null;
        const expiration = getExpirationDisplay(expirationRaw);
        const urgency: TaskFileStatus = expiration.urgency === "unknown" ? "on_file" : expiration.urgency;
        return {
            id: doc.id,
            fileName: doc.file_name || doc.document_type || "Document",
            folderName: doc.document_type || "Asset Documents",
            issueDate: null,
            expirationDate: expiration.formattedDate,
            uploadedDate: formatTaskFileDate(doc.uploaded_at),
            status: urgency,
            statusLabel: statusLabelFromUrgency(urgency),
            notes: notesById[String(doc.id)] ?? doc.notes ?? "",
            fileUrl: doc.file_url,
            filePath: doc.file_path,
        };
    });
}
export function groupTaskFileRows(rows: TaskFileRow[]): Map<string, TaskFileRow[]> {
    const groups = new Map<string, TaskFileRow[]>();
    for (const row of rows) {
        const key = row.folderName || "Other";
        const bucket = groups.get(key) ?? [];
        bucket.push(row);
        groups.set(key, bucket);
    }
    return groups;
}
