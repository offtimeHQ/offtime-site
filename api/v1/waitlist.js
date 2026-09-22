const { createHmac } = require("node:crypto");

const MAX_BODY_BYTES = 2_048;
const VALID_INTERESTS = new Set(["earning", "compute"]);

function firstHeaderValue(value) {
  return Array.isArray(value) ? value[0] : String(value || "").split(",")[0].trim();
}

function requestOrigin(req) {
  const host = firstHeaderValue(req.headers["x-forwarded-host"] || req.headers.host);
  if (!host) return "";
  const protocol = firstHeaderValue(req.headers["x-forwarded-proto"]) || "https";
  return `${protocol}://${host}`;
}

function setResponseHeaders(req, res) {
  const origin = firstHeaderValue(req.headers.origin);
  const allowedOrigin = (process.env.OFFTIME_WEBSITE_ORIGIN || requestOrigin(req)).replace(/\/$/, "");

  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("X-Content-Type-Options", "nosniff");

  if (origin && origin === allowedOrigin) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    res.setHeader("Vary", "Origin");
  }

  return !origin || origin === allowedOrigin;
}

function send(res, status, payload) {
  res.statusCode = status;
  res.end(JSON.stringify(payload));
}

function parseBody(req) {
  const contentLength = Number(req.headers["content-length"] || 0);
  if (contentLength > MAX_BODY_BYTES) {
    const error = new Error("body too large");
    error.statusCode = 413;
    throw error;
  }

  const rawBody = typeof req.body === "string" ? req.body : JSON.stringify(req.body ?? {});
  if (Buffer.byteLength(rawBody, "utf8") > MAX_BODY_BYTES) {
    const error = new Error("body too large");
    error.statusCode = 413;
    throw error;
  }

  try {
    return typeof req.body === "string" ? JSON.parse(req.body) : req.body ?? {};
  } catch {
    const error = new Error("invalid JSON");
    error.statusCode = 400;
    throw error;
  }
}

function hashRateLimitKey(secret, kind, value) {
  return createHmac("sha256", secret).update(`${kind}:${value}`).digest("hex");
}

async function supabaseRequest(path, body, additionalHeaders = {}) {
  const supabaseUrl = (process.env.SUPABASE_URL || "").replace(/\/$/, "");
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!supabaseUrl || !serviceRoleKey) throw new Error("Supabase is not configured");

  return fetch(`${supabaseUrl}${path}`, {
    method: "POST",
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json",
      ...additionalHeaders,
    },
    body: JSON.stringify(body),
  });
}

async function consumeRateLimit(keyHash, maximum, windowSeconds) {
  const response = await supabaseRequest("/rest/v1/rpc/consume_waitlist_rate_limit", {
    p_key_hash: keyHash,
    p_max_requests: maximum,
    p_window_seconds: windowSeconds,
  });
  if (!response.ok) throw new Error(`rate limit request failed (${response.status})`);
  return response.json();
}

async function upsertEntry(email, interest) {
  const response = await supabaseRequest(
    "/rest/v1/waitlist_entries?on_conflict=email",
    { email, interest, source: "website" },
    { Prefer: "resolution=merge-duplicates,return=minimal" },
  );
  if (!response.ok) throw new Error(`waitlist upsert failed (${response.status})`);
}

module.exports = async function waitlist(req, res) {
  const originAllowed = setResponseHeaders(req, res);
  if (!originAllowed) return send(res, 403, { ok: false });

  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    return res.end();
  }
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST, OPTIONS");
    return send(res, 405, { ok: false });
  }

  const contentType = firstHeaderValue(req.headers["content-type"]).toLowerCase();
  if (!contentType.startsWith("application/json")) return send(res, 415, { ok: false });

  try {
    const body = parseBody(req);
    if (typeof body.website !== "string") return send(res, 400, { ok: false });
    if (body.website.trim()) return send(res, 200, { ok: true });

    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const interest = typeof body.interest === "string" ? body.interest : "";
    const validEmail =
      email.length >= 3 && email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    if (!validEmail || !VALID_INTERESTS.has(interest)) return send(res, 400, { ok: false });

    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
    const ip = firstHeaderValue(req.headers["x-forwarded-for"] || req.headers["x-real-ip"]) || "unknown";
    const [ipAllowed, emailAllowed] = await Promise.all([
      consumeRateLimit(hashRateLimitKey(serviceRoleKey, "ip", ip), 20, 3_600),
      consumeRateLimit(hashRateLimitKey(serviceRoleKey, "email", email), 5, 3_600),
    ]);
    if (!ipAllowed || !emailAllowed) return send(res, 429, { ok: false });

    await upsertEntry(email, interest);
    return send(res, 200, { ok: true });
  } catch (error) {
    if (error.statusCode) return send(res, error.statusCode, { ok: false });
    console.error("Waitlist request failed", { message: error.message });
    return send(res, 503, { ok: false });
  }
};
