(() => {
  "use strict";

  const parameters = new URLSearchParams(window.location.search);
  const state = parameters.get("state") || "";
  const challenge = parameters.get("code_challenge") || "";
  const redirectUri = parameters.get("redirect_uri") || "";
  const apiUrl = (window.OFFTIME_AUTH_CONFIG?.apiUrl || "").replace(/\/$/, "");
  const validRequest = /^[A-Za-z0-9_-]{43}$/.test(challenge)
    && state.length >= 32 && state.length <= 128
    && redirectUri === "offtime://auth/callback";

  const form = document.querySelector("#auth-form");
  const email = document.querySelector("#email");
  const password = document.querySelector("#password");
  const status = document.querySelector("#status");
  const submit = document.querySelector("#submit");
  const title = document.querySelector("#auth-title");
  const copy = document.querySelector("#auth-copy");
  const help = document.querySelector("#password-help");
  const tabs = { signin: document.querySelector("#signin-tab"), signup: document.querySelector("#signup-tab") };
  let mode = "signin";

  function selectMode(nextMode) {
    mode = nextMode;
    const signingIn = mode === "signin";
    tabs.signin.setAttribute("aria-selected", String(signingIn));
    tabs.signup.setAttribute("aria-selected", String(!signingIn));
    password.autocomplete = signingIn ? "current-password" : "new-password";
    help.hidden = signingIn;
    title.textContent = signingIn ? "Welcome back." : "Create your account.";
    copy.textContent = signingIn ? "Sign in to continue securely in the Offtime app." : "Enter your email and choose a password. That’s all we need.";
    submit.firstChild.textContent = signingIn ? "Sign in " : "Create account ";
    status.textContent = "";
  }

  tabs.signin.addEventListener("click", () => selectMode("signin"));
  tabs.signup.addEventListener("click", () => selectMode("signup"));

  if (!validRequest || !apiUrl) {
    submit.disabled = true;
    status.textContent = !apiUrl ? "Authentication is not configured. Please return to the app and try again later." : "This sign-in link is invalid. Please return to the app and start again.";
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!validRequest || !apiUrl || !form.reportValidity()) return;
    submit.disabled = true;
    status.className = "status";
    status.textContent = mode === "signin" ? "Signing in…" : "Creating your account…";
    try {
      const response = await fetch(`${apiUrl}/v1/browser/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.value, password: password.value, state, code_challenge: challenge, redirect_uri: redirectUri }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "Authentication failed. Please try again.");
      status.className = "status success";
      status.textContent = "Success. Returning to Offtime…";
      const callback = new URL(payload.redirect_uri);
      callback.searchParams.set("code", payload.code);
      callback.searchParams.set("state", payload.state);
      window.location.assign(callback.toString());
    } catch (error) {
      status.textContent = error instanceof Error ? error.message : "Authentication failed. Please try again.";
      submit.disabled = false;
    }
  });
})();