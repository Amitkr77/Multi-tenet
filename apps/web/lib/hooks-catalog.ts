"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  UpdateTenantDto,
  CreateProductDto,
  CreateCategoryDto,
  CreateBrandDto,
  AdjustInventoryDto,
  TransferInventoryDto,
  CreateCouponDto,
  UpdateCouponDto,
  CreateShippingZoneDto,
  CreateShippingRateDto,
  CreateTaxRuleDto,
  UpdateOrderStatusDto,
  RefundOrderDto,
  InviteUserDto,
  UpdateUserDto,
  CreateRoleDto,
  UpdateRoleDto,
  UpdateCustomerDto,
  CreateWarehouseDto,
  UpdateWarehouseDto,
} from "@saas/shared-types";
import { apiFetch } from "./api-client";

// --- Categories / Brands (dashboard dropdowns + management) ---

export function useCategories() {
  return useQuery({ queryKey: ["categories"], queryFn: () => apiFetch<any[]>("/categories") });
}

export function useCreateCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: CreateCategoryDto) => apiFetch<any>("/categories", { method: "POST", body: dto }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["categories"] }),
  });
}

export function useBrands() {
  return useQuery({ queryKey: ["brands"], queryFn: () => apiFetch<any[]>("/brands") });
}

export function useCreateBrand() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: CreateBrandDto) => apiFetch<any>("/brands", { method: "POST", body: dto }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["brands"] }),
  });
}

// --- Products ---

export function useProducts(enabled = true) {
  return useQuery({ queryKey: ["products"], queryFn: () => apiFetch<any[]>("/products"), enabled });
}

export function useProduct(id: string | undefined) {
  return useQuery({ queryKey: ["products", id], queryFn: () => apiFetch<any>(`/products/${id}`), enabled: !!id });
}

export function useCreateProduct() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: CreateProductDto) => apiFetch<any>("/products", { method: "POST", body: dto }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["products"] }),
  });
}

export function useUpdateProduct() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: any }) => apiFetch<any>(`/products/${id}`, { method: "PATCH", body: dto }),
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["products", vars.id] });
    },
  });
}

/** Presign → PUT the file directly to storage → confirm, in one call for the UI's sake. */
export function useUploadProductImage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ productId, file }: { productId: string; file: File }) => {
      const presign = await apiFetch<{ uploadUrl: string; key: string }>(`/products/${productId}/images/presign`, {
        method: "POST",
        body: { filename: file.name, contentType: file.type },
      });
      await fetch(presign.uploadUrl, { method: "PUT", headers: { "Content-Type": file.type }, body: file });
      return apiFetch<any>(`/products/${productId}/images`, { method: "POST", body: { key: presign.key } });
    },
    onSuccess: (_data, vars) => queryClient.invalidateQueries({ queryKey: ["products", vars.productId] }),
  });
}

export function useAddVariant() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ productId, dto }: { productId: string; dto: any }) =>
      apiFetch<any>(`/products/${productId}/variants`, { method: "POST", body: dto }),
    onSuccess: (_data, vars) => queryClient.invalidateQueries({ queryKey: ["products", vars.productId] }),
  });
}

export function useImportProductsCsv() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (csv: string) => apiFetch<any>("/products/import", { method: "POST", body: { csv } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["products"] }),
  });
}

// --- Inventory ---

export function useInventory(lowStockOnly = false, warehouseId?: string) {
  return useQuery({
    queryKey: ["inventory", lowStockOnly, warehouseId],
    queryFn: () => {
      const params = new URLSearchParams();
      if (lowStockOnly) params.set("lowStock", "true");
      if (warehouseId) params.set("warehouseId", warehouseId);
      const qs = params.toString();
      return apiFetch<any[]>(`/inventory${qs ? `?${qs}` : ""}`);
    },
  });
}

