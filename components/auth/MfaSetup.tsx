"use client";
import React, { useMemo, useRef } from "react";
import { ArrowRight, ChevronLeft, Copy, ShieldCheck } from "lucide-react";
import { authLabelClass, authMfaBackupKeyCardClass, authMfaDigitInputClass, authMfaQrPanelClass, authPrimaryButtonClass, authSecondaryButtonClass, authSubtitleClass, authTitleClass, } from "@/components/auth/authFormStyles";
interface MfaSetupProps {
    backupKey: string;
    code: string[];
    error?: string;
    onCodeChange: (index: number, raw: string) => void;
    onCodePaste: (raw: string) => void;
    onCopyBackupKey: () => void;
    onBack: () => void;
    onVerify: () => void;
}
function buildQrMatrix(secret: string, size = 21): boolean[][] {
    let seed = 0;
    for (let i = 0; i < secret.length; i += 1) {
        seed = (seed * 31 + secret.charCodeAt(i)) >>> 0;
    }
    const matrix: boolean[][] = Array.from({ length: size }, () => Array(size).fill(false));
    const pseudoRandom = (x: number, y: number) => {
        const n = Math.sin((seed + x * 374761 + y * 668265) * 12.9898) * 43758.5453;
        return n - Math.floor(n);
    };
    for (let y = 0; y < size; y += 1) {
        for (let x = 0; x < size; x += 1) {
            matrix[y][x] = pseudoRandom(x, y) > 0.48;
        }
    }
    const drawFinder = (ox: number, oy: number) => {
        for (let y = 0; y < 7; y += 1) {
            for (let x = 0; x < 7; x += 1) {
                const edge = x === 0 || x === 6 || y === 0 || y === 6;
                const core = x >= 2 && x <= 4 && y >= 2 && y <= 4;
                matrix[oy + y][ox + x] = edge || core;
            }
        }
    };
    drawFinder(0, 0);
    drawFinder(size - 7, 0);
    drawFinder(0, size - 7);
    return matrix;
}
function AuthenticatorQrSvg({ secret }: {
    secret: string;
}) {
    const matrix = useMemo(() => buildQrMatrix(secret), [secret]);
    const size = matrix.length;
    const cell = 100 / size;
    return (<svg viewBox="0 0 100 100" className="h-28 w-28 sm:h-32 sm:w-32" aria-hidden="true">
      <rect width="100" height="100" fill="white" rx="4"/>
      {matrix.map((row, y) => row.map((filled, x) => filled ? (<rect key={`${x}-${y}`} x={x * cell + 0.2} y={y * cell + 0.2} width={cell - 0.4} height={cell - 0.4} fill="#09090b" rx={0.3}/>) : null))}
    </svg>);
}
export default function MfaSetup({ backupKey, code, error, onCodeChange, onCodePaste, onCopyBackupKey, onBack, onVerify, }: MfaSetupProps) {
    const digitRefs = useRef<Array<HTMLInputElement | null>>([]);
    const verifyButtonRef = useRef<HTMLButtonElement | null>(null);
    const handleDigitInput = (index: number, raw: string) => {
        const nextDigit = raw.replace(/\D/g, "").slice(-1);
        onCodeChange(index, nextDigit);
        if (nextDigit && index < 5) {
            digitRefs.current[index + 1]?.focus();
            return;
        }
        if (nextDigit && index === 5) {
            verifyButtonRef.current?.focus();
        }
    };
    const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
        e.preventDefault();
        const pasted = e.clipboardData.getData("text");
        onCodePaste(pasted);
        const len = pasted.replace(/\D/g, "").slice(0, 6).length;
        if (len >= 6) {
            verifyButtonRef.current?.focus();
        }
        else {
            digitRefs.current[Math.min(Math.max(len - 1, 0), 5)]?.focus();
        }
    };
    return (<div className="animate-in fade-in slide-in-from-right-4 duration-300">
      <h2 className={authTitleClass}>Secure your workspace</h2>
      <p className={authSubtitleClass}>
        Scan the QR code or enter the backup key in Google Authenticator or 1Password.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className={authMfaQrPanelClass}>
          <AuthenticatorQrSvg secret={backupKey}/>
          <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
            Authenticator QR
          </p>
        </div>

        <div className={authMfaBackupKeyCardClass}>
          <div className="flex items-start gap-2">
            <ShieldCheck size={18} className="text-blue-600 shrink-0 mt-0.5"/>
            <div>
              <p className="text-xs font-bold uppercase text-zinc-500 dark:text-zinc-400">
                Manual backup key
              </p>
              <p className="text-sm font-mono font-bold mt-2 break-all">{backupKey}</p>
            </div>
          </div>
          <button type="button" onClick={onCopyBackupKey} className="mt-4 inline-flex items-center gap-2 text-xs font-bold text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 transition-colors">
            <Copy size={14}/>
            Copy backup key
          </button>
        </div>
      </div>

      <div className="mt-5">
        <label className={authLabelClass}>6-digit verification code</label>
        <div className="mt-2 flex items-center justify-between gap-2">
          {code.map((digit, index) => (<input key={index} ref={(el) => {
                digitRefs.current[index] = el;
            }} type="text" inputMode="numeric" pattern="[0-9]*" maxLength={1} value={digit} onChange={(e) => handleDigitInput(index, e.target.value)} onKeyDown={(e) => {
                if (e.key === "Backspace" && !code[index] && index > 0) {
                    digitRefs.current[index - 1]?.focus();
                }
                if (e.key === "Enter" && /^\d{6}$/.test(code.join(""))) {
                    onVerify();
                }
            }} onPaste={handlePaste} className={authMfaDigitInputClass(Boolean(error))} aria-label={`Verification digit ${index + 1}`}/>))}
        </div>
        {error && <p className="text-xs text-red-500 dark:text-red-400 mt-2 font-semibold">{error}</p>}
      </div>

      <div className="flex gap-3 mt-6">
        <button type="button" onClick={onBack} className={authSecondaryButtonClass}>
          <ChevronLeft size={16}/>
          Back
        </button>
        <button type="button" ref={verifyButtonRef} onClick={onVerify} className={`flex-1 ${authPrimaryButtonClass}`}>
          Verify & continue
          <ArrowRight size={16} aria-hidden="true"/>
        </button>
      </div>
    </div>);
}
