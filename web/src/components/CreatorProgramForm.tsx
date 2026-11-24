"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  joinCreatorProgram,
  saveCreatorPayout,
  type CreatorErrorCode,
} from "@/app/(site)/settings/creator/actions";

// "Join the creator program" and "Payout settings" on /settings/creator (TODO 12, S6). All visible text comes in as props
// (translated on the server), so this file has no words.
//   mode "join": terms + country + method (+ details, optional). mode "edit": the same, and the password is asked again.
export type CreatorFormText = {
  terms: string;
  country: string;
  chooseCountry: string;
  method: string;
  methods: Record<string, string>; // PAYPAL / BANK_LK
  paypalEmail: string;
  bankName: string;
  branch: string;
  holderName: string;
  accountNumber: string;
  keepHint: string; // shown under the details when something is already saved
  password: string;
  submitJoin: string;
  submitSave: string;
  working: string;
  joined: string;
  saved: string;
  notOpen: string; // the note for a country without payouts yet
  noMethodNeeded: string;
  errors: Record<CreatorErrorCode, string>;
};

export type CreatorFormProps = {
  mode: "join" | "edit";
  text: CreatorFormText;
  countries: { code: string; name: string }[];
  methodsByCountry: Record<string, string[]>; // only the payout countries
  initial: { country: string; method: string };
  hasSavedDetails: boolean;
};

export default function CreatorProgramForm({ mode, text, countries, methodsByCountry, initial, hasSavedDetails }: CreatorFormProps) {
  const router = useRouter();
  const [accept, setAccept] = useState(false);
  const [country, setCountry] = useState(initial.country);
  const [method, setMethod] = useState(initial.method);
  const [paypal, setPaypal] = useState("");
  const [bank, setBank] = useState({ bankName: "", branch: "", holderName: "", accountNumber: "" });
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const methods = methodsByCountry[country] ?? [];
  const chosenMethod = methods.includes(method) ? method : methods[0] ?? "";

  function onCountry(code: string) {
    setCountry(code);
    setMessage(null);
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (pending) return;
    setMessage(null);
    const input = { acceptTerms: accept, country, method: chosenMethod, paypalEmail: paypal, bank, password };
    startTransition(async () => {
      const result = mode === "join" ? await joinCreatorProgram(input) : await saveCreatorPayout(input);
      setPassword("");
      if ("error" in result) {
        setMessage({ kind: "error", text: text.errors[result.error] });
        return;
      }
      setPaypal("");
      setBank({ bankName: "", branch: "", holderName: "", accountNumber: "" });
      setMessage({ kind: "ok", text: mode === "join" ? text.joined : text.saved });
      router.refresh();
    });
  }

  const set = (key: keyof typeof bank) => (e: React.ChangeEvent<HTMLInputElement>) => setBank((b) => ({ ...b, [key]: e.target.value }));

  return (
    <form className="cr-form" onSubmit={onSubmit} autoComplete="off">
      <label className="cr-field">
        <span>{text.country}</span>
        <select value={country} onChange={(e) => onCountry(e.target.value)} required disabled={pending}>
          <option value="">{text.chooseCountry}</option>
          {countries.map((c) => (
            <option key={c.code} value={c.code}>{c.name}</option>
          ))}
        </select>
      </label>

      {country !== "" && methods.length === 0 && <p className="notice cr-note" role="note">{text.notOpen}</p>}

      {methods.length > 0 && (
        <>
          <label className="cr-field">
            <span>{text.method}</span>
            <select value={chosenMethod} onChange={(e) => setMethod(e.target.value)} disabled={pending}>
              {methods.map((m) => (
                <option key={m} value={m}>{text.methods[m] ?? m}</option>
              ))}
            </select>
          </label>

          {chosenMethod === "PAYPAL" && (
            <label className="cr-field">
              <span>{text.paypalEmail}</span>
              <input type="email" value={paypal} onChange={(e) => setPaypal(e.target.value)} maxLength={254} disabled={pending} autoComplete="off" />
            </label>
          )}
          {chosenMethod === "BANK_LK" && (
            <>
              <label className="cr-field"><span>{text.bankName}</span><input value={bank.bankName} onChange={set("bankName")} maxLength={80} disabled={pending} /></label>
              <label className="cr-field"><span>{text.branch}</span><input value={bank.branch} onChange={set("branch")} maxLength={80} disabled={pending} /></label>
              <label className="cr-field"><span>{text.holderName}</span><input value={bank.holderName} onChange={set("holderName")} maxLength={80} disabled={pending} /></label>
              <label className="cr-field"><span>{text.accountNumber}</span><input value={bank.accountNumber} onChange={set("accountNumber")} inputMode="numeric" maxLength={30} disabled={pending} autoComplete="off" /></label>
            </>
          )}
          {hasSavedDetails && <p className="pc-meta">{text.keepHint}</p>}
        </>
      )}

      {mode === "join" && (
        <label className="cr-check">
          <input type="checkbox" checked={accept} onChange={(e) => setAccept(e.target.checked)} disabled={pending} />
          <span>{text.terms}</span>
        </label>
      )}

      {mode === "edit" && (
        <label className="cr-field">
          <span>{text.password}</span>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} maxLength={128} required disabled={pending} autoComplete="current-password" />
        </label>
      )}

      <div className="cr-actions">
        <button type="submit" className="pc-btn pc-btn-sm" disabled={pending || country === "" || (mode === "join" && !accept)}>
          {pending ? text.working : mode === "join" ? text.submitJoin : text.submitSave}
        </button>
        {message && (
          <span className={message.kind === "error" ? "notice notice-danger" : "pc-meta"} role={message.kind === "error" ? "alert" : "status"}>
            {message.text}
          </span>
        )}
      </div>
    </form>
  );
}
