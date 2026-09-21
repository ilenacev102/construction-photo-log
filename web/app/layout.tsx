import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import { HtmlLangSync } from "@/components/HtmlLangSync";
import { ServiceWorkerRegistration } from "@/components/ServiceWorkerRegistration";
import { SpeedInsights } from "@vercel/speed-insights/next";

const geist = Geist({
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Construction Photo Log",
  description: "Photo documentation and field operations platform",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="mk"
      dir="ltr"
      className={`${geist.className} h-full`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col antialiased">
        <HtmlLangSync />
        <ServiceWorkerRegistration />
        {children}
        <SpeedInsights />
      </body>
    </html>
  );
}
