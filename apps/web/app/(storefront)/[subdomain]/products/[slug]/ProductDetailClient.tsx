"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  useStorefrontProduct,
  useAddCartItem,
  useStorefrontProductReviews,
  useSubmitReview,
  useStorefrontTenant,
} from "@/lib/hooks-storefront";
import { formatMoney } from "@/lib/format-currency";
import { getCustomerAccessToken } from "@/lib/customer-auth";
import { ApiError } from "@/lib/api-client";

function StarRating({ rating }: { rating: number }) {
  return <span className="text-amber-500">{"★".repeat(rating)}{"☆".repeat(5 - rating)}</span>;
}

function ReviewsSection({ subdomain, productId }: { subdomain: string; productId: string }) {
  const router = useRouter();
  const reviews = useStorefrontProductReviews(subdomain, productId);
  const submitReview = useSubmitReview(subdomain);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!getCustomerAccessToken()) {
      router.push(`/${subdomain}/login`);
      return;
    }
    submitReview.mutate(
      { productId, dto: { rating, comment: comment || undefined } },
      { onSuccess: () => setSubmitted(true) },
    );
  };

  const errorMessage =
    submitReview.error instanceof ApiError
      ? submitReview.error.code === "NOT_ELIGIBLE"
        ? "You can review this product after your order is delivered."
        : submitReview.error.code === "ALREADY_REVIEWED"
          ? "You've already reviewed this product."
          : submitReview.error.message
      : null;

  return (
    <div className="mt-10 border-t border-zinc-200 pt-8 dark:border-zinc-800">
      <h2 className="mb-3 text-lg font-semibold text-zinc-900 dark:text-zinc-50">Reviews</h2>
      {reviews.data && reviews.data.count > 0 ? (
        <p className="mb-4 text-sm text-zinc-600 dark:text-zinc-400">
          <StarRating rating={Math.round(reviews.data.average)} /> {reviews.data.average.toFixed(1)} ({reviews.data.count}{" "}
          review{reviews.data.count === 1 ? "" : "s"})
        </p>
      ) : (
        <p className="mb-4 text-sm text-zinc-500">No reviews yet.</p>
      )}

      <ul className="mb-6 space-y-3">
        {reviews.data?.reviews?.map((r: any) => (
          <li key={r.id} className="text-sm">
            <StarRating rating={r.rating} />{" "}
            <span className="text-zinc-500">
              by {r.customer?.firstName} {r.customer?.lastName}
            </span>
            {r.comment && <p className="mt-0.5 text-zinc-700 dark:text-zinc-300">{r.comment}</p>}
          </li>
        ))}
      </ul>

      {submitted ? (
        <p className="text-sm text-green-700 dark:text-green-400">Thanks — your review was submitted for moderation.</p>
      ) : (
        <form onSubmit={handleSubmit} className="max-w-sm space-y-2">
          <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Leave a review</p>
          <select
            value={rating}
            onChange={(e) => setRating(Number(e.target.value))}
            className="w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          >
            {[5, 4, 3, 2, 1].map((n) => (
              <option key={n} value={n}>
                {n} star{n === 1 ? "" : "s"}
              </option>
            ))}
          </select>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Optional comment"
            className="w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            rows={3}
          />
          {errorMessage && <p className="text-sm text-red-600">{errorMessage}</p>}
          <button
            type="submit"
            disabled={submitReview.isPending}
            className="rounded-full bg-brand-600 px-4 py-1.5 text-xs font-medium text-white hover:bg-brand-700 disabled:opacity-60"
          >
            Submit review
          </button>
        </form>
      )}
    </div>
  );
}

export default function ProductDetailClient() {
  const { subdomain, slug } = useParams<{ subdomain: string; slug: string }>();
  const router = useRouter();
  const product = useStorefrontProduct(subdomain, slug);
  const tenant = useStorefrontTenant(subdomain);
  const currency = tenant.data?.currency ?? "USD";
  const addItem = useAddCartItem(subdomain);
  const [addedVariantId, setAddedVariantId] = useState<string | null>(null);

  if (product.isLoading) return <p className="p-8 text-sm text-zinc-500">Loading…</p>;
  if (!product.data) {
    const suspended = product.error instanceof ApiError && product.error.code === "TENANT_SUSPENDED";
    return (
      <p className="p-8 text-sm text-red-600">
        {suspended ? "This store is temporarily unavailable." : "Product not found."}
      </p>
    );
  }

  const p = product.data;

  const handleAddToCart = (variantId: string) => {
    if (!getCustomerAccessToken()) {
      router.push(`/${subdomain}/login`);
      return;
    }
    addItem.mutate(
      { variantId, quantity: 1 },
      { onSuccess: () => setAddedVariantId(variantId) },
    );
  };

  return (
    <div className="mx-auto max-w-3xl p-8">
      <div className="grid grid-cols-1 gap-8 sm:grid-cols-2">
        <div>
          {p.images[0] ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={p.images[0].url} alt={p.name} className="w-full rounded-lg object-cover" />
          ) : (
            <div className="flex h-64 w-full items-center justify-center rounded-lg bg-zinc-100 text-zinc-400 dark:bg-zinc-900">No image</div>
          )}
        </div>
        <div className="space-y-4">
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">{p.name}</h1>
          <p className="text-xl text-zinc-700 dark:text-zinc-300">{formatMoney(Number(p.basePrice), currency)}</p>
          {p.description && <p className="text-sm text-zinc-600 dark:text-zinc-400">{p.description}</p>}
          {p.variants.length > 0 && (
            <div className="space-y-2">
              <p className="mb-1 text-sm font-medium text-zinc-700 dark:text-zinc-300">Options</p>
              <ul className="space-y-2 text-sm text-zinc-600 dark:text-zinc-400">
                {p.variants.map((v: any) => (
                  <li key={v.id} className="flex items-center justify-between gap-3">
                    <span>
                      {v.sku}
                      {Object.keys(v.options).length > 0 &&
                        ` (${Object.entries(v.options)
                          .map(([k, val]) => `${k}: ${val}`)
                          .join(", ")})`}
                    </span>
                    <button
                      onClick={() => handleAddToCart(v.id)}
                      disabled={addItem.isPending}
                      className="shrink-0 rounded-full bg-brand-600 px-4 py-1.5 text-xs font-medium text-white hover:bg-brand-700 disabled:opacity-60"
                    >
                      {addedVariantId === v.id ? "Added ✓" : "Add to cart"}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
      <ReviewsSection subdomain={subdomain} productId={p.id} />
    </div>
  );
}