export function useAdjustInventory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ variantId, dto }: { variantId: string; dto: AdjustInventoryDto & { warehouseId?: string } }) =>
      apiFetch<any>(`/inventory/${variantId}`, { method: "PATCH", body: dto }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["inventory"] }),
  });
}

export function useTransferStock() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: TransferInventoryDto) => apiFetch<void>("/inventory/transfer", { method: "POST", body: dto }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["inventory"] }),
  });
}

// --- Orders ---

export function useOrders(status?: string) {
  return useQuery({
    queryKey: ["orders", status],
    queryFn: () => apiFetch<any[]>(`/orders${status ? `?status=${status}` : ""}`),
  });
}

export function useOrder(id: string | undefined) {
  return useQuery({ queryKey: ["orders", id], queryFn: () => apiFetch<any>(`/orders/${id}`), enabled: !!id });
}

export function useUpdateOrderStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: UpdateOrderStatusDto }) =>
      apiFetch<any>(`/orders/${id}/status`, { method: "PATCH", body: dto }),
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: ["orders", vars.id] });
    },
  });
}

export function useRefundOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: RefundOrderDto }) =>
      apiFetch<any>(`/orders/${id}/refund`, { method: "POST", body: dto }),
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: ["orders", vars.id] });
    },
  });
}

// --- Coupons ---

export function useCoupons() {
  return useQuery({ queryKey: ["coupons"], queryFn: () => apiFetch<any[]>("/coupons") });
}

export function useCoupon(id: string | undefined) {
  return useQuery({ queryKey: ["coupons", id], queryFn: () => apiFetch<any>(`/coupons/${id}`), enabled: !!id });
}

export function useCreateCoupon() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: CreateCouponDto) => apiFetch<any>("/coupons", { method: "POST", body: dto }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["coupons"] }),
  });
}

export function useUpdateCoupon() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: UpdateCouponDto }) =>
      apiFetch<any>(`/coupons/${id}`, { method: "PATCH", body: dto }),
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ["coupons"] });
      queryClient.invalidateQueries({ queryKey: ["coupons", vars.id] });
    },
  });
}

