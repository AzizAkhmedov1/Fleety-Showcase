"use client";
import type { ReactNode } from "react";
import AuthMarketingPanel from "./AuthMarketingPanel";
import { authFormColumnClass, authPanelBaseClass } from "./authFormStyles";
interface AuthSplitLayoutProps {
    children: ReactNode;
    topRight?: ReactNode;
}
export default function AuthSplitLayout({ children, topRight }: AuthSplitLayoutProps) {
    return (<div className={`grid grid-cols-1 lg:grid-cols-2 min-h-screen w-full bg-[#F8F9FA] dark:bg-[#0A0A0A] transition-colors duration-300 ${authPanelBaseClass}`}>
      <AuthMarketingPanel />
      <div className={`relative flex min-h-screen w-full flex-col justify-center items-center px-6 py-12 sm:px-10 lg:px-12 xl:px-16 ${authFormColumnClass} ${authPanelBaseClass}`}>
        {topRight ? (<div className="absolute top-6 right-6 z-10 sm:top-8 sm:right-8">{topRight}</div>) : null}
        <div className="w-full flex justify-center">{children}</div>
      </div>
    </div>);
}
