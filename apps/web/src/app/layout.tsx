import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AppShell } from "@/components/app-shell";

export const metadata: Metadata = {
  title: "calorieX — AI calorie tracker",
  description: "Track calories effortlessly with AI.",
};

export const viewport: Viewport = {
  themeColor: "#07080c",
  colorScheme: "dark",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen font-sans text-zinc-50 antialiased">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