export function useDeleteCoupon() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch<void>(`/coupons/${id}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["coupons"] }),
  });
}

// --- Shipping ---

export function useShippingZones(enabled = true) {
  return useQuery({ queryKey: ["shipping-zones"], queryFn: () => apiFetch<any[]>("/shipping-zones"), enabled });
}

export function useCreateShippingZone() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: CreateShippingZoneDto) => apiFetch<any>("/shipping-zones", { method: "POST", body: dto }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["shipping-zones"] }),
  });
}

export function useAddShippingRate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ zoneId, dto }: { zoneId: string; dto: CreateShippingRateDto }) =>
      apiFetch<any>(`/shipping-zones/${zoneId}/rates`, { method: "POST", body: dto }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["shipping-zones"] }),
  });
}

// --- Tax ---

export function useTaxRules() {
  return useQuery({ queryKey: ["tax-rules"], queryFn: () => apiFetch<any[]>("/tax-rules") });
}

export function useCreateTaxRule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: CreateTaxRuleDto) => apiFetch<any>("/tax-rules", { method: "POST", body: dto }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["tax-rules"] }),
  });
}

// --- Payments (Stripe Connect) ---

export function usePaymentAccountStatus(enabled = true) {
  return useQuery({
    queryKey: ["payments-connect-status"],
    queryFn: () => apiFetch<any>("/payments/connect/status"),
    enabled,
  });
}

export function useStartOnboarding() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => apiFetch<{ url: string }>("/payments/connect/onboard", { method: "POST" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["payments-connect-status"] }),
  });
}

export function usePayouts(enabled = true) {
  return useQuery({ queryKey: ["payouts"], queryFn: () => apiFetch<any[]>("/payments/payouts"), enabled });
}

// --- Tenant profile (store settings) ---

export function useTenantProfile(enabled = true) {
  return useQuery({ queryKey: ["tenant-profile"], queryFn: () => apiFetch<any>("/tenants/me"), enabled });
}

export function useUpdateTenantProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: UpdateTenantDto) => apiFetch<any>("/tenants/me", { method: "PATCH", body: dto }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tenant-profile"] });
      queryClient.invalidateQueries({ queryKey: ["me"] });
    },
  });
}

// --- Billing (tenant-facing) ---

export function useBillingPlan() {
  return useQuery({ queryKey: ["billing-plan"], queryFn: () => apiFetch<any>("/billing/plan") });
}

export function useUpgradePlan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (planId: string) => apiFetch<any>("/billing/upgrade", { method: "POST", body: { planId } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["billing-plan"] }),
  });
}

export function useInvoices() {
  return useQuery({ queryKey: ["invoices"], queryFn: () => apiFetch<any[]>("/billing/invoices") });
}

// --- Plans (public list + Super Admin CRUD) ---

export function usePlans() {
  return useQuery({ queryKey: ["plans"], queryFn: () => apiFetch<any[]>("/plans") });
}

export function useCreatePlan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: any) => apiFetch<any>("/plans", { method: "POST", body: dto }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["plans"] }),
  });
}

export function useUpdatePlan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: any }) => apiFetch<any>(`/plans/${id}`, { method: "PATCH", body: dto }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["plans"] }),
  });
}

export function useArchivePlan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch<any>(`/plans/${id}/archive`, { method: "POST" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["plans"] }),
  });
}

// --- Super Admin: tenants ---

export function useAdminTenants(page = 1, limit = 20) {
  return useQuery({
    queryKey: ["admin-tenants", page, limit],
    queryFn: () => apiFetch<any>(`/tenants?page=${page}&limit=${limit}`),
  });
}

export function useAdminTenant(id: string | undefined) {
  return useQuery({
    queryKey: ["admin-tenants", id],
    queryFn: () => apiFetch<any>(`/tenants/${id}`),
    enabled: !!id,
  });
}

export function useAdminTenantAuditLogs(id: string | undefined) {
  return useQuery({
    queryKey: ["admin-tenants", id, "audit-logs"],
    queryFn: () => apiFetch<any[]>(`/tenants/${id}/audit-logs`),
    enabled: !!id,
  });
}

export function useUpdateTenantStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: { status: string; reason: string } }) =>
      apiFetch<any>(`/tenants/${id}/status`, { method: "PATCH", body: dto }),
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ["admin-tenants"] });
      queryClient.invalidateQueries({ queryKey: ["admin-tenants", vars.id] });
    },
  });
}

export function usePlanOverrides(tenantId: string | undefined) {
  return useQuery({
    queryKey: ["plan-overrides", tenantId],
    queryFn: () => apiFetch<any[]>(`/tenants/${tenantId}/plan-override`),
    enabled: !!tenantId,
  });
}

export function useCreatePlanOverride() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ tenantId, dto }: { tenantId: string; dto: any }) =>
      apiFetch<any>(`/tenants/${tenantId}/plan-override`, { method: "POST", body: dto }),
    onSuccess: (_data, vars) => queryClient.invalidateQueries({ queryKey: ["plan-overrides", vars.tenantId] }),
  });
}

// --- Reviews (moderation queue) ---

export function useReviewsQueue(status?: string) {
  return useQuery({
    queryKey: ["reviews-queue", status],
    queryFn: () => apiFetch<any[]>(`/reviews${status ? `?status=${status}` : ""}`),
  });
}

export function useModerateReview() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: "approved" | "rejected" | "hidden" }) =>
      apiFetch<any>(`/reviews/${id}/moderate`, { method: "PATCH", body: { status } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["reviews-queue"] }),
  });
}

// --- Analytics ---

export interface AnalyticsDateRange {
  from?: string;
  to?: string;
  granularity?: "day" | "week" | "month";
}

function rangeQueryString(range: AnalyticsDateRange): string {
  const params = new URLSearchParams();
  if (range.from) params.set("from", range.from);
  if (range.to) params.set("to", range.to);
  if (range.granularity) params.set("granularity", range.granularity);
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

export function useAnalyticsRevenue(range: AnalyticsDateRange) {
  return useQuery({
    queryKey: ["analytics-revenue", range],
    queryFn: () => apiFetch<any>(`/analytics/revenue${rangeQueryString(range)}`),
  });
}

export function useAnalyticsOrders(range: AnalyticsDateRange) {
  return useQuery({
    queryKey: ["analytics-orders", range],
    queryFn: () => apiFetch<any>(`/analytics/orders${rangeQueryString(range)}`),
  });
}

export function useAnalyticsBestSellers(range: AnalyticsDateRange) {
  return useQuery({
    queryKey: ["analytics-best-sellers", range],
    queryFn: () => apiFetch<any>(`/analytics/products/best-sellers${rangeQueryString(range)}`),
  });
}

export function useAnalyticsCustomers(range: AnalyticsDateRange) {
  return useQuery({
    queryKey: ["analytics-customers", range],
    queryFn: () => apiFetch<any>(`/analytics/customers${rangeQueryString(range)}`),
  });
}

export function useAnalyticsInventory() {
  return useQuery({
    queryKey: ["analytics-inventory"],
    queryFn: () => apiFetch<any>("/analytics/inventory"),
  });
}

// --- Custom Domains (Phase 6) ---

export function useDomains() {
  return useQuery({ queryKey: ["domains"], queryFn: () => apiFetch<any[]>("/domains") });
}

export function useAddDomain() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (domain: string) => apiFetch<any>("/domains", { method: "POST", body: { domain } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["domains"] }),
  });
}

export function useVerifyDomain() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch<any>(`/domains/${id}/verify`, { method: "POST" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["domains"] }),
  });
}

export function useRemoveDomain() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch<void>(`/domains/${id}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["domains"] }),
  });
}

