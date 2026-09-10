import { cp, readFile, readdir, writeFile } from "node:fs/promises";

const buildId = (await readFile(".next/BUILD_ID", "utf8")).trim();
const files = await readdir(".next/static", {
  recursive: true,
  withFileTypes: true,
});
const assets = files
  .filter((file) => file.isFile() && !file.name.endsWith(".map"))
  .map((file) => {
    const relative = `${file.parentPath}/${file.name}`
      .replaceAll("\\", "/")
      .split(".next/static/")[1];
    return `/_next/static/${relative}`;
  });
assets.push(
  "/",
  "/manifest.webmanifest",
  "/favicon.ico",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/maskable-512.png",
  "/icons/apple-touch-icon.png",
);
const template = await readFile("scripts/service-worker.js", "utf8");
await writeFile(
  "public/sw.js",
  template
    .replace("__BUILD_ID__", buildId)
    .replace("__ASSETS__", JSON.stringify(assets)),
);
console.info(
  `Prepared offline cache for ${assets.length} assets (${buildId}).`,
);

await cp("public", ".next/standalone/public", { recursive: true });
await cp(".next/static", ".next/standalone/.next/static", { recursive: true });
