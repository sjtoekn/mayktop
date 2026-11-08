// The words used by the Edit / Delete buttons, translated on the server (t()).
import { t } from "@/i18n";
import type { OwnerText } from "@/components/OwnerActions";

export function ownerText(): OwnerText {
  return {
    edit: t("manage.edit"),
    delete: t("manage.delete"),
    save: t("manage.save"),
    cancel: t("submit.cancel"),
    saving: t("submit.saving"),
    confirm: t("manage.confirm"),
    confirmYes: t("manage.confirm.yes"),
    confirmNo: t("manage.confirm.no"),
    error: t("manage.error"),
    fieldTitle: t("manage.field.title"),
    fieldBody: t("manage.field.body"),
  };
}
