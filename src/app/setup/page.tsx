import { redirect } from "next/navigation";
import { isSetupComplete } from "@/lib/setup";
import SetupForm from "@/components/SetupForm";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Set up Guitar Junk Tracker",
};

export default async function SetupPage() {
  // Once an admin exists, the wizard is done — send people to the app.
  if (await isSetupComplete()) redirect("/");
  return <SetupForm />;
}
