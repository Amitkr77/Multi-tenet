export interface JwtAccessPayload {
  sub: string; // userId
  tenantId: string | null;
  email: string;
  type: 'access';
}
