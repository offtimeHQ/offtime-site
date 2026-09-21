(() => {
  document.documentElement.classList.add("js");

  const configuredUrl = window.OFFTIME_CONFIG?.downloadUrl?.trim() || "";
  const hasDownload = configuredUrl.length > 0;
  const actions = document.querySelectorAll("[data-download-action]");

  actions.forEach((action) => {
    const link = action.querySelector("[data-download-link]");
    const status = action.querySelector("[data-download-status]");
    const manual = action.querySelector("[data-manual-download]");

    if (hasDownload) {
      link.href = configuredUrl;
      link.setAttribute("download", "");
      if (manual) {
        manual.href = configuredUrl;
        manual.setAttribute("download", "");
      }
    } else {
      link.setAttribute("aria-describedby", status.id);
    }

    link.addEventListener("click", (event) => {
      if (!hasDownload) {
        event.preventDefault();
        status.textContent = "The macOS app isn’t available to download yet.";
        manual.hidden = true;
        return;
      }

      link.classList.add("is-downloading");
      status.textContent = "Your download should begin shortly.";
      if (manual) manual.hidden = false;
    });

    if (hasDownload && action.hasAttribute("data-auto-download-action")) {
      window.setTimeout(() => link.click(), 0);
    }
  });

  const revealItems = document.querySelectorAll(".reveal");
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (reduceMotion || !("IntersectionObserver" in window)) {
    revealItems.forEach((item) => item.classList.add("is-visible"));
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      });
    },
    { rootMargin: "0px 0px -8%", threshold: 0.12 },
  );

  revealItems.forEach((item) => observer.observe(item));
})();