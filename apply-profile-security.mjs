// apply-profile-security.mjs: puts patch-profile-security into the CURRENT project without overwriting other patches.
// Run in the project folder (where PROJECT.md is):   node apply-profile-security.mjs
// It is safe to run twice (it skips what is already there). Back up first.
import fs from "node:fs";
const read = (p) => fs.readFileSync(p, "utf8");
const write = (p, s) => fs.writeFileSync(p, s);
let problems = 0;
const done = (m) => console.log("OK    " + m);
const skip = (m) => console.log("SKIP  " + m);
const bad = (m) => { problems++; console.log("PROBLEM " + m); };

function edit(file, marker, anchor, make, where = "after") {
  if (!fs.existsSync(file)) return bad(`${file} not found`);
  const s = read(file);
  if (s.includes(marker)) return skip(`${file} (already done)`);
  const i = s.indexOf(anchor);
  if (i < 0) return bad(`${file}: the place to change was not found (send me this file)`);
  const at = where === "after" ? i + anchor.length : i;
  write(file, s.slice(0, at) + make + s.slice(at));
  done(file);
}

// 1. config
edit("web/src/config/site.ts", "export const profileConfig", "  deletePasswordWindowMinutes: 15,\n};\n", `
// Profile and sign-in security settings (patch-profile-security, PROVISIONAL numbers: change them here only).
//  - displayName / bio: the limits are counted in characters a person sees (an emoji is one).
//  - profileEdit: how often one person may save the profile; passwordChange / emailChange: how often one person may try
//    (every attempt counts, right or wrong, so a stolen login cannot guess the password).
export const profileConfig = {
  displayNameMax: 50,
  bioMax: 300,
  profileEdit: [{ max: 10, windowSeconds: 60 * 60 }],
  passwordChange: [{ max: 5, windowSeconds: 15 * 60 }],
  emailChange: [{ max: 3, windowSeconds: 60 * 60 }],
};
`);

// 2. auth: change email on
edit("web/src/lib/auth.ts", "changeEmail:", `      username: { type: "string", required: true, input: true },
    },
`, `    // Change email (patch-profile-security). Two steps: a link to the CURRENT email (approve), then a link to the NEW one
    // (verify, sent by sendVerificationEmail below). The email changes only after both. The form asks for the password too.
    changeEmail: {
      enabled: true,
      sendChangeEmailConfirmation: async ({ user, newEmail, url }) => {
        void sendEmail({
          to: user.email,
          subject: t("email.changeEmail.subject", { site: siteConfig.name }),
          text: t("email.changeEmail.body", { name: user.name || user.email, newEmail, url }),
        }).catch((error) => console.error("sendEmail failed:", error));
      },
    },
`);

// 3. two links on /settings
edit("web/src/app/(site)/settings/page.tsx", "/settings/profile", `        <ul className="st-list">\n`, `          <li>
            <Link href="/settings/profile" className="st-link">
              <b>{t("settings.profile.link")}</b>
              <span>{t("settings.profile.link.desc")}</span>
            </Link>
          </li>
          <li>
            <Link href="/settings/security" className="st-link">
              <b>{t("settings.security.link")}</b>
              <span>{t("settings.security.link.desc")}</span>
            </Link>
          </li>
`);

// 4. npm script
edit("web/package.json", "test:profile", `    "check:i18n": "tsx scripts/check-i18n.ts",\n`, `    "test:profile": "tsx scripts/test-profile.ts",\n`);

// 5. texts in six languages
const { keys, texts } = JSON.parse(read("profile-security-texts.json"));
const js = (x) => '"' + x.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n") + '"';
for (const lang of ["en", "es", "fr", "hi", "zh", "ar"]) {
  const file = `web/src/i18n/messages/${lang}.ts`;
  const s = read(file);
  if (s.includes('"settings.profile.title"')) { skip(file + " (already done)"); continue; }
  const end = lang === "en" ? "} as const;\n\nexport default" : "};\n\nexport default";
  const i = s.lastIndexOf(end);
  if (i < 0) { bad(`${file}: end of the list not found (send me this file)`); continue; }
  const add = keys.map((k, n) => `  "${k}": ${js(texts[lang][n])},\n`).join("");
  write(file, s.slice(0, i) + add + s.slice(i));
  done(file);
}

// 6. notes in the project documents
const section = fs.readFileSync("profile-security-notes.txt", "utf8").split("=====\n");
const [accountNote, changelogNote, projectNote] = section;
if (!read("ACCOUNT_RULES.md").includes("### 3.23 Profile, password and email")) { fs.appendFileSync("ACCOUNT_RULES.md", "\n" + accountNote); done("ACCOUNT_RULES.md"); } else skip("ACCOUNT_RULES.md");
if (!read("CHANGELOG.md").includes("patch-profile-security")) {
  const c = read("CHANGELOG.md"); const k = c.indexOf("\n## ");
  write("CHANGELOG.md", k < 0 ? c + "\n" + changelogNote : c.slice(0, k + 1) + "## " + c.slice(k + 4).split("\n")[0] + "\n\n" + changelogNote + c.slice(k + 4 + c.slice(k + 4).split("\n")[0].length + 1).replace(/^\n/, ""));
  done("CHANGELOG.md");
} else skip("CHANGELOG.md");
if (!read("PROJECT.md").includes("patch-profile-security")) {
  const p = read("PROJECT.md"); const a = "- [ ] Language switcher:";
  if (p.includes(a)) { write("PROJECT.md", p.replace(a, projectNote + a)); done("PROJECT.md"); } else bad("PROJECT.md: place not found (skippable)");
} else skip("PROJECT.md");

console.log(problems ? `\n${problems} problem(s): nothing else was changed; send me the lines above.` : "\nAll done. Next: cd web && npm run test:profile && npm run check:i18n && npm run lint && npm run build");
