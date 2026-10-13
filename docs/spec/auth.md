# Auth, sign-in and import tokens

Resolves [Decide auth, sign-in and import tokens](https://github.com/Ed-Barnes937/FindersEaters/issues/20). Builds on [Choose the stack and hosting](https://github.com/Ed-Barnes937/FindersEaters/issues/6) (`docs/adr/0001-stack-and-hosting.md`), the ownership rules in `docs/spec/data-model.md` (section 3) and the iPhone Shortcut findings in `docs/ideation/research/ios-import-and-platform.md`. Feeds [Specify the import capture contract](https://github.com/Ed-Barnes937/FindersEaters/issues/24), the V0.1 spec (`docs/spec/v0.1.md`) and [Write the Claude Design brief](https://github.com/Ed-Barnes937/FindersEaters/issues/17).

Every decision here was made by the agent under the owner's standing rules. None was escalated: V0.1 has one household and a handful of users, so even swapping the auth library later means migrating two or three accounts (and asking them to set a new password), and every V1 addition below (email delivery, passkeys, sharing invites) is additive.

## 1. Shape in one paragraph

People sign in with **email and password** through **Better Auth**, mounted in Fastify with its Drizzle adapter, and get a long-lived, sliding, cookie session. There is **no public sign-up**: households and users are created by a CLI command in the app image. Every tRPC request resolves its session to a user, and the user to their single household through `household_user`, once, in the request context. Handlers never take a household id from input. The iPhone Shortcut instead sends a per-device **import token** (a random secret, stored only as a hash) as a bearer header to `POST /api/v1/import`. That route accepts only import tokens, never cookies, and a token can do nothing but import into its household.

## 2. Auth library: Better Auth, app-owned

- **Better Auth**, as sprout uses it in HomeOfEd (HomeOfEd ADR 0012): Fastify handler at `/api/auth/*`, Drizzle adapter, its `user`, `session`, `account` and `verification` tables in the app's single Drizzle schema and migration journal (generated with the rest, not by Better Auth's own migrator). `household_user.user_id` and the `created_by` columns are real foreign keys to `user.id`.
- **Ids**: Better Auth's `advanced.database.generateId` is set to the app's UUIDv7 generator, so auth tables follow the data model's id rule.
- **Copy the pattern, not the package**: the composition root resolves identity once and handlers only see a typed principal (section 5). Swapping Better Auth later, or adopting a HomeOfEd central identity service if one ever exists, changes that one seam.
- **Built-in rate limiting on** for the auth routes, with memory storage (one Fly Machine).
- **Secrets**: `BETTER_AUTH_SECRET` (the "auth secret" ADR 0001 already lists) and `BETTER_AUTH_URL` per environment, via `fly secrets`. Staging has its own database and therefore its own users.

Considered: a hand-rolled session table (rejected: password hashing, session rotation and rate limiting are exactly what a maintained library should own), and Lucia-style DIY (deprecated as a library).

## 3. Sign-in method: email and password

Chosen because it is the only option that works inside an installed iOS Home Screen web app with no extra vendor:

| Option | Verdict | Why |
| --- | --- | --- |
| **Email + password** | **V0.1** | Works entirely inside the PWA. iCloud Keychain and other password managers fill and generate it. No email vendor needed. |
| Magic link | Rejected | The link opens in Safari, whose storage is isolated from the installed web app, so the session lands in the wrong cookie jar. Also needs an email vendor. |
| Google or Apple OAuth | Rejected | Same storage split on the redirect leg in a standalone PWA; Sign in with Apple needs the paid developer account; redirect URIs must be redone at the product-domain move. |
| Passkeys | Later | Work in the PWA, but a passkey is bound to its domain. V0.1 runs on a homeofed.com subdomain and must move to a product domain before V1, which would strand every passkey. Add the Better Auth passkey plugin after the move, additively. |
| Email one-time code | Later | Works in the PWA, but needs an email vendor and DNS setup for little V0.1 gain. The natural V1 route for password reset and invites. |

Rules:

