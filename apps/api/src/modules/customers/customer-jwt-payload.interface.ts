export interface JwtCustomerPayload {
  sub: string; // customerId
  tenantId: string; // always present — customers are always tenant-scoped, unlike staff (no null-tenant case)
  email: string;
  type: 'customer';
}
