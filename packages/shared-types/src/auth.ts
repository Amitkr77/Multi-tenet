import { z } from "zod";

/**
 * Auth DTOs — single source of truth for both apps/web (form validation)
 * and apps/api (request body validation via ZodValidationPipe).
 * Mirrors 06-api-specification.md §1 and 01-functional-requirements.md §3.
 */

export const registerSchema = z.object({
  businessName: z.string().min(2).max(120),
  subdomain: z
    .string()
    .min(3)
    .max(63)
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "lowercase letters, numbers, and hyphens only"),
  email: z.string().email(),
  password: z.string().min(10).max(128),
});
export type RegisterDto = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  // Disambiguates which tenant-scoped User row to authenticate against
  // (FR-A-06 — the same email can have memberships in multiple tenants).
  // A subdomain, not a UUID: in production the dashboard is reached AT the
  // tenant's subdomain so the Host header resolves this automatically and a
  // person never sees this field; apps/web's Phase 1 dashboard has no
  // subdomain routing yet (middleware.ts/proxy.ts is deliberately minimal —
  // see its comment), so the login form collects it directly instead. A
  // person knows their store's subdomain; they don't know its internal UUID.
  //
  // Preprocessed empty-string-to-undefined (same `optionalUuid`/
  // `optionalNumber` pattern as products.ts/coupons.ts) — a real bug caught
  // during Phase 5 verification: a platform Super Admin has NO subdomain at
  // all, but react-hook-form submits an untouched text input as `""`, not
  // `undefined`, which `z.string().min(1).optional()` alone rejects
  // client-side before the request is even sent — even though
  // AuthService#login's own `if (dto.subdomain)` check already treats an
  // empty string exactly like "absent" server-side.
  subdomain: z.preprocess(
    (val) => (val === "" ? undefined : val),
    z.string().min(1).optional(),
  ),
});
export type LoginDto = z.infer<typeof loginSchema>;

// `refreshToken` is optional in the body because the web client relies on
// the httpOnly `refresh_token` cookie (set by the API on login/register/
// refresh — see apps/api/src/modules/auth/auth.controller.ts) instead of
// handling the token in JS at all. Non-browser clients (mobile, machine
// clients) that can't rely on cookies still pass it explicitly here.
export const refreshSchema = z.object({
  refreshToken: z.string().min(1).optional(),
});
export type RefreshDto = z.infer<typeof refreshSchema>;

// Logout needs to know *which* session to revoke — an access token alone
// doesn't map 1:1 to a Session row (Sessions track refresh tokens). Same
// shape as refresh, different endpoint/intent.
export const logoutSchema = refreshSchema;
export type LogoutDto = RefreshDto;

export const verifyEmailSchema = z.object({
  token: z.string().min(1),
});
export type VerifyEmailDto = z.infer<typeof verifyEmailSchema>;

export const forgotPasswordSchema = z.object({
  email: z.string().email(),
});
export type ForgotPasswordDto = z.infer<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(10).max(128),
});
export type ResetPasswordDto = z.infer<typeof resetPasswordSchema>;

export const switchTenantSchema = z.object({
  tenantId: z.string().uuid(),
});
export type SwitchTenantDto = z.infer<typeof switchTenantSchema>;

export const authTokensSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  expiresIn: z.number(), // seconds until access token expiry
});
export type AuthTokens = z.infer<typeof authTokensSchema>;

export const meResponseSchema = z.object({
  user: z.object({
    id: z.string().uuid(),
    email: z.string().email(),
    isActive: z.boolean(),
    twoFactorEnabled: z.boolean(),
  }),
  tenant: z
    .object({
      id: z.string().uuid(),
      name: z.string(),
      subdomain: z.string(),
      status: z.enum(["trial", "active", "past_due", "suspended", "offboarded"]),
    })
    .nullable(), // null for platform Super Admin
  roles: z.array(z.string()),
  permissions: z.array(z.string()),
});
export type MeResponse = z.infer<typeof meResponseSchema>;

// 2FA schemas
export const verifyTotpSchema = z.object({
  code: z.string().length(6).regex(/^\d{6}$/, "Must be a 6-digit numeric code"),
});
export type VerifyTotpDto = z.infer<typeof verifyTotpSchema>;

export const completeTwoFactorLoginSchema = z.object({
  challengeToken: z.string().min(1),
  code: z.string().length(6).regex(/^\d{6}$/, "Must be a 6-digit numeric code"),
});
export type CompleteTwoFactorLoginDto = z.infer<typeof completeTwoFactorLoginSchema>;
