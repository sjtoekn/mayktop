"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { logIn, signUp, type AuthErrorCode } from "@/app/(site)/auth/actions";

// All visible text comes in as props (translated on the server), so this file has no words.
export type AuthText = {
  loginTitle: string;
  signupTitle: string;
  email: string;
  password: string;
  username: string;
  usernameHint: string;
  name: string;
  loginSubmit: string;
  signupSubmit: string;
  working: string;
  loginNew: string; // "New here?"
  forgot: string; // "Forgot your password?"
  signupHave: string; // "Already have an account?"
  signupLink: string; // "Sign up"
  loginLink: string; // "Log in"
  errors: Record<AuthErrorCode, string>;
};

/** The log-in form (mode "login") and the sign-up form (mode "signup"). */
export default function AuthForm({ mode, text }: { mode: "login" | "signup"; text: AuthText }) {
  const signup = mode === "signup";
  const [username, setUsername] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<AuthErrorCode | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (pending) return;
    setError(null);
    startTransition(async () => {
      // On success the action sends the browser to the home page and returns nothing.
      const result = signup
        ? await signUp({ username, name, email, password })
        : await logIn({ email, password });
      if (result?.error) setError(result.error);
    });
  }

  return (
    <form onSubmit={onSubmit} className="sf-wrap">
      <section className="card sf-card">
        <h1 className="sf-h1">{signup ? text.signupTitle : text.loginTitle}</h1>

        {signup && (
          <>
            <label className="sf-label" htmlFor="au-username">{text.username}</label>
            <input
              id="au-username"
              className="pc-field"
              value={username}
              maxLength={20}
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              required
              onChange={(e) => setUsername(e.target.value)}
            />
            <p className="type-small">{text.usernameHint}</p>

            <label className="sf-label" htmlFor="au-name">{text.name}</label>
            <input
              id="au-name"
              className="pc-field"
              value={name}
              maxLength={50}
              autoComplete="name"
              onChange={(e) => setName(e.target.value)}
            />
          </>
        )}

        <label className="sf-label" htmlFor="au-email">{text.email}</label>
        <input
          id="au-email"
          type="email"
          className="pc-field"
          value={email}
          maxLength={254}
          autoComplete="email"
          required
          onChange={(e) => setEmail(e.target.value)}
        />

        <label className="sf-label" htmlFor="au-password">{text.password}</label>
        <input
          id="au-password"
          type="password"
          className="pc-field"
          value={password}
          maxLength={128}
          minLength={signup ? 8 : undefined}
          autoComplete={signup ? "new-password" : "current-password"}
          required
          onChange={(e) => setPassword(e.target.value)}
        />

        {!signup && (
          <p className="type-small">
            <Link href="/forgot-password">{text.forgot}</Link>
          </p>
        )}

        {error && <div className="notice notice-danger" role="alert">{text.errors[error]}</div>}

        <div className="pc-actions">
          <button type="submit" className="pc-btn" disabled={pending}>
            {pending ? text.working : signup ? text.signupSubmit : text.loginSubmit}
          </button>
        </div>

        <p className="type-small">
          {signup ? text.signupHave : text.loginNew}{" "}
          <Link href={signup ? "/login" : "/signup"}>{signup ? text.loginLink : text.signupLink}</Link>
        </p>
      </section>
    </form>
  );
}