// --- Outbound Webhook Subscriptions (Phase 6) ---

export function useWebhookSubscriptions() {
  return useQuery({
    queryKey: ["webhook-subscriptions"],
    queryFn: () => apiFetch<any[]>("/webhook-subscriptions"),
  });
}

export function useCreateWebhookSubscription() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: { url: string; eventTypes: string[] }) =>
      apiFetch<any>("/webhook-subscriptions", { method: "POST", body: dto }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["webhook-subscriptions"] }),
  });
}

export function useUpdateWebhookSubscription() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: { isActive?: boolean; url?: string; eventTypes?: string[] } }) =>
      apiFetch<any>(`/webhook-subscriptions/${id}`, { method: "PATCH", body: dto }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["webhook-subscriptions"] }),
  });
}

export function useRemoveWebhookSubscription() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch<void>(`/webhook-subscriptions/${id}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["webhook-subscriptions"] }),
  });
}

export function useWebhookDeliveries(subscriptionId: string | undefined) {
  return useQuery({
    queryKey: ["webhook-deliveries", subscriptionId],
    queryFn: () => apiFetch<any[]>(`/webhook-subscriptions/${subscriptionId}/deliveries`),
    enabled: !!subscriptionId,
  });
}

// --- Compliance: data export (FR-AU-03 / NFR-CP-01) ---

export function useExportRequests() {
  return useQuery({
    queryKey: ["export-requests"],
    queryFn: () => apiFetch<any[]>("/tenants/me/export"),
    // Requests move pending -> ready in the background (worker-processed) —
    // a short poll while any are still pending picks up the transition
    // without a manual refresh, same "poll while not-yet-terminal" idea as
    // nothing else in this app currently needs but is the simplest fix here.
    refetchInterval: (query) => {
      const data = query.state.data as any[] | undefined;
      return data?.some((r) => r.status === "pending") ? 3000 : false;
    },
  });
}

export function useRequestExport() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => apiFetch<any>("/tenants/me/export", { method: "POST" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["export-requests"] }),
  });
}

// --- Public API: API keys for tenant integrations ---

export function useApiKeys() {
  return useQuery({
    queryKey: ["api-keys"],
    queryFn: () => apiFetch<any[]>("/api-keys"),
  });
}

export function useCreateApiKey() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: { name: string }) => apiFetch<any>("/api-keys", { method: "POST", body: dto }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["api-keys"] }),
  });
}

export function useRevokeApiKey() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch<void>(`/api-keys/${id}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["api-keys"] }),
  });
}

