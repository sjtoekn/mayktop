import type { Metadata } from "next";
import AuthForm from "@/components/AuthForm";
import { authText } from "@/lib/auth-text";
import { t } from "@/i18n";

export const metadata: Metadata = { title: t("auth.signup.title") };

export default function SignupPage() {
  return <AuthForm mode="signup" text={authText()} />;
}
