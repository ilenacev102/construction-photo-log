import type { MetadataRoute } from "next";

/**
 * Web App Manifest за „Фото Градежен Дневник“.
 * Реф: node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/01-metadata/manifest.md
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Фото Градежен Дневник",
    short_name: "Фото Дневник",
    description:
      "Фото документација на градежни објекти, организација по проекти и генерирање PDF извештаи.",
    lang: "mk",
    start_url: "/",
    display: "standalone",
    background_color: "#FBF9F4",
    theme_color: "#1E2330",
    icons: [
      {
        src: "/globe.svg",
        sizes: "any",
        type: "image/svg+xml",
      },
    ],
  };
}