// Better Auth's own endpoints (session check, sign-out, and later Google / GitHub callbacks).
import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "@/lib/auth";

export const { GET, POST } = toNextJsHandler(auth);
