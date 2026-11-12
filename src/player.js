/**
 * Auto-scroll “Play” for the scrolly experience.
 * After a full run, Play is replaced by Zoom out (scroll back over 20s).
 * Wheel/touch while playing or zooming out pauses.
 */

/** Full zoom-in run duration. */
export const PLAY_DURATION_MS = 40_000;

/** Zoom-out (scroll back to top) duration. */
export const ZOOM_OUT_DURATION_MS = 20_000;

export function createPlayer({ button }) {
  /** @type {"idle" | "playing" | "readyZoomOut" | "zoomingOut"} */
  let mode = "idle";
  let raf = 0;
  let lastAt = 0;
  let ignoreScrollPauseUntil = 0;

  const labelEl = button.querySelector(".play-control__label");

  function maxScroll() {
    return Math.max(
      0,
      document.documentElement.scrollHeight - window.innerHeight
    );
  }

  function syncButton() {
    const busy = mode === "playing" || mode === "zoomingOut";
    button.classList.toggle("is-playing", busy);
    button.classList.toggle("is-zoom-out", mode === "readyZoomOut");
    button.classList.toggle("is-zooming-out", mode === "zoomingOut");
    button.hidden = false;

    if (mode === "idle") {
      button.setAttribute("aria-pressed", "false");
      button.setAttribute("aria-label", "Play");
      if (labelEl) labelEl.textContent = "Play";
    } else if (mode === "playing") {
      button.setAttribute("aria-pressed", "true");
      button.setAttribute("aria-label", "Pause");
      if (labelEl) labelEl.textContent = "Pause";
    } else if (mode === "readyZoomOut") {
      button.setAttribute("aria-pressed", "false");
      button.setAttribute("aria-label", "Zoom out");
      if (labelEl) labelEl.textContent = "Zoom out";
    } else if (mode === "zoomingOut") {
      button.setAttribute("aria-pressed", "true");
      button.setAttribute("aria-label", "Pause zoom out");
      if (labelEl) labelEl.textContent = "Pause";
    }
  }

  function cancelLoop() {
    cancelAnimationFrame(raf);
    raf = 0;
    lastAt = 0;
  }

  function playFrame(now) {
    if (mode !== "playing") return;
    if (!lastAt) lastAt = now;
    const dt = Math.min(0.05, (now - lastAt) / 1000);
    lastAt = now;

    const end = maxScroll();
    const speed = end / (PLAY_DURATION_MS / 1000);
    const next = Math.min(end, window.scrollY + speed * dt);
    ignoreScrollPauseUntil = performance.now() + 80;
    window.scrollTo(0, next);

    if (next >= end - 0.5) {
      cancelLoop();
      mode = "readyZoomOut";
      syncButton();
      return;
    }
    raf = requestAnimationFrame(playFrame);
  }

  function zoomOutFrame(now) {
    if (mode !== "zoomingOut") return;
    if (!lastAt) lastAt = now;
    const dt = Math.min(0.05, (now - lastAt) / 1000);
    lastAt = now;

    const start = maxScroll();
    const speed = start / (ZOOM_OUT_DURATION_MS / 1000);
    const next = Math.max(0, window.scrollY - speed * dt);
    ignoreScrollPauseUntil = performance.now() + 80;
    window.scrollTo(0, next);

    if (next <= 0.5) {
      cancelLoop();
      mode = "idle";
      syncButton();
      return;
    }
    raf = requestAnimationFrame(zoomOutFrame);
  }

  function play() {
    if (mode === "playing") return;
    const end = maxScroll();
    if (end <= 0) return;
    if (window.scrollY >= end - 2) {
      ignoreScrollPauseUntil = performance.now() + 100;
      window.scrollTo(0, 0);
    }
    mode = "playing";
    syncButton();
    lastAt = 0;
    raf = requestAnimationFrame(playFrame);
  }

  function startZoomOut() {
    if (mode === "zoomingOut") return;
    if (window.scrollY <= 0.5) {
      mode = "idle";
      syncButton();
      return;
    }
    mode = "zoomingOut";
    syncButton();
    lastAt = 0;
    raf = requestAnimationFrame(zoomOutFrame);
  }

  function stop() {
    if (mode === "playing") {
      cancelLoop();
      mode = "idle";
      syncButton();
      return;
    }
    if (mode === "zoomingOut") {
      cancelLoop();
      // Stay on Zoom out so they can resume
      mode = "readyZoomOut";
      syncButton();
    }
  }

  function toggle() {
    if (mode === "idle") play();
    else if (mode === "playing") stop();
    else if (mode === "readyZoomOut") startZoomOut();
    else if (mode === "zoomingOut") stop();
  }

  function onUserScrollIntent() {
    if (mode !== "playing" && mode !== "zoomingOut") return;
    if (performance.now() < ignoreScrollPauseUntil) return;
    stop();
  }

  button.addEventListener("click", toggle);
  window.addEventListener("wheel", onUserScrollIntent, { passive: true });
  window.addEventListener("touchmove", onUserScrollIntent, { passive: true });
  window.addEventListener("keydown", (e) => {
    if (
      (mode === "playing" || mode === "zoomingOut") &&
      (e.key === "ArrowDown" ||
        e.key === "ArrowUp" ||
        e.key === "PageDown" ||
        e.key === "PageUp" ||
        e.key === " ")
    ) {
      if (e.key === " ") {
        e.preventDefault();
        toggle();
      } else {
        onUserScrollIntent();
      }
    } else if (mode === "readyZoomOut" && e.key === " ") {
      e.preventDefault();
      startZoomOut();
    } else if (mode === "idle" && e.key === " ") {
      e.preventDefault();
      play();
    }
  });

  syncButton();

  return {
    play,
    stop,
    toggle,
    isPlaying: () => mode === "playing" || mode === "zoomingOut",
    destroy() {
      cancelLoop();
      mode = "idle";
      button.removeEventListener("click", toggle);
    },
  };
}
