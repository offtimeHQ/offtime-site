import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";

const [html, build, packageSource, authHtml, authScript, landingHtml, landingScript] = await Promise.all([
  readFile(new URL("../compute/index.html", import.meta.url), "utf8"),
  readFile(new URL("./build.mjs", import.meta.url), "utf8"),
  readFile(new URL("../package.json", import.meta.url), "utf8"),
  readFile(new URL("../auth/index.html", import.meta.url), "utf8"),
  readFile(new URL("../auth/auth.js", import.meta.url), "utf8"),
  readFile(new URL("../index.html", import.meta.url), "utf8"),
  readFile(new URL("../landing/landing.js", import.meta.url), "utf8"),
]);

assert.match(html, /Get the compute[\s\S]*?you need\./, "Compute hero must explain the renter proposition.");
assert.match(html, /Your jobs run in the Offtime app\./, "Page must direct real work to the app.");
assert.match(html, /You get compute\.[\s\S]*?Not someone’s Mac\./, "Privacy boundary must be explicit.");
assert.match(html, /Traditional cloud[\s\S]*?Offtime/, "Conceptual cloud comparison must be present.");
assert.equal((html.match(/class="step reveal"/g) || []).length, 4, "Compute onboarding must have four steps.");
assert.doesNotMatch(html, /<form|<input|<select|type="file"|data-run|data-job|data-history/, "Public compute page must not expose job controls.");
assert.doesNotMatch(html, /\/v1\/jobs|OFFTIME_COMPUTE_CONFIG|apiBaseUrl/, "Public compute page must not contain API integration.");
assert.match(html, /Example rate[\s\S]*?Example total/, "Pricing visual must be labeled as an example.");
assert.doesNotMatch(build, /computeConfig|compute\/compute\.js/, "Build must not configure a public compute console.");
assert.doesNotMatch(packageSource, /compute\/compute\.js|compute\/config\.js/, "Validation scripts must not reference removed console files.");
assert.match(authHtml, /type="email"[\s\S]*type="password"/, "Auth must request email and password only.");
assert.match(authHtml, /terms\.html[\s\S]*privacy\.html/, "Auth must link to Terms and Privacy.");
assert.match(authScript, /redirectUri === "offtime:\/\/auth\/callback"/, "Auth must allow only the app callback.");
assert.doesNotMatch(authScript, /session_token|localStorage|document\.cookie/, "Browser code must not receive or persist app sessions.");
assert.match(landingHtml, /id="waitlist-form"[\s\S]*value="earning"[\s\S]*value="compute"/, "Landing page must collect both waitlist interests.");
assert.match(landingHtml, /type="email"[\s\S]*id="waitlist-submit"/, "Waitlist must collect and submit an email address.");
assert.match(landingHtml, /id="waitlist-submit" type="submit" disabled/, "Waitlist submission must start disabled until an interest is selected.");
assert.doesNotMatch(landingHtml, /Start earning|Get compute/, "Landing page must not link visitors into product onboarding.");
assert.match(landingScript, /\/v1\/waitlist/, "Waitlist must submit to the control-plane endpoint.");
assert.match(landingScript, /input\[name="interest"\]:checked/, "Waitlist submission must remain disabled until an interest is selected.");
assert.match(landingScript, /email: email\.value\.trim\(\)[\s\S]*interest: data\.get\("interest"\)/, "Waitlist payload must include both email and interest.");
assert.match(landingScript, /5 \* 24 \* 60 \* 60 \* 1000/, "Countdown must have a five-day fallback.");
assert.doesNotMatch(await readFile(new URL("../how-it-works.html", import.meta.url), "utf8"), /Start earning|Get compute/, "How-it-works calls to action must use the waitlist.");

const productionEnvironment = { ...process.env, VERCEL_ENV: "production" };
delete productionEnvironment.OFFTIME_API_URL;
const unconfiguredBuild = spawnSync(process.execPath, [new URL("./build.mjs", import.meta.url).pathname], {
  encoding: "utf8",
  env: productionEnvironment,
});
assert.equal(unconfiguredBuild.status, 0, `Production must build without optional API configuration:\n${unconfiguredBuild.stderr}`);

const unsafeBuild = spawnSync(process.execPath, [new URL("./build.mjs", import.meta.url).pathname], {
  encoding: "utf8",
  env: { ...productionEnvironment, OFFTIME_API_URL: "http://api.example.com" },
});
assert.notEqual(unsafeBuild.status, 0, "Production must reject a non-HTTPS API URL.");
assert.match(unsafeBuild.stderr, /must be an HTTPS origin/, "Unsafe API URL failure must explain the requirement.");

console.log("Static compute onboarding safeguards are valid.");