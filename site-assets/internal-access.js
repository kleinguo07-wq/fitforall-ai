"use strict";

(() => {
  // This browser-only prompt leaves the published static files publicly accessible.
  const salt = "c916f4b278c3e7ee870f7d3bdcad115a";
  const verifier = "6fb36be92862203d2e51217363684dead388adf536ec9c537b38faf9646699b5";
  const sessionKey = "fitforall-ai.internal-access";
  const lockAttribute = "data-internal-access-locked";
  const root = document.documentElement;

  try {
    if (sessionStorage.getItem(sessionKey) === verifier) {
      root.removeAttribute(lockAttribute);
      return;
    }
  } catch {
    // The prompt also works when browser storage is disabled.
  }

  document.addEventListener("DOMContentLoaded", () => {
    const dialog = document.getElementById("internal-access");
    const form = dialog.querySelector("form");
    const field = form.querySelector("input");
    const submit = form.querySelector("button");
    const message = document.getElementById("internal-access-message");
    dialog.addEventListener("cancel", event => event.preventDefault());
    if (typeof dialog.showModal === "function") {
      dialog.removeAttribute("open");
      dialog.showModal();
    }
    field.focus({ preventScroll: true });

    form.addEventListener("submit", async event => {
      event.preventDefault();
      if (submit.disabled || !field.value) return;
      submit.disabled = true;
      message.textContent = "";
      field.removeAttribute("aria-invalid");
      const password = field.value;
      try {
        const key = await crypto.subtle.importKey(
          "raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]
        );
        const bytes = Uint8Array.from(salt.match(/../g), value => parseInt(value, 16));
        const derived = await crypto.subtle.deriveBits(
          { name: "PBKDF2", salt: bytes, iterations: 310000, hash: "SHA-256" }, key, 256
        );
        const checked = Array.from(new Uint8Array(derived), value => value.toString(16).padStart(2, "0")).join("");
        if (checked !== verifier) {
          field.setAttribute("aria-invalid", "true");
          message.textContent = "密码不正确，请重试。";
          return;
        }
        try {
          sessionStorage.setItem(sessionKey, verifier);
        } catch {
          // This page can still be unlocked for the current visit.
        }
        root.removeAttribute(lockAttribute);
        dialog.close?.();
      } catch {
        message.textContent = "暂时无法验证。请刷新页面后再试。";
      } finally {
        field.value = "";
        submit.disabled = false;
        if (root.hasAttribute(lockAttribute)) field.focus();
      }
    });
  }, { once: true });
})();
