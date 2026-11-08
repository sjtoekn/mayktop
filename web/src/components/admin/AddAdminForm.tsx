"use client";
// "Add admin" box on /admin/team: type a username, press the button. Text comes in as props (translated on the server).
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addAdmin } from "@/app/admin/team/actions";

export type AddAdminText = {
  label: string;
  button: string;
  working: string;
  done: string;
  errors: Record<string, string>; // by staff error code, plus "other"
};

export default function AddAdminForm({ text }: { text: AddAdminText }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (pending || name.trim().length === 0) return;
    setError(null);
    setDone(false);
    startTransition(async () => {
      const result = await addAdmin(name);
      if ("error" in result) {
        setError(text.errors[result.error] ?? text.errors.other);
        return;
      }
      setName("");
      setDone(true);
      router.refresh();
    });
  }

  return (
    <form onSubmit={submit} className="ad-form">
      <label className="sf-label" htmlFor="ad-newadmin">{text.label}</label>
      <input
        id="ad-newadmin"
        className="pc-field"
        type="text"
        value={name}
        maxLength={100}
        autoComplete="off"
        autoCapitalize="none"
        onChange={(e) => setName(e.target.value)}
      />
      {error && <div className="notice notice-danger" role="alert">{error}</div>}
      {done && <div className="notice notice-success" role="status">{text.done}</div>}
      <div className="ad-actionRow">
        <button type="submit" className="btn btn-primary" disabled={pending || name.trim().length === 0}>
          {pending ? text.working : text.button}
        </button>
      </div>
    </form>
  );
}
