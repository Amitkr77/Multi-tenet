/**
 * Shared Tailwind design tokens (v3-style JS config shape). apps/web actually
 * runs Tailwind v4, which is CSS-first and doesn't consume this file directly
 * — its `@theme` block in app/globals.css mirrors these values by hand. Kept
 * here as the canonical source apps/web's CSS theme should match; if a future
 * app needs Tailwind v3, it can spread this in normally.
 */
module.exports = {
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#f5f7ff",
          500: "#4f46e5",
          600: "#4338ca",
          700: "#3730a3",
        },
      },
    },
  },
  plugins: [],
};
