import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Manguifi — Pointage QR",
    short_name: "Manguifi",
    description:
      "Pointage du personnel par QR code de site et géolocalisation, sans badgeuse physique.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f4f6fb",
    theme_color: "#0b1a36",
    lang: "fr",
    categories: ["business", "productivity"],
    icons: [
      { src: "/icons/icon-192", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
