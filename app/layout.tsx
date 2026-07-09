import type { Metadata } from "next";
import "./globals.css";
import AuthSessionProvider from "@/components/providers/AuthSessionProvider";
import GlobalAssistantWrapper from "@/components/ai/GlobalAssistantWrapper";
export const metadata: Metadata = {
    title: "Fleety | TMS",
    description: "Fleety Transportation Management System",
    openGraph: {
        title: "Fleety | TMS",
        description: "Fleety Transportation Management System",
    },
};
export default function RootLayout({ children }: {
    children: React.ReactNode;
}) {
    return (<html lang="en" suppressHydrationWarning>
      <body className="h-screen overflow-hidden bg-shell-bg text-shell-text" suppressHydrationWarning>
        <AuthSessionProvider>
          {children}
          <GlobalAssistantWrapper />
        </AuthSessionProvider>
      </body>
    </html>);
}
