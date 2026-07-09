"use client";
import { ArrowRight, ChevronLeft } from "lucide-react";
import { authLabelClass, authSubtitleClass, authTitleClass, } from "@/components/auth/authFormStyles";
import { MC_NUMBER_DIGIT_LIMIT, sanitizeMcNumberDigits } from "@/lib/input-formatters";
interface McVerificationProps {
    mcNumber: string;
    error?: string;
    companyNameError?: string;
    verifying: boolean;
    verified: boolean;
    verifiedCarrierName?: string;
    showBack?: boolean;
    onMcNumberChange: (value: string) => void;
    onMcNumberBlur?: () => void;
    onBack: () => void;
    onVerify: () => void;
}
export default function McVerification({ mcNumber, error, companyNameError, verifying, verified, verifiedCarrierName, showBack = true, onMcNumberChange, onMcNumberBlur, onBack, onVerify, }: McVerificationProps) {
    return (<div className="animate-in fade-in slide-in-from-right-4 duration-300">
      <h2 className={authTitleClass}>MC Number verification</h2>
      <p className={authSubtitleClass}>
        Enter your FMCSA motor carrier number to verify operating authority before continuing.
      </p>

      <div className="space-y-4">
        <div>
          <label className={authLabelClass}>MC Number</label>
          <div className="relative">
            <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 rounded-md bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              MC
            </span>
            <input type="text" inputMode="numeric" pattern="[0-9]*" maxLength={MC_NUMBER_DIGIT_LIMIT} value={mcNumber} onChange={(e) => onMcNumberChange(sanitizeMcNumberDigits(e.target.value))} onBlur={() => onMcNumberBlur?.()} className="w-full h-12 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder-zinc-600 pl-14 pr-4 text-sm outline-none transition-all focus:border-blue-600 focus:ring-1 focus:ring-blue-600 dark:focus:ring-blue-600" placeholder="1234567"/>
          </div>
          {error && <p className="text-xs text-red-500 dark:text-red-400 mt-1.5 font-semibold">{error}</p>}
          {companyNameError && (<p className="text-xs text-red-500 dark:text-red-400 mt-1.5 font-semibold">{companyNameError}</p>)}
          {verified && verifiedCarrierName && (<p className="text-xs text-emerald-600 dark:text-emerald-400 mt-2 font-medium">
              ✓ Authority verified — {verifiedCarrierName}
            </p>)}
        </div>

        <div className="flex items-center gap-4 w-full mt-6">
          {showBack && (<button type="button" onClick={onBack} className="w-1/3 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 rounded-xl py-3 text-sm font-medium transition-all inline-flex items-center justify-center gap-1">
              <ChevronLeft size={16} aria-hidden="true"/>
              Back
            </button>)}
          <button type="button" onClick={onVerify} disabled={verifying} className={`${showBack ? 'w-2/3' : 'w-full'} bg-blue-600 hover:bg-blue-700 text-white rounded-xl py-3 text-sm font-medium transition-all flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed`}>
            {verifying ? "Verifying authority..." : verified ? "Continue" : "Verify Authority"}
            {!verifying && <ArrowRight className="w-4 h-4" aria-hidden="true"/>}
          </button>
        </div>
      </div>
    </div>);
}
