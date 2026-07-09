"use client";
import React, { useEffect, useState } from "react";
import { signIn } from "next-auth/react";
import { AlertTriangle, Check, Eye, EyeOff, Mail, Lock, ArrowRight } from "lucide-react";
import toast from "react-hot-toast";
import McVerification from "@/components/auth/McVerification";
import AdditionalInfoStep, { type CarrierRole, type FleetSize, } from "@/components/auth/AdditionalInfoStep";
import { SOCIAL_AUTH_BUTTON_CLASS } from "@/components/auth/socialAuthStyles";
import { validateCompanyAvailability } from "@/lib/company-validation";
import { authCardClass, authTitleClass, authSubtitleClass, authLabelClass, authInputClass, authInputIconClass, authPrimaryButtonStandaloneClass, authDividerClass, authDividerLineClass, authDividerTextClass, authSocialGridClass, authFooterLinkAccentClass, } from "@/components/auth/authFormStyles";
import { MC_NUMBER_DIGIT_LIMIT, sanitizeMcNumberDigits } from "@/lib/input-formatters";
export interface RegisterWizardPayload {
    email: string;
    password: string;
    authProvider: "email" | "google" | "apple";
    twoFactorCode: string;
    firstName: string;
    lastName: string;
    phone: string;
    companyName: string;
    mcNumber: string;
    mcVerified: boolean;
    role: CarrierRole;
    fleetSize: FleetSize;
    referralSource: string;
    policyAccepted: boolean;
    captchaVerified: boolean;
}
interface RegisterWizardProps {
    onComplete?: (payload: RegisterWizardPayload) => void | Promise<void>;
    onBackToLogin?: () => void;
    initialStep?: WizardStep;
    profileOnly?: boolean;
    defaultEmail?: string;
    defaultFirstName?: string;
    defaultLastName?: string;
    registrationError?: string;
}
type WizardStep = 1 | 2 | 3;
type Step1Errors = Partial<Record<"email" | "password", string>>;
type Step2Errors = Partial<Record<"mcNumber" | "companyName", string>>;
type Step3Errors = Partial<Record<"role" | "fleetSize" | "referralSource" | "policyAccepted" | "captchaVerified", string>>;
const STEP_LABELS = ["Create account", "MC Number verification", "Additional info"] as const;
const inputClass = (hasError?: boolean) => authInputClass(hasError);
const labelClass = authLabelClass;
const getPasswordErrors = (password: string) => {
    const errors: string[] = [];
    if (password.length < 8)
        errors.push("At least 8 characters");
    if (!/[A-Z]/.test(password))
        errors.push("One uppercase letter");
    if (!/[0-9]/.test(password))
        errors.push("One number");
    if (!/[!@#$%^&*(),.?":{}|<>]/.test(password))
        errors.push("One special character");
    return errors;
};
const isValidEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
export default function RegisterWizard({ onComplete, onBackToLogin, initialStep = 1, profileOnly = false, defaultEmail = "", defaultFirstName = "", defaultLastName = "", registrationError = "", }: RegisterWizardProps) {
    const resolvedInitialStep: WizardStep = profileOnly ? 2 : initialStep;
    const [step, setStep] = useState<WizardStep>(resolvedInitialStep);
    const [authProvider, setAuthProvider] = useState<"email" | "google" | "apple">(profileOnly ? "google" : "email");
    const [email, setEmail] = useState(defaultEmail);
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [firstName, setFirstName] = useState(defaultFirstName);
    const [lastName, setLastName] = useState(defaultLastName);
    const [mcNumber, setMcNumber] = useState("");
    const [mcVerified, setMcVerified] = useState(false);
    const [verifiedCarrierName, setVerifiedCarrierName] = useState("");
    const [companyName, setCompanyName] = useState("");
    const [mcVerifying, setMcVerifying] = useState(false);
    const [role, setRole] = useState<CarrierRole | "">("");
    const [fleetSize, setFleetSize] = useState<FleetSize | "">("");
    const [referralSource, setReferralSource] = useState("");
    const [policyAccepted, setPolicyAccepted] = useState(false);
    const [captchaVerified, setCaptchaVerified] = useState(false);
    const [step1Errors, setStep1Errors] = useState<Step1Errors>({});
    const [step2Errors, setStep2Errors] = useState<Step2Errors>({});
    const [step3Errors, setStep3Errors] = useState<Step3Errors>({});
    const [submitting, setSubmitting] = useState(false);
    const [showPasswordRequirements, setShowPasswordRequirements] = useState(false);
    const [passwordShake, setPasswordShake] = useState(false);
    useEffect(() => {
        if (defaultEmail)
            setEmail(defaultEmail);
    }, [defaultEmail]);
    useEffect(() => {
        if (defaultFirstName)
            setFirstName(defaultFirstName);
    }, [defaultFirstName]);
    useEffect(() => {
        if (defaultLastName)
            setLastName(defaultLastName);
    }, [defaultLastName]);
    const passwordErrors = getPasswordErrors(password);
    const validateStep1 = () => {
        const nextErrors: Step1Errors = {};
        if (!email.trim()) {
            nextErrors.email = "Email is required.";
        }
        else if (!isValidEmail(email)) {
            nextErrors.email = "Enter a valid email address.";
        }
        if (!password) {
            nextErrors.password = "Password is required.";
        }
        else if (passwordErrors.length > 0) {
            nextErrors.password = "Password does not meet security requirements.";
        }
        setStep1Errors(nextErrors);
        return Object.keys(nextErrors).length === 0;
    };
    const validateMcNumber = () => {
        const digits = mcNumber.replace(/\D/g, "");
        if (!digits) {
            setStep2Errors({ mcNumber: "MC number is required." });
            return false;
        }
        if (!/^\d{6,8}$/.test(digits)) {
            setStep2Errors({ mcNumber: `Enter a valid 6–${MC_NUMBER_DIGIT_LIMIT} digit MC number.` });
            return false;
        }
        setStep2Errors((prev) => {
            const next = { ...prev };
            delete next.mcNumber;
            return next;
        });
        return true;
    };
    const checkCompanyAvailability = async (proposedName: string, dotNumber: string) => {
        try {
            const result = await validateCompanyAvailability(proposedName, dotNumber);
            if (!result.available) {
                setStep2Errors({
                    companyName: result.detail ||
                        "This company workspace is already registered. Use a different MC number or contact support.",
                });
                return false;
            }
            setStep2Errors((prev) => {
                const next = { ...prev };
                delete next.companyName;
                return next;
            });
            return true;
        }
        catch {
            setStep2Errors({
                companyName: "Unable to verify company availability. Please try again.",
            });
            return false;
        }
    };
    const validateStep3 = () => {
        const nextErrors: Step3Errors = {};
        if (!role)
            nextErrors.role = "Select your role to continue.";
        if (!fleetSize)
            nextErrors.fleetSize = "Select your fleet size.";
        if (!referralSource)
            nextErrors.referralSource = "Tell us how you heard about Fleety.";
        if (!policyAccepted)
            nextErrors.policyAccepted = "You must accept the Terms and Privacy Policy.";
        if (!captchaVerified)
            nextErrors.captchaVerified = "Complete the reCAPTCHA verification.";
        setStep3Errors(nextErrors);
        return Object.keys(nextErrors).length === 0;
    };
    const handleContinueStep1 = () => {
        setAuthProvider("email");
        if (!validateStep1()) {
            if (passwordErrors.length > 0) {
                toast.error("Password does not meet all security requirements.");
                setPasswordShake(true);
                window.setTimeout(() => setPasswordShake(false), 450);
            }
            return;
        }
        setStep(2);
    };
    const handleVerifyMc = async () => {
        if (mcVerified) {
            const available = await checkCompanyAvailability(companyName, mcNumber.replace(/\D/g, ""));
            if (!available)
                return;
            setStep(3);
            return;
        }
        if (!validateMcNumber())
            return;
        const digits = mcNumber.replace(/\D/g, "");
        const proposedCompanyName = `FMCSA Carrier MC-${digits}`;
        setMcVerifying(true);
        try {
            await new Promise((resolve) => window.setTimeout(resolve, 700));
            const available = await checkCompanyAvailability(proposedCompanyName, digits);
            if (!available)
                return;
            const carrierLabel = `Verified Carrier Authority #${digits}`;
            setVerifiedCarrierName(carrierLabel);
            setCompanyName(proposedCompanyName);
            setMcVerified(true);
            toast.success("Motor carrier authority verified.");
            window.setTimeout(() => setStep(3), 400);
        }
        finally {
            setMcVerifying(false);
        }
    };
    const handleMcNumberChange = (value: string) => {
        setMcNumber(sanitizeMcNumberDigits(value));
        setMcVerified(false);
        setVerifiedCarrierName("");
        setCompanyName("");
        setStep2Errors({});
    };
    const handleMcNumberBlur = async () => {
        if (!validateMcNumber() || mcVerified)
            return;
        const digits = mcNumber.replace(/\D/g, "");
        const proposedCompanyName = `FMCSA Carrier MC-${digits}`;
        await checkCompanyAvailability(proposedCompanyName, digits);
    };
    const handleSubmit = async () => {
        if (!mcVerified && !validateMcNumber())
            return;
        if (companyName.trim()) {
            const available = await checkCompanyAvailability(companyName.trim(), mcNumber.replace(/\D/g, ""));
            if (!available) {
                setStep(2);
                return;
            }
        }
        if (!validateStep3())
            return;
        setSubmitting(true);
        try {
            await onComplete?.({
                email: (email.trim() || defaultEmail).trim(),
                password,
                authProvider,
                twoFactorCode: "",
                firstName: firstName.trim(),
                lastName: lastName.trim(),
                phone: "",
                companyName: companyName.trim(),
                mcNumber: mcNumber.replace(/\D/g, ""),
                mcVerified,
                role: role as CarrierRole,
                fleetSize: fleetSize as FleetSize,
                referralSource,
                policyAccepted,
                captchaVerified,
            });
        }
        finally {
            setSubmitting(false);
        }
    };
    const effectiveStep = step;
    return (<div className="w-full">
      <div className="mb-8">
        <div className="flex items-center">
          {STEP_LABELS.map((label, index) => {
            const stepNumber = (index + 1) as WizardStep;
            const isProfileStepComplete = profileOnly && stepNumber === 1;
            const isActive = effectiveStep === stepNumber;
            const isComplete = isProfileStepComplete || effectiveStep > stepNumber;
            return (<React.Fragment key={label}>
                <div className="flex flex-col items-center gap-1.5 min-w-0">
                  <div className={`h-9 w-9 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-colors shrink-0 ${isActive
                    ? "bg-blue-600 text-white border-blue-600"
                    : isComplete
                        ? "bg-blue-600 text-white border-blue-600"
                        : "bg-white dark:bg-zinc-950 text-zinc-400 dark:text-zinc-500 border-zinc-200 dark:border-zinc-800"}`}>
                    {isComplete && !isActive ? <Check size={16} strokeWidth={3}/> : stepNumber}
                  </div>
                  <span className={`text-[10px] font-semibold text-center leading-tight max-w-[5.5rem] hidden sm:block ${isActive
                    ? "text-zinc-900 dark:text-zinc-100"
                    : isComplete
                        ? "text-blue-600 dark:text-blue-400"
                        : "text-zinc-400 dark:text-zinc-500"}`}>
                    {label}
                  </span>
                </div>
                {index < STEP_LABELS.length - 1 && (<div className={`flex-1 h-0.5 mx-2 sm:mx-3 mb-5 sm:mb-0 transition-colors ${effectiveStep > stepNumber || (profileOnly && stepNumber === 1)
                        ? "bg-blue-600"
                        : "bg-zinc-200 dark:bg-zinc-800"}`}/>)}
              </React.Fragment>);
        })}
        </div>
      </div>

      <div className={authCardClass}>
        {registrationError && (<div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-2 text-red-500 text-xs font-medium w-full animate-in fade-in zoom-in-95 duration-150">
            <AlertTriangle className="w-4 h-4 shrink-0" aria-hidden="true"/>
            <span>{registrationError}</span>
          </div>)}

        {step === 1 && (<div className="animate-in fade-in slide-in-from-right-4 duration-300">
            <h2 className={authTitleClass}>Create your account</h2>
            <p className={authSubtitleClass}>
              Join Fleety and simplify the way you manage your transportation operations.
            </p>

            <div className="space-y-4">
              <div>
                <label className={labelClass}>Work email</label>
                <div className="relative">
                  <Mail size={16} className={authInputIconClass}/>
                  <input type="email" value={email} onChange={(e) => {
                setEmail(e.target.value);
                setStep1Errors((prev) => {
                    const next = { ...prev };
                    delete next.email;
                    return next;
                });
            }} className={inputClass(Boolean(step1Errors.email))} placeholder="dispatcher@carrier.com"/>
                </div>
                {step1Errors.email && (<p className="text-xs text-red-500 mt-1 font-semibold">{step1Errors.email}</p>)}
              </div>

              <div>
                <label className={labelClass}>Password</label>
                <div className="relative">
                  {showPasswordRequirements && (<div className="absolute z-50 bottom-full mb-2 left-0 w-full bg-zinc-900 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 shadow-xl backdrop-blur-md" onMouseDown={(e) => e.preventDefault()}>
                      <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">
                        Password requirements
                      </p>
                      <ul className="text-xs space-y-1.5">
                        {[
                    { ok: password.length >= 8, label: "At least 8 characters" },
                    { ok: /[A-Z]/.test(password), label: "One uppercase letter" },
                    { ok: /[0-9]/.test(password), label: "One number" },
                    {
                        ok: /[!@#$%^&*(),.?":{}|<>]/.test(password),
                        label: "One special character",
                    },
                ].map((rule) => (<li key={rule.label} className={`flex items-center gap-2 ${rule.ok ? "text-emerald-500" : "text-zinc-500 dark:text-zinc-300"}`}>
                            <span aria-hidden="true">{rule.ok ? "✓" : "○"}</span>
                            {rule.label}
                          </li>))}
                      </ul>
                    </div>)}
                  <div className="relative">
                    <Lock size={16} className={authInputIconClass}/>
                    <input type={showPassword ? "text" : "password"} value={password} minLength={8} autoComplete="new-password" onChange={(e) => {
                setPassword(e.target.value);
                setStep1Errors((prev) => {
                    const next = { ...prev };
                    delete next.password;
                    return next;
                });
            }} onFocus={() => setShowPasswordRequirements(true)} onBlur={() => {
                window.setTimeout(() => setShowPasswordRequirements(false), 120);
            }} className={`${inputClass(Boolean(step1Errors.password))} pr-10 transition-all ${passwordShake ? "border-red-500 ring-2 ring-red-500/40 animate-pulse" : ""}`} placeholder="Create a secure password"/>
                    <button type="button" onClick={() => setShowPassword((prev) => !prev)} className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors" aria-label={showPassword ? "Hide password" : "Show password"}>
                      {showPassword ? <EyeOff size={16}/> : <Eye size={16}/>}
                    </button>
                  </div>
                </div>
                {step1Errors.password && (<p className="text-xs text-red-500 mt-1 font-semibold">{step1Errors.password}</p>)}
              </div>

              <button type="button" onClick={handleContinueStep1} className={authPrimaryButtonStandaloneClass}>
                Continue to MC verification
                <ArrowRight size={16} aria-hidden="true"/>
              </button>
            </div>

            <div className={authDividerClass}>
              <div className={authDividerLineClass}/>
              <span className={authDividerTextClass}>or sign up with</span>
              <div className={authDividerLineClass}/>
            </div>

            <div className={authSocialGridClass}>
              <button type="button" onClick={() => {
                setAuthProvider("google");
                signIn("google", { callbackUrl: "/" });
            }} className={SOCIAL_AUTH_BUTTON_CLASS}>
                <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                <span className="truncate">Continue with Google</span>
              </button>
            </div>
          </div>)}

        {step === 2 && (<McVerification mcNumber={mcNumber} error={step2Errors.mcNumber} companyNameError={step2Errors.companyName} verifying={mcVerifying} verified={mcVerified} verifiedCarrierName={verifiedCarrierName} showBack={!profileOnly} onMcNumberChange={handleMcNumberChange} onMcNumberBlur={handleMcNumberBlur} onBack={() => setStep(1)} onVerify={handleVerifyMc}/>)}

        {step === 3 && (<AdditionalInfoStep role={role} fleetSize={fleetSize} referralSource={referralSource} policyAccepted={policyAccepted} captchaVerified={captchaVerified} submitting={submitting} errors={step3Errors} onRoleChange={(value) => {
                setRole(value);
                setStep3Errors((prev) => {
                    const next = { ...prev };
                    delete next.role;
                    return next;
                });
            }} onFleetSizeChange={(value) => {
                setFleetSize(value);
                setStep3Errors((prev) => {
                    const next = { ...prev };
                    delete next.fleetSize;
                    return next;
                });
            }} onReferralChange={(value) => {
                setReferralSource(value);
                setStep3Errors((prev) => {
                    const next = { ...prev };
                    delete next.referralSource;
                    return next;
                });
            }} onPolicyChange={(accepted) => {
                setPolicyAccepted(accepted);
                setStep3Errors((prev) => {
                    const next = { ...prev };
                    delete next.policyAccepted;
                    return next;
                });
            }} onCaptchaChange={(verified) => {
                setCaptchaVerified(verified);
                setStep3Errors((prev) => {
                    const next = { ...prev };
                    delete next.captchaVerified;
                    return next;
                });
            }} onSubmit={handleSubmit} onBack={() => setStep(2)}/>)}

        {onBackToLogin && !profileOnly && step === 1 && (<p className="mt-8 text-center text-sm text-zinc-500 dark:text-zinc-500 antialiased">
            Already have an account?{" "}
            <button type="button" onClick={onBackToLogin} className={authFooterLinkAccentClass}>
              Sign in
            </button>
          </p>)}

      </div>
    </div>);
}
