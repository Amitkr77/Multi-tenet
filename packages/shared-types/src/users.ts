import { z } from "zod";

/** 01-functional-requirements.md §4, 06-api-specification.md §3. */

export const inviteUserSchema = z.object({
  email: z.string().email(),
  roleId: z.string().uuid(),
});
export type InviteUserDto = z.infer<typeof inviteUserSchema>;

export const updateUserSchema = z.object({
  roleId: z.string().uuid().optional(),
  isActive: z.boolean().optional(),
});
export type UpdateUserDto = z.infer<typeof updateUserSchema>;

export const acceptInviteSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(10).max(128),
});
export type AcceptInviteDto = z.infer<typeof acceptInviteSchema>;

export const createRoleSchema = z.object({
  name: z.string().min(2).max(60),
  permissionCodes: z.array(z.string()).min(1),
});
export type CreateRoleDto = z.infer<typeof createRoleSchema>;

export const updateRoleSchema = z.object({
  name: z.string().min(2).max(60).optional(),
  permissionCodes: z.array(z.string()).min(1).optional(),
});
export type UpdateRoleDto = z.infer<typeof updateRoleSchema>;
