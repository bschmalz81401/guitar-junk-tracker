import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { pendingPhotoCleanupCount } from "@/lib/photoCleanupDb";
import { getSettings, isSmtpConfigured } from "@/lib/settings";
import AdminPanel from "@/components/AdminPanel";

export default async function AdminPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login?from=/admin");
  if (user.role !== "admin") redirect("/");

  const [users, settings, pendingCleanup] = await Promise.all([
    prisma.user.findMany({
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        email: true,
        username: true,
        name: true,
        role: true,
        catalogPublic: true,
        createdAt: true,
        _count: { select: { items: true } },
      },
    }),
    getSettings(),
    pendingPhotoCleanupCount(),
  ]);

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-2">Admin</h1>
      <p className="text-sm text-[var(--muted)] mb-6">
        Manage users, SMTP mail, and public sign-up.
      </p>
      <AdminPanel
        currentUserId={user.id}
        initialUsers={users.map((u) => ({
          id: u.id,
          email: u.email,
          username: u.username,
          name: u.name,
          role: u.role,
          catalogPublic: u.catalogPublic,
          createdAt: u.createdAt.toISOString(),
          itemCount: u._count.items,
        }))}
        initialPendingCleanup={pendingCleanup}
        initialSettings={{
          allowSignup: settings.allowSignup,
          showcaseEmail: settings.showcaseEmail ?? "",
          smtpHost: settings.smtpHost ?? "",
          smtpPort: settings.smtpPort ?? 587,
          smtpSecure: settings.smtpSecure,
          smtpUser: settings.smtpUser ?? "",
          smtpPasswordSet: Boolean(settings.smtpPassword),
          smtpFrom: settings.smtpFrom ?? "",
          smtpConfigured: isSmtpConfigured(settings),
        }}
      />
    </div>
  );
}
