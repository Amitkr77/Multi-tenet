/**
 * Google OAuth login (FR-A-02) — deferred per arch.md §6 ("optional
 * Google login... as a later addition") and the user's explicit choice to
 * defer it in this pass. This file exists so the folder shape matches
 * 07-folder-module-architecture.md, but it is NOT imported or registered in
 * auth.module.ts — wiring it up is a small, self-contained follow-up:
 *
 *   1. `pnpm add --filter api passport-google-oauth20 @types/passport-google-oauth20`
 *   2. Implement a PassportStrategy(Strategy, "google") here, same shape as
 *      jwt.strategy.ts, using GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET env vars.
 *   3. Register it as a provider in auth.module.ts.
 *   4. Add `GET /auth/google` + `GET /auth/google/callback` to auth.controller.ts,
 *      guarded by `AuthGuard("google")`.
 */
export {};
