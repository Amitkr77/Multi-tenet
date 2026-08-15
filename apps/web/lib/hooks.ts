"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { RegisterDto, LoginDto, MeResponse, AuthTokens, CompleteTwoFactorLoginDto, AcceptInviteDto } from "@saas/shared-types";
import { apiFetch } from "./api-client";
import { setAccessToken, clearAccessToken } from "./auth";

export function useRegister() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: RegisterDto) =>
      apiFetch<{ tokens: AuthTokens; tenantId: string }>("/auth/register", { method: "POST", body: dto, skipAuthRetry: true }),
    onSuccess: (data) => {
      setAccessToken(data.tokens.accessToken);
      queryClient.invalidateQueries({ queryKey: ["me"] });
    },
  });
}

type LoginResponse =
  | ({ tokens: AuthTokens } & MeResponse)
  | { requiresTwoFactor: true; challengeToken: string };

export function useLogin() {
  return useMutation({
    mutationFn: (dto: LoginDto) =>
      apiFetch<LoginResponse>("/auth/login", { method: "POST", body: dto, skipAuthRetry: true }),
  });
}

export function useLogout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => apiFetch<void>("/auth/logout", { method: "POST", body: {} }),
    onSettled: () => {
      clearAccessToken();
      queryClient.invalidateQueries({ queryKey: ["me"] });
    },
  });
}

export interface AccountSession {
  id: string;
  userAgent: string | null;
  ipAddress: string | null;
  createdAt: string;
  expiresAt: string;
}

export function useSessions() {
  return useQuery({
    queryKey: ["sessions"],
    queryFn: () => apiFetch<AccountSession[]>("/auth/sessions"),
  });
}

export function useRevokeSession() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch<void>(`/auth/sessions/${id}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["sessions"] }),
  });
}

export function useLogoutAll() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => apiFetch<void>("/auth/logout-all", { method: "POST", body: {} }),
    onSettled: () => {
      clearAccessToken();
      queryClient.clear();
    },
  });
}

export function useMe(enabled = true) {
  return useQuery({
    queryKey: ["me"],
    queryFn: () => apiFetch<MeResponse>("/auth/me"),
    enabled,
    retry: false,
  });
}

export function useForgotPassword() {
  return useMutation({
    mutationFn: (email: string) =>
      apiFetch<void>("/auth/forgot-password", { method: "POST", body: { email }, skipAuthRetry: true }),
  });
}

export function useResetPassword() {
  return useMutation({
    mutationFn: (dto: { token: string; password: string }) =>
      apiFetch<void>("/auth/reset-password", { method: "POST", body: dto, skipAuthRetry: true }),
  });
}

export function useVerifyEmail() {
  return useMutation({
    mutationFn: (token: string) =>
      apiFetch<void>("/auth/verify-email", { method: "POST", body: { token }, skipAuthRetry: true }),
  });
}

export function useAcceptInvite() {
  return useMutation({
    mutationFn: (dto: AcceptInviteDto) =>
      apiFetch<void>("/users/accept-invite", {
        method: "POST",
        body: dto,
        skipAuthRetry: true,
      }),
  });
}

// 2FA hooks

export function useSetup2fa() {
  return useMutation({
    mutationFn: () =>
      apiFetch<{ secret: string; otpauthUrl: string }>("/auth/2fa/setup", { method: "POST" }),
  });
}

export function useEnable2fa() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (code: string) =>
      apiFetch<void>("/auth/2fa/enable", { method: "POST", body: { code } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["me"] }),
  });
}

export function useDisable2fa() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (code: string) =>
      apiFetch<void>("/auth/2fa/disable", { method: "POST", body: { code } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["me"] }),
  });
}

export function useCompleteTwoFactorLogin() {
  return useMutation({
    mutationFn: (dto: CompleteTwoFactorLoginDto) =>
      apiFetch<{ tokens: AuthTokens } & MeResponse>("/auth/2fa/login", { method: "POST", body: dto, skipAuthRetry: true }),
  });
}
