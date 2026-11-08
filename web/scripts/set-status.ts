// Test helper (TODO 36): puts an account into a state so you can see how the site behaves.
// There are no staff tools for every case yet (Phase 3), so this is the way to try suspend / ban / deletion / erasure.
// Run from the web/ folder:
//   npm run db:status -- <username> <state>
// States: active | suspend | ban | deletion
//   deletion-due / ban-due:        the erase date was 1 hour ago, no warning email sent yet     -> `npm run purge` WARNS first
//   deletion-warned / ban-warned:  the erase date was 1 hour ago, the warning was sent 13 hours ago -> `npm run purge -- --run` ERASES (TODO 36e)
import { prisma } from "../src/lib/prisma";
import { SuspensionKind, UserStatus } from "../generated/prisma/client";

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

async function main() {
  const [username, state] = process.argv.slice(2);
  const states = ["active", "suspend", "ban", "deletion", "deletion-due", "ban-due", "deletion-warned", "ban-warned"];
  if (!username || !states.includes(state)) {
    console.log(`Usage: npm run db:status -- <username> <${states.join("|")}>`);
    process.exitCode = 1;
    return;
  }
  const now = new Date();
  const clear = {
    suspendedAt: null,
    suspendedUntil: null,
    suspensionKind: null,
    suspensionNote: null,
    eraseAt: null,
    eraseWarnedAt: null,
  };
  // For the erasure tests (36e): the erase date is already past, and maybe the warning email was already sent.
  const past = state.endsWith("-due") || state.endsWith("-warned");
  const eraseAt = new Date(now.getTime() + (past ? -HOUR : 7 * DAY));
  const eraseWarnedAt = state.endsWith("-warned") ? new Date(now.getTime() - 13 * HOUR) : null;
  const data =
    state === "active"
      ? { status: UserStatus.ACTIVE, ...clear }
      : state === "suspend"
        ? {
            ...clear,
            status: UserStatus.SUSPENDED,
            suspendedAt: now,
            suspendedUntil: new Date(now.getTime() + 3 * DAY),
            suspensionKind: SuspensionKind.TEMPORARY,
            suspensionNote: "Test suspension",
          }
        : state.startsWith("ban")
          ? {
              ...clear,
              status: UserStatus.SUSPENDED,
              suspendedAt: now,
              suspensionKind: SuspensionKind.BAN,
              suspensionNote: "Test ban",
              eraseAt,
              eraseWarnedAt,
            }
          : { ...clear, status: UserStatus.DELETION_PENDING, eraseAt, eraseWarnedAt };

  const result = await prisma.user.updateMany({ where: { username: username.toLowerCase() }, data });
  console.log(result.count === 1 ? `${username} is now: ${state}` : `No account named "${username}".`);
}

main()
  .catch((error) => {
    console.error("set-status FAILED:", error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
