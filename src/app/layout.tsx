import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { isSetupComplete } from "@/lib/setup";
import SiteHeader from "@/components/SiteHeader";
import FluidBackground from "@/components/FluidBackground";
import { CATEGORY_LIST } from "@/types/categories";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Guitar Junk Tracker",
  description: "A self-hosted guitar gear collection tracker.",
};

export const dynamic = "force-dynamic";

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // First-run gate: until an admin exists, every page is the setup wizard.
  const setupComplete = await isSetupComplete();
  const pathname = (await headers()).get("x-pathname") ?? "";

  if (!setupComplete && !pathname.startsWith("/setup")) {
    redirect("/setup");
  }

  const htmlClass = `${geistSans.variable} ${geistMono.variable} h-full antialiased`;

  if (!setupComplete) {
    // Bare, header-less shell for the setup wizard.
    return (
      <html lang="en" className={htmlClass}>
        <body className="min-h-full flex flex-col">
          <main className="flex-1">
            <div className="mx-auto max-w-6xl px-4 py-8">{children}</div>
          </main>
        </body>
      </html>
    );
  }

  const user = await getSessionUser();
  const settings = await getSettings().catch(() => null);
  const allowSignup = Boolean(settings?.allowSignup);

  return (
    <html lang="en" className={htmlClass}>
      <body className="min-h-full flex flex-col">
        <FluidBackground />
        <SiteHeader
          user={
            user
              ? { email: user.email, name: user.name, role: user.role }
              : null
          }
          allowSignup={allowSignup}
          categories={CATEGORY_LIST.map((c) => ({
            key: c.key,
            slug: c.slug,
            plural: c.plural,
          }))}
        />
        <main className="flex-1">
          <div className="mx-auto max-w-6xl px-4 py-8">{children}</div>
        </main>
      </body>
    </html>
  );
}
