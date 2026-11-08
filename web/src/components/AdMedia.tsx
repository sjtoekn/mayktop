// The picture or video of an ad (ADS_PLAN Session 3b). Used by the real ad box, the form preview and the admin review,
// so a reviewer sees exactly what visitors will see. No hooks: it works in server and client components.
//  - IMAGE: one picture.
//  - VIDEO: a poster picture with the browser's own play controls. NEVER autoplay (PROJECT.md section 5):
//    `preload="none"` means nothing is even downloaded until the visitor presses play.
// `imageUrl` / `videoUrl` are always OUR OWN addresses (/api/ad/media/...), checked when the ad is saved and by the media route.
import "./ad-media.css";

export type AdMediaProps = {
  format: "TEXT" | "IMAGE" | "VIDEO";
  imageUrl: string | null;
  videoUrl: string | null;
  title: string; // names the video for screen readers (the picture is decorative: the title text sits right next to it)
  empty?: string; // shown instead of a file in a preview before a file is chosen
};

export default function AdMedia({ format, imageUrl, videoUrl, title, empty }: AdMediaProps) {
  if (format === "TEXT") return null;
  if (format === "VIDEO" && videoUrl) {
    return (
      <div className="ad-media">
        <video controls preload="none" playsInline poster={imageUrl ?? undefined} src={videoUrl} aria-label={title} />
      </div>
    );
  }
  if (imageUrl) {
    return (
      <div className="ad-media">
        {/* eslint-disable-next-line @next/next/no-img-element -- our own protected file; a plain <img> keeps the no-tracking route simple */}
        <img src={imageUrl} alt="" loading="lazy" decoding="async" />
      </div>
    );
  }
  return <div className="ad-media ad-media-empty">{empty ?? ""}</div>;
}
