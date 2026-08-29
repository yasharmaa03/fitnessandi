import type { Metadata, Viewport } from "next";
import "./globals.css";
import DarkModeSync from "@/components/DarkModeSync";
import AuthProvider from "@/components/providers/AuthProvider";

export const metadata: Metadata = {
  title: "FitnessAndi",
  description: "Your AI-powered fitness operating system",
  manifest: "/manifest.json",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "FitnessAndi" },
};

export const viewport: Viewport = {
  themeColor: "#2563EB",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <body className="h-full font-body">
        <DarkModeSync />
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
