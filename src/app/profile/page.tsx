import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import ProfileForm from "@/components/ProfileForm";

export default async function ProfilePage() {
  const session = await getSessionUser();
  if (!session) redirect("/login?from=/profile");

  const user = await prisma.user.findUnique({
    where: { id: session.id },
    select: {
      email: true,
      username: true,
      name: true,
      bio: true,
      location: true,
      catalogPublic: true,
      createdAt: true,
      _count: { select: { items: true } },
    },
  });
  if (!user) redirect("/login");

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-2">Your profile</h1>
      <p className="text-sm text-[var(--muted)] mb-6">
        Update your public page, visibility, and password.
      </p>
      <ProfileForm
        profile={{
          email: user.email,
          username: user.username,
          name: user.name,
          bio: user.bio,
          location: user.location,
          catalogPublic: user.catalogPublic,
          itemCount: user._count.items,
          createdAt: user.createdAt.toISOString(),
        }}
      />
    </div>
  );
}
