import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [html, build, packageSource] = await Promise.all([
  readFile(new URL("../compute/index.html", import.meta.url), "utf8"),
  readFile(new URL("./build.mjs", import.meta.url), "utf8"),
  readFile(new URL("../package.json", import.meta.url), "utf8"),
]);

assert.match(html, /Get the compute[\s\S]*?you need\./, "Compute hero must explain the renter proposition.");
assert.match(html, /Your jobs run in the Offtime app\./, "Page must direct real work to the app.");
assert.match(html, /You get compute\.[\s\S]*?Not someone’s Mac\./, "Privacy boundary must be explicit.");
assert.match(html, /Traditional cloud[\s\S]*?Offtime/, "Conceptual cloud comparison must be present.");
assert.equal((html.match(/class="step reveal"/g) || []).length, 4, "Compute onboarding must have four steps.");
assert.doesNotMatch(html, /<form|<input|<select|type="file"|data-run|data-job|data-history/, "Public compute page must not expose job controls.");
assert.doesNotMatch(html, /\/v1\/jobs|OFFTIME_COMPUTE_CONFIG|apiBaseUrl/, "Public compute page must not contain API integration.");
assert.match(html, /Example rate[\s\S]*?Example total/, "Pricing visual must be labeled as an example.");
assert.doesNotMatch(build, /OFFTIME_API|computeConfig|compute\/compute\.js/, "Build must not configure a public compute console.");
assert.doesNotMatch(packageSource, /compute\/compute\.js|compute\/config\.js/, "Validation scripts must not reference removed console files.");

console.log("Static compute onboarding safeguards are valid.");