"use client";

// The form of /places/new (Photos plan, stage 3). Quick checks here only save a wasted round trip; the server action
// (createPlace) checks everything again. After a successful save the person goes to the new place's page.
import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import LoginNotice from "@/components/LoginNotice";
import { placeFields, reputationConfig } from "@/config/site";
import { useLoggedOut } from "@/lib/use-logged-out";
import { createPlace, type CreatePlaceResult } from "@/app/(site)/places/actions";
import { placeTexts, placeTypeNames } from "@/lib/place-text";
import { placeTypes } from "@/config/site";

type Failure = false | Exclude<CreatePlaceResult, { ok: true }>["reason"];

export default function PlaceForm() {
  const router = useRouter();
  const loggedOut = useLoggedOut();
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [type, setType] = useState("");
  const [city, setCity] = useState("");
  const [region, setRegion] = useState("");
  const [country, setCountry] = useState("");
  const [description, setDescription] = useState("");
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [website, setWebsite] = useState("");
  const [failed, setFailed] = useState<Failure>(false);
  const [waitMinutes, setWaitMinutes] = useState(1);
  const [existingId, setExistingId] = useState<number | null>(null);

  const canSend = !pending && !loggedOut && name.trim() !== "" && type !== "" && country.trim() !== "";

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSend) return;
    setFailed(false);
    setExistingId(null);
    startTransition(async () => {
      const form = new FormData();
      form.set("name", name);
      form.set("type", type);
      form.set("city", city);
      form.set("region", region);
      form.set("country", country);
      form.set("description", description);
      form.set("latitude", latitude);
      form.set("longitude", longitude);
      form.set("website", website);
      let result: CreatePlaceResult;
      try {
        result = await createPlace(form);
      } catch {
        result = { ok: false, reason: "error" };
      }
      if (result.ok) {
        router.push(`/places/${result.id}`);
        return;
      }
      if (result.reason === "tooMany") setWaitMinutes(result.waitMinutes ?? 1);
      if (result.reason === "exists") setExistingId(result.existingId ?? null);
      setFailed(result.reason);
    });
  }

  function errorText(reason: Exclude<Failure, false>): string {
    switch (reason) {
      case "name":
        return placeTexts.errName;
      case "type":
        return placeTexts.errType;
      case "country":
        return placeTexts.errCountry;
      case "coords":
        return placeTexts.errCoords;
      case "website":
        return placeTexts.errWebsite;
      case "city":
      case "region":
      case "description":
        return placeTexts.errField;
      case "tooMany":
        return placeTexts.errTooMany.replace("{minutes}", String(waitMinutes));
      case "exists":
        return placeTexts.errExists;
      case "link":
        return placeTexts.errLink.replace("{need}", String(reputationConfig.privileges.link));
      default:
        return placeTexts.errGeneral;
    }
  }

  const off = loggedOut || pending;

  return (
    <form onSubmit={onSubmit} className="sf-wrap">
      <section className="card sf-card">
        <h1 className="sf-h1">{placeTexts.newTitle}</h1>
        <p className="sf-imageHelp">{placeTexts.newHelp}</p>

        {loggedOut && (
          <div className="notice notice-danger" role="status">
            <LoginNotice text={{ message: placeTexts.loginRequired, link: placeTexts.login }} />
          </div>
        )}

        <label className="sf-label" htmlFor="place-name">{placeTexts.nameLabel}</label>
        <input id="place-name" type="text" className="pc-field" maxLength={placeFields.nameMax} value={name} disabled={off} onChange={(e) => setName(e.target.value)} />

        <label className="sf-label" htmlFor="place-type">{placeTexts.typeLabel}</label>
        <select id="place-type" className="pc-field" value={type} disabled={off} onChange={(e) => setType(e.target.value)}>
          <option value="">{placeTexts.typePlaceholder}</option>
          {placeTypes.map((key) => (
            <option key={key} value={key}>{placeTypeNames[key]}</option>
          ))}
        </select>

        <label className="sf-label" htmlFor="place-city">{placeTexts.cityLabel}</label>
        <input id="place-city" type="text" className="pc-field" maxLength={placeFields.cityMax} value={city} disabled={off} onChange={(e) => setCity(e.target.value)} />

        <label className="sf-label" htmlFor="place-region">{placeTexts.regionLabel}</label>
        <input id="place-region" type="text" className="pc-field" maxLength={placeFields.regionMax} value={region} disabled={off} onChange={(e) => setRegion(e.target.value)} />

        <label className="sf-label" htmlFor="place-country">{placeTexts.countryLabel}</label>
        <input id="place-country" type="text" className="pc-field" maxLength={placeFields.countryMax} value={country} disabled={off} onChange={(e) => setCountry(e.target.value)} />

        <label className="sf-label" htmlFor="place-description">{placeTexts.descriptionLabel}</label>
        <textarea id="place-description" className="pc-field" rows={5} maxLength={placeFields.descriptionMax} value={description} disabled={off} onChange={(e) => setDescription(e.target.value)} />
        <div className="sp-counter">{description.length}/{placeFields.descriptionMax}</div>

        <div className="pl-coords">
          <div>
            <label className="sf-label" htmlFor="place-lat">{placeTexts.latitudeLabel}</label>
            <input id="place-lat" type="text" inputMode="decimal" className="pc-field" maxLength={12} value={latitude} disabled={off} onChange={(e) => setLatitude(e.target.value)} />
          </div>
          <div>
            <label className="sf-label" htmlFor="place-lng">{placeTexts.longitudeLabel}</label>
            <input id="place-lng" type="text" inputMode="decimal" className="pc-field" maxLength={12} value={longitude} disabled={off} onChange={(e) => setLongitude(e.target.value)} />
          </div>
        </div>
        <p className="sf-imageHelp">{placeTexts.coordsHelp}</p>

        <label className="sf-label" htmlFor="place-website">{placeTexts.websiteLabel}</label>
        <input id="place-website" type="text" inputMode="url" className="pc-field" maxLength={placeFields.websiteMax} value={website} disabled={off} onChange={(e) => setWebsite(e.target.value)} />

        {failed && (
          <div className="notice notice-danger" role="alert">
            {failed === "login" ? (
              <LoginNotice text={{ message: placeTexts.loginRequired, link: placeTexts.login }} />
            ) : (
              errorText(failed)
            )}
            {failed === "exists" && existingId !== null && (
              <>
                {" "}
                <Link href={`/places/${existingId}`}>{placeTexts.errExistsOpen}</Link>
              </>
            )}
          </div>
        )}

        <div className="sf-actions">
          <Link href="/places" className="btn btn-secondary btn-lg">{placeTexts.cancel}</Link>
          <button type="submit" className="btn btn-primary btn-lg" disabled={!canSend}>
            {pending ? placeTexts.saving : placeTexts.submit}
          </button>
        </div>
      </section>
    </form>
  );
}
