import type { Metadata } from "next";
import SocialPostForm from "@/components/social/SocialPostForm";
import { socialMedia } from "@/config/site";
import { t } from "@/i18n";

export const metadata: Metadata = {
  title: t("social.form.title"),
};

export default async function SocialSubmitPage({ searchParams }: { searchParams: Promise<{ body?: string }> }) {
  const { body } = await searchParams;
  const initialBody = typeof body === "string" ? body.slice(0, 5000) : "";
  const mb = Math.floor(socialMedia.imageMaxBytes / (1024 * 1024));
  return (
    <SocialPostForm
      initialBody={initialBody}
      imageMaxBytes={socialMedia.imageMaxBytes}
      imageTypes={[...socialMedia.imageTypes]}
      text={{
        title: t("social.form.title"),
        bodyLabel: t("social.form.body"),
        bodyPlaceholder: t("social.form.placeholder"),
        submit: t("social.form.submit"),
        cancel: t("social.form.cancel"),
        saving: t("social.form.saving"),
        error: t("social.form.error"),
        invalid: t("social.form.invalid"),
        tooMany: t("social.form.toomany"),
        duplicate: t("social.form.duplicate"),
        login: t("auth.required"),
        loginLink: t("topbar.login"),
        imageAdd: t("social.form.image.add"),
        imageRemove: t("social.form.image.remove"),
        imageHelp: t("social.form.image.help", { mb }),
        imageType: t("social.form.image.type"),
        imageSize: t("social.form.image.size", { mb }),
        imagePixels: t("social.form.image.pixels"),
        imagePreview: t("social.form.image.preview"),
        linkAdd: t("social.form.link.add"),
        linkField: t("social.form.link.field"),
        linkPlaceholder: t("social.form.link.placeholder"),
        linkInsert: t("social.form.link.insert"),
        linkCancel: t("social.form.link.cancel"),
        linkInvalid: t("social.form.link.invalid"),
        linkHelp: t("social.form.link.help"),
        linkPreview: t("social.form.link.preview"),
        videoPlay: t("social.video.play"),
        videoTitle: t("social.video.title"),
        videoOpen: t("social.video.open"),
        linkOpen: t("social.link.open", { host: "{host}" }),
        replyLabel: t("social.replyControl.label"),
        replyHelp: t("social.replyControl.help"),
        replyEveryone: t("social.replyControl.everyone"),
        replyFollowing: t("social.replyControl.following"),
        replyMentioned: t("social.replyControl.mentioned"),
      }}
    />
  );
}
