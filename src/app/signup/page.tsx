import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import SignupForm from "@/components/SignupForm";

export default async function SignupPage() {
  if (await getSessionUser()) redirect("/");

  const settings = await getSettings();
  if (!settings.allowSignup) {
    redirect("/login");
  }

  return <SignupForm />;
}
