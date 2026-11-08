// The one-line helper the Social actions use: `limitsFor(rules, viewer)` = the normal rules, or the stricter ones
// while the person's account is new (src/lib/new-account-rules.ts, numbers in `newAccountLimits` in site.ts).
import { newAccountLimits } from "@/config/site";
import { rulesForAccount } from "@/lib/new-account-rules";
import type { RateRule } from "@/lib/social-limits";

export function limitsFor(rules: RateRule[], person: { createdAt: Date }): RateRule[] {
  return rulesForAccount(rules, person.createdAt.getTime(), newAccountLimits);
}
