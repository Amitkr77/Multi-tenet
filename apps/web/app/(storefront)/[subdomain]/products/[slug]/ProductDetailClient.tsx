"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  useStorefrontProduct,
  useAddCartItem,
  useStorefrontProductReviews,
  useSubmitReview,
  useStorefrontTenant,
  useWishlist,
  useAddToWishlist,
  useRemoveFromWishlist,
  useProductQuestions,
  useAskQuestion,
} from "@/lib/hooks-storefront";
import { formatMoney } from "@/lib/format-currency";
import { getCustomerAccessToken } from "@/lib/customer-auth";
import { ApiError } from "@/lib/api-client";

function StarRating({ rating, interactive, onChange }: { rating: number; interactive?: boolean; onChange?: (n: number) => void }) {
  const [hovered, setHovered] = useState(0);
  return (
    <span className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <span
          key={n}
          className={`text-lg ${
            n <= (interactive ? hovered || rating : rating) ? "text-amber-400" : "text-zinc-200 dark:text-zinc-700"
          } ${interactive ? "cursor-pointer" : ""}`}
          onMouseEnter={() => interactive && setHovered(n)}
          onMouseLeave={() => interactive && setHovered(0)}
          onClick={() => interactive && onChange?.(n)}
        >
          ★
        </span>
      ))}
    </span>
  );
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
    <div className="mt-12 border-t border-zinc-200 pt-10 dark:border-zinc-800">
      <div className="mb-6 flex items-center gap-4">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Reviews</h2>
        {reviews.data && reviews.data.count > 0 && (
          <div className="flex items-center gap-2">
            <StarRating rating={Math.round(reviews.data.average)} />
            <span className="text-sm text-zinc-500">{reviews.data.average.toFixed(1)} ({reviews.data.count})</span>
          </div>
        )}
      </div>

      {!reviews.data || reviews.data.count === 0 ? (
        <p className="mb-6 text-sm text-zinc-500">No reviews yet — be the first!</p>
      ) : (
        <ul className="mb-8 space-y-4">
          {reviews.data.reviews?.map((r: any) => (
            <li key={r.id} className="rounded-lg border border-zinc-100 p-4 dark:border-zinc-800">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <StarRating rating={r.rating} />
                  <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                    {r.customer?.firstName} {r.customer?.lastName}
                  </span>
                </div>
              </div>
              {r.comment && <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">{r.comment}</p>}
            </li>
          ))}
        </ul>
      )}

      {submitted ? (
        <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-700 dark:border-green-800 dark:bg-green-950 dark:text-green-300">
          Thanks — your review was submitted for moderation.
        </div>
      ) : (
        <div className="rounded-xl border border-zinc-200 p-5 dark:border-zinc-800">
          <p className="mb-4 text-sm font-semibold text-zinc-900 dark:text-zinc-50">Leave a review</p>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <p className="mb-1 text-xs text-zinc-500">Rating</p>
              <StarRating rating={rating} interactive onChange={setRating} />
            </div>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Share your thoughts (optional)…"
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
              rows={3}
            />
            {errorMessage && <p className="text-sm text-red-600">{errorMessage}</p>}
            <button
              type="submit"
              disabled={submitReview.isPending}
              className="rounded-full bg-brand-600 px-5 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
            >
              {submitReview.isPending ? "Submitting…" : "Submit review"}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

function QaSection({ subdomain, productId }: { subdomain: string; productId: string }) {
  const router = useRouter();
  const questions = useProductQuestions(subdomain, productId);
  const askQuestion = useAskQuestion(subdomain);
  const [question, setQuestion] = useState("");
  const [asked, setAsked] = useState(false);

  const handleAsk = (e: React.FormEvent) => {
    e.preventDefault();
    if (!getCustomerAccessToken()) { router.push(`/${subdomain}/login`); return; }
    if (!question.trim()) return;
    askQuestion.mutate(
      { productId, question },
      { onSuccess: () => { setAsked(true); setQuestion(""); } },
    );
  };

  return (
    <div className="mt-10 border-t border-zinc-200 pt-10 dark:border-zinc-800">
      <h2 className="mb-6 text-lg font-semibold text-zinc-900 dark:text-zinc-50">Questions & Answers</h2>
      {questions.isLoading ? (
        <div className="space-y-3 mb-6">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="h-14 animate-pulse rounded-lg bg-zinc-100 dark:bg-zinc-800" />
          ))}
        </div>
      ) : (questions.data?.length ?? 0) === 0 ? (
        <p className="mb-6 text-sm text-zinc-500">No questions yet — be the first to ask!</p>
      ) : (
        <ul className="mb-6 space-y-3">
          {questions.data!.map((q: any) => (
            <li key={q.id} className="rounded-lg border border-zinc-100 p-4 dark:border-zinc-800">
              <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200">Q: {q.question}</p>
              {q.answer && (
                <p className="mt-1.5 text-sm text-zinc-600 dark:text-zinc-400">A: {q.answer}</p>
              )}
            </li>
          ))}
        </ul>
      )}
      {asked ? (
        <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-700 dark:border-green-800 dark:bg-green-950 dark:text-green-300">
          Your question was submitted. We&apos;ll answer it soon.
        </div>
      ) : (
        <form onSubmit={handleAsk} className="flex gap-2">
          <input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Ask a question about this product…"
            className="flex-1 rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
          />
          <button
            type="submit"
            disabled={askQuestion.isPending || !question.trim()}
            className="rounded-full bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
          >
            Ask
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
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null);
  const [addedVariantId, setAddedVariantId] = useState<string | null>(null);
  const hasToken = typeof window !== "undefined" && !!getCustomerAccessToken();
  const wishlist = useWishlist(subdomain, hasToken);
  const addToWishlist = useAddToWishlist(subdomain);
  const removeFromWishlist = useRemoveFromWishlist(subdomain);

  if (product.isLoading) {
    return (
      <div className="mx-auto max-w-5xl px-6 py-10">
        <div className="grid grid-cols-1 gap-10 sm:grid-cols-2">
          <div className="aspect-square w-full animate-pulse rounded-xl bg-zinc-100 dark:bg-zinc-800" />
          <div className="space-y-4">
            <div className="h-8 w-2/3 animate-pulse rounded bg-zinc-100 dark:bg-zinc-800" />
            <div className="h-6 w-1/4 animate-pulse rounded bg-zinc-100 dark:bg-zinc-800" />
            <div className="h-4 w-full animate-pulse rounded bg-zinc-100 dark:bg-zinc-800" />
            <div className="h-4 w-5/6 animate-pulse rounded bg-zinc-100 dark:bg-zinc-800" />
          </div>
        </div>
      </div>
    );
  }

  if (!product.data) {
    const suspended = product.error instanceof ApiError && product.error.code === "TENANT_SUSPENDED";
    return (
      <div className="flex min-h-[40vh] items-center justify-center p-8">
        <p className="text-sm text-red-600">
          {suspended ? "This store is temporarily unavailable." : "Product not found."}
        </p>
      </div>
    );
  }

  const p = product.data;
  const activeVariantId = selectedVariantId ?? (p.variants.length === 1 ? p.variants[0].id : null);
  const activeVariant = p.variants.find((v: any) => v.id === activeVariantId);
  const displayPrice = activeVariant?.price ? Number(activeVariant.price) : Number(p.basePrice);

  const handleAddToCart = () => {
    if (!activeVariantId) return;
    if (!getCustomerAccessToken()) {
      router.push(`/${subdomain}/login`);
      return;
    }
    addItem.mutate(
      { variantId: activeVariantId, quantity: 1 },
      { onSuccess: () => setAddedVariantId(activeVariantId) },
    );
  };

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <div className="grid grid-cols-1 gap-10 sm:grid-cols-2">
        {/* Image */}
        <div className="overflow-hidden rounded-xl bg-zinc-50 dark:bg-zinc-900">
          {p.images?.[0] ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={p.images[0].url} alt={p.name} className="aspect-square w-full object-cover" />
          ) : (
            <div className="flex aspect-square w-full items-center justify-center text-zinc-300 dark:text-zinc-700">
              <svg className="h-16 w-16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
          )}
        </div>

        {/* Details */}
        <div className="space-y-5">
          <div>
            {p.category && <p className="mb-1 text-xs font-medium uppercase tracking-wider text-zinc-400">{p.category.name}</p>}
            <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">{p.name}</h1>
            <p className="mt-2 text-2xl font-semibold text-zinc-700 dark:text-zinc-300">
              {formatMoney(displayPrice, currency)}
            </p>
          </div>

          {p.description && (
            <p className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">{p.description}</p>
          )}

          {/* Variant selector */}
          {p.variants.length > 1 && (
            <div>
              <p className="mb-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">Select option</p>
              <div className="flex flex-wrap gap-2">
                {p.variants.map((v: any) => {
                  const label = Object.keys(v.options).length > 0
                    ? Object.entries(v.options).map(([, val]) => String(val)).join(" / ")
                    : v.sku;
                  const isSelected = activeVariantId === v.id;
                  return (
                    <button
                      key={v.id}
                      onClick={() => { setSelectedVariantId(v.id); setAddedVariantId(null); }}
                      className={`rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${
                        isSelected
                          ? "border-brand-600 bg-brand-50 text-brand-700 dark:border-brand-500 dark:bg-brand-950 dark:text-brand-400"
                          : "border-zinc-200 text-zinc-700 hover:border-zinc-400 dark:border-zinc-700 dark:text-zinc-300 dark:hover:border-zinc-500"
                      }`}
                    >
                      {label}
                      {v.price && v.price !== p.basePrice && (
                        <span className="ml-1.5 text-xs opacity-70">{formatMoney(Number(v.price), currency)}</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Stock indicator */}
          {activeVariant && (() => {
            const stock = activeVariant.inventory?.reduce((s: number, i: any) => s + i.quantityOnHand, 0) ?? 0;
            return stock === 0 ? (
              <p className="text-sm font-medium text-red-600">Out of stock</p>
            ) : stock <= 5 ? (
              <p className="text-sm font-medium text-amber-600">Only {stock} left in stock</p>
            ) : (
              <p className="text-sm text-green-600">In stock</p>
            );
          })()}

          {/* Add to cart + Wishlist */}
          <div className="flex gap-3 pt-2">
            <button
              onClick={handleAddToCart}
              disabled={addItem.isPending || (!activeVariantId && p.variants.length > 1)}
              className={`flex-1 rounded-full py-3 text-sm font-semibold transition-colors disabled:opacity-60 ${
                addedVariantId && addedVariantId === activeVariantId
                  ? "bg-green-600 text-white hover:bg-green-700"
                  : "bg-brand-600 text-white hover:bg-brand-700"
              }`}
            >
              {addItem.isPending
                ? "Adding…"
                : addedVariantId && addedVariantId === activeVariantId
                  ? "Added to cart ✓"
                  : p.variants.length > 1 && !activeVariantId
                    ? "Select an option"
                    : "Add to cart"}
            </button>
            {(() => {
              const isWishlisted = wishlist.data?.some((w: any) => w.productId === p.id);
              return (
                <button
                  onClick={() => {
                    if (!getCustomerAccessToken()) { router.push(`/${subdomain}/login`); return; }
                    isWishlisted ? removeFromWishlist.mutate(p.id) : addToWishlist.mutate(p.id);
                  }}
                  title={isWishlisted ? "Remove from wishlist" : "Add to wishlist"}
                  className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full border text-lg transition-colors ${
                    isWishlisted
                      ? "border-red-300 bg-red-50 text-red-500 dark:border-red-800 dark:bg-red-950"
                      : "border-zinc-200 text-zinc-400 hover:border-red-300 hover:text-red-500 dark:border-zinc-700"
                  }`}
                >
                  {isWishlisted ? "♥" : "♡"}
                </button>
              );
            })()}
          </div>

          {addedVariantId && (
            <p className="text-center text-xs text-green-600 dark:text-green-400">
              Item added —{" "}
              <a href={`/${subdomain}/cart`} className="underline">view cart</a>
            </p>
          )}
        </div>
      </div>

      <ReviewsSection subdomain={subdomain} productId={p.id} />
      <QaSection subdomain={subdomain} productId={p.id} />
    </div>
  );
}
