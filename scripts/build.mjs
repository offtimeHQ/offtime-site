import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const output = path.join(root, "dist");
const files = [
  "index.html",
  "styles.css",
  "how-it-works.html",
  "how-it-works.css",
  "privacy.html",
  "terms.html",
  "macbook.png",
  "macmini.png",
  "earn/index.html",
  "earn/earn.css",
  "earn/earn.js",
  "compute/index.html",
  "compute/compute.css",
];

await rm(output, { recursive: true, force: true });

for (const file of files) {
  const destination = path.join(output, file);
  await mkdir(path.dirname(destination), { recursive: true });
  await cp(path.join(root, file), destination);
}

const downloadUrl = process.env.OFFTIME_DOWNLOAD_URL?.trim() || "";
const config = `window.OFFTIME_CONFIG = {\n  downloadUrl: ${JSON.stringify(downloadUrl)},\n};\n`;
await writeFile(path.join(output, "earn/config.js"), config);

const earnHtml = await readFile(path.join(output, "earn/index.html"), "utf8");
if (!earnHtml.includes("./config.js")) throw new Error("Earn page is missing runtime configuration.");

const computeHtml = await readFile(path.join(output, "compute/index.html"), "utf8");
if (!computeHtml.includes("../earn/config.js")) throw new Error("Compute page is missing shared download configuration.");

console.log(`Built static site in dist/ (${downloadUrl ? "download configured" : "download unavailable"}).`);