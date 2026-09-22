import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const htmlFiles = ["index.html", "how-it-works.html", "privacy.html", "terms.html", "earn/index.html", "compute/index.html", "auth/index.html"];
const cssFiles = ["styles.css", "how-it-works.css", "earn/earn.css", "compute/compute.css", "auth/auth.css"];
const analyticsScript = '<script src="/_vercel/insights/script.js" defer></script>';
const errors = [];

for (const file of htmlFiles) {
  const source = await readFile(path.join(root, file), "utf8");
  const analyticsScriptCount = source.split(analyticsScript).length - 1;
  if (analyticsScriptCount !== 1) {
    errors.push(`${file}: expected one Vercel Web Analytics script, found ${analyticsScriptCount}`);
  }
  for (const match of source.matchAll(/(?:href|src)="([^"]+)"/g)) {
    const link = match[1];
    if (/^(?:https?:|mailto:|tel:|#|\/_vercel\/)/.test(link)) continue;
    const cleanPath = link.split(/[?#]/)[0];
    if (!cleanPath) continue;
    const target = cleanPath.startsWith("/")
      ? path.join(root, cleanPath.slice(1))
      : path.resolve(path.dirname(path.join(root, file)), cleanPath);
    try {
      await access(target);
    } catch {
      errors.push(`${file}: missing local target ${link}`);
    }
  }
}

for (const file of cssFiles) {
  const source = await readFile(path.join(root, file), "utf8");
  const opening = (source.match(/{/g) || []).length;
  const closing = (source.match(/}/g) || []).length;
  if (opening !== closing) errors.push(`${file}: unbalanced braces (${opening}/${closing})`);
}

if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}

console.log("Static HTML links and CSS structure are valid.");