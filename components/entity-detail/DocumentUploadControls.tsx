"use client";
import React, { useCallback, useRef, useState } from "react";
import { Loader2, Trash2, UploadCloud } from "lucide-react";
import { ASSET_DOCUMENT_ACCEPT, isAllowedAssetDocumentFile, } from "@/lib/asset-document-upload";
export const CUSTOM_FOLDER_OPTION = "__custom_folder__";
export const DEFAULT_DOCUMENT_TYPE_OPTIONS = [
    "Driver's License",
    "Medical Card",
    "TWIC Card",
    "Driver Document",
] as const;
export function resolveUploadDocumentType(documentType: string, customFolderName: string): string | null {
    if (documentType === CUSTOM_FOLDER_OPTION) {
        const trimmed = customFolderName.trim();
        return trimmed || null;
    }
    return documentType;
}
export type ManagedCustomFolder = {
    id: number;
    folder_name: string;
};
interface DocumentUploadControlsProps {
    documentType: string;
    onDocumentTypeChange: (value: string) => void;
    customFolderName: string;
    onCustomFolderNameChange: (value: string) => void;
    onFileSelected: (file: File) => void | Promise<void>;
    uploading?: boolean;
    disabled?: boolean;
    inputId: string;
    documentTypeOptions?: readonly string[];
    managedCustomFolders?: ManagedCustomFolder[];
    onDeleteCustomFolder?: (folderId: number) => void | Promise<void>;
    onInvalidFile?: (file: File) => void;
    accept?: string;
    scanHint?: string | null;
}
export default function DocumentUploadControls({ documentType, onDocumentTypeChange, customFolderName, onCustomFolderNameChange, onFileSelected, uploading = false, disabled = false, inputId, documentTypeOptions = DEFAULT_DOCUMENT_TYPE_OPTIONS, managedCustomFolders, onDeleteCustomFolder, onInvalidFile, accept = ASSET_DOCUMENT_ACCEPT, scanHint = "CDL and medical card uploads are automatically scanned for expiration dates.", }: DocumentUploadControlsProps) {
    const isCustomFolder = documentType === CUSTOM_FOLDER_OPTION;
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [folderMenuOpen, setFolderMenuOpen] = useState(false);
    const processSelectedFile = useCallback((file: File) => {
        if (!isAllowedAssetDocumentFile(file)) {
            onInvalidFile?.(file);
            return;
        }
        void onFileSelected(file);
    }, [onFileSelected, onInvalidFile]);
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file)
            processSelectedFile(file);
        e.target.value = "";
    };
    const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        if (uploading || disabled)
            return;
        const file = e.dataTransfer.files?.[0];
        if (file)
            processSelectedFile(file);
    }, [disabled, processSelectedFile, uploading]);
    const selectedLabel = documentType === CUSTOM_FOLDER_OPTION
        ? "+ Create Custom Folder"
        : documentType || "Select folder";
    const handleFolderSelect = (value: string) => {
        onDocumentTypeChange(value);
        setFolderMenuOpen(false);
    };
    const handleDeleteFolder = async (event: React.MouseEvent<HTMLButtonElement>, folderId: number, folderName: string) => {
        event.preventDefault();
        event.stopPropagation();
        if (!onDeleteCustomFolder || uploading || disabled)
            return;
        await onDeleteCustomFolder(folderId);
        if (documentType === folderName) {
            onDocumentTypeChange("");
        }
    };
    return (<div className="space-y-3">
      {scanHint ? (<p className="text-xs text-zinc-500">{scanHint}</p>) : null}

      {managedCustomFolders ? (<div className="relative">
          <button type="button" onClick={() => setFolderMenuOpen((open) => !open)} disabled={uploading || disabled} className="w-full border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-zinc-900 dark:text-white p-2.5 rounded-lg text-sm font-medium outline-none focus:ring-2 focus:ring-zinc-600 transition-colors disabled:opacity-60 text-left">
            {selectedLabel}
          </button>
          {folderMenuOpen ? (<div className="absolute z-20 mt-1 w-full max-h-64 overflow-y-auto rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 shadow-lg">
              {documentTypeOptions.map((option) => (<button key={option} type="button" onClick={() => handleFolderSelect(option)} className="w-full px-3 py-2 text-left text-sm text-zinc-900 dark:text-white hover:bg-zinc-100 dark:hover:bg-zinc-900">
                  {option}
                </button>))}
              {managedCustomFolders.map((folder) => (<div key={folder.id} className="flex items-center gap-2 px-3 py-2 hover:bg-zinc-100 dark:hover:bg-zinc-900">
                  <button type="button" onClick={() => handleFolderSelect(folder.folder_name)} className="flex-1 text-left text-sm text-zinc-900 dark:text-white">
                    {folder.folder_name}
                  </button>
                  {onDeleteCustomFolder ? (<button type="button" aria-label={`Delete ${folder.folder_name}`} onClick={(event) => void handleDeleteFolder(event, folder.id, folder.folder_name)} disabled={uploading || disabled} className="text-zinc-400 hover:text-red-500 dark:text-zinc-600 dark:hover:text-red-400 disabled:opacity-50">
                      <Trash2 size={14}/>
                    </button>) : null}
                </div>))}
              <button type="button" onClick={() => handleFolderSelect(CUSTOM_FOLDER_OPTION)} className="w-full px-3 py-2 text-left text-sm text-zinc-900 dark:text-white hover:bg-zinc-100 dark:hover:bg-zinc-900 border-t border-zinc-200 dark:border-zinc-800">
                + Create Custom Folder
              </button>
            </div>) : null}
        </div>) : (<select value={documentType} onChange={(e) => onDocumentTypeChange(e.target.value)} disabled={uploading || disabled} className="w-full border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-zinc-900 dark:text-white p-2.5 rounded-lg text-sm font-medium outline-none focus:ring-2 focus:ring-zinc-600 transition-colors disabled:opacity-60">
          {documentTypeOptions.map((option) => (<option key={option} value={option}>
              {option}
            </option>))}
          <option value={CUSTOM_FOLDER_OPTION}>+ Create Custom Folder</option>
        </select>)}

      {isCustomFolder ? (<input type="text" value={customFolderName} onChange={(e) => onCustomFolderNameChange(e.target.value)} placeholder='Folder name (e.g. "Safety Cert", "W-2")' disabled={uploading || disabled} className="w-full border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-white p-2.5 rounded-lg text-sm outline-none focus:ring-2 focus:ring-zinc-600 transition-colors disabled:opacity-60"/>) : null}

      <div onDragOver={(e) => {
            e.preventDefault();
            e.stopPropagation();
        }} onDrop={handleDrop} className="border-2 border-dashed border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl p-4 text-center transition-colors">
        <UploadCloud size={22} className="mx-auto text-zinc-400 dark:text-zinc-500 mb-2"/>
        <p className="text-sm font-semibold text-zinc-700 dark:text-zinc-200 mb-1">
          Drag & drop or browse
        </p>
        <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-3">PDF, PNG, or JPG accepted</p>
        <input ref={fileInputRef} type="file" id={inputId} className="hidden" accept={accept} onChange={handleFileChange}/>
        <button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploading || disabled} className="bg-zinc-900 hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200 text-white rounded-lg text-sm font-semibold px-4 py-2 transition-all disabled:opacity-50 shadow-sm inline-flex items-center gap-2">
          {uploading ? <Loader2 size={14} className="animate-spin"/> : null}
          {uploading ? "Uploading..." : "Browse Files"}
        </button>
      </div>
    </div>);
}
