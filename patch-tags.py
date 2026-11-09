import re, sys, pathlib

def edit(path, pairs):
    p = pathlib.Path(path)
    s = p.read_text(encoding="utf-8")
    for old, new in pairs:
        if s.count(old) != 1:
            sys.exit(f"STOP: {path}: expected exactly 1 match, found {s.count(old)} for:\n{old[:90]}")
        s = s.replace(old, new)
    p.write_text(s, encoding="utf-8")
    print("OK", path)

# 1. translations (every language must have the same keys)
tr = {
  "en": ("More photos tagged #{tag}", "Photos tagged #{tag}"),
  "es": ("Más fotos con la etiqueta #{tag}", "Fotos con la etiqueta #{tag}"),
  "fr": ("Plus de photos avec l’étiquette #{tag}", "Photos avec l’étiquette #{tag}"),
  "zh": ("更多带有 #{tag} 标签的照片", "带有 #{tag} 标签的照片"),
  "hi": ("#{tag} टैग वाली और तस्वीरें", "#{tag} टैग वाली तस्वीरें"),
  "ar": ("المزيد من الصور بالوسم #{tag}", "الصور بالوسم #{tag}"),
}
for loc, (more, head) in tr.items():
    path = f"src/i18n/messages/{loc}.ts"
    s = pathlib.Path(path).read_text(encoding="utf-8")
    m = re.search(r'^  "photo\.detail\.tags": .*,\n', s, re.M)
    if not m or '"photo.tag.more"' in s:
        sys.exit(f"STOP: {path}: anchor missing or already patched")
    add = f'  "photo.tag.more": "{more}",\n  "photo.tag.heading": "{head}",\n'
    pathlib.Path(path).write_text(s[:m.end()] + add + s[m.end():], encoding="utf-8")
    print("OK", path)

# 2. photo page: tag chips become links with a tooltip
edit("src/app/(site)/photos/[id]/page.tsx", [(
'''                <li key={row.tag} className="ph-chip">
                  #{row.tag}
                </li>''',
'''                <li key={row.tag} className="ph-chip">
                  <Link href={`/photos?tag=${encodeURIComponent(row.tag)}`} title={t("photo.tag.more", { tag: row.tag })}>
                    #{row.tag}
                  </Link>
                </li>''')])

# 3. loader: optional tag filter
edit("src/lib/photo-feed.ts", [
('export async function loadPhotoPage(before: number | null): Promise<PhotoPage> {',
 'export async function loadPhotoPage(before: number | null, tag: string | null = null): Promise<PhotoPage> {'),
('where: { status: ContentStatus.VISIBLE, deletedAt: null, ...(cursor !== null ? { id: { lt: cursor } } : {}) },',
 'where: { status: ContentStatus.VISIBLE, deletedAt: null, ...(tag !== null ? { tags: { some: { tag } } } : {}), ...(cursor !== null ? { id: { lt: cursor } } : {}) },'),
])

# 4. /photos page: ?tag=
edit("src/app/(site)/photos/page.tsx", [
('import { photoThumbUrl } from "@/lib/photo-file";',
 'import { photoThumbUrl } from "@/lib/photo-file";\nimport { parseTagParam } from "@/lib/social-tags";'),
('type Search = Promise<{ before?: string | string[] }>;',
 'type Search = Promise<{ before?: string | string[]; tag?: string | string[] }>;'),
('  const { before } = await searchParams;\n  const cursor = parsePhotoBefore(before);\n  const page = await loadPhotoPage(cursor);',
 '  const { before, tag: rawTag } = await searchParams;\n  const cursor = parsePhotoBefore(before);\n  const tag = parseTagParam(rawTag);\n  const page = await loadPhotoPage(cursor, tag);\n  const baseHref = tag ? `/photos?tag=${encodeURIComponent(tag)}` : "/photos";\n  const moreHref = (id: number) => (tag ? `${baseHref}&before=${id}` : `/photos?before=${id}`);'),
('<h1 className="sf-h1">{t("photo.list.title")}</h1>',
 '<h1 className="sf-h1">{tag ? t("photo.tag.heading", { tag }) : t("photo.list.title")}</h1>'),
('<Link href="/photos" className="btn btn-secondary">\n                {t("photo.list.newest")}',
 '<Link href={baseHref} className="btn btn-secondary">\n                {t("photo.list.newest")}'),
('<Link href={`/photos?before=${page.next}`} className="btn btn-secondary">',
 '<Link href={moreHref(page.next)} className="btn btn-secondary">'),
])

# 5. style of the linked chip
with open("src/app/(site)/photos/photos.css", "a", encoding="utf-8") as f:
    f.write('''
/* Tag chips are links now */
.ph-chip a {
  color: inherit;
  text-decoration: none;
}
.ph-chip:hover {
  background: rgba(47, 91, 255, 0.18);
}
''')
print("OK photos.css")
