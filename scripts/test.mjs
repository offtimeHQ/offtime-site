import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const waitlistHandler = require("../api/v1/waitlist.js");

const [
  html,
  build,
  packageSource,
  authHtml,
  authScript,
  landingHtml,
  landingScript,
  waitlistMigration,
  rateLimitMigration,
  rateLimitFixMigration,
  vercelConfig,
] =
  await Promise.all([
    readFile(new URL("../compute/index.html", import.meta.url), "utf8"),
    readFile(new URL("./build.mjs", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
    readFile(new URL("../auth/index.html", import.meta.url), "utf8"),
    readFile(new URL("../auth/auth.js", import.meta.url), "utf8"),
    readFile(new URL("../index.html", import.meta.url), "utf8"),
    readFile(new URL("../landing/landing.js", import.meta.url), "utf8"),
    readFile(
      new URL("../supabase/migrations/20260921000000_create_waitlist_statistics.sql", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL("../supabase/migrations/20260921210000_create_waitlist_rate_limits.sql", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL("../supabase/migrations/20260922065000_fix_waitlist_rate_limit_timestamp.sql", import.meta.url),
      "utf8",
    ),
    readFile(new URL("../vercel.json", import.meta.url), "utf8"),
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
assert.match(landingHtml, /class="interest-choice__prompt"[\s\S]*I’m interested in/, "Landing waitlist must label the interest options with a directional prompt.");
assert.match(landingHtml, /type="email"[\s\S]*id="waitlist-submit"/, "Waitlist must collect and submit an email address.");
assert.match(landingHtml, /id="waitlist-submit" type="submit" disabled/, "Waitlist submission must start disabled until an interest is selected.");
assert.match(landingHtml, /href="\.\/how-it-works\.html"/, "Landing navigation must link to the how-it-works page.");
assert.doesNotMatch(landingHtml, /Start earning|Get compute/, "Landing page must not link visitors into product onboarding.");
assert.match(landingScript, /\/v1\/waitlist/, "Waitlist must submit to the control-plane endpoint.");
assert.match(landingScript, /config\.apiUrl \|\| window\.location\.origin/, "Waitlist must default to its same-origin API.");
assert.match(landingScript, /input\[name="interest"\]:checked/, "Waitlist submission must remain disabled until an interest is selected.");
assert.match(landingScript, /email: email\.value\.trim\(\)[\s\S]*interest: data\.get\("interest"\)/, "Waitlist payload must include both email and interest.");
assert.match(landingScript, /defaultWaitlistEndAt = "2026-09-27T00:00:00Z"/, "Countdown must default to the September 27 launch deadline.");
assert.match(build, /defaultWaitlistEndAt = "2026-09-27T00:00:00Z"/, "Production builds must default to the September 27 launch deadline.");
assert.match(waitlistMigration, /CREATE TABLE public\.waitlist_entries/, "Migration must create the private waitlist table.");
assert.match(waitlistMigration, /CREATE TABLE public\.waitlist_daily_statistics/, "Migration must create aggregate waitlist statistics.");
assert.match(waitlistMigration, /ENABLE ROW LEVEL SECURITY/g, "Waitlist tables must use row-level security.");
assert.match(waitlistMigration, /update_waitlist_daily_statistics/, "Waitlist statistics must stay synchronized by trigger.");
assert.match(rateLimitMigration, /CREATE TABLE public\.waitlist_rate_limits/, "Migration must create private rate-limit counters.");
assert.match(rateLimitMigration, /consume_waitlist_rate_limit/, "Rate limiting must use an atomic database function.");
assert.match(rateLimitFixMigration, /request_time TIMESTAMPTZ/, "Rate limiting must use an unambiguous timestamp value.");
assert.match(vercelConfig, /"source": "\/v1\/waitlist"[\s\S]*"destination": "\/api\/v1\/waitlist"/, "Vercel must route the public waitlist endpoint.");
const howItWorksHtml = await readFile(new URL("../how-it-works.html", import.meta.url), "utf8");
assert.match(howItWorksHtml, /Compute is everywhere\.[\s\S]*Most of it is idle\./, "How-it-works must open with the core idle-compute idea.");
assert.match(howItWorksHtml, /id="waitlist"[\s\S]*id="waitlist-form"[\s\S]*value="earning"[\s\S]*value="compute"/, "How-it-works must end with the shared waitlist UI.");
assert.match(howItWorksHtml, /class="interest-choice__prompt"[\s\S]*I’m interested in/, "How-it-works waitlist must include the directional interest prompt.");
assert.match(howItWorksHtml, /<header class="how-nav">[\s\S]*<nav aria-label="Primary navigation">[\s\S]*class="how-nav__cta" href="\.\/index\.html">Join<\/a>/, "The how-it-works header must include a Join button linking home.");
assert.doesNotMatch(howItWorksHtml, /final-path|Start earning|Join the waitlist/, "How-it-works must not retain the split final CTA.");
assert.match(howItWorksHtml, /<footer class="how-footer">\s*<p>Offtime\.<\/p>\s*<\/footer>/, "How-it-works must end with only the centered Offtime wordmark.");
assert.doesNotMatch(howItWorksHtml, /<(?:img|svg|video|picture|canvas)\b/i, "How-it-works must remain entirely text driven.");

function createResponse() {
  return {
    headers: {},
    statusCode: 200,
    body: "",
    setHeader(name, value) {
      this.headers[name] = value;
    },
    end(body = "") {
      this.body = body;
    },
  };
}

const originalFetch = globalThis.fetch;
const originalSupabaseUrl = process.env.SUPABASE_URL;
const originalServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
process.env.SUPABASE_URL = "https://example.supabase.co";
process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role-key";
const apiCalls = [];
globalThis.fetch = async (url, options) => {
  apiCalls.push({ url, options });
  return url.includes("/rpc/")
    ? { ok: true, status: 200, json: async () => true }
    : { ok: true, status: 201 };
};

const apiResponse = createResponse();
await waitlistHandler(
  {
    method: "POST",
    headers: {
      "content-type": "application/json",
      host: "offtime.test",
      origin: "https://offtime.test",
      "x-forwarded-for": "192.0.2.1",
      "x-forwarded-proto": "https",
    },
    body: { email: " Person@Example.com ", interest: "earning", website: "" },
  },
  apiResponse,
);
assert.equal(apiResponse.statusCode, 200, "Valid waitlist submissions must succeed.");
assert.equal(apiCalls.length, 3, "A valid signup must check both limits and write one entry.");
const upsertCall = apiCalls.find(({ url }) => url.includes("waitlist_entries"));
assert.deepEqual(JSON.parse(upsertCall.options.body), {
  email: "person@example.com",
  interest: "earning",
  source: "website",
});
assert.match(upsertCall.options.headers.Prefer, /resolution=merge-duplicates/, "Repeat emails must be upserted.");

apiCalls.length = 0;
const honeypotResponse = createResponse();
await waitlistHandler(
  {
    method: "POST",
    headers: { "content-type": "application/json", host: "offtime.test" },
    body: { email: "bot@example.com", interest: "compute", website: "spam" },
  },
  honeypotResponse,
);
assert.equal(honeypotResponse.statusCode, 200, "Honeypot submissions must receive a neutral response.");
assert.equal(apiCalls.length, 0, "Honeypot submissions must not reach Supabase.");

globalThis.fetch = originalFetch;
if (originalSupabaseUrl === undefined) delete process.env.SUPABASE_URL;
else process.env.SUPABASE_URL = originalSupabaseUrl;
if (originalServiceRoleKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
else process.env.SUPABASE_SERVICE_ROLE_KEY = originalServiceRoleKey;

const productionEnvironment = { ...process.env, VERCEL_ENV: "production" };
delete productionEnvironment.OFFTIME_API_URL;
const buildScriptPath = fileURLToPath(new URL("./build.mjs", import.meta.url));
const unconfiguredBuild = spawnSync(process.execPath, [buildScriptPath], {
  encoding: "utf8",
  env: productionEnvironment,
});
assert.equal(unconfiguredBuild.status, 0, `Production must build without optional API configuration:\n${unconfiguredBuild.stderr}`);

const unsafeBuild = spawnSync(process.execPath, [buildScriptPath], {
  encoding: "utf8",
  env: { ...productionEnvironment, OFFTIME_API_URL: "http://api.example.com" },
});
assert.notEqual(unsafeBuild.status, 0, "Production must reject a non-HTTPS API URL.");
assert.match(unsafeBuild.stderr, /must be an HTTPS origin/, "Unsafe API URL failure must explain the requirement.");

console.log("Static compute onboarding safeguards are valid.");
