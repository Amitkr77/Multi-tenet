import { z } from "zod";

/** 01-functional-requirements.md §7, 06-api-specification.md §6. */

export const customerRegisterSchema = z.object({
  email: z.string().email(),
  password: z.string().min(10).max(128),
  firstName: z.string().max(80).optional(),
  lastName: z.string().max(80).optional(),
  phone: z.string().max(30).optional(),
});
export type CustomerRegisterDto = z.infer<typeof customerRegisterSchema>;

export const customerLoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});
export type CustomerLoginDto = z.infer<typeof customerLoginSchema>;

// Tenant-facing (staff) edit — includes segmentation/active-status fields
// FR-C-03/FR-C-05 grant staff but not the customer themselves.
export const updateCustomerSchema = z.object({
  firstName: z.string().max(80).optional(),
  lastName: z.string().max(80).optional(),
  phone: z.string().max(30).optional(),
  tags: z.array(z.string().max(40)).optional(),
  isActive: z.boolean().optional(),
});
export type UpdateCustomerDto = z.infer<typeof updateCustomerSchema>;

// Storefront self-edit — deliberately narrower than the staff-facing DTO
// above (no tags/isActive — a customer can't segment or deactivate themselves).
export const customerSelfUpdateSchema = z.object({
  firstName: z.string().max(80).optional(),
  lastName: z.string().max(80).optional(),
  phone: z.string().max(30).optional(),
});
export type CustomerSelfUpdateDto = z.infer<typeof customerSelfUpdateSchema>;

export const createAddressSchema = z.object({
  line1: z.string().min(1).max(200),
  line2: z.string().max(200).optional(),
  city: z.string().min(1).max(100),
  state: z.string().max(100).optional(),
  postalCode: z.string().max(20).optional(),
  country: z.string().min(2).max(60),
  isDefault: z.boolean().default(false),
});
export type CreateAddressDto = z.infer<typeof createAddressSchema>;
export const updateAddressSchema = createAddressSchema.partial();
export type UpdateAddressDto = z.infer<typeof updateAddressSchema>;
