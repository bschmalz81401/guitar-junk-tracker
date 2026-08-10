"use client";

import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";

export default function LogoutButton() {
  const router = useRouter();

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <Button variant="ghost" size="sm" onClick={handleLogout} className="min-h-11">
      Log out
    </Button>
  );
}
