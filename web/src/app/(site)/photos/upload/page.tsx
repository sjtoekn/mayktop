import type { Metadata } from "next";
import PhotoUploadForm from "@/components/photos/PhotoUploadForm";
import { photoCategories, photoMedia, photoText, type PhotoCategory } from "@/config/site";
import { t } from "@/i18n";

export const metadata: Metadata = {
  title: t("photo.upload.title"),
};

// /photos/upload (PHOTO_TODO 4). Anybody may open the page; a login is needed to send (the form says so, the server checks).
export default function PhotoUploadPage() {
  const mb = Math.floor(photoMedia.imageMaxBytes / (1024 * 1024));
  const categoryNames: Record<PhotoCategory, string> = {
    nature: t("photo.category.nature"),
    people: t("photo.category.people"),
    animals: t("photo.category.animals"),
    food: t("photo.category.food"),
    travel: t("photo.category.travel"),
    buildings: t("photo.category.buildings"),
    vehicles: t("photo.category.vehicles"),
    art: t("photo.category.art"),
    sports: t("photo.category.sports"),
    other: t("photo.category.other"),
  };
  return (
    <PhotoUploadForm
      imageMaxBytes={photoMedia.imageMaxBytes}
      imageTypes={["image/jpeg", "image/png", "image/webp"]}
      titleMax={photoText.titleMax}
      captionMax={photoText.captionMax}
      batchMax={photoMedia.batchMax}
      categories={photoCategories.map((key) => ({ value: key, label: categoryNames[key] }))}
      text={{
        title: t("photo.upload.title"),
        choose: t("photo.upload.choose"),
        change: t("photo.upload.change"),
        help: t("photo.upload.help", { mb }),
        typeError: t("photo.upload.type"),
        sizeError: t("photo.upload.size", { mb }),
        pixelsError: t("photo.upload.pixels"),
        noImage: t("photo.upload.noImage"),
        preview: t("photo.upload.preview"),
        titleLabel: t("photo.upload.titleLabel"),
        titleHelp: t("photo.upload.titleHelp", { max: photoText.titleMax }),
        captionLabel: t("photo.upload.captionLabel"),
        captionPlaceholder: t("photo.upload.captionPlaceholder"),
        categoryLabel: t("photo.upload.categoryLabel"),
        categoryPlaceholder: t("photo.upload.categoryPlaceholder"),
        categoryRequired: t("photo.upload.categoryRequired"),
        tagsLabel: t("photo.upload.tagsLabel"),
        tagsHelp: t("photo.upload.tagsHelp", { max: photoText.maxTags }),
        rules: t("photo.upload.rules"),
        submit: t("photo.upload.submit"),
        saving: t("photo.upload.saving"),
        cancel: t("photo.upload.cancel"),
        error: t("photo.upload.error"),
        titleRequired: t("photo.upload.titleRequired"),
        invalid: t("photo.upload.invalid"),
        tagsInvalid: t("photo.upload.tagsInvalid", { tagMax: 50, max: photoText.maxTags }),
        tooMany: t("photo.upload.tooMany"),
        done: t("photo.upload.done"),
        another: t("photo.upload.another"),
        login: t("auth.required"),
        loginLink: t("topbar.login"),
        // Multiple upload (stage 1). TEMPORARY English: move these 11 texts into the 6 language files (src/i18n/messages/).
        chooseMore: "Add more photos",
        count: "{count} of {max} photos",
        remove: "Remove this photo",
        sameInfo: "The title, caption, category and tags below are used for all of these photos. A photo with its own title keeps that title.",
        overLimit: "Only {max} photos can be uploaded at once. The extra photos were not added.",
        duplicateSkipped: "{count} photo(s) were already in the list and were skipped.",
        progress: "Uploading… {done} of {total} done",
        itemDone: "Uploaded",
        itemFailed: "Not uploaded",
        retry: "Try again (failed photos only)",
        partlyDone: "{ok} uploaded, {failed} failed. Press \"Try again\" to send only the failed ones.",
        doneMany: "{count} photos uploaded.",
        // Stage 2 (also TEMPORARY English): 1 more text for the language files.
        ownTitle: "Own title (optional)",
      }}
    />
  );
}
