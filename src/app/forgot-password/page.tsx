import { getSettings, isSmtpConfigured } from "@/lib/settings";
import ForgotPasswordForm from "@/components/ForgotPasswordForm";

export default async function ForgotPasswordPage() {
  const settings = await getSettings();
  return <ForgotPasswordForm smtpReady={isSmtpConfigured(settings)} />;
}
