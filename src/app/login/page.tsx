import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import LoginForm from "@/components/LoginForm";

interface PageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function LoginPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const rawFrom = typeof params.from === "string" ? params.from : "/";
  const from = rawFrom.startsWith("/") && !rawFrom.startsWith("//") ? rawFrom : "/";

  if (await getSessionUser()) redirect(from);

  const settings = await getSettings();

  return <LoginForm from={from} allowSignup={settings.allowSignup} />;
}
