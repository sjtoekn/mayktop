// The words used by the login / sign-up form, translated on the server (t()).
import { t } from "@/i18n";
import type { AuthText } from "@/components/AuthForm";
import type { ResetText } from "@/components/PasswordResetForm";

export function authText(): AuthText {
  return {
    loginTitle: t("auth.login.title"),
    signupTitle: t("auth.signup.title"),
    email: t("auth.field.email"),
    password: t("auth.field.password"),
    username: t("auth.field.username"),
    usernameHint: t("auth.field.username.hint"),
    name: t("auth.field.name"),
    loginSubmit: t("auth.login.submit"),
    signupSubmit: t("auth.signup.submit"),
    working: t("auth.working"),
    loginNew: t("auth.login.new"),
    forgot: t("auth.login.forgot"),
    signupHave: t("auth.signup.have"),
    signupLink: t("topbar.signup"),
    loginLink: t("topbar.login"),
    errors: {
      credentials: t("auth.error.credentials"),
      emailTaken: t("auth.error.email.taken"),
      usernameTaken: t("auth.error.username.taken"),
      usernameInvalid: t("auth.error.username.invalid"),
      passwordShort: t("auth.error.password.short"),
      emailNotVerified: t("auth.error.email.unverified"),
      generic: t("auth.error.generic"),
    },
  };
}

/** The words used by the "forgot password" and "choose a new password" pages. */
export function resetText(): ResetText {
  return {
    forgotTitle: t("auth.forgot.title"),
    forgotBody: t("auth.forgot.body"),
    forgotSubmit: t("auth.forgot.submit"),
    sentTitle: t("auth.forgot.sent.title"),
    sentBody: t("auth.forgot.sent.body"),
    resetTitle: t("auth.reset.title"),
    resetSubmit: t("auth.reset.submit"),
    doneTitle: t("auth.reset.done.title"),
    doneBody: t("auth.reset.done.body"),
    email: t("auth.field.email"),
    newPassword: t("auth.field.password.new"),
    working: t("auth.working"),
    backToLogin: t("auth.reset.back"),
    errors: {
      generic: t("auth.error.generic"),
      passwordShort: t("auth.error.password.short"),
      invalidToken: t("auth.reset.error"),
    },
  };
}
