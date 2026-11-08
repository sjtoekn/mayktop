"use client";

// Remembers the logged-in person's own votes (the highlighted arrows).
//
// The pages themselves are cached and shared, so they contain no personal data. Every
// <VoteButtons> registers itself here; after a short moment ONE request (getMyVotes) loads the
// person's votes for all arrows on the page. Log in or out and the list is reloaded / emptied.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { authClient } from "@/lib/auth-client";
import { getMyVotes } from "@/app/(site)/vote/my-votes";

export type MyVote = -1 | 0 | 1;
type Target = "post" | "comment";

type MyVotesApi = {
  get: (target: Target, id: number) => MyVote;
  set: (target: Target, id: number, value: MyVote) => void;
  register: (target: Target, id: number) => void;
};

const MyVotesContext = createContext<MyVotesApi | null>(null);

// Used when a component is shown outside the provider: no highlight, nothing to load.
const noVotes: MyVotesApi = { get: () => 0, set: () => {}, register: () => {} };

export function useMyVotes(): MyVotesApi {
  return useContext(MyVotesContext) ?? noVotes;
}

const keyOf = (target: Target, id: number) => `${target}:${id}`;

export default function MyVotesProvider({ children }: { children: React.ReactNode }) {
  const { data: session, isPending } = authClient.useSession();
  // undefined = still asking who is logged in, null = nobody, string = the person's id
  const userId: string | null | undefined = isPending ? undefined : (session?.user.id ?? null);

  const [saved, setSaved] = useState<{ userId: string | null; map: Record<string, MyVote> }>({
    userId: null,
    map: {},
  });

  const userRef = useRef<string | null | undefined>(undefined);
  const wanted = useRef(new Set<string>()); // every arrow that asked for its state
  const loaded = useRef<{ user: string | null | undefined; keys: Set<string> }>({
    user: undefined,
    keys: new Set(),
  });
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flush = useCallback(async () => {
    const user = userRef.current;
    if (user === undefined) return; // wait: the browser has not said who is logged in yet
    if (loaded.current.user !== user) loaded.current = { user, keys: new Set() };
    if (user === null) return; // nobody logged in: there are no votes to load

    const missing = [...wanted.current].filter((k) => !loaded.current.keys.has(k));
    if (missing.length === 0) return;
    missing.forEach((k) => loaded.current.keys.add(k));

    const idsOf = (prefix: Target) =>
      missing.filter((k) => k.startsWith(`${prefix}:`)).map((k) => Number(k.slice(prefix.length + 1)));
    try {
      const result = await getMyVotes({ posts: idsOf("post"), comments: idsOf("comment") });
      if (result.userId !== userRef.current) return; // the person changed while we were asking
      setSaved((prev) => {
        const map = prev.userId === result.userId ? { ...prev.map } : {};
        for (const k of missing) {
          const [kind, rawId] = k.split(":");
          const mine = (kind === "post" ? result.posts : result.comments)[Number(rawId)];
          map[k] = mine === 1 ? 1 : mine === -1 ? -1 : 0;
        }
        return { userId: result.userId, map };
      });
    } catch {
      missing.forEach((k) => loaded.current.keys.delete(k)); // allow a retry on the next mount
    }
  }, []);

  const schedule = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void flush(), 0); // one request for all arrows mounted together
  }, [flush]);

  // Log in / log out (or the first answer from the browser): load again for the new person.
  useEffect(() => {
    userRef.current = userId;
    schedule();
  }, [userId, schedule]);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const register = useCallback(
    (target: Target, id: number) => {
      wanted.current.add(keyOf(target, id));
      schedule();
    },
    [schedule],
  );

  const set = useCallback((target: Target, id: number, value: MyVote) => {
    const user = userRef.current;
    if (typeof user !== "string") return;
    loaded.current.keys.add(keyOf(target, id));
    setSaved((prev) => ({
      userId: user,
      map: { ...(prev.userId === user ? prev.map : {}), [keyOf(target, id)]: value },
    }));
  }, []);

  const api = useMemo<MyVotesApi>(
    () => ({
      // Only the current person's saved votes count (after a log out nothing is highlighted).
      get: (target, id) =>
        typeof userId === "string" && saved.userId === userId ? (saved.map[keyOf(target, id)] ?? 0) : 0,
      set,
      register,
    }),
    [userId, saved, set, register],
  );

  return <MyVotesContext.Provider value={api}>{children}</MyVotesContext.Provider>;
}