- Password length 12 to 128 characters (Better Auth defaults for hashing, scrypt). No composition rules.
- The sign-in form uses `autocomplete="username"` and `autocomplete="current-password"`; the CLI-issued first password is changed in Settings (`new-password`), so Keychain can generate and store a strong one.
- Better Auth's `emailAndPassword.disableSignUp` is on. The sign-in screen has no "Create account" link, and "Forgot password?" says to ask the household's admin (V0.1 recovery is the CLI, section 4).
- **Sign in inside the installed app** on iPhone: the Home Screen app does not share cookies with Safari. When the sign-in screen is opened in iOS Safari rather than the installed app, it says so ("Add to Home Screen first, then sign in there"); the wording is the design brief's.

## 4. Accounts: no public sign-up, a CLI instead

The app runs on a public URL and every import spends Jev calls, so open registration is a cost and abuse risk with no V0.1 benefit. Accounts are made by a CLI command in the same image, run the same way as the batch re-parse (`fly ssh console` or a one-off `fly machine run --rm`):

| Command | Does |
| --- | --- |
| `household create --name <name> --email <email> --user-name <name>` | In one transaction: creates the household, the first user (through Better Auth's server API, so the hash format is the library's) and the `household_user` row. Prints a generated first password once. |
| `user add --household <id> --email <email> --name <name>` | A second user in an existing household (Ed's partner, for shared shopping). No sharing UX needed. |
| `user set-password --email <email>` | Recovery. Prints a generated password once and revokes that user's sessions. |
| `user sign-out-all --email <email>` | Revokes every session of one user (lost phone). |
| `user remove --email <email>` | Deletes the user, their sessions and their import tokens. Their `created_by` references are set to null. |

Users never land in a state with no household: creation is transactional, and the one-household-per-user unique index in `household_user` stays.

Reversible: turning on public sign-up later is a config flag plus a "create household on first sign-in" hook.

## 5. How every request resolves to a household

One resolution point per transport, producing a typed **principal**:

```ts
type Principal =
  | { kind: "user"; userId: string; householdId: string; sessionId: string }
  | { kind: "importToken"; tokenId: string; userId: string; householdId: string };
```

- **tRPC (`/trpc/*`)**: the context factory calls Better Auth `getSession` with the request headers, then looks up `household_user` by `user_id` (unique index, one row). The result is `ctx.principal` with `kind: "user"`, or none.
- **Procedures**: `householdProcedure` requires a user principal and passes `householdId` down; there is no public tRPC procedure in V0.1 (sign-in is Better Auth's own route, `/health` is plain HTTP). A session whose user has no household returns `FORBIDDEN` ("account not set up"), which only a half-run CLI could cause.
- **Import route (`POST /api/v1/import`)**: resolves the bearer import token (section 6) to `kind: "importToken"`. It ignores cookies entirely.
- **Handlers and the data-access layer never read a household id, user id or token from input.** Every data-access function takes `householdId` from the principal as its first argument; the data model's test that every household-owned table is filtered covers the rest.
- `created_by` on rows comes from `principal.userId`: the signed-in user, or for imports, the user who created the token.

No session cookie cache: every request reads the session row, so sign-out and revocation are immediate. One indexed query is cheap next to the Neon round trip the request makes anyway; turn on Better Auth's short cookie cache only if profiling shows it matters.

## 6. Sessions and cookies

- Database-backed Better Auth sessions, **90-day expiry, sliding** (renewed when older than one day). A phone that is used weekly never sees the sign-in screen again; one forgotten for three months does.
- Cookie: `HttpOnly`, `Secure`, `SameSite=Lax`, host-only on the app's origin (Fastify serves the PWA and API from one origin, per ADR 0001).
- **CSRF**: tRPC mutations are JSON `POST`s, the cookie is `SameSite=Lax`, and Better Auth checks `Origin` against `trustedOrigins` (the app's own origin). The import route is the only CORS route and it takes no cookies, so cross-origin calls cannot ride a session.
- **Settings > Account**: change password, Sign out (this device), Sign out of all other devices.
- **Risk to watch**: Safari caps some cookies at 7 days (script-set cookies, and CNAME-cloaked third-party responses). The session cookie is server-set and first-party, so it should not be capped. If iPhones sign out weekly in practice, check the Cloudflare DNS record for the subdomain first.

### Offline and the PWA

- A tRPC `UNAUTHORIZED` pauses the persisted mutation queue instead of failing it, and routes to sign-in. After sign-in, the queue replays if the same user signed in. If a different user signed in, the queued changes are discarded with a notice ("3 offline changes from another account were discarded"). Shopping list ticks are idempotent and timestamped per device, so a late replay is safe.
- **Sign out clears the persisted query cache and the queue** (warning first if the queue is not empty), so the next person on a shared device sees nothing of the previous library.

## 7. Import tokens

An import token lets one device add recipes to a household's library from outside the app. In V0.1 that is the iPhone Shortcut; later the bookmarklet uses the same mechanism.

### Storage

| Table | Columns | Notes |
| --- | --- | --- |
| `import_token` | id (UUIDv7), household_id (FK), created_by (FK user), label (text, required, e.g. "Ed's iPhone"), token_hash (bytea, unique), last_four (text), created_at, last_used_at (null), revoked_at (null) | Household-owned like everything else. Revoked rows are kept for audit and hidden from the list. |

- **Format**: `fe_imp_` followed by 32 random bytes in base64url (43 characters). The prefix makes a leaked token recognisable to people and secret scanners.
- **Only the SHA-256 hash is stored.** A 256-bit random secret cannot be brute-forced, so a slow password hash buys nothing and would cost a full scan per request; the unique index on the hash is the lookup.
- At most 10 active tokens per household.

### Issue, show, rotate, revoke

- **Issue**: Settings > Import from iPhone > Add a device. The user types a label; the server returns the token once. The screen shows it with a Copy button, the "Get the Shortcut" iCloud link and three steps: copy the key, tap Get Shortcut, paste the key when the Shortcut asks. It says the key will not be shown again.
- **The shared Shortcut never contains a token.** The iCloud link is the same for everyone (Apple keeps a copy of it). The token is collected by the Shortcut's import question at install and lives in that one person's Shortcut, in plain text, which is why its scope is import only.
- **Show**: the list shows label, who created it, created date, last used ("Never used" until the first import, so the user can see the setup worked) and `...` plus the last four characters. Never the full token again.
- **Rotate**: there is no in-place rotation. A lost or suspect token is replaced by adding a new device and revoking the old one. Updating the Shortcut means re-running its import question (or reinstalling it).
- **Revoke**: immediate (`revoked_at` set; the next request fails). Removing a user from the household revokes their tokens: **a token is valid only while it is unrevoked and its creator still belongs to its household.**
- **No expiry.** The Shortcut cannot refresh a token, so an expiry would silently break imports months later. Import-only scope, revocation, last-used visibility and rate limits are the mitigations.

### Using a token

- Sent as `Authorization: Bearer fe_imp_...`. Never in the query string or body, so it never lands in access logs. The logger redacts `authorization` and `cookie` headers.
- **Scope**: `POST /api/v1/import` only. A token cannot call tRPC, read the library, sign in or create tokens. The worst a leaked token does is add recipes (visible, deletable) and spend Jev calls.
- **Rate limit**: 30 imports per hour per token (`@fastify/rate-limit`, memory store, keyed by token id), answered with `429` and a message the Shortcut can show.
- **Errors**: missing, malformed, unknown and revoked tokens all return `401` with one JSON body the Shortcut shows as-is: `{ "error": "invalid_token", "message": "This Shortcut's import key no longer works. Make a new one in Finders Eaters: Settings, Import from iPhone." }`.
- On success, `last_used_at` is set and the import runs as in `docs/spec/data-model.md` section 4, with `created_by` the token's creator. The request body and response are the import capture contract's.
- **In-app imports do not use tokens.** Paste link and the Android share target (`/share`) call a tRPC import procedure with the session; both transports call the same import service.

## 8. Tests

- tRPC: every procedure rejects a request with no session; a user principal can only touch its own household (two-household fixture).
- Import route: missing, unknown, revoked and removed-creator tokens return `401`; a valid session cookie without a token returns `401`; a valid token cannot call any tRPC procedure; the 31st import in an hour returns `429`.
- Tokens: the raw token never appears in the database or the logs; the list endpoint never returns it.
- Offline: an expired session pauses and keeps the mutation queue; a different user signing in discards it.
- E2E (Playwright): CLI-created user signs in, adds a device, imports with the token through the HTTP route, revokes it, import fails.

## 9. Later, additively

- **Email delivery** (a transactional vendor and DNS records): password reset by one-time code, then household sharing invites. Pre-V1.
- **Passkeys** after the product-domain move.
- **Public sign-up** with a household created on first sign-in, when V1 opens up.
- **Token scopes** beyond import (a native share extension may use a token or a real session; decided with the Capacitor stage).
