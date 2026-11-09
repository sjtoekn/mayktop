// apply-admin-ad-manage.mjs — admin can EDIT or DELETE any ad (buttons under every ad on /admin/ads and on the ad detail page).
// Run from the 7-mayktop folder:  node apply-admin-ad-manage.mjs    (safe to run twice; makes .bak copies of the files it changes)
import fs from "node:fs";
import path from "node:path";

const LIB = "// Admin: edit or delete ANY ad (added 2026-11-09). Server only. The caller (the server action) has already checked that the person is an admin.\n//  - Edit: title, text, link (https), contact email and the place (slot). The format and the picture / video stay as they are.\n//    Same length / link / email checks as the \"Create an ad\" form (ad-input.ts); the blocked-words check is NOT applied: the admin is trusted.\n//  - Delete: removes the ad and its daily counters for good. It is refused while an appeal about this ad is still open.\n// No audit row is written for these two (the AuditAction list has no value for them yet; that needs a database change).\nimport { adsConfig } from \"@/config/site\";\nimport { cleanEmail, cleanHttpsUrl, cleanLine } from \"@/lib/ad-input\";\nimport { prisma } from \"@/lib/prisma\";\nimport { AppealStatus, AuditTarget } from \"../../generated/prisma/client\";\n\nexport type ManageError = \"type\" | \"notfound\" | \"title\" | \"body\" | \"url\" | \"email\" | \"slot\" | \"appeal\";\nexport type ManageResult = { ok: true } | { error: ManageError };\n\nexport async function adminEditAd(input: {\n  adId: number;\n  title: unknown;\n  body: unknown;\n  url: unknown;\n  email: unknown;\n  slot: unknown;\n}): Promise<ManageResult> {\n  if (!input || !Number.isInteger(input.adId)) return { error: \"type\" };\n  if (typeof input.title !== \"string\" || typeof input.body !== \"string\" || typeof input.slot !== \"string\") return { error: \"type\" };\n\n  const title = cleanLine(input.title);\n  if (title.length < adsConfig.titleMinLength || title.length > adsConfig.titleMaxLength) return { error: \"title\" };\n  const body = cleanLine(input.body);\n  if (body.length < adsConfig.bodyMinLength || body.length > adsConfig.bodyMaxLength) return { error: \"body\" };\n  const destinationUrl = cleanHttpsUrl(input.url);\n  if (!destinationUrl) return { error: \"url\" };\n  const contactEmail = cleanEmail(input.email);\n  if (!contactEmail) return { error: \"email\" };\n  if (!(adsConfig.slots as readonly string[]).includes(input.slot)) return { error: \"slot\" };\n  const slot = input.slot as (typeof adsConfig.slots)[number];\n\n  const ad = await prisma.adCampaign.findUnique({ where: { id: input.adId }, select: { id: true, format: true } });\n  if (!ad) return { error: \"notfound\" };\n  if (slot === \"HEADER\" && ad.format !== \"IMAGE\") return { error: \"slot\" }; // the header banner is a wide PICTURE\n\n  await prisma.adCampaign.update({\n    where: { id: ad.id },\n    data: { title, body, destinationUrl, contactEmail, slot, ...(slot === \"SOCIAL_FEED\" ? { communityId: null } : {}) },\n  });\n  return { ok: true };\n}\n\nexport async function adminDeleteAd(input: { adId: number }): Promise<ManageResult> {\n  if (!input || !Number.isInteger(input.adId)) return { error: \"type\" };\n  const ad = await prisma.adCampaign.findUnique({ where: { id: input.adId }, select: { id: true } });\n  if (!ad) return { error: \"notfound\" };\n\n  const openAppeals = await prisma.appeal.count({\n    where: { status: AppealStatus.OPEN, auditLog: { targetType: AuditTarget.AD, targetId: String(ad.id) } },\n  });\n  if (openAppeals > 0) return { error: \"appeal\" };\n\n  await prisma.$transaction([\n    prisma.adDailyStat.deleteMany({ where: { adId: ad.id } }), // the database refuses to delete an ad that still has counters\n    prisma.adCampaign.delete({ where: { id: ad.id } }),\n  ]);\n  return { ok: true };\n}\n";
const COMPONENT = "\"use client\";\n// Admin: Edit / Delete buttons for ANY ad (added 2026-11-09). Shown under every ad on /admin/ads and on the ad detail page.\n// Admin-only screen, so the words are plain English constants here. The server checks everything again (admin-ad-manage.ts).\nimport { useState, useTransition } from \"react\";\nimport { useRouter } from \"next/navigation\";\nimport { adminDeleteAdAction, adminEditAdAction } from \"@/app/admin/ads/actions\";\n\ntype Props = {\n  adId: number;\n  format: \"TEXT\" | \"IMAGE\" | \"VIDEO\";\n  initial: { title: string; body: string; url: string; email: string; slot: string };\n  slots: string[];\n  limits: { titleMax: number; bodyMax: number };\n  redirectAfterDelete?: string; // the detail page sends the admin back to the list after a delete\n};\n\nconst SLOT_LABEL: Record<string, string> = {\n  SIDEBAR: \"Sidebar\",\n  FEED: \"Feed (between posts)\",\n  SOCIAL_FEED: \"Social feed\",\n  HEADER: \"Header banner (picture ads only)\",\n};\n\nconst ERRORS: Record<string, string> = {\n  type: \"Something in the form is not valid.\",\n  notfound: \"This ad does not exist any more.\",\n  title: \"The title is too short or too long.\",\n  body: \"The text is too short or too long.\",\n  url: \"The link must be a full https:// address of a public website.\",\n  email: \"The contact email does not look right.\",\n  slot: \"This place is not allowed for this ad (the header banner is for picture ads only).\",\n  appeal: \"This ad has an open appeal. Decide the appeal first, then delete the ad.\",\n  other: \"Something went wrong. Nothing was changed.\",\n};\n\nexport default function AdManage({ adId, format, initial, slots, limits, redirectAfterDelete }: Props) {\n  const router = useRouter();\n  const [mode, setMode] = useState<\"none\" | \"edit\" | \"delete\">(\"none\");\n  const [title, setTitle] = useState(initial.title);\n  const [body, setBody] = useState(initial.body);\n  const [url, setUrl] = useState(initial.url);\n  const [email, setEmail] = useState(initial.email);\n  const [slot, setSlot] = useState(initial.slot);\n  const [error, setError] = useState<string | null>(null);\n  const [saved, setSaved] = useState(false);\n  const [pending, startTransition] = useTransition();\n\n  const id = `ad-manage-${adId}`;\n  const allowedSlots = slots.filter((s) => s !== \"HEADER\" || format === \"IMAGE\");\n\n  function open(next: \"edit\" | \"delete\") {\n    setMode(next);\n    setError(null);\n    setSaved(false);\n  }\n\n  function save(e: React.FormEvent) {\n    e.preventDefault();\n    if (pending) return;\n    startTransition(async () => {\n      const result = await adminEditAdAction({ adId, title, body, url, email, slot });\n      if (\"error\" in result) {\n        setError(ERRORS[result.error] ?? ERRORS.other);\n        return;\n      }\n      setError(null);\n      setSaved(true);\n      setMode(\"none\");\n      router.refresh();\n    });\n  }\n\n  function remove() {\n    if (pending) return;\n    startTransition(async () => {\n      const result = await adminDeleteAdAction({ adId });\n      if (\"error\" in result) {\n        setError(ERRORS[result.error] ?? ERRORS.other);\n        return;\n      }\n      if (redirectAfterDelete) router.push(redirectAfterDelete);\n      router.refresh();\n    });\n  }\n\n  return (\n    <div className=\"ad-form ad-manage\">\n      {saved && mode === \"none\" && <div className=\"notice notice-success\" role=\"status\">Saved.</div>}\n\n      {mode === \"none\" && (\n        <div className=\"ad-actionRow\">\n          <button type=\"button\" className=\"btn btn-secondary btn-sm\" onClick={() => open(\"edit\")}>Edit this ad</button>\n          <button type=\"button\" className=\"btn btn-danger btn-sm\" onClick={() => open(\"delete\")}>Delete this ad</button>\n        </div>\n      )}\n\n      {mode === \"edit\" && (\n        <form className=\"ad-form\" onSubmit={save} noValidate>\n          <label className=\"sf-label\" htmlFor={`${id}-title`}>Title</label>\n          <input id={`${id}-title`} className=\"pc-field\" value={title} maxLength={limits.titleMax} onChange={(e) => setTitle(e.target.value)} />\n\n          <label className=\"sf-label\" htmlFor={`${id}-body`}>Text</label>\n          <textarea id={`${id}-body`} className=\"pc-field\" rows={3} value={body} maxLength={limits.bodyMax} onChange={(e) => setBody(e.target.value)} />\n\n          <label className=\"sf-label\" htmlFor={`${id}-url`}>Link (https://...)</label>\n          <input id={`${id}-url`} className=\"pc-field\" type=\"url\" inputMode=\"url\" value={url} onChange={(e) => setUrl(e.target.value)} />\n\n          <label className=\"sf-label\" htmlFor={`${id}-email`}>Contact email</label>\n          <input id={`${id}-email`} className=\"pc-field\" type=\"email\" value={email} onChange={(e) => setEmail(e.target.value)} />\n\n          <label className=\"sf-label\" htmlFor={`${id}-slot`}>Where it is shown</label>\n          <select id={`${id}-slot`} className=\"pc-field\" value={slot} onChange={(e) => setSlot(e.target.value)}>\n            {allowedSlots.map((s) => (\n              <option key={s} value={s}>{SLOT_LABEL[s] ?? s}</option>\n            ))}\n          </select>\n\n          {error && <div className=\"notice notice-danger\" role=\"alert\">{error}</div>}\n          <div className=\"ad-actionRow\">\n            <button type=\"submit\" className=\"btn btn-primary btn-sm\" disabled={pending}>{pending ? \"Saving...\" : \"Save changes\"}</button>\n            <button type=\"button\" className=\"btn btn-ghost btn-sm\" onClick={() => setMode(\"none\")} disabled={pending}>Cancel</button>\n          </div>\n        </form>\n      )}\n\n      {mode === \"delete\" && (\n        <div className=\"ad-form\">\n          <p className=\"ad-sure\">Delete ad #{adId} for good? Its numbers (shown / clicks) are deleted too. This cannot be undone.</p>\n          {error && <div className=\"notice notice-danger\" role=\"alert\">{error}</div>}\n          <div className=\"ad-actionRow\">\n            <button type=\"button\" className=\"btn btn-danger btn-sm\" onClick={remove} disabled={pending}>{pending ? \"Deleting...\" : \"Yes, delete it\"}</button>\n            <button type=\"button\" className=\"btn btn-ghost btn-sm\" onClick={() => setMode(\"none\")} disabled={pending}>Cancel</button>\n          </div>\n        </div>\n      )}\n    </div>\n  );\n}\n";

const W = (...p) => path.join("web", "src", ...p);
const files = {
  lib: W("lib", "admin-ad-manage.ts"),
  comp: W("components", "admin", "AdManage.tsx"),
  actions: W("app", "admin", "ads", "actions.ts"),
  list: W("app", "admin", "ads", "page.tsx"),
  detail: W("app", "admin", "ads", "[id]", "page.tsx"),
};
for (const f of [files.actions, files.list, files.detail]) {
  if (!fs.existsSync(f)) { console.error(f + ": not found. Run this from the 7-mayktop folder."); process.exit(1); }
}
const backup = (f) => { if (!fs.existsSync(f + ".bak")) fs.copyFileSync(f, f + ".bak"); };

function writeNew(file, text) {
  if (fs.existsSync(file) && fs.readFileSync(file, "utf8") === text) return console.log(file + ": already done");
  fs.writeFileSync(file, text);
  console.log(file + ": written");
}

// Check every edit first, so a mismatch changes NOTHING.
const plan = [];
function edit(file, marker, pairs, append) {
  let s = fs.readFileSync(file, "utf8");
  if (s.includes(marker)) { console.log(file + ": already done"); return; }
  for (const [a, b] of pairs) {
    if (!s.includes(a)) { console.error(file + ": expected text not found:\n" + a + "\nNothing was changed."); process.exit(1); }
    s = s.replace(a, b);
  }
  if (append) s = s.replace(/\s*$/, "\n") + append;
  plan.push([file, s]);
}

