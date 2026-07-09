"use client";
import Image from "next/image";
import { BarChart3, ShieldCheck, Truck } from "lucide-react";
import FleetyIcon from "@/components/icons/FleetyIcon";
import { authMarketingEyebrowClass, authMarketingFeatureDescClass, authMarketingFeatureIconClass, authMarketingFeatureTitleClass, authMarketingHeroAccentClass, authMarketingHeroTitleClass, authMarketingSubtitleClass, authPanelBaseClass, } from "@/components/auth/authFormStyles";
const FEATURES = [
    {
        icon: BarChart3,
        title: "Real-time visibility",
        description: "Track shipments and vehicles in real time.",
    },
    {
        icon: Truck,
        title: "Optimize operations",
        description: "Reduce costs and improve efficiency.",
    },
    {
        icon: ShieldCheck,
        title: "Secure & reliable",
        description: "Your data is safe with enterprise-grade security.",
    },
] as const;
const ALPINE_SLATE = "#07111C";
export default function AuthMarketingPanel() {
    return (<aside className={`hidden lg:flex relative min-h-screen h-full w-full flex-col overflow-hidden bg-[#07111C] text-white ${authPanelBaseClass}`}>
      <div className="pointer-events-none absolute inset-0 z-0">
        <div className="relative w-full h-full overflow-hidden bg-[#07111C]">
          <Image src="/auth/alpine-truck-hero.webp" alt="Alpine logistics transport" fill priority unoptimized sizes="(max-width: 1024px) 100vw, 50vw" className="object-cover object-bottom antialiased select-none transform-gpu" style={{
            imageRendering: "-webkit-optimize-contrast",
            backfaceVisibility: "hidden",
        }}/>

          <div className="absolute inset-0 z-10" style={{
            background: `linear-gradient(to bottom, ${ALPINE_SLATE} 0%, rgba(7,17,28,0.80) 40%, rgba(7,17,28,0.20) 72%, transparent 100%)`,
        }}/>

          <div className="absolute inset-0 z-[11]" style={{
            background: "radial-gradient(ellipse 120% 90% at 48% 82%, transparent 0%, rgba(7,17,28,0.14) 50%, rgba(7,17,28,0.50) 100%)",
        }}/>

          <div className="absolute inset-0 z-[12] bg-gradient-to-r from-[#07111C]/92 via-[#07111C]/48 to-transparent"/>
        </div>
      </div>

      <div className="relative z-20 flex flex-1 flex-col p-10 xl:p-14 pb-12">
        <div className="flex items-center gap-2 select-none antialiased">
          <div className="drop-shadow-[0_0_12px_rgba(30,111,255,0.35)] shrink-0">
            <FleetyIcon className="h-14 w-14 -ml-2 -mr-1 shrink-0" aria-hidden/>
          </div>
          <span className="text-white font-sans lowercase italic font-bold text-3xl tracking-[-0.04em]">
            fleety
          </span>
        </div>

        <p className={authMarketingEyebrowClass}>Transport Management System</p>

        <h1 className={authMarketingHeroTitleClass}>
          Move more. Manage{" "}
          <span className={authMarketingHeroAccentClass}>smarter.</span>
        </h1>

        <p className={authMarketingSubtitleClass}>
          Join Fleety and simplify the way you manage your transportation operations.
        </p>

        <ul className="mt-10 space-y-5 max-w-md">
          {FEATURES.map(({ icon: Icon, title, description }) => (<li key={title} className="flex items-start gap-4">
              <div className={authMarketingFeatureIconClass}>
                <Icon size={18} strokeWidth={2}/>
              </div>
              <div>
                <p className={authMarketingFeatureTitleClass}>{title}</p>
                <p className={authMarketingFeatureDescClass}>{description}</p>
              </div>
            </li>))}
        </ul>
      </div>
    </aside>);
}
