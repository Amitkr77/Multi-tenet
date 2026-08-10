import { z } from "zod";

/** 01-functional-requirements.md §5, 06-api-specification.md §4. */

// An HTML <select> with a "—" (none) option submits an empty string, not
// `undefined` — plain `.uuid().optional()` rejects "" (fails the uuid
// format check before optional() ever gets a chance to apply), which fails
// client-side validation silently whenever a form doesn't render that
// specific field's error text. Coercing "" -> undefined first is what
// `.optional()` actually needs to see.
const optionalUuid = z.preprocess((val) => (val === "" ? undefined : val), z.string().uuid().optional());

export const createCategorySchema = z.object({
  name: z.string().min(1).max(120),
  slug: z.string().min(1).max(140).regex(/^[a-z0-9]+(-[a-z0-9]+)*$/),
  parentId: optionalUuid,
});
export type CreateCategoryDto = z.infer<typeof createCategorySchema>;
export const updateCategorySchema = createCategorySchema.partial();
export type UpdateCategoryDto = z.infer<typeof updateCategorySchema>;

export const createBrandSchema = z.object({
  name: z.string().min(1).max(120),
  slug: z.string().min(1).max(140).regex(/^[a-z0-9]+(-[a-z0-9]+)*$/),
});
export type CreateBrandDto = z.infer<typeof createBrandSchema>;
export const updateBrandSchema = createBrandSchema.partial();
export type UpdateBrandDto = z.infer<typeof updateBrandSchema>;

export const createAttributeSchema = z.object({
  name: z.string().min(1).max(80),
});
export type CreateAttributeDto = z.infer<typeof createAttributeSchema>;

export const setAttributeValueSchema = z.object({
  attributeId: z.string().uuid(),
  value: z.string().min(1).max(200),
});
export type SetAttributeValueDto = z.infer<typeof setAttributeValueSchema>;

export const productStatusSchema = z.enum(["draft", "published"]);

export const createVariantSchema = z.object({
  sku: z.string().min(1).max(80),
  price: z.number().nonnegative().optional(), // null/omitted = inherits Product.basePrice
  options: z.record(z.string(), z.string()).default({}),
  initialStock: z.number().int().nonnegative().default(0), // only consulted on variant creation
});
export type CreateVariantDto = z.infer<typeof createVariantSchema>;
export const updateVariantSchema = createVariantSchema.omit({ initialStock: true }).partial();
export type UpdateVariantDto = z.infer<typeof updateVariantSchema>;

export const createProductSchema = z.object({
  name: z.string().min(1).max(200),
  slug: z.string().min(1).max(220).regex(/^[a-z0-9]+(-[a-z0-9]+)*$/),
  description: z.string().max(5000).optional(),
  basePrice: z.number().nonnegative(),
  categoryId: optionalUuid,
  brandId: optionalUuid,
  status: productStatusSchema.default("draft"),
  // A product needs at least one purchasable unit — creating it with its
  // first variant inline avoids a separate empty-product intermediate state.
  variant: createVariantSchema.optional(),
});
export type CreateProductDto = z.infer<typeof createProductSchema>;
export const updateProductSchema = createProductSchema.omit({ variant: true }).partial();
export type UpdateProductDto = z.infer<typeof updateProductSchema>;

export const presignImageSchema = z.object({
  filename: z.string().min(1).max(255),
  contentType: z.string().min(1).max(100),
});
export type PresignImageDto = z.infer<typeof presignImageSchema>;

export const confirmImageSchema = z.object({
  key: z.string().min(1),
});
export type ConfirmImageDto = z.infer<typeof confirmImageSchema>;

/** Bulk CSV import — one row per product + its default variant (FR-PR-07). */
export const productCsvRowSchema = z.object({
  name: z.string().min(1),
  slug: z.string().min(1).regex(/^[a-z0-9]+(-[a-z0-9]+)*$/),
  categorySlug: z.string().optional(),
  brandSlug: z.string().optional(),
  basePrice: z.coerce.number().nonnegative(),
  description: z.string().optional(),
  sku: z.string().min(1),
  initialStock: z.coerce.number().int().nonnegative().default(0),
});
export type ProductCsvRow = z.infer<typeof productCsvRowSchema>;

export interface ProductCsvImportResult {
  totalRows: number;
  succeeded: number;
  failed: Array<{ row: number; error: string }>;
}

// Accepted as raw CSV text in a JSON field rather than a multipart file
// upload — avoids pulling in a multipart-parsing dependency for Phase 2's
// dev-scale catalogs; revisit if real usage needs true file uploads.
export const importProductsSchema = z.object({
  csv: z.string().min(1),
});
export type ImportProductsDto = z.infer<typeof importProductsSchema>;
