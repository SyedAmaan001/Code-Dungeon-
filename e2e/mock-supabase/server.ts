/**
 * MOCK Supabase Auth (GoTrue-compatible subset) for end-to-end tests. NOT Supabase.
 *
 * It lets the real, production-built app exercise its Supabase code paths (PKCE OAuth
 * redirects, code exchange, cookie sessions, getUser verification, magic links, sign-out,
 * admin user deletion) over real HTTP without a Supabase project or Google account.
 * Tests that use it prove our integration code, not Supabase's or Google's behaviour.
 *
 * Endpoints (under /auth/v1): GET /authorize, POST /token?grant_type=pkce|refresh_token,
 * GET /user, POST /otp, GET /verify, POST /logout, DELETE /admin/users/:id.
 * Test controls (under /__mock): GET /outbox?email=, GET /users, GET /calls, POST /reset.
 */
import { randomBytes, randomUUID } from "node:crypto";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";

const PORT = Number(process.env.MOCK_SUPABASE_PORT ?? 54400);
const PUBLISHABLE = process.env.MOCK_SUPABASE_PUBLISHABLE_KEY ?? "sb_publishable_e2e_mock";
const SECRET = process.env.MOCK_SUPABASE_SECRET_KEY ?? "sb_secret_e2e_mock";
/** Mimics Supabase's redirect allow-list. */
const ALLOWED_REDIRECT = process.env.MOCK_SUPABASE_ALLOWED_REDIRECT ?? "http://localhost:3101/";

interface User {
  id: string;
  email: string;
  email_confirmed_at: string | null;
  provider: "google" | "email";
}

const state = {
  users: new Map<string, User>(), // by id
  codes: new Map<string, string>(), // auth code -> user id
  tokens: new Map<string, string>(), // access/refresh token -> user id
  outbox: [] as { email: string; link: string }[],
  calls: [] as string[],
};

const now = () => new Date().toISOString();
const token = () => randomBytes(24).toString("base64url");

function jwt(user: User): string {
  const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const exp = Math.floor(Date.now() / 1000) + 3600;
  return `${b64({ alg: "HS256", typ: "JWT" })}.${b64({ sub: user.id, email: user.email, exp, role: "authenticated", aud: "authenticated" })}.mock-signature`;
}

function userJson(u: User) {
  return {
    id: u.id,
    aud: "authenticated",
    role: "authenticated",
    email: u.email,
    email_confirmed_at: u.email_confirmed_at,
    app_metadata: { provider: u.provider, providers: [u.provider] },
    user_metadata: {},
    identities: [],
    created_at: now(),
    updated_at: now(),
  };
}

function session(u: User) {
  const access = jwt(u);
  const refresh = token();
  state.tokens.set(access, u.id);
  state.tokens.set(refresh, u.id);
  return {
    access_token: access,
    token_type: "bearer",
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    refresh_token: refresh,
    user: userJson(u),
  };
}

function findOrCreate(email: string, provider: User["provider"], confirmed: boolean): User {
  let user = [...state.users.values()].find((u) => u.email === email);
  if (!user) {
    user = { id: randomUUID(), email, email_confirmed_at: null, provider };
    state.users.set(user.id, user);
  }
  if (confirmed && !user.email_confirmed_at) user.email_confirmed_at = now();
  return user;
}

function issueCode(user: User) {
  const code = randomUUID();
  state.codes.set(code, user.id);
  return code;
}

function withParam(url: string, key: string, value: string) {
  const u = new URL(url);
  u.searchParams.set(key, value);
  return u.toString();
}

const send = (res: ServerResponse, status: number, body?: unknown, headers = {}) => {
  res.writeHead(status, { "content-type": "application/json", ...headers });
  res.end(body === undefined ? "" : JSON.stringify(body));
};
const fail = (res: ServerResponse, status: number, error_code: string, msg: string) =>
  send(res, status, { code: status, error_code, msg });

async function readBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  for await (const c of req) chunks.push(c as Buffer);
  const text = Buffer.concat(chunks).toString("utf8");
  if (!text) return {};
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return Object.fromEntries(new URLSearchParams(text));
  }
}

const bearer = (req: IncomingMessage) =>
  (req.headers.authorization ?? "").replace(/^Bearer\s+/i, "");

