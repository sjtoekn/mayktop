import type { Metadata } from "next";
import ShortUploadForm from "@/components/shorts/ShortUploadForm";
import {
  SHORT_DESCRIPTION_MAX,
  SHORT_MAX_BYTES,
  SHORT_MAX_SECONDS,
  SHORT_MIN_SECONDS,
  SHORT_TITLE_MAX,
} from "@/config/short-config";
import { shortText } from "@/config/short-text";
import { reputationConfig } from "@/config/site";
import { t } from "@/i18n";

export const metadata: Metadata = {
  title: shortText.uploadTitle,
};

function fill(text: string, values: Record<string, string | number>): string {
  return text.replace(/\{(\w+)\}/g, (whole, key: string) => (key in values ? String(values[key]) : whole));
}

// /shorts/upload (SHORTS_TODO 17). Anybody may open the page; a login is needed to send (the form says so, the server checks).
export default function ShortUploadPage() {
  const mb = Math.floor(SHORT_MAX_BYTES / (1024 * 1024));
  const limits = { min: SHORT_MIN_SECONDS, max: SHORT_MAX_SECONDS, mb };
  return (
    <ShortUploadForm
      maxBytes={SHORT_MAX_BYTES}
      minSeconds={SHORT_MIN_SECONDS}
      maxSeconds={SHORT_MAX_SECONDS}
      videoTypes={["video/mp4", "video/webm", "video/quicktime"]}
      titleMax={SHORT_TITLE_MAX}
      descriptionMax={SHORT_DESCRIPTION_MAX}
      text={{
        ...shortText,
        help: fill(shortText.help, limits),
        sizeError: fill(shortText.sizeError, limits),
        tooShortError: fill(shortText.tooShortError, limits),
        tooLongError: fill(shortText.tooLongError, limits),
        titleHelp: fill(shortText.titleHelp, { max: SHORT_TITLE_MAX }),
        linkError: fill(shortText.linkError, { need: reputationConfig.privileges.link }),
        login: t("auth.required"),
        loginLink: t("topbar.login"),
      }}
    />
  );
}
