import Link from "next/link";
import { requireAdmin } from "@/lib/admin";
import { loadAdminRequests } from "@/lib/community-request";
import { crText } from "@/lib/community-request-text";
import CommunityRequestDecision from "@/components/admin/CommunityRequestDecision";

function dateText(date: Date): string {
  return new Intl.DateTimeFormat("en", { dateStyle: "medium", timeZone: "UTC" }).format(date);
}

export default async function AdminCommunityRequestsPage() {
  await requireAdmin();
  const { pending, decided } = await loadAdminRequests();
  const a = crText.admin;
  return (
    <>
      <section className="ad-head">
        <h1 className="pc-title pc-title-lg">{a.title}</h1>
        <p className="pc-text">{a.intro}</p>
        <p><Link href="/admin/communities" className="underline">{a.back}</Link></p>
      </section>

      <h2 className="sf-h2">{a.pendingTitle} ({pending.length})</h2>
      {pending.length === 0 ? (
        <p className="card ad-empty">{a.empty}</p>
      ) : (
        pending.map((r) => (
          <section key={r.id} className="card ad-item">
            <h3 className="pc-title">{r.name} <span className="pc-meta">c/{r.slug}</span></h3>
            <p className="pc-meta">{a.by} <Link href={`/u/${r.requester}`}>{r.requester}</Link> · {dateText(r.createdAt)} · {crText.fieldCategory}: {crText.categories[r.category] ?? r.category}</p>
            <p className="pc-text">{r.description}</p>
            <ol>
              {r.rules.map((rule, i) => (
                <li key={i}><b>{rule.title}.</b> {rule.text}</li>
              ))}
            </ol>
            <CommunityRequestDecision id={r.id} text={crText} />
          </section>
        ))
      )}

      {decided.length > 0 && (
        <>
          <h2 className="sf-h2">{a.decidedTitle}</h2>
          {decided.map((r) => (
            <section key={r.id} className="card ad-item">
              <p>
                <b>{r.name}</b> · c/{r.slug} · {a.by} {r.requester} ·{" "}
                <span className={`pc-badge ${r.status === "APPROVED" ? "pc-badge-success" : "pc-badge-danger"}`}>{crText.status[r.status]}</span>
              </p>
              {r.note && <p className="pc-meta">{crText.reasonLabel} {r.note}</p>}
            </section>
          ))}
        </>
      )}
    </>
  );
}
