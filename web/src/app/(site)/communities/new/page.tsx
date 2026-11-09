import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import CommunityRequestForm from "@/components/CommunityRequestForm";
import { getSessionUser } from "@/lib/session";
import { loadMyRequests } from "@/lib/community-request";
import { crText } from "@/lib/community-request-text";

export const metadata: Metadata = { title: crText.title };

async function Content() {
  await connection(); // reads the login and the database: per request, never at build time (Cache Components)
  const user = await getSessionUser();
  if (!user) {
    return (
      <div className="notice notice-info">
        {crText.loginMessage} <Link href="/login" className="underline">{crText.loginLink}</Link>
      </div>
    );
  }
  const mine = await loadMyRequests(user.id);
  const waiting = mine.some((r) => r.status === "PENDING");
  return (
    <>
      {waiting ? (
        <div className="notice notice-info" role="status">
          <p><b>{crText.waitingTitle}</b></p>
          <p>{crText.waitingText}</p>
        </div>
      ) : (
        <CommunityRequestForm text={crText} />
      )}

      {mine.length > 0 && (
        <section className="card sf-card">
          <h2 className="sf-h2">{crText.yourRequests}</h2>
          {mine.map((r) => (
            <div key={r.id}>
              <p>
                <b>{r.name}</b> · c/{r.slug} ·{" "}
                <span className={`pc-badge ${r.status === "APPROVED" ? "pc-badge-success" : r.status === "REJECTED" ? "pc-badge-danger" : "pc-badge-neutral"}`}>
                  {crText.status[r.status]}
                </span>
              </p>
              {r.status === "REJECTED" && r.note && <p className="pc-meta">{crText.reasonLabel} {r.note}</p>}
              {r.status === "APPROVED" && <Link href={`/c/${r.slug}`} className="underline">{crText.open}</Link>}
            </div>
          ))}
        </section>
      )}
    </>
  );
}

export default function NewCommunityPage() {
  return (
    <div className="sf-wrap">
      <section className="card sf-card">
        <h1 className="sf-h1">{crText.title}</h1>
        <p className="pc-text">{crText.intro}</p>
      </section>
      <Suspense fallback={null}>
        <Content />
      </Suspense>
    </div>
  );
}