// --- Customers (staff-facing management) ---

export function useCustomers(search?: string) {
  return useQuery({
    queryKey: ["customers", search],
    queryFn: () => apiFetch<any[]>(`/customers${search ? `?search=${encodeURIComponent(search)}` : ""}`),
  });
}

export function useCustomer(id: string | undefined) {
  return useQuery({
    queryKey: ["customers", id],
    queryFn: () => apiFetch<any>(`/customers/${id}`),
    enabled: !!id,
  });
}

export function useUpdateCustomer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: UpdateCustomerDto }) =>
      apiFetch<any>(`/customers/${id}`, { method: "PATCH", body: dto }),
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      queryClient.invalidateQueries({ queryKey: ["customers", vars.id] });
    },
  });
}

// --- Users / Staff management ---

export function useUsers() {
  return useQuery({ queryKey: ["users"], queryFn: () => apiFetch<any[]>("/users") });
}

export function useInviteUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: InviteUserDto) => apiFetch<any>("/users/invite", { method: "POST", body: dto }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["users"] }),
  });
}

export function useUpdateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: UpdateUserDto }) =>
      apiFetch<any>(`/users/${id}`, { method: "PATCH", body: dto }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["users"] }),
  });
}

export function useRemoveUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch<void>(`/users/${id}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["users"] }),
  });
}

// --- Roles & Permissions ---

export function useRoles() {
  return useQuery({ queryKey: ["roles"], queryFn: () => apiFetch<any[]>("/roles") });
}

export function usePermissionCatalogue() {
  return useQuery({ queryKey: ["permissions"], queryFn: () => apiFetch<any[]>("/permissions") });
}

export function useCreateRole() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: CreateRoleDto) => apiFetch<any>("/roles", { method: "POST", body: dto }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["roles"] }),
  });
}

export function useUpdateRole() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: UpdateRoleDto }) =>
      apiFetch<any>(`/roles/${id}`, { method: "PATCH", body: dto }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["roles"] }),
  });
}

export function useDeleteRole() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch<void>(`/roles/${id}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["roles"] }),
  });
}

// --- Warehouses ---

export function useWarehouses(enabled = true) {
  return useQuery({ queryKey: ["warehouses"], queryFn: () => apiFetch<any[]>("/warehouses"), enabled });
}

export function useCreateWarehouse() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: CreateWarehouseDto) => apiFetch<any>("/warehouses", { method: "POST", body: dto }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["warehouses"] }),
  });
}

export function useUpdateWarehouse() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: UpdateWarehouseDto }) =>
      apiFetch<any>(`/warehouses/${id}`, { method: "PATCH", body: dto }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["warehouses"] }),
  });
}

export function useSetDefaultWarehouse() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch<any>(`/warehouses/${id}/set-default`, { method: "POST" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["warehouses"] }),
  });
}

export function useDeleteWarehouse() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch<void>(`/warehouses/${id}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["warehouses"] }),
  });
}

// --- Audit Log (tenant-facing) ---

export function useAuditLog() {
  return useQuery({
    queryKey: ["audit-log"],
    queryFn: () => apiFetch<any[]>("/tenants/me/audit-logs"),
  });
}

// --- Admin platform metrics (all tenants, high limit for stats) ---

export function useAdminAllTenants() {
  return useQuery({
    queryKey: ["admin-tenants-all"],
    queryFn: () => apiFetch<any>("/tenants?page=1&limit=1000"),
  });
}
