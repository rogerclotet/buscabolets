import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Buscabolets · Una petita aventura al bosc",
    short_name: "Buscabolets",
    description:
      "Segueix les pistes, troba bolets i descobreix nous talents. Un joc en català.",
    lang: "ca",
    start_url: "/",
    scope: "/",
    id: "/",
    display: "standalone",
    background_color: "#f6f4ed",
    theme_color: "#f5f3e9",
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
