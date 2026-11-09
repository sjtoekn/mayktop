import json, re, sys, pathlib

def read(path): return pathlib.Path(path).read_text(encoding="utf-8")
def write(path, s): pathlib.Path(path).write_text(s, encoding="utf-8")

def edit(path, pairs):
    s = read(path)
    for old, new in pairs:
        if s.count(old) != 1:
            sys.exit(f"STOP: {path}: expected exactly 1 match, found {s.count(old)} for:\n{old[:90]}")
        s = s.replace(old, new)
    write(path, s)
    print("OK", path)

def create(path, text):
    p = pathlib.Path(path)
    if p.exists():
        sys.exit(f"STOP: {path} already exists (patch already applied?)")
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(text, encoding="utf-8")
    print("NEW", path)

# ------------------------------------------------------------------ 1. database models
edit("prisma/schema.prisma", [
 ("  photoBookmarks PhotoBookmark[]\n", "  photoBookmarks PhotoBookmark[]\n  photoCollections PhotoCollection[]\n"),
 ("  bookmarks PhotoBookmark[]\n  id        Int       @id @default(autoincrement())",
  "  bookmarks PhotoBookmark[]\n  collectionItems PhotoCollectionItem[]\n  id        Int       @id @default(autoincrement())"),
])
s = read("prisma/schema.prisma")
if "model PhotoCollection " in s: sys.exit("STOP: schema already has PhotoCollection")
write("prisma/schema.prisma", s.rstrip("\n") + '''

// Photo collections: a person's own named groups of photos (private, like saved photos). Rules: src/lib/photo-collection.ts.
model PhotoCollection {
  id        Int      @id @default(autoincrement())
  ownerId   String
  name      String
  createdAt DateTime @default(now())

  owner User                  @relation(fields: [ownerId], references: [id], onDelete: Restrict)
  items PhotoCollectionItem[]

  @@unique([ownerId, name])
}

model PhotoCollectionItem {
  collectionId Int
  photoId      Int
  createdAt    DateTime @default(now())

  collection PhotoCollection @relation(fields: [collectionId], references: [id], onDelete: Restrict)
  photo      Photo           @relation(fields: [photoId], references: [id], onDelete: Restrict)

  @@id([collectionId, photoId])
  @@index([photoId])
}
''')
print("OK prisma/schema.prisma (models)")

# ------------------------------------------------------------------ 2. rules (server)
create("src/lib/photo-collection.ts", '''// Photo collections: a person's own named groups of photos. Private: nobody else sees them, no count, no notification.
// The server actions call these inside a transaction. Rules:
//  - the person comes from the login cookie (the action does that and the rate limit first);
//  - a collection belongs to ONE person; nobody can change another person's collection ("not found");
//  - ADDING a photo needs a photo that may be shown (VISIBLE, not deleted, owner shown) and no block either way;
//  - REMOVING a photo from a collection is always allowed; doing the same thing twice changes nothing;
//  - a name is 1 to 60 characters, unique per person; at most 50 collections per person, 500 photos per collection.
import type { Prisma } from "../../generated/prisma/client";
import { ContentStatus } from "../../generated/prisma/enums"; // plain constants: no database code is loaded
import { isPhotoId } from "@/lib/photo-detail-rules";
import { isBlockedEitherWay } from "@/lib/social-block";
import { isSocialAuthorShown } from "@/lib/social-visibility";

type Db = Prisma.TransactionClient;

export const photoCollectionLimits = { maxCollections: 50, maxPhotos: 500, nameMax: 60 } as const;

export type PhotoCollectionRow = { id: number; name: string; has: boolean };

export type PhotoCollectionFail = "error" | "notfound" | "full" | "exists" | "badname";

/** The name as it is saved: NFC, spaces collapsed and trimmed. Null = not allowed. */
export function cleanCollectionName(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const name = raw.normalize("NFC").replace(/\\s+/g, " ").trim();
  if (name.length < 1 || name.length > photoCollectionLimits.nameMax) return null;
  return name;
}

async function photoMayBeAdded(db: Db, userId: string, photoId: number): Promise<boolean> {
  const photo = await db.photo.findUnique({ where: { id: photoId }, select: { ownerId: true, status: true, deletedAt: true } });
  if (!photo || photo.status !== ContentStatus.VISIBLE || photo.deletedAt !== null) return false;
  const owner = await db.user.findUnique({ where: { id: photo.ownerId }, select: { status: true, deletedAt: true } });
  if (!owner || !isSocialAuthorShown(owner)) return false;
  if (await isBlockedEitherWay(db, userId, photo.ownerId)) return false;
  return true;
}

/** The person's collections (newest first) and whether this photo is already in each. */
export async function listCollectionsForPhoto(db: Db, userId: string, photoId: unknown): Promise<PhotoCollectionRow[]> {
  if (!isPhotoId(photoId) || !userId) return [];
  const rows = await db.photoCollection.findMany({
    where: { ownerId: userId },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: { id: true, name: true, items: { where: { photoId }, select: { photoId: true } } },
  });
  return rows.map((row) => ({ id: row.id, name: row.name, has: row.items.length > 0 }));
}

export async function applyCollectionToggle(
  db: Db,
  input: { userId: string; collectionId: unknown; photoId: unknown; add: unknown },
): Promise<{ ok: true; has: boolean } | { ok: false; reason: PhotoCollectionFail }> {
  const { collectionId, photoId } = input;
  if (typeof collectionId !== "number" || !Number.isSafeInteger(collectionId) || collectionId < 1) return { ok: false, reason: "error" };
  if (!isPhotoId(photoId) || typeof input.add !== "boolean" || !input.userId) return { ok: false, reason: "error" };

  const collection = await db.photoCollection.findUnique({ where: { id: collectionId }, select: { ownerId: true } });
  if (!collection || collection.ownerId !== input.userId) return { ok: false, reason: "notfound" };

  const key = { collectionId_photoId: { collectionId, photoId } };
  const existing = await db.photoCollectionItem.findUnique({ where: key, select: { photoId: true } });

  if (!input.add) {
    if (existing) await db.photoCollectionItem.delete({ where: key });
    return { ok: true, has: false };
  }

  if (!(await photoMayBeAdded(db, input.userId, photoId))) return { ok: false, reason: "notfound" };
  if (existing) return { ok: true, has: true };
  const total = await db.photoCollectionItem.count({ where: { collectionId } });
  if (total >= photoCollectionLimits.maxPhotos) return { ok: false, reason: "full" };
  await db.photoCollectionItem.create({ data: { collectionId, photoId } });
  return { ok: true, has: true };
}

/** A new collection that already holds this photo. */
export async function createCollectionWithPhoto(
  db: Db,
  input: { userId: string; name: unknown; photoId: unknown },
): Promise<{ ok: true; collection: PhotoCollectionRow } | { ok: false; reason: PhotoCollectionFail }> {
  const name = cleanCollectionName(input.name);
  if (name === null) return { ok: false, reason: "badname" };
  const photoId = input.photoId;
  if (!isPhotoId(photoId) || !input.userId) return { ok: false, reason: "error" };
  if (!(await photoMayBeAdded(db, input.userId, photoId))) return { ok: false, reason: "notfound" };

  const count = await db.photoCollection.count({ where: { ownerId: input.userId } });
  if (count >= photoCollectionLimits.maxCollections) return { ok: false, reason: "full" };
  const same = await db.photoCollection.findUnique({ where: { ownerId_name: { ownerId: input.userId, name } }, select: { id: true } });
  if (same) return { ok: false, reason: "exists" };

  const created = await db.photoCollection.create({
    data: { ownerId: input.userId, name, items: { create: { photoId } } },
    select: { id: true, name: true },
  });
  return { ok: true, collection: { id: created.id, name: created.name, has: true } };
}

/**
 * Final erasure of an account (ACCOUNT_RULES.md 3.7): deletes the person's collections (with what is in them) and every
 * place where a collection of somebody else holds one of the person's photos. Safe to run twice.
 * MUST run before the person's photos are deleted (the links are RESTRICT foreign keys).
 */
export async function erasePhotoCollections(db: Db, userId: string): Promise<number> {
  const items = await db.photoCollectionItem.deleteMany({ where: { OR: [{ collection: { ownerId: userId } }, { photo: { ownerId: userId } }] } });
  const collections = await db.photoCollection.deleteMany({ where: { ownerId: userId } });
  return items.count + collections.count;
}
''')

# ------------------------------------------------------------------ 3. server actions
create("src/app/(site)/photos/collection/actions.ts", '''"use server";

// Photo collections (private). The rules are in src/lib/photo-collection.ts. Rate limit: the Social bookmark numbers, in their
// own key, with the stricter limits of a new account. Nothing is cached, nobody is notified.
import { socialLimits } from "@/config/site";
import { limitsFor } from "@/lib/account-limits";
import {
  applyCollectionToggle,
  createCollectionWithPhoto,
  listCollectionsForPhoto,
  type PhotoCollectionFail,
  type PhotoCollectionRow,
} from "@/lib/photo-collection";
import { prisma } from "@/lib/prisma";
import { takeActionDb } from "@/lib/rate-limit-db";
import { getSessionUser } from "@/lib/session";

const rules = socialLimits.bookmarks.map((rule) => ({ max: rule.max, windowMs: rule.windowSeconds * 1000 }));

export type PhotoCollectionFailure = { error: true; reason: "login" | "tooMany" | "full" | "exists" | "badName" | "error" };

function failure(reason: PhotoCollectionFail): PhotoCollectionFailure {
  if (reason === "full" || reason === "exists") return { error: true, reason };
  if (reason === "badname") return { error: true, reason: "badName" };
  return { error: true, reason: "error" };
}

export async function getPhotoCollections(photoId: number): Promise<{ collections: PhotoCollectionRow[] } | PhotoCollectionFailure> {
  const viewer = await getSessionUser();
  if (!viewer) return { error: true, reason: "login" };
  try {
    const collections = await prisma.$transaction((tx) => listCollectionsForPhoto(tx, viewer.id, photoId));
    return { collections };
  } catch (error) {
    console.error("getPhotoCollections failed:", error);
    return { error: true, reason: "error" };
  }
}

export async function togglePhotoInCollection(collectionId: number, photoId: number, add: boolean): Promise<{ has: boolean } | PhotoCollectionFailure> {
  const viewer = await getSessionUser();
  if (!viewer) return { error: true, reason: "login" };
  if (!(await takeActionDb(`photo-collection:${viewer.id}`, limitsFor(rules, viewer))).ok) return { error: true, reason: "tooMany" };
  try {
    const result = await prisma.$transaction((tx) => applyCollectionToggle(tx, { userId: viewer.id, collectionId, photoId, add }));
    return result.ok ? { has: result.has } : failure(result.reason);
  } catch (error) {
    console.error("togglePhotoInCollection failed:", error);
    return { error: true, reason: "error" };
  }
}

export async function createPhotoCollection(photoId: number, name: string): Promise<{ collection: PhotoCollectionRow } | PhotoCollectionFailure> {
  const viewer = await getSessionUser();
  if (!viewer) return { error: true, reason: "login" };
  if (!(await takeActionDb(`photo-collection:${viewer.id}`, limitsFor(rules, viewer))).ok) return { error: true, reason: "tooMany" };
  try {
    const result = await prisma.$transaction((tx) => createCollectionWithPhoto(tx, { userId: viewer.id, name, photoId }));
    return result.ok ? { collection: result.collection } : failure(result.reason);
  } catch (error) {
    console.error("createPhotoCollection failed:", error);
    return { error: true, reason: "error" };
  }
}
''')

# ------------------------------------------------------------------ 4. the button
create("src/components/photos/PhotoCollectionButton.tsx", '''"use client";

// The Collection button of the photo page: opens a small panel with the person's collections (tick = this photo is in it),
// and a field to make a new one. Private. The server actions give the real state back.
import { useEffect, useRef, useState, useTransition } from "react";
import Icon from "@/components/shell/Icon";
import { createPhotoCollection, getPhotoCollections, togglePhotoInCollection } from "@/app/(site)/photos/collection/actions";
import type { PhotoCollectionRow } from "@/lib/photo-collection";

export type PhotoCollectionText = {
  label: string;
  title: string;
  heading: string;
  empty: string;
  newName: string;
  create: string;
  login: string;
  tooMany: string;
  full: string;
  exists: string;
  badName: string;
  error: string;
  loading: string;
};

export default function PhotoCollectionButton({ photoId, text }: { photoId: number; text: PhotoCollectionText }) {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<PhotoCollectionRow[] | null>(null);
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const box = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDown(event: MouseEvent) {
      if (box.current && !box.current.contains(event.target as Node)) setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function message(reason: string): string {
    if (reason === "login") return text.login;
    if (reason === "tooMany") return text.tooMany;
    if (reason === "full") return text.full;
    if (reason === "exists") return text.exists;
    if (reason === "badName") return text.badName;
    return text.error;
  }

  function toggleOpen() {
    const next = !open;
    setOpen(next);
    setError("");
    if (next) {
      startTransition(async () => {
        const result = await getPhotoCollections(photoId);
        if ("error" in result) {
          setError(message(result.reason));
          return;
        }
        setRows(result.collections);
      });
    }
  }

  function toggleRow(row: PhotoCollectionRow) {
    if (pending) return;
    setError("");
    startTransition(async () => {
      const result = await togglePhotoInCollection(row.id, photoId, !row.has);
      if ("error" in result) {
        setError(message(result.reason));
        return;
      }
      setRows((current) => (current ?? []).map((item) => (item.id === row.id ? { ...item, has: result.has } : item)));
    });
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (pending || name.trim() === "") return;
    setError("");
    startTransition(async () => {
      const result = await createPhotoCollection(photoId, name);
      if ("error" in result) {
        setError(message(result.reason));
        return;
      }
      setRows((current) => [result.collection, ...(current ?? [])]);
      setName("");
    });
  }

  return (
    <span className="ph-collWrap" ref={box}>
      <button type="button" className="pc-pill sp-bookmarkButton" onClick={toggleOpen} aria-expanded={open} title={text.title}>
        <Icon name="folderPlus" size={18} /> {text.label}
      </button>
      {open ? (
        <div className="ph-collPanel" role="dialog" aria-label={text.heading}>
          <b className="ph-collHeading">{text.heading}</b>
          {rows === null && error === "" ? <p className="ph-collNote">{text.loading}</p> : null}
          {rows !== null && rows.length === 0 ? <p className="ph-collNote">{text.empty}</p> : null}
          {rows !== null && rows.length > 0 ? (
            <ul className="ph-collList">
              {rows.map((row) => (
                <li key={row.id}>
                  <button type="button" className="ph-collRow" onClick={() => toggleRow(row)} disabled={pending} aria-pressed={row.has}>
                    <span className={`ph-collCheck${row.has ? " is-on" : ""}`} aria-hidden="true">{row.has ? "✓" : ""}</span>
                    <span className="ph-collName">{row.name}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          <form className="ph-collForm" onSubmit={submit}>
            <input type="text" value={name} onChange={(event) => setName(event.target.value)} maxLength={60} placeholder={text.newName} aria-label={text.newName} />
            <button type="submit" className="btn btn-primary" disabled={pending || name.trim() === ""}>{text.create}</button>
          </form>
          {error ? <p className="ph-collNote" role="status">{error}</p> : null}
        </div>
      ) : null}
    </span>
  );
}
''')

edit("src/components/shell/Icon.tsx", [(
 '  bookmark: "M6 3h12v18l-6-4-6 4z",\n',
 '  bookmark: "M6 3h12v18l-6-4-6 4z",\n  folderPlus: "M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM12 11v6M9 14h6",\n')])

# ------------------------------------------------------------------ 5. photo page
edit("src/app/(site)/photos/[id]/page.tsx", [
 ('import PhotoBookmarkButton from "@/components/photos/PhotoBookmarkButton";',
  'import PhotoBookmarkButton from "@/components/photos/PhotoBookmarkButton";\nimport PhotoCollectionButton from "@/components/photos/PhotoCollectionButton";'),
 ('              <span className="ph-public">{t("photo.visibility.public")}</span>',
  '''              <PhotoCollectionButton
                photoId={photo.id}
                text={{
                  label: t("photo.collection.label"),
                  title: t("photo.collection.title"),
                  heading: t("photo.collection.heading"),
                  empty: t("photo.collection.empty"),
                  newName: t("photo.collection.new"),
                  create: t("photo.collection.create"),
                  login: t("photo.collection.login"),
                  tooMany: t("photo.collection.tooMany"),
                  full: t("photo.collection.full"),
                  exists: t("photo.collection.exists"),
                  badName: t("photo.collection.badName"),
                  error: t("photo.collection.error"),
                  loading: t("photo.collection.loading"),
                }}
              />
              <span className="ph-public">{t("photo.visibility.public")}</span>'''),
])

# ------------------------------------------------------------------ 6. account erasure
edit("src/lib/purge-social.ts", [
 ('import { erasePhotoBookmarks } from "./photo-bookmark";',
  'import { erasePhotoBookmarks } from "./photo-bookmark";\nimport { erasePhotoCollections } from "./photo-collection";'),
 ('  await erasePhotoBookmarks(db, userId); // saved photos made, and saves of the person\'s photos (patch-photo-save)\n',
  '  await erasePhotoBookmarks(db, userId); // saved photos made, and saves of the person\'s photos (patch-photo-save)\n  await erasePhotoCollections(db, userId); // photo collections made, and places where a collection holds the person\'s photos\n'),
])

# ------------------------------------------------------------------ 7. translations
keys = ["label","title","heading","empty","new","create","login","tooMany","full","exists","badName","error","loading"]
tr = {
 "en": ["Collection","Add this photo to a collection","Your collections","You have no collections yet. Create your first one below.","New collection name","Create","Please log in to use collections.","Too many changes in a short time. Please wait a moment.","This collection or your list of collections is full.","You already have a collection with this name.","Use a name of 1 to 60 characters.","Could not update the collection. Please try again.","Loading…"],
 "es": ["Colección","Añadir esta foto a una colección","Tus colecciones","Aún no tienes colecciones. Crea la primera abajo.","Nombre de la nueva colección","Crear","Inicia sesión para usar las colecciones.","Demasiados cambios en poco tiempo. Espera un momento.","Esta colección o tu lista de colecciones está llena.","Ya tienes una colección con este nombre.","Usa un nombre de 1 a 60 caracteres.","No se pudo actualizar la colección. Inténtalo de nuevo.","Cargando…"],
 "fr": ["Collection","Ajouter cette photo à une collection","Vos collections","Vous n'avez pas encore de collection. Créez la première ci-dessous.","Nom de la nouvelle collection","Créer","Connectez-vous pour utiliser les collections.","Trop de modifications en peu de temps. Patientez un instant.","Cette collection ou votre liste de collections est pleine.","Vous avez déjà une collection portant ce nom.","Utilisez un nom de 1 à 60 caractères.","Impossible de mettre à jour la collection. Réessayez.","Chargement…"],
 "zh": ["合集","将这张照片添加到合集","你的合集","你还没有合集，请在下方创建第一个。","新合集名称","创建","请登录后使用合集。","短时间内操作过多，请稍等片刻。","此合集或你的合集列表已满。","你已有同名合集。","名称长度须为 1 到 60 个字符。","无法更新合集，请重试。","加载中…"],
 "hi": ["संग्रह","इस फ़ोटो को संग्रह में जोड़ें","आपके संग्रह","अभी आपका कोई संग्रह नहीं है। नीचे पहला बनाएँ।","नए संग्रह का नाम","बनाएँ","संग्रह उपयोग करने के लिए कृपया लॉग इन करें।","थोड़े समय में बहुत ज़्यादा बदलाव। कृपया थोड़ा रुकें।","यह संग्रह या आपकी संग्रह सूची भर चुकी है।","इस नाम का संग्रह आपके पास पहले से है।","1 से 60 अक्षरों का नाम रखें।","संग्रह अपडेट नहीं हो सका। कृपया फिर कोशिश करें।","लोड हो रहा है…"],
 "ar": ["مجموعة","أضف هذه الصورة إلى مجموعة","مجموعاتك","ليس لديك مجموعات بعد. أنشئ أولى مجموعاتك أدناه.","اسم المجموعة الجديدة","إنشاء","يرجى تسجيل الدخول لاستخدام المجموعات.","تغييرات كثيرة في وقت قصير. يرجى الانتظار قليلاً.","هذه المجموعة أو قائمة مجموعاتك ممتلئة.","لديك مجموعة بهذا الاسم بالفعل.","استخدم اسمًا من 1 إلى 60 حرفًا.","تعذر تحديث المجموعة. حاول مرة أخرى.","جارٍ التحميل…"],
}
for loc, vals in tr.items():
    path = f"src/i18n/messages/{loc}.ts"
    s = read(path)
    m = re.search(r'^  "photo\.bookmark\.full": .*,\n', s, re.M)
    if not m or '"photo.collection.label"' in s:
        sys.exit(f"STOP: {path}: anchor missing or already patched")
    add = "".join(f'  "photo.collection.{k}": {json.dumps(v, ensure_ascii=False)},\n' for k, v in zip(keys, vals))
    write(path, s[:m.end()] + add + s[m.end():])
    print("OK", path)

# ------------------------------------------------------------------ 8. style
with open("src/app/(site)/photos/photos.css", "a", encoding="utf-8") as f:
    f.write('''
/* Collection button and its panel */
.ph-collWrap {
  position: relative;
  display: inline-flex;
}
.ph-collPanel {
  position: absolute;
  inset-inline-start: 0;
  top: calc(100% + 8px);
  z-index: 30;
  width: min(320px, 86vw);
  padding: 14px;
  border-radius: 14px;
  background: var(--surface);
  color: var(--ink);
  box-shadow: 0 0 0 1px rgba(127, 127, 127, 0.25), 0 12px 32px rgba(0, 0, 0, 0.18);
}
.ph-collHeading {
  display: block;
  margin-bottom: 8px;
}
.ph-collNote {
  margin: 6px 0;
  font-size: 0.9rem;
  color: var(--muted);
}
.ph-collList {
  list-style: none;
  margin: 0 0 10px;
  padding: 0;
  max-height: 220px;
  overflow-y: auto;
}
.ph-collRow {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 8px 6px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: inherit;
  font: inherit;
  text-align: start;
  cursor: pointer;
}
.ph-collRow:hover {
  background: var(--surface2);
}
.ph-collRow:disabled {
  cursor: wait;
  opacity: 0.7;
}
.ph-collCheck {
  display: inline-grid;
  place-items: center;
  width: 20px;
  height: 20px;
  border-radius: 6px;
  box-shadow: inset 0 0 0 2px rgba(127, 127, 127, 0.5);
  font-size: 0.8rem;
  font-weight: 800;
}
.ph-collCheck.is-on {
  background: var(--brand, #2f5bff);
  color: #ffffff;
  box-shadow: none;
}
.ph-collName {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.ph-collForm {
  display: flex;
  gap: 8px;
}
.ph-collForm input {
  flex: 1;
  min-width: 0;
  padding: 8px 10px;
  border: 0;
  border-radius: 8px;
  background: var(--surface2);
  color: inherit;
  font: inherit;
}
''')
print("OK photos.css")
