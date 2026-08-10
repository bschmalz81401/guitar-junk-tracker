import ResetPasswordForm from "@/components/ResetPasswordForm";

interface PageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function ResetPasswordPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const token = typeof params.token === "string" ? params.token : "";
  return <ResetPasswordForm token={token} />;
}
