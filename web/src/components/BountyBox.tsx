"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { createBounty } from "@/app/(site)/post/[id]/qa-actions";

// All visible text comes in as props (translated on the server). {need} and {min}/{max} are filled in here.
export type BountyText = {
  title: string;
  help: string;
  amount: string;
  submit: string;
  saving: string;
  error: string;
  errorAmount: string; // contains {min} and {max}
  errorReputation: string; // contains {need}
  errorPoints: string;
};

/** "Offer a bounty" on a question (SITE_PLAN B6). Shown ONLY to the person who asked it; the server checks everything again. */
export default function BountyBox({
  postId,
  postAuthor,
  min,
  max,
  need,
  text,
}: {
  postId: number;
  postAuthor: string;
  min: number;
  max: number;
  need: number; // the reputation a person needs to offer one
  text: BountyText;
}) {
  const { data: session } = authClient.useSession();
  const router = useRouter();
  const [amount, setAmount] = useState(String(min));
  const [failed, setFailed] = useState<string | false>(false);
  const [pending, startTransition] = useTransition();

  if (!session || !postAuthor || session.user.username !== postAuthor) return null;

  const value = Number(amount);
  const valid = Number.isInteger(value) && value >= min && value <= max;

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (pending || !valid) return;
    setFailed(false);
    startTransition(async () => {
      const result = await createBounty({ postId, amount: value });
      if ("error" in result) {
        setFailed(result.reason ?? "error");
        return;
      }
      router.refresh();
    });
  }

  const message =
    failed === false
      ? ""
      : failed === "amount"
        ? text.errorAmount.replace("{min}", String(min)).replace("{max}", String(max))
        : failed === "reputation"
          ? text.errorReputation.replace("{need}", String(need))
          : failed === "points"
            ? text.errorPoints
            : text.error;

  return (
    <form onSubmit={onSubmit} className="card sf-card bn-box">
      <h2 className="sf-h2">{text.title}</h2>
      <p className="sf-intro">{text.help}</p>
      <div className="bn-row">
        <label className="sf-label" htmlFor={`bn-amount-${postId}`}>{text.amount}</label>
        <input
          id={`bn-amount-${postId}`}
          className="pc-field bn-amount"
          type="number"
          inputMode="numeric"
          min={min}
          max={max}
          step={1}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
        <button type="submit" className="btn btn-primary" disabled={pending || !valid}>
          {pending ? text.saving : text.submit}
        </button>
      </div>
      {message && <div className="notice notice-danger" role="alert">{message}</div>}
    </form>
  );
}
