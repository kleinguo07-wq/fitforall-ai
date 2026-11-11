"use strict";

(() => {
  const header = document.querySelector(".site-header");
  const surface = header.dataset.surface;
  const guideButton = document.getElementById("site-guide-open");
  const fullscreenButton = document.getElementById("site-fullscreen");
  const guide = document.getElementById("site-guide");

  guideButton?.addEventListener("click", () => guide.showModal());
  guide?.addEventListener("close", () => guideButton.focus());

  const previewViews = {
    fitness: {
      defaultView: "device",
      triggers: {
        device: '.nav[data-view="device"]',
        admin: '[data-admin-page="screen"]',
        spec: '.nav[data-view="spec"]',
        docs: '.nav[data-view="docs"]',
        tracking: '.nav[data-view="tracking"]',
      },
      selected() {
        if (!document.getElementById("admin-view").classList.contains("hidden")) return "admin";
        return document.querySelector(".nav.active[data-view]")?.dataset.view;
      },
    },
    trail: {
      defaultView: "public",
      triggers: Object.fromEntries(["public", "ops", "admin"].map((view) => [view, `.view-nav [data-view="${view}"]`])),
      selected() {
        return document.querySelector('.view-nav [aria-pressed="true"]')?.dataset.view;
      },
    },
  };

  const bridge = previewViews[surface];
  const normalizedPath = (url) => url.pathname.replace(/\/index\.html$/, "/");
  const localLinks = [...header.querySelectorAll(".site-local a")];

  function requestedView(url) {
    return url.searchParams.get("view") || bridge.defaultView;
  }

  function applyView(view) {
    if (!Object.hasOwn(bridge.triggers, view) || bridge.selected() === view) return;
    document.querySelector(bridge.triggers[view])?.click();
  }

  function refreshNavigation() {
    if (bridge) {
      const currentPage = new URL(location.href);
      const selected = bridge.selected();
      if (Object.hasOwn(bridge.triggers, selected) && requestedView(currentPage) !== selected) {
        if (selected === bridge.defaultView) currentPage.searchParams.delete("view");
        else currentPage.searchParams.set("view", selected);
        history.replaceState(null, "", currentPage);
      }
      for (const link of localLinks) {
        const destination = new URL(link.href);
        if (normalizedPath(currentPage) !== normalizedPath(destination)) continue;
        if (Object.hasOwn(bridge.triggers, requestedView(destination)) && requestedView(destination) === selected) {
          link.setAttribute("aria-current", "page");
        } else {
          link.removeAttribute("aria-current");
        }
      }
      if (fullscreenButton) fullscreenButton.hidden = selected !== bridge.defaultView;
    } else if (surface === "backlog" && fullscreenButton) {
      fullscreenButton.hidden = document.getElementById("device-view").classList.contains("hidden");
    }
  }

  if (bridge) {
    applyView(requestedView(new URL(location.href)));
    header.addEventListener("click", (event) => {
      const link = event.target.closest(".site-local a");
      if (!link || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const destination = new URL(link.href);
      if (normalizedPath(destination) !== normalizedPath(new URL(location.href))) return;
      const view = requestedView(destination);
      if (!Object.hasOwn(bridge.triggers, view)) return;
      event.preventDefault();
      if (destination.href !== location.href) history.pushState(null, "", destination);
      applyView(view);
      refreshNavigation();
    });
    window.addEventListener("popstate", () => {
      applyView(requestedView(new URL(location.href)));
      refreshNavigation();
    });
  }

  if (bridge || surface === "backlog") {
    const targets = surface === "trail" ? [document.querySelector(".view-nav")] :
      [document.querySelector("body > .sidebar"), document.getElementById("device-view"), document.getElementById("admin-view")];
    const observer = new MutationObserver(refreshNavigation);
    for (const target of targets) {
      if (target) observer.observe(target, { attributes: true, attributeFilter: ["class", "aria-pressed"], subtree: target.matches("nav, aside") });
    }
  }
  refreshNavigation();

  function fullscreenTarget() {
    return surface === "trail" ? document.querySelector(".preview-stage") : document.querySelector(".stage-canvas");
  }

  fullscreenButton?.addEventListener("click", async () => {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else if (surface === "landscape") {
        const layout = document.getElementById("prototype-review-layout");
        const target = layout.classList.contains("help-open") ? layout : layout.querySelector(".device");
        await target.requestFullscreen();
      } else {
        const target = fullscreenTarget();
        target.classList.add("site-fullscreen-target");
        await target.requestFullscreen();
      }
    } catch {
      fullscreenButton.textContent = "无法全屏";
    }
  });
  document.addEventListener("fullscreenchange", () => {
    if (fullscreenButton) fullscreenButton.textContent = document.fullscreenElement ? "退出全屏" : "全屏预览";
  });
})();
