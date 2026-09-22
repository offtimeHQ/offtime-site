(() => {
  "use strict";

  const defaultWaitlistEndAt = "2026-09-27T00:00:00Z";
  const config = window.OFFTIME_LANDING_CONFIG || {};
  const apiUrl = (config.apiUrl || window.location.origin).replace(/\/$/, "");
  const configuredEnd = Date.parse(config.waitlistEndAt || "");
  const endAt = Number.isNaN(configuredEnd) ? Date.parse(defaultWaitlistEndAt) : configuredEnd;
  const countdown = document.querySelector("[data-countdown]");
  const countdownLabel = document.querySelector(".launch-countdown__label");
  const form = document.querySelector("#waitlist-form");
  const email = document.querySelector("#waitlist-email");
  const submit = document.querySelector("#waitlist-submit");
  const status = document.querySelector("#waitlist-status");
  const interests = form.querySelectorAll('input[name="interest"]');
  let isSubmitting = false;

  function syncSubmitState() {
    submit.disabled = isSubmitting || !form.querySelector('input[name="interest"]:checked');
  }

  interests.forEach((interest) => interest.addEventListener("change", syncSubmitState));
  syncSubmitState();

  function updateCountdown() {
    const remaining = Math.max(0, endAt - Date.now());
    const days = Math.floor(remaining / 86_400_000);
    const hours = Math.floor((remaining % 86_400_000) / 3_600_000);
    const minutes = Math.floor((remaining % 3_600_000) / 60_000);
    const seconds = Math.floor((remaining % 60_000) / 1_000);
    countdown.textContent = `${String(days).padStart(2, "0")}d ${String(hours).padStart(2, "0")}h ${String(minutes).padStart(2, "0")}m ${String(seconds).padStart(2, "0")}s`;
    if (remaining === 0) countdownLabel.textContent = "Live now";
    return remaining;
  }

  if (countdown && countdownLabel) {
    updateCountdown();
    const countdownInterval = window.setInterval(() => {
      if (updateCountdown() === 0) window.clearInterval(countdownInterval);
    }, 1_000);
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    const data = new FormData(form);
    isSubmitting = true;
    syncSubmitState();
    status.className = "waitlist__status";
    status.textContent = "Joining…";

    try {
      const response = await fetch(`${apiUrl}/v1/waitlist`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.value.trim(),
          interest: data.get("interest"),
          website: data.get("website"),
        }),
      });
      if (!response.ok) throw new Error("request failed");
      form.reset();
      isSubmitting = false;
      syncSubmitState();
      status.className = "waitlist__status waitlist__status--success";
      status.textContent = "You’re on the list. We’ll be in touch.";
    } catch {
      status.className = "waitlist__status waitlist__status--error";
      status.textContent = "We couldn’t add you right now. Please try again.";
      isSubmitting = false;
      syncSubmitState();
    }
  });
})();
