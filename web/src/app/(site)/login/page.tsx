import type { Metadata } from "next";
import AuthForm from "@/components/AuthForm";
import { authText } from "@/lib/auth-text";
import { t } from "@/i18n";

export const metadata: Metadata = { title: t("auth.login.title") };

export default function LoginPage() {
  return <AuthForm mode="login" text={authText()} />;
}
