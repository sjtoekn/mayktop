// The texts of <SocialBlockButtons>, built on the server (the texts are translated here). One place, used by the Social
// profile page (for the normal profile and for the "you blocked this person" page).
import { t } from "@/i18n";
import type { SocialBlockText } from "@/components/social/SocialBlockButtons";

export function socialBlockText(username: string): SocialBlockText {
  return {
    mute: t("social.mute"),
    unmute: t("social.unmute"),
    muteLabel: t("social.mute.label", { username }),
    unmuteLabel: t("social.unmute.label", { username }),
    block: t("social.block"),
    unblock: t("social.unblock"),
    blockLabel: t("social.block.label", { username }),
    unblockLabel: t("social.unblock.label", { username }),
    confirm: t("social.block.confirm", { username }),
    confirmYes: t("social.block.confirm.yes"),
    confirmNo: t("social.block.confirm.no"),
    login: t("social.block.login"),
    tooMany: t("social.block.toomany"),
    error: t("social.block.error"),
  };
}
