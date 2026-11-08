// Test: Notification settings (SOCIAL_TODO B8, patch-social-notif-settings). Run:  npm run test:notification-settings
// Needs no database: the rules are run against a small in-memory stand-in for the database.
import assert from "node:assert/strict";
import { applyNotificationSettings, eraseNotificationSettings } from "../src/lib/notification-settings";
import { cleanEnabledTypes, enabledTypesFrom, NOTIFICATION_SETTING_TYPES, offTypesFor } from "../src/lib/notification-settings-rules";
import { FOLLOW_NOTIFICATION } from "../src/lib/social-follow";
import { REPLY_NOTIFICATION } from "../src/lib/social-reply";
import { REPOST_NOTIFICATION } from "../src/lib/social-repost";
import { MENTION_NOTIFICATION } from "../src/lib/social-tag-sync";
import { socialLimits } from "../src/config/site";
import en from "../src/i18n/messages/en";
import es from "../src/i18n/messages/es";
import fr from "../src/i18n/messages/fr";
import zh from "../src/i18n/messages/zh";
import hi from "../src/i18n/messages/hi";
import ar from "../src/i18n/messages/ar";

function ok(name: string) { console.log("OK  " + name); }

type Row = { userId: string; type: string };
function fakeDb() {
  const rows: Row[] = [];
  const client = {
    notificationOptOut: {
      deleteMany: async ({ where }: { where: { userId: string } }) => {
        let count = 0;
        for (let i = rows.length - 1; i >= 0; i--) if (rows[i].userId === where.userId) { rows.splice(i, 1); count++; }
        return { count };
      },
      create: async ({ data }: { data: Row }) => {
        if (rows.some((r) => r.userId === data.userId && r.type === data.type)) throw new Error("unique");
        rows.push({ ...data });
        return data;
      },
    },
  };
  return { db: client as unknown as Parameters<typeof applyNotificationSettings>[0], rows };
}

async function main() {
  // 1. The setting types are exactly the types the code creates and shows
  assert.deepEqual([...NOTIFICATION_SETTING_TYPES].sort(), [FOLLOW_NOTIFICATION, "SOCIAL_POST_LIKE", REPOST_NOTIFICATION, REPLY_NOTIFICATION, MENTION_NOTIFICATION].sort());
  ok("setting types = the notification types the site creates");

  // 2. Cleaning
  assert.deepEqual(cleanEnabledTypes(["SOCIAL_MENTION", "FOLLOW", "FOLLOW"]), ["FOLLOW", "SOCIAL_MENTION"]);
  assert.deepEqual(cleanEnabledTypes([]), []);
  for (const bad of [null, undefined, "FOLLOW", {}, [1], ["NOPE"], ["FOLLOW", "other"], Array(50).fill("FOLLOW")]) assert.equal(cleanEnabledTypes(bad), null, String(bad));
  ok("input: only known types; anything else is refused whole");

  // 3. On / off lists
  assert.deepEqual(offTypesFor([]), [...NOTIFICATION_SETTING_TYPES]);
  assert.deepEqual(offTypesFor([...NOTIFICATION_SETTING_TYPES]), []);
  assert.deepEqual(enabledTypesFrom([]), [...NOTIFICATION_SETTING_TYPES]); // default: everything on
  assert.deepEqual(enabledTypesFrom(["SOCIAL_POST_LIKE", "UNKNOWN_FUTURE"]), NOTIFICATION_SETTING_TYPES.filter((t) => t !== "SOCIAL_POST_LIKE"));
  ok("everything is on by default; only the off types are stored; unknown stored values are ignored");

  // 4. Saving
  {
    const { db, rows } = fakeDb();
    assert.deepEqual(await applyNotificationSettings(db, { userId: "a", enabled: ["FOLLOW", "SOCIAL_POST_REPLY"] }), { ok: true, enabled: ["FOLLOW", "SOCIAL_POST_REPLY"] });
    assert.deepEqual(rows.filter((r) => r.userId === "a").map((r) => r.type).sort(), ["SOCIAL_MENTION", "SOCIAL_POST_LIKE", "SOCIAL_POST_REPOST"]);
    await applyNotificationSettings(db, { userId: "b", enabled: [] });
    assert.equal(rows.filter((r) => r.userId === "b").length, 5);
    // same list twice: the same rows
    await applyNotificationSettings(db, { userId: "a", enabled: ["FOLLOW", "SOCIAL_POST_REPLY"] });
    assert.equal(rows.filter((r) => r.userId === "a").length, 3);
    // everything on again: nothing stored; another person untouched
    await applyNotificationSettings(db, { userId: "a", enabled: [...NOTIFICATION_SETTING_TYPES] });
    assert.equal(rows.filter((r) => r.userId === "a").length, 0);
    assert.equal(rows.filter((r) => r.userId === "b").length, 5);
    ok("saving replaces the person's list only; same list twice changes nothing; all on stores nothing");

    assert.deepEqual(await applyNotificationSettings(db, { userId: "a", enabled: ["BAD"] }), { ok: false, reason: "error" });
    assert.deepEqual(await applyNotificationSettings(db, { userId: "", enabled: [] }), { ok: false, reason: "error" });
    assert.equal(rows.filter((r) => r.userId === "b").length, 5);
    ok("bad input is an error and changes nothing");

    assert.equal(await eraseNotificationSettings(db, "b"), 5);
    assert.equal(await eraseNotificationSettings(db, "b"), 0);
    assert.equal(rows.length, 0);
    ok("final erasure removes the settings; safe to run twice");
  }

  // 5. Limits and texts
  assert.ok(socialLimits.notificationSettings.length >= 1 && socialLimits.notificationSettings.every((r) => r.max > 0 && r.windowSeconds > 0));
  const keys = ["link", "link.desc", "title", "intro", "type.follow", "type.like", "type.repost", "type.reply", "type.mention", "save", "saving", "saved", "login", "toomany", "error", "note", "back"].map((k) => `settings.notif.${k}`);
  for (const [name, messages] of Object.entries({ en, es, fr, zh, hi, ar })) {
    for (const key of keys) assert.ok(typeof (messages as Record<string, unknown>)[key] === "string", `${name} ${key}`);
  }
  ok("rate limit is set; all 17 texts exist in 6 languages");

  console.log("\nAll notification-settings tests passed.");
}

main().catch((error) => { console.error(error); process.exit(1); });