const BOX = (indent, extra) =>
  `${indent}<AdManage\n${indent}  adId={ad.id}\n${indent}  format={ad.format}\n${indent}  initial={{ title: ad.title, body: ad.body, url: ad.destinationUrl, email: ad.contactEmail, slot: ad.slot }}\n` +
  `${indent}  slots={[...adsConfig.slots]}\n${indent}  limits={{ titleMax: adsConfig.titleMaxLength, bodyMax: adsConfig.bodyMaxLength }}${extra}\n${indent}/>`;

// 1) server actions
edit(
  files.actions,
  "adminEditAdAction",
  [[
    'import { approveAd, markAdPaid, pauseAd, rejectAd, restoreAd, type AdError, type AdResult } from "@/lib/ad-review";',
    'import { approveAd, markAdPaid, pauseAd, rejectAd, restoreAd, type AdError, type AdResult } from "@/lib/ad-review";\nimport { adminDeleteAd, adminEditAd, type ManageResult } from "@/lib/admin-ad-manage";',
  ]],
  `
// Admin: edit or delete ANY ad (admin-ad-manage.ts). The actor is the logged-in admin; not an admin -> 404.
export async function adminEditAdAction(input: {
  adId: number;
  title: string;
  body: string;
  url: string;
  email: string;
  slot: string;
}): Promise<ManageResult | { error: "other" }> {
  await requireAdmin();
  try {
    const result = await adminEditAd(input);
    if ("error" in result) return result;
    updateTag("ads");
    revalidatePath("/admin/ads");
    revalidatePath(\`/admin/ads/\${input.adId}\`);
    return { ok: true };
  } catch (error) {
    console.error("adminEditAdAction failed:", error);
    return { error: "other" };
  }
}

export async function adminDeleteAdAction(input: { adId: number }): Promise<ManageResult | { error: "other" }> {
  await requireAdmin();
  try {
    const result = await adminDeleteAd(input);
    if ("error" in result) return result;
    updateTag("ads");
    revalidatePath("/admin/ads");
    revalidatePath("/admin");
    return { ok: true };
  } catch (error) {
    console.error("adminDeleteAdAction failed:", error);
    return { error: "other" };
  }
}
`
);

