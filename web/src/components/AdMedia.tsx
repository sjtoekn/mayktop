// The picture or video of an ad (ADS_PLAN Session 3b). Used by the real ad box, the form preview and the admin review,
// so a reviewer sees exactly what visitors will see. No hooks: it works in server and client components.
//  - IMAGE: one picture.
//  - VIDEO: no poster. It starts by itself, silent, for at most 10 seconds, with no controls (AdVideo.tsx; changed 2026-11-08,
//    ADS_PLAN decision 10b). Inside AdBox the whole ad is a link, so a click on the video opens the advertiser's page.
// `imageUrl` / `videoUrl` are always OUR OWN addresses (/api/ad/media/...), checked when the ad is saved and by the media route.
import AdVideo from "@/components/AdVideo";
import { adsConfig } from "@/config/site";
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
        <AdVideo src={videoUrl} title={title} seconds={adsConfig.media.videoSeconds} />
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
