import type { Metadata } from "next";
import PlaceForm from "@/components/places/PlaceForm";
import { placeTexts } from "@/lib/place-text";
import "../../photos/photos.css";
import "../places.css";

export const metadata: Metadata = {
  title: placeTexts.newTitle,
};

// /places/new (Photos plan, stage 3). Anybody may open the page; a login is needed to send (the form says so, the server checks).
export default function NewPlacePage() {
  return <PlaceForm />;
}