// 2) the list page: under every ad (running / waiting / history)
edit(
  files.list,
  "AdManage",
  [
    [
      'import AdDecision, { type AdDecisionText } from "@/components/admin/AdDecision";',
      'import AdDecision, { type AdDecisionText } from "@/components/admin/AdDecision";\nimport AdManage from "@/components/admin/AdManage";',
    ],
    [
      '                <Link href={`/admin/ads/${ad.id}`} className="btn btn-ghost btn-sm">{t("ad.detail.link")}</Link>\n              </div>\n            </article>',
      '                <Link href={`/admin/ads/${ad.id}`} className="btn btn-ghost btn-sm">{t("ad.detail.link")}</Link>\n              </div>\n' + BOX("              ", "") + '\n            </article>',
    ],
    [
      '              <AdDecision adId={ad.id} actions={ad.actions} rules={rules} limits={limits} text={text} />\n            </article>',
      '              <AdDecision adId={ad.id} actions={ad.actions} rules={rules} limits={limits} text={text} />\n' + BOX("              ", "") + '\n            </article>',
    ],
  ]
);

// 3) the ad detail page
edit(
  files.detail,
  "AdManage",
  [
    [
      'import AdMedia from "@/components/AdMedia";',
      'import AdMedia from "@/components/AdMedia";\nimport AdManage from "@/components/admin/AdManage";',
    ],
    [
      '      <AdStatsView ad={ad} csvHref=',
      '      <section className="card adt-block">\n' + BOX("        ", '\n        redirectAfterDelete="/admin/ads"') + '\n      </section>\n\n      <AdStatsView ad={ad} csvHref=',
    ],
  ]
);

for (const [file, text] of plan) { backup(file); fs.writeFileSync(file, text); console.log(file + ": updated"); }
writeNew(files.lib, LIB);
writeNew(files.comp, COMPONENT);
console.log("Done. Reload http://localhost:3000/admin/ads, then: cd web && npm run lint && npm run build");
