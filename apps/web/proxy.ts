import { NextResponse } from "next/server";

/**
 * Deliberately minimal for Phase 1 — see app/dashboard/layout.tsx's comment
 * for why auth-gating happens client-side instead of here (the refresh
 * cookie lives on the API's own origin, not this app's). Subdomain/custom-
 * domain resolution for the storefront route group is Phase 2+ work, once
 * that route group actually exists — not an oversight, just not yet needed.
 */
export function proxy() {
  return NextResponse.next();
}

export const config = {
  matcher: [],
};
