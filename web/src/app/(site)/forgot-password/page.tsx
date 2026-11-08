import type { Metadata } from "next";
import PasswordResetForm from "@/components/PasswordResetForm";
import { resetText } from "@/lib/auth-text";
import { t } from "@/i18n";

export const metadata: Metadata = { title: t("auth.forgot.title") };

export default function ForgotPasswordPage() {
  return <PasswordResetForm mode="request" text={resetText()} />;
}
