// INTERNAL style-guide page (/design). Developer tool only:
// English-only on purpose, and it must be deleted or hidden before launch.
import type { Metadata } from "next";
import Icon from "@/components/shell/Icon";

export const metadata: Metadata = {
  title: "Design system",
  robots: { index: false, follow: false },
};

const swatches: { name: string; note: string }[] = [
  { name: "page", note: "Page background" },
  { name: "surface", note: "Cards, header" },
  { name: "surface2", note: "Inputs, pills" },
  { name: "line", note: "Borders" },
  { name: "ink", note: "Main text" },
  { name: "muted", note: "Secondary text" },
  { name: "brand", note: "Main colour" },
  { name: "brandsoft", note: "Light brand" },
  { name: "success", note: "Success" },
  { name: "warning", note: "Warning" },
  { name: "danger", note: "Danger" },
  { name: "adbg", note: "Ad background" },
];

function Section({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <div className="pc-sectionbar">
        <h2>{title}</h2>
        {note && <span className="type-small">{note}</span>}
      </div>
      {children}
    </section>
  );
}

export default function DesignPage() {
  return (
    <>
      <section className="pc-hero">
        <h1>Design system</h1>
        <p className="pc-hero-desc">
          Every colour, text style, button and card used by the site. Switch your device
          between light and dark mode to check both.
        </p>
        <p className="pc-hero-members">Source of truth: globals.css (tokens), shell.css, content.css</p>
      </section>

      <Section title="Colours" note="Tokens from globals.css">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          {swatches.map((s) => (
            <div key={s.name} className="card card-flat space-y-2 !p-3">
              <div className="h-12 rounded-xl border border-line" style={{ background: `var(--${s.name})` }} />
              <div className="type-body font-semibold">{s.name}</div>
              <div className="type-small">{s.note}</div>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Typography">
        <div className="card space-y-3">
          <p className="type-display">Display: page title</p>
          <p className="type-title">Title: section title</p>
          <p className="type-heading">Heading: post or card title</p>
          <p className="type-body">Body: normal reading text. Keep lines short and clear.</p>
          <p className="type-small">Small: who posted it, when, which community</p>
          <p className="type-label">Label: small uppercase tag</p>
        </div>
      </Section>

      <Section title="Buttons">
        <div className="card space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <button className="btn btn-primary">Primary</button>
            <button className="btn btn-secondary">Secondary</button>
            <button className="btn btn-ghost">Ghost</button>
            <button className="btn btn-danger">Danger</button>
            <button className="btn btn-primary" disabled>Disabled</button>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button className="btn btn-primary btn-sm">Small</button>
            <button className="btn btn-primary">Default</button>
            <button className="btn btn-primary btn-lg">Large</button>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button className="pc-btn"><Icon name="send" size={20} /> Home-style button</button>
            <button className="pc-btn pc-btn-sm">Small</button>
            <button className="pc-pill"><Icon name="up" size={20} /> 245 <Icon name="down" size={20} /></button>
            <button className="pc-pill"><Icon name="share" size={20} /> Pill</button>
          </div>
        </div>
      </Section>

      <Section title="Cards">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="card">
            <h3 className="type-heading">Normal card</h3>
            <p className="type-small mt-1">Used for posts, comments, boxes.</p>
          </div>
          <div className="card card-link">
            <h3 className="type-heading">Clickable card</h3>
            <p className="type-small mt-1">Lifts slightly when hovered.</p>
          </div>
          <div className="card card-ad sm:col-span-2">
            <span className="badge badge-ad">Ad</span>
            <p className="type-small mt-2">Ads always carry the Ad label and a different background.</p>
          </div>
        </div>
      </Section>

      <Section title="Avatars and community chips">
        <div className="card space-y-4">
          <div className="flex flex-wrap gap-3">
            {[1, 2, 3, 4, 5].map((n) => (
              <div key={n} className={`pc-avatar pc-a${n}`}>{"ABCDE"[n - 1]}</div>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            {[1, 2, 3, 4, 5].map((n) => (
              <span key={n} className={`ch-cat ch-cat-${n}`}>c/example-{n}</span>
            ))}
          </div>
        </div>
      </Section>

      <Section title="Notices (removal reasons, warnings)">
        <div className="space-y-3">
          <div className="notice notice-info">Info: neutral information.</div>
          <div className="notice notice-success">Success: it worked.</div>
          <div className="notice notice-warning">Warning: hidden pending review.</div>
          <div className="notice notice-danger">Danger: removed. Rule 2, with a reason and an appeal button.</div>
        </div>
      </Section>

      <Section title="Badges and inputs">
        <div className="card space-y-4">
          <div className="flex flex-wrap gap-2">
            <span className="badge">Default</span>
            <span className="badge badge-brand">Brand</span>
            <span className="badge badge-success">Success</span>
            <span className="badge badge-warning">Warning</span>
            <span className="badge badge-danger">Danger</span>
            <span className="badge badge-ad">Ad</span>
          </div>
          <input className="pc-field" placeholder="Text input (home style)" aria-label="Text input" />
          <textarea className="pc-field" rows={3} placeholder="Text area (home style)" aria-label="Text area" />
        </div>
      </Section>
    </>
  );
}
