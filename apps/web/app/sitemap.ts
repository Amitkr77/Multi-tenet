import type { MetadataRoute } from "next";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: APP_URL, priority: 1.0, changeFrequency: "monthly" },
    { url: `${APP_URL}/login`, priority: 0.5, changeFrequency: "monthly" },
    { url: `${APP_URL}/register`, priority: 0.7, changeFrequency: "monthly" },
    { url: `${APP_URL}/privacy`, priority: 0.3, changeFrequency: "yearly" },
    { url: `${APP_URL}/terms`, priority: 0.3, changeFrequency: "yearly" },
  ];
}
