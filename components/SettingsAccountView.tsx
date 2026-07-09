"use client";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import toast from "react-hot-toast";
import { UserCircle, Truck, Settings2, Bell, MapPinned, Shield, Loader2, Save, Users, Smartphone, } from "lucide-react";
import { createApiClient, hasValidTmsToken, normalizeBearerToken } from "@/lib/api-client";
import { createTmsApi } from "@/lib/tms-api";
import TeamManagement from "@/components/settings/TeamManagement";
import MobileAppManagement from "@/components/settings/MobileAppManagement";
import { useTMSStore } from "@/store/useTMSStore";
type SettingsTab = "profile" | "carrier" | "team" | "mobile" | "system";
interface SettingsAccountViewProps {
    token: string | null;
}
const labelClass = "text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide";
const inputClass = "w-full border border-zinc-200 dark:border-zinc-800 p-3.5 rounded-xl mt-1 focus:ring-2 focus:ring-zinc-600 outline-none font-medium bg-zinc-50 dark:bg-zinc-900 text-zinc-900 dark:text-white transition-colors";
const inputErrorClass = "w-full border border-red-400 dark:border-red-500/70 p-3.5 rounded-xl mt-1 focus:ring-2 focus:ring-red-500/40 outline-none font-medium bg-zinc-50 dark:bg-zinc-900 text-zinc-900 dark:text-white transition-colors";
function splitSessionName(fullName?: string | null) {
    if (!fullName?.trim())
        return { firstName: "", lastName: "" };
    const parts = fullName.trim().split(/\s+/);
    return {
        firstName: parts[0] ?? "",
        lastName: parts.slice(1).join(" "),
    };
}
const BASE_TABS: {
    id: SettingsTab;
    label: string;
    icon: React.ReactNode;
}[] = [
    { id: "profile", label: "User Profile", icon: <UserCircle size={18}/> },
    { id: "carrier", label: "Carrier Authority", icon: <Truck size={18}/> },
    { id: "system", label: "System Settings", icon: <Settings2 size={18}/> },
];
export default function SettingsAccountView({ token }: SettingsAccountViewProps) {
    const { data: session } = useSession();
    const userRoles = useTMSStore((state) => state.userRoles);
    const isAdmin = userRoles.includes("Admin");
    const tabs = useMemo(() => isAdmin
        ? [
            ...BASE_TABS.slice(0, 2),
            { id: "team" as const, label: "Team Management", icon: <Users size={18}/> },
            { id: "mobile" as const, label: "Mobile App", icon: <Smartphone size={18}/> },
            ...BASE_TABS.slice(2),
        ]
        : BASE_TABS, [isAdmin]);
    const bearerToken = normalizeBearerToken(token);
    const tmsApi = useMemo(() => createTmsApi(createApiClient(bearerToken || null)), [bearerToken]);
    const [activeTab, setActiveTab] = useState<SettingsTab>("profile");
    const [loading, setLoading] = useState(true);
    const [firstName, setFirstName] = useState("");
    const [lastName, setLastName] = useState("");
    const [email, setEmail] = useState("");
    const [profileErrors, setProfileErrors] = useState<Record<string, string>>({});
    const [savingProfile, setSavingProfile] = useState(false);
    const [companyName, setCompanyName] = useState("");
    const [companyPhone, setCompanyPhone] = useState("");
    const [mcNumber, setMcNumber] = useState("");
    const [dotNumber, setDotNumber] = useState("");
    const [carrierErrors, setCarrierErrors] = useState<Record<string, string>>({});
    const [savingCarrier, setSavingCarrier] = useState(false);
    const [notifyLoadUpdates, setNotifyLoadUpdates] = useState(true);
    const [notifyEtaAlerts, setNotifyEtaAlerts] = useState(true);
    const [autoAssignSuggestions, setAutoAssignSuggestions] = useState(false);
    const [dispatchersCanView, setDispatchersCanView] = useState(true);
    const [dispatchersCanEdit, setDispatchersCanEdit] = useState(false);
    const [includeInComplianceExports, setIncludeInComplianceExports] = useState(true);
    const [savingSystemSettings, setSavingSystemSettings] = useState(false);
    const loadSettings = useCallback(async () => {
        if (!hasValidTmsToken(bearerToken)) {
            setLoading(false);
            return;
        }
        setLoading(true);
        try {
            const sessionName = splitSessionName(session?.user?.name);
            const [userRes, companyRes, systemRes] = await Promise.all([
                tmsApi.users.me(),
                tmsApi.company.me(),
                tmsApi.system.settings(),
            ]);
            setEmail(userRes.email || session?.user?.email || "");
            setFirstName(userRes.first_name?.trim() || sessionName.firstName || "");
            setLastName(userRes.last_name?.trim() || sessionName.lastName || "");
            setCompanyName(companyRes.name || "");
            setCompanyPhone(companyRes.phone || "");
            setMcNumber(companyRes.mc_number || companyRes.dot_number || "");
            setDotNumber(companyRes.mc_number ? companyRes.dot_number || "" : "");
            if (systemRes) {
                setDispatchersCanView(systemRes.dispatchers_can_view);
                setDispatchersCanEdit(systemRes.dispatchers_can_edit);
                setIncludeInComplianceExports(systemRes.include_in_compliance_exports);
            }
        }
        catch (err: unknown) {
            const status = (err as {
                response?: {
                    status?: number;
                };
            })?.response?.status;
            if (status !== 401) {
                const sessionName = splitSessionName(session?.user?.name);
                setEmail(session?.user?.email || "");
                setFirstName(sessionName.firstName);
                setLastName(sessionName.lastName);
                toast.error("Could not load account settings.");
            }
        }
        finally {
            setLoading(false);
        }
    }, [bearerToken, session?.user?.email, session?.user?.name, tmsApi]);
    const persistSystemSettings = useCallback(async (patch: {
        dispatchers_can_view?: boolean;
        dispatchers_can_edit?: boolean;
        include_in_compliance_exports?: boolean;
    }) => {
        if (!isAdmin)
            return;
        setSavingSystemSettings(true);
        try {
            const updated = await tmsApi.system.updateSettings(patch);
            setDispatchersCanView(updated.dispatchers_can_view);
            setDispatchersCanEdit(updated.dispatchers_can_edit);
            setIncludeInComplianceExports(updated.include_in_compliance_exports);
        }
        catch (err: unknown) {
            const detail = (err as {
                response?: {
                    data?: {
                        detail?: string;
                    };
                };
            })?.response?.data?.detail ||
                "Failed to save system settings.";
            toast.error(typeof detail === "string" ? detail : "Failed to save system settings.");
        }
        finally {
            setSavingSystemSettings(false);
        }
    }, [isAdmin, tmsApi]);
    useEffect(() => {
        void loadSettings();
    }, [loadSettings]);
    useEffect(() => {
        const validTabIds = new Set(tabs.map((tab) => tab.id));
        if (!validTabIds.has(activeTab)) {
            setActiveTab("profile");
        }
    }, [tabs, activeTab]);
    const validateProfile = () => {
        const next: Record<string, string> = {};
        if (!firstName.trim())
            next.firstName = "First name is required.";
        if (!lastName.trim())
            next.lastName = "Last name is required.";
        setProfileErrors(next);
        return Object.keys(next).length === 0;
    };
    const validateCarrier = () => {
        const next: Record<string, string> = {};
        if (!companyName.trim())
            next.companyName = "Company name is required.";
        const phoneDigits = companyPhone.replace(/\D/g, "");
        if (companyPhone.trim() && phoneDigits.length < 10) {
            next.companyPhone = "Enter a valid 10-digit phone number.";
        }
        setCarrierErrors(next);
        return Object.keys(next).length === 0;
    };
    const handleSaveProfile = async () => {
        if (!validateProfile())
            return;
        setSavingProfile(true);
        try {
            await tmsApi.users.update({
                first_name: firstName.trim(),
                last_name: lastName.trim(),
            });
            toast.success("Profile updated.");
            setProfileErrors({});
        }
        catch (err: unknown) {
            const detail = (err as {
                response?: {
                    data?: {
                        detail?: string;
                    };
                };
            })?.response?.data?.detail ||
                "Failed to save profile.";
            toast.error(typeof detail === "string" ? detail : "Failed to save profile.");
        }
        finally {
            setSavingProfile(false);
        }
    };
    const handleSaveCarrier = async () => {
        if (!validateCarrier())
            return;
        setSavingCarrier(true);
        try {
            await tmsApi.company.update({
                name: companyName.trim(),
                phone: companyPhone.trim() || null,
                mc_number: mcNumber.trim() || null,
                dot_number: dotNumber.trim() || null,
            });
            toast.success("Carrier authority updated.");
            setCarrierErrors({});
        }
        catch (err: unknown) {
            const detail = (err as {
                response?: {
                    data?: {
                        detail?: string;
                    };
                };
            })?.response?.data?.detail ||
                "Failed to save carrier settings.";
            toast.error(typeof detail === "string" ? detail : "Failed to save carrier settings.");
        }
        finally {
            setSavingCarrier(false);
        }
    };
    if (!hasValidTmsToken(bearerToken)) {
        return (<div className="flex items-center justify-center h-full min-h-[420px] text-zinc-400">
        Sign in to manage account settings.
      </div>);
    }
    if (loading) {
        return (<div className="flex items-center justify-center h-full min-h-[420px] text-zinc-400">
        <Loader2 className="animate-spin mr-2" size={20}/>
        Loading account settings...
      </div>);
    }
    return (<div className="flex flex-col lg:flex-row gap-6 h-full min-h-0">
      <nav className="lg:w-64 shrink-0">
        <div className="bg-white dark:bg-[#161616] border border-zinc-200 dark:border-zinc-800 rounded-2xl p-3 space-y-1 shadow-sm">
          {tabs.map((tab) => (<button key={tab.id} type="button" onClick={() => setActiveTab(tab.id)} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all duration-200 ${activeTab === tab.id
                ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-sm"
                : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800/50"}`}>
              <span className={activeTab === tab.id
                ? "text-zinc-700 dark:text-white"
                : "text-zinc-400 dark:text-zinc-500"}>
                {tab.icon}
              </span>
              {tab.label}
            </button>))}
        </div>
      </nav>

      <div className="flex-1 min-w-0">
        <div key={activeTab} className="bg-white dark:bg-[#161616] border border-zinc-200 dark:border-zinc-800 rounded-2xl p-8 shadow-sm animate-in fade-in slide-in-from-right-2 duration-300">
          {activeTab === "profile" && (<div className="space-y-6">
              <div>
                <h2 className="text-xl font-black text-zinc-900 dark:text-white">User Profile</h2>
                <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
                  Manage your personal account details for this workspace.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className={labelClass}>First Name</label>
                  <input type="text" value={firstName} onChange={(e) => {
                setFirstName(e.target.value);
                if (profileErrors.firstName) {
                    setProfileErrors((prev) => ({ ...prev, firstName: "" }));
                }
            }} className={profileErrors.firstName ? inputErrorClass : inputClass}/>
                  {profileErrors.firstName && (<p className="text-xs text-red-500 dark:text-red-400 mt-1 font-semibold">
                      {profileErrors.firstName}
                    </p>)}
                </div>
                <div>
                  <label className={labelClass}>Last Name</label>
                  <input type="text" value={lastName} onChange={(e) => {
                setLastName(e.target.value);
                if (profileErrors.lastName) {
                    setProfileErrors((prev) => ({ ...prev, lastName: "" }));
                }
            }} className={profileErrors.lastName ? inputErrorClass : inputClass}/>
                  {profileErrors.lastName && (<p className="text-xs text-red-500 dark:text-red-400 mt-1 font-semibold">
                      {profileErrors.lastName}
                    </p>)}
                </div>
              </div>

              <div>
                <label className={labelClass}>Email</label>
                <input type="email" value={email} readOnly autoComplete="email" name="user-email" className={`${inputClass} opacity-80 cursor-not-allowed`}/>
                <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-2">
                  Email is managed by your sign-in provider and cannot be changed here.
                </p>
              </div>

              <button type="button" onClick={handleSaveProfile} disabled={savingProfile} className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-zinc-900 dark:bg-white text-white dark:text-black font-bold text-sm hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors disabled:opacity-60">
                {savingProfile ? <Loader2 size={16} className="animate-spin"/> : <Save size={16}/>}
                Save Profile
              </button>
            </div>)}

          {activeTab === "carrier" && (<div className="space-y-6">
              <div>
                <h2 className="text-xl font-black text-zinc-900 dark:text-white">Carrier Authority</h2>
                <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
                  View and update your carrier regulatory and contact information.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="md:col-span-2">
                  <label className={labelClass}>Company Name</label>
                  <input type="text" value={companyName} onChange={(e) => {
                setCompanyName(e.target.value);
                if (carrierErrors.companyName) {
                    setCarrierErrors((prev) => ({ ...prev, companyName: "" }));
                }
            }} className={carrierErrors.companyName ? inputErrorClass : inputClass}/>
                  {carrierErrors.companyName && (<p className="text-xs text-red-500 dark:text-red-400 mt-1 font-semibold">
                      {carrierErrors.companyName}
                    </p>)}
                </div>
                <div>
                  <label className={labelClass}>Contact Phone</label>
                  <input type="tel" value={companyPhone} onChange={(e) => {
                setCompanyPhone(e.target.value);
                if (carrierErrors.companyPhone) {
                    setCarrierErrors((prev) => ({ ...prev, companyPhone: "" }));
                }
            }} placeholder="(555) 123-4567" className={carrierErrors.companyPhone ? inputErrorClass : inputClass}/>
                  {carrierErrors.companyPhone && (<p className="text-xs text-red-500 dark:text-red-400 mt-1 font-semibold">
                      {carrierErrors.companyPhone}
                    </p>)}
                </div>
                <div>
                  <label className={labelClass}>MC Number</label>
                  <input type="text" value={mcNumber} onChange={(e) => setMcNumber(e.target.value)} placeholder="MC-123456" className={inputClass}/>
                </div>
                <div>
                  <label className={labelClass}>DOT Number</label>
                  <input type="text" value={dotNumber} onChange={(e) => setDotNumber(e.target.value)} placeholder="1234567" className={inputClass}/>
                </div>
              </div>

              <button type="button" onClick={handleSaveCarrier} disabled={savingCarrier} className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-zinc-900 dark:bg-white text-white dark:text-black font-bold text-sm hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors disabled:opacity-60">
                {savingCarrier ? <Loader2 size={16} className="animate-spin"/> : <Save size={16}/>}
                Save Changes
              </button>
            </div>)}

          {activeTab === "team" && isAdmin && <TeamManagement token={token}/>}

          {activeTab === "mobile" && isAdmin && <MobileAppManagement token={token}/>}

          {activeTab === "system" && (<div className="space-y-6">
              <div>
                <h2 className="text-xl font-black text-zinc-900 dark:text-white">System Settings</h2>
                <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
                  Configure notification rules and dispatcher access policies.
                </p>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-[#0B0B0B]">
                  <div className="flex items-start gap-3">
                    <Bell size={18} className="text-zinc-400 mt-0.5"/>
                    <div>
                      <p className="font-bold text-zinc-900 dark:text-white text-sm">Load status notifications</p>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                        Alert when loads move between pipeline stages.
                      </p>
                    </div>
                  </div>
                  <input type="checkbox" checked={notifyLoadUpdates} onChange={(e) => setNotifyLoadUpdates(e.target.checked)} className="h-4 w-4 rounded border-zinc-600 text-zinc-900 focus:ring-zinc-600"/>
                </div>

                <div className="flex items-center justify-between p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-[#0B0B0B]">
                  <div className="flex items-start gap-3">
                    <MapPinned size={18} className="text-zinc-400 mt-0.5"/>
                    <div>
                      <p className="font-bold text-zinc-900 dark:text-white text-sm">ETA risk alerts</p>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                        Highlight trucks at risk of missing delivery windows.
                      </p>
                    </div>
                  </div>
                  <input type="checkbox" checked={notifyEtaAlerts} onChange={(e) => setNotifyEtaAlerts(e.target.checked)} className="h-4 w-4 rounded border-zinc-600 text-zinc-900 focus:ring-zinc-600"/>
                </div>

                <div className="flex items-center justify-between p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-[#0B0B0B]">
                  <div className="flex items-start gap-3">
                    <Settings2 size={18} className="text-zinc-400 mt-0.5"/>
                    <div>
                      <p className="font-bold text-zinc-900 dark:text-white text-sm">Auto-assign suggestions</p>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                        Surface recommended driver-unit pairings on new loads.
                      </p>
                    </div>
                  </div>
                  <input type="checkbox" checked={autoAssignSuggestions} onChange={(e) => setAutoAssignSuggestions(e.target.checked)} className="h-4 w-4 rounded border-zinc-600 text-zinc-900 focus:ring-zinc-600"/>
                </div>

                <div className="flex items-center justify-between p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-[#0B0B0B]">
                  <div className="flex items-start gap-3">
                    <Shield size={18} className="text-zinc-400 mt-0.5"/>
                    <div>
                      <p className="font-bold text-zinc-900 dark:text-white text-sm">Dispatchers can view</p>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                        Allow dispatch team members to open truck and equipment records globally.
                      </p>
                    </div>
                  </div>
                  <input type="checkbox" checked={dispatchersCanView} disabled={!isAdmin || savingSystemSettings} onChange={(e) => {
                const next = e.target.checked;
                setDispatchersCanView(next);
                void persistSystemSettings({ dispatchers_can_view: next });
            }} className="h-4 w-4 rounded border-zinc-600 text-zinc-900 focus:ring-zinc-600 disabled:opacity-50"/>
                </div>

                <div className="flex items-center justify-between p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-[#0B0B0B]">
                  <div className="flex items-start gap-3">
                    <Shield size={18} className="text-zinc-400 mt-0.5"/>
                    <div>
                      <p className="font-bold text-zinc-900 dark:text-white text-sm">Dispatchers can edit</p>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                        Allow dispatch team members to update truck fields, status changes, and terminal assignments.
                      </p>
                    </div>
                  </div>
                  <input type="checkbox" checked={dispatchersCanEdit} disabled={!isAdmin || savingSystemSettings} onChange={(e) => {
                const next = e.target.checked;
                setDispatchersCanEdit(next);
                void persistSystemSettings({ dispatchers_can_edit: next });
            }} className="h-4 w-4 rounded border-zinc-600 text-zinc-900 focus:ring-zinc-600 disabled:opacity-50"/>
                </div>

                <div className="flex items-center justify-between p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-[#0B0B0B]">
                  <div className="flex items-start gap-3">
                    <Shield size={18} className="text-zinc-400 mt-0.5"/>
                    <div>
                      <p className="font-bold text-zinc-900 dark:text-white text-sm">Include in compliance exports</p>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                        Surface equipment history records in regulatory, IFTA, and audit report bundles.
                      </p>
                    </div>
                  </div>
                  <input type="checkbox" checked={includeInComplianceExports} disabled={!isAdmin || savingSystemSettings} onChange={(e) => {
                const next = e.target.checked;
                setIncludeInComplianceExports(next);
                void persistSystemSettings({ include_in_compliance_exports: next });
            }} className="h-4 w-4 rounded border-zinc-600 text-zinc-900 focus:ring-zinc-600 disabled:opacity-50"/>
                </div>
              </div>
            </div>)}
        </div>
      </div>
    </div>);
}
