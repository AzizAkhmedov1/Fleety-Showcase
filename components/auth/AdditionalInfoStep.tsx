"use client";
import Link from "next/link";
import { ArrowRight, ChevronDown } from "lucide-react";
import { authLabelClass, authPrimaryButtonClass, authSubtitleClass, authTitleClass, } from "@/components/auth/authFormStyles";
export type CarrierRole = "owner" | "dispatcher" | "driver" | "billing";
export type FleetSize = "1-14" | "15-49" | "50-99" | "100+";
const ROLES: {
    value: CarrierRole;
    label: string;
}[] = [
    { value: "owner", label: "Owner" },
    { value: "dispatcher", label: "Dispatcher" },
    { value: "driver", label: "Driver" },
    { value: "billing", label: "Billing" },
];
const FLEET_SIZES: FleetSize[] = ["1-14", "15-49", "50-99", "100+"];
const REFERRAL_OPTIONS = [
    "Google search",
    "Referral from a colleague",
    "Industry event",
    "Social media",
    "Other",
];
interface AdditionalInfoStepProps {
    role: CarrierRole | "";
    fleetSize: FleetSize | "";
    referralSource: string;
    policyAccepted: boolean;
    captchaVerified: boolean;
    submitting: boolean;
    errors: {
        role?: string;
        fleetSize?: string;
        referralSource?: string;
        policyAccepted?: string;
        captchaVerified?: string;
    };
    onRoleChange: (role: CarrierRole) => void;
    onFleetSizeChange: (size: FleetSize) => void;
    onReferralChange: (value: string) => void;
    onPolicyChange: (accepted: boolean) => void;
    onCaptchaChange: (verified: boolean) => void;
    onSubmit: () => void;
    onBack?: () => void;
}
export default function AdditionalInfoStep({ role, fleetSize, referralSource, policyAccepted, captchaVerified, submitting, errors, onRoleChange, onFleetSizeChange, onReferralChange, onPolicyChange, onCaptchaChange, onSubmit, onBack, }: AdditionalInfoStepProps) {
    return (<form onSubmit={(e) => {
            e.preventDefault();
            onSubmit();
        }} className="animate-in fade-in slide-in-from-right-4 duration-300 space-y-6">
      <div>
        <h2 className={authTitleClass}>Additional Information</h2>
        <p className={authSubtitleClass}>Select your role</p>
      </div>

      <fieldset>
        <legend className="sr-only">Select your role</legend>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {ROLES.map(({ value, label }) => {
            const selected = role === value;
            return (<label key={value} className={`cursor-pointer rounded-xl border px-3 py-3 text-center text-sm font-medium transition-all ${selected
                    ? "border-blue-600 dark:border-blue-500 bg-blue-500/5 text-zinc-900 dark:text-zinc-100 ring-1 ring-blue-600/30"
                    : "border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-900/50"}`}>
                <input type="radio" name="carrier-role" value={value} checked={selected} onChange={() => onRoleChange(value)} className="sr-only"/>
                {label}
              </label>);
        })}
        </div>
        {errors.role && <p className="text-xs text-red-500 mt-1.5 font-semibold">{errors.role}</p>}
      </fieldset>

      <div>
        <label className={authLabelClass}>How many Trucks do you have?</label>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-1.5">
          {FLEET_SIZES.map((size) => {
            const selected = fleetSize === size;
            return (<button key={size} type="button" onClick={() => onFleetSizeChange(size)} className={`h-12 rounded-xl border text-sm font-medium transition-all ${selected
                    ? "border-blue-600 dark:border-blue-500 bg-blue-500/5 text-zinc-900 dark:text-zinc-100 ring-1 ring-blue-600/30"
                    : "border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-900/50"}`}>
                {size}
              </button>);
        })}
        </div>
        {errors.fleetSize && (<p className="text-xs text-red-500 mt-1.5 font-semibold">{errors.fleetSize}</p>)}
      </div>

      <div>
        <label className={authLabelClass} htmlFor="referral-source">
          How did you hear about us?
        </label>
        <div className="relative mt-1.5">
          <select id="referral-source" value={referralSource} onChange={(e) => onReferralChange(e.target.value)} className="w-full h-12 appearance-none rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 px-4 pr-10 text-sm outline-none transition-all focus:border-blue-600 focus:ring-1 focus:ring-blue-600 dark:focus:ring-blue-600">
            <option value="">Select an option</option>
            {REFERRAL_OPTIONS.map((opt) => (<option key={opt} value={opt}>
                {opt}
              </option>))}
          </select>
          <ChevronDown size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400"/>
        </div>
        {errors.referralSource && (<p className="text-xs text-red-500 mt-1.5 font-semibold">{errors.referralSource}</p>)}
      </div>

      <label className="flex items-start gap-3 cursor-pointer group">
        <input type="checkbox" checked={policyAccepted} onChange={(e) => onPolicyChange(e.target.checked)} className="mt-1 h-4 w-4 rounded border-zinc-300 dark:border-zinc-700 text-blue-600 focus:ring-blue-600"/>
        <span className="text-sm text-zinc-600 dark:text-zinc-300 leading-relaxed">
          By checking this box, I acknowledge that I have read and understood the{" "}
          <Link href="/terms" className="text-blue-600 dark:text-blue-400 hover:underline font-medium">
            Terms of Service
          </Link>{" "}
          and{" "}
          <Link href="/privacy" className="text-blue-600 dark:text-blue-400 hover:underline font-medium">
            Privacy Policy
          </Link>
          , and I agree to be bound by them.
        </span>
      </label>
      {errors.policyAccepted && (<p className="text-xs text-red-500 font-semibold -mt-3">{errors.policyAccepted}</p>)}

      <div className={`rounded-xl border p-4 flex items-center gap-3 transition-colors ${captchaVerified
            ? "border-emerald-300 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/20"
            : "border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950"}`}>
        <button type="button" onClick={() => onCaptchaChange(!captchaVerified)} className={`h-7 w-7 shrink-0 rounded border-2 flex items-center justify-center transition-colors ${captchaVerified
            ? "border-emerald-500 bg-emerald-500 text-white"
            : "border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900"}`} aria-label="I'm not a robot">
          {captchaVerified && (<svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3}>
              <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>)}
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200">I&apos;m not a robot</p>
          <p className="text-[10px] text-zinc-400 dark:text-zinc-500 mt-0.5">reCAPTCHA · Privacy · Terms</p>
        </div>
        <div className="shrink-0 text-[10px] text-zinc-400 dark:text-zinc-500 font-semibold">reCAPTCHA</div>
      </div>
      {errors.captchaVerified && (<p className="text-xs text-red-500 font-semibold -mt-3">{errors.captchaVerified}</p>)}

      <div className="flex items-center gap-4 w-full mt-6">
        {onBack ? (<button type="button" onClick={onBack} className="w-1/3 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 rounded-xl py-3 text-sm font-medium transition-all">
            Back
          </button>) : null}
        <button type="submit" disabled={submitting} className={`${onBack ? 'w-2/3' : 'w-full'} bg-blue-600 hover:bg-blue-700 text-white rounded-xl py-3 text-sm font-medium transition-all flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed`}>
          {submitting ? "Creating your workspace..." : "Continue to Fleety"}
          {!submitting && <ArrowRight className="w-4 h-4" aria-hidden="true"/>}
        </button>
      </div>

      <p className="text-center text-xs text-zinc-400 dark:text-zinc-500">
        By creating your account you accept our{" "}
        <Link href="/terms" className="text-blue-600 dark:text-blue-400 hover:underline">
          Terms of Service
        </Link>{" "}
        and{" "}
        <Link href="/privacy" className="text-blue-600 dark:text-blue-400 hover:underline">
          Privacy Policy
        </Link>
      </p>

      <p className="text-center text-xs text-zinc-400 dark:text-zinc-500 pb-1">
        ©2026 Fleety, Inc. All rights reserved.
      </p>
    </form>);
}