const html = (res: ServerResponse, body: string) => {
  res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
  res.end(
    `<!doctype html><html lang="en"><head><title>Mock Google sign-in</title></head><body>${body}</body></html>`,
  );
};

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://localhost:${PORT}`);
  const path = url.pathname;
  state.calls.push(`${req.method} ${path}`);

  // ---- test controls -------------------------------------------------------
  if (path === "/__mock/reset") {
    state.users.clear();
    state.codes.clear();
    state.tokens.clear();
    state.outbox.length = 0;
    state.calls.length = 0;
    return send(res, 200, { ok: true });
  }
  if (path === "/__mock/outbox") {
    const email = url.searchParams.get("email");
    const mail = [...state.outbox].reverse().find((m) => m.email === email);
    return mail ? send(res, 200, mail) : send(res, 404, { error: "no mail" });
  }
  if (path === "/__mock/users") return send(res, 200, [...state.users.values()]);
  if (path === "/__mock/calls") return send(res, 200, state.calls);
  if (path === "/") return send(res, 200, { mock: "supabase-auth" });

  // ---- Google OAuth (mocked consent screen) --------------------------------
  if (path === "/auth/v1/authorize" && req.method === "GET") {
    const redirectTo = url.searchParams.get("redirect_to") ?? "";
    if (url.searchParams.get("provider") !== "google")
      return fail(res, 400, "bad_provider", "unsupported provider");
    if (!redirectTo.startsWith(ALLOWED_REDIRECT))
      return fail(res, 400, "bad_redirect", "redirect_to not allowed");
    if (!url.searchParams.get("code_challenge")) return fail(res, 400, "no_pkce", "PKCE required");
    return html(
      res,
      `<main><h1>Mock Google sign-in</h1><p>Test double for end-to-end tests. Not Google.</p>
       <form method="get" action="/__mock/google-consent">
         <input type="hidden" name="redirect_to" value="${redirectTo.replace(/"/g, "&quot;")}">
         <label>Google account email <input name="email" type="email" required></label>
         <label><input type="checkbox" name="verified" checked> Email verified by Google</label>
         <button type="submit">Continue as this Google user</button>
       </form></main>`,
    );
  }
  if (path === "/__mock/google-consent") {
    const email = url.searchParams.get("email") ?? "";
    const redirectTo = url.searchParams.get("redirect_to") ?? "";
    if (!redirectTo.startsWith(ALLOWED_REDIRECT))
      return fail(res, 400, "bad_redirect", "redirect_to not allowed");
    const user = findOrCreate(email, "google", url.searchParams.get("verified") === "on");
    res.writeHead(303, { location: withParam(redirectTo, "code", issueCode(user)) });
    return res.end();
  }

  // ---- token exchange / refresh --------------------------------------------
  if (path === "/auth/v1/token" && req.method === "POST") {
    if (req.headers.apikey !== PUBLISHABLE) return fail(res, 401, "bad_key", "invalid apikey");
    const body = await readBody(req);
    const grant = url.searchParams.get("grant_type");
    if (grant === "pkce") {
      const userId = state.codes.get(String(body.auth_code ?? ""));
      if (!userId || !body.code_verifier)
        return fail(res, 400, "flow_state_not_found", "invalid flow state");
      state.codes.delete(String(body.auth_code));
      const user = state.users.get(userId);
      return user ? send(res, 200, session(user)) : fail(res, 400, "user_not_found", "user gone");
    }
    if (grant === "refresh_token") {
      const userId = state.tokens.get(String(body.refresh_token ?? ""));
      const user = userId && state.users.get(userId);
      return user
        ? send(res, 200, session(user))
        : fail(res, 400, "refresh_token_not_found", "invalid refresh token");
    }
    return fail(res, 400, "unsupported_grant_type", "unsupported grant");
  }

  // ---- the user behind a token (what getUser() verifies) --------------------
  if (path === "/auth/v1/user" && req.method === "GET") {
    const userId = state.tokens.get(bearer(req));
    const user = userId && state.users.get(userId);
    return user ? send(res, 200, userJson(user)) : fail(res, 401, "bad_jwt", "invalid JWT");
  }

  // ---- magic link ------------------------------------------------------------
  if (path === "/auth/v1/otp" && req.method === "POST") {
    const body = await readBody(req);
    const email = String(body.email ?? "");
    const redirectTo = url.searchParams.get("redirect_to") ?? "";
    if (!redirectTo.startsWith(ALLOWED_REDIRECT))
      return fail(res, 400, "bad_redirect", "redirect_to not allowed");
    const user = findOrCreate(email, "email", false);
    const t = token();
    state.codes.set(`otp:${t}`, user.id);
    state.outbox.push({
      email,
      link: `http://localhost:${PORT}/auth/v1/verify?token=${t}&type=magiclink&redirect_to=${encodeURIComponent(redirectTo)}`,
    });
    return send(res, 200, {});
  }
  if (path === "/auth/v1/verify" && req.method === "GET") {
    const t = url.searchParams.get("token") ?? "";
    const redirectTo = url.searchParams.get("redirect_to") ?? "";
    const userId = state.codes.get(`otp:${t}`);
    const user = userId && state.users.get(userId);
    if (!user || !redirectTo.startsWith(ALLOWED_REDIRECT)) {
      res.writeHead(303, { location: `${ALLOWED_REDIRECT}sign-in?error=link` });
      return res.end();
    }
    state.codes.delete(`otp:${t}`);
    user.email_confirmed_at ??= now(); // opening the link confirms the address
    res.writeHead(303, { location: withParam(redirectTo, "code", issueCode(user)) });
    return res.end();
  }

  // ---- sign-out ----------------------------------------------------------------
  if (path === "/auth/v1/logout" && req.method === "POST") {
    const userId = state.tokens.get(bearer(req));
    for (const [t, id] of state.tokens) if (id === userId) state.tokens.delete(t);
    return send(res, 204);
  }

  // ---- admin: delete a user (secret key only) --------------------------------
  const del = /^\/auth\/v1\/admin\/users\/([0-9a-f-]{36})$/.exec(path);
  if (del && req.method === "DELETE") {
    if (req.headers.apikey !== SECRET || bearer(req) !== SECRET)
      return fail(res, 401, "not_admin", "admin key required");
    const user = state.users.get(del[1]!);
    if (!user) return fail(res, 404, "user_not_found", "User not found");
    state.users.delete(user.id);
    for (const [t, id] of state.tokens) if (id === user.id) state.tokens.delete(t);
    return send(res, 200, userJson(user));
  }

  return fail(res, 404, "not_found", `mock has no ${req.method} ${path}`);
});

server.listen(PORT, () => console.log(`mock supabase auth on :${PORT}`));
