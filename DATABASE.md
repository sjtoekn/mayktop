# MaykTop — Database guide (plain language)

The real definition is `web/prisma/schema.prisma`. This file explains it in words.
Update both whenever the design changes. Decided: 2026-11-07 (TODO 28).

## Rules the whole design follows
1. **Never hard-delete.** Posts and comments have a status; accounts are marked deleted/suspended; rules and communities are archived. Every link between tables refuses deletion (`onDelete: Restrict`).
2. **One audit log.** Every moderator/admin action is one row in `AuditLog` (who, what, when, which rule). This one table is both the "mod actions" and the "audit log" from the TODO list. The public Mod log page reads it.
3. **UTC times.** All dates are saved in UTC. The page converts them for the reader.
4. **Plain ids.** People have text ids (safe for sign-in later); posts, comments, communities have numbers (so `/post/1` keeps working).

## Tables
| Table | What it holds |
|---|---|
| `User` | Account: username, email, `role` (USER / MODERATOR / ADMIN), `status` (ACTIVE / SUSPENDED / DELETION_PENDING / DELETED), suspension fields (`suspensionKind` TEMPORARY / BAN, `suspendedUntil`, `suspensionNote`, `eraseAt`; rules in PROJECT.md 8c), language, timezone. |
| `Community` | A community (`slug`, name, description). Archived, not deleted. |
| `Rule` | The 3-5 rules of one community, in order. Archived, not deleted (old removals point to them). |
| `Membership` | Who joined which community; also marks a person as MODERATOR of that community. |
| `Post` | A post. `status`: VISIBLE / HIDDEN_PENDING_REVIEW / REMOVED, plus the rule and note shown when it is not visible. |
| `Comment` | A comment; replies point to their parent comment. Same status fields as `Post`. |
| `PostVote`, `CommentVote` | One vote (+1 or -1) per person per post/comment. |
| `Report` | A person reports a post or a comment, optionally naming the rule. Status OPEN → IN_REVIEW → ACTIONED / DISMISSED. |
| `AuditLog` | Every moderator/admin action. Rows are only added, never changed or removed. |
| `AdCampaign` | One ad + its booking (TODO 44): advertiser, contact email, title, text, optional image, https link, slot (SIDEBAR / FEED / SOCIAL_FEED), optional community, start/end date, flat price in cents, `status` (DRAFT / SUBMITTED / APPROVED / REJECTED / ACTIVE / PAUSED / ENDED), `paymentStatus` (UNPAID / PAID), and the review result (reviewer, `reviewRule`, `reviewNote`), and `endingSoonNoticeAt` (when the "ends soon" email was sent; once per ad). Never deleted. |
| `AdDailyStat` | Totals only: impressions and clicks of one ad on one UTC day. No user id, IP or cookie. |
| `Appeal` | "I disagree with this decision." Points to the audit-log row of that decision (a removed post / comment, a suspension / ban, or the `AD_REJECTED` row of a rejected ad). Status OPEN / ACCEPTED (decision reversed) / REJECTED (decision stands). |

## Two kinds of "moderator"
- `User.role` = what the account may do on the whole site (USER, MODERATOR, ADMIN).
- `Membership.role` = which communities that person moderates. This is what the Phase 3 limit ("one person cannot lead many large communities") will count.

## Checks the app must do (the database cannot)
- A `Report` fills exactly one of `postId` / `commentId`.
- A vote `value` is +1 or -1.
- Hiding or removing content needs a `ruleId` and a `reason` in the `AuditLog` row (Phase 3).
- An appeal is reviewed by someone other than the person who made the decision (Phase 3).
- Usernames are saved in lower case.

## Not in the database yet (on purpose)
- Sign-in tables (passwords, sessions, email verification, password reset): added in TODO 30-32, when the sign-in method is chosen.
- Profile extras shown on the sample profile page (verified tick, tagline, location, website, avatar, followers, interests, badges, saved posts): not on the TODO list yet. Decide at TODO 29 whether the profile page stays on sample data for now.
- Ad billing tables (wallet, card payments, refunds, disputes): TODO 46. For now payment is marked by an admin on `AdCampaign`.

## Ads (TODO 44, added 2026-11-07)
- **Flat monthly fee**, no per-click or per-impression price, no bidding.
- **Contextual only:** an ad is chosen by slot and (optionally) community, never by who is looking. Nothing about viewers is stored; `AdDailyStat` holds per-ad per-day totals only.
- An ad decision is one `AuditLog` row (`AD_APPROVED`, `AD_REJECTED`, `AD_PAUSED`, `AD_RESTORED`, `AD_PAID`, `AD_ENDED`, `AD_RESUBMITTED`; `targetType` AD, `targetId` = the ad id), so the existing `Appeal` table works for ads too.
- Checks the app must do: `destinationUrl` starts with `https://`; a REJECTED ad has `reviewRule` (a key from `adsConfig.policyRules` in `src/config/site.ts`) and a `reviewNote`; the reviewer is not the advertiser; `status` only moves forward as in ADS_PLAN.md; `AdDailyStat.date` is UTC midnight.

## Ad files and backup (Session 7)
Pictures and videos of ads are NOT in the database: they are files in `web/storage/ads/` (outside `public/`). A database backup alone loses them: back up the database AND that folder together (production plan: TODO 56). Ad decisions are not on the public mod log in v1 (they are only in `AuditLog`, shown to the advertiser and the admins).

## Ad formats (ADS_PLAN Session 3, migration `ad_formats`)
`AdCampaign.format` (`AdFormat`: TEXT / IMAGE / VIDEO, default TEXT, so older ads stay valid) and `AdCampaign.videoUrl` (VIDEO ads only; `imageUrl` is then the poster picture). The app keeps `imageUrl` / `videoUrl` to OUR OWN media addresses (`/api/ad/media/...`, Session 3b), never an outside address. Session 3b is built: the files are NOT in the database, they are in `web/storage/ads/` (setting `AD_MEDIA_DIR` can move the folder); back that folder up together with the database. No new table or column.
