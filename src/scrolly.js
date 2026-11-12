/**
 * Continuous scroll → log10(atom count).
 * Scroll sets a target; the camera eases toward it with a speed cap
 * so GPT stop-to-stop zooms stay smooth instead of jumpy.
 */

export function createScrolly({ chapters, onProgress }) {
  const chapterEls = [];
  let targetLog = chapters[0]?.log10Target ?? 27;
  let currentLog = targetLog;
  let activeIndex = 0;
  let raf = 0;
  let running = false;
  let lastFrameAt = 0;

  // Ease time-constant (seconds) and max |Δlog10| per second
  const TAU = 0.38;
  const MAX_LOG_PER_SEC = 0.7;
  // GPT-1 → trillion is a huge log jump but a tiny zoom nudge — cross it in ~2s
  const MAX_LOG_PER_SEC_DEEP = 4;
  const LOG_GPT1 = Math.log10(18e18);

  function register(el, index) {
    chapterEls[index] = el;
  }

  function emit(settled) {
    onProgress({
      log10Target: targetLog,
      log10Current: currentLog,
      activeIndex,
      settled: !!settled,
    });
  }

  function readScrollTarget() {
    if (!chapterEls.length) return;

    const vh = window.innerHeight;
    const anchor = window.scrollY + vh * 0.42;

    const centers = chapterEls
      .map((el, i) => {
        if (!el) return null;
        const top = el.getBoundingClientRect().top + window.scrollY;
        const height = el.offsetHeight || el.getBoundingClientRect().height;
        return {
          index: i,
          y: top + height * 0.4,
          log: chapters[i].log10Target,
        };
      })
      .filter(Boolean);

    if (!centers.length) return;

    if (anchor <= centers[0].y) {
      targetLog = centers[0].log;
      setActive(centers[0].index);
      return;
    }
    if (anchor >= centers[centers.length - 1].y) {
      targetLog = centers[centers.length - 1].log;
      setActive(centers[centers.length - 1].index);
      return;
    }

    let lo = centers[0];
    let hi = centers[1];
    for (let i = 0; i < centers.length - 1; i++) {
      if (anchor >= centers[i].y && anchor <= centers[i + 1].y) {
        lo = centers[i];
        hi = centers[i + 1];
        break;
      }
    }
    const span = Math.max(1, hi.y - lo.y);
    // Linear in scroll — smoothstep was rushing the middle of each beat
    const t = clamp((anchor - lo.y) / span, 0, 1);
    // GPT-1 → trillion is a huge log gap for a tiny zoom; keep scroll→camera
    // moving immediately (no dwell at GPT-1 while log crawls).
    const loId = chapters[lo.index]?.id;
    const hiId = chapters[hi.index]?.id;
    const tLog =
      loId === "gpt1" && hiId === "trillion" ? Math.pow(t, 0.65) : t;
    targetLog = lo.log + (hi.log - lo.log) * tLog;
    setActive(t < 0.5 ? lo.index : hi.index);
  }

  function stepToward(dt) {
    const delta = targetLog - currentLog;
    if (Math.abs(delta) < 0.0008) {
      currentLog = targetLog;
      return true;
    }

    // Exponential ease toward target, capped so big jumps never snap
    const alpha = 1 - Math.exp(-dt / TAU);
    let step = delta * alpha;
    const deep = Math.min(currentLog, targetLog) < LOG_GPT1;
    const maxStep = (deep ? MAX_LOG_PER_SEC_DEEP : MAX_LOG_PER_SEC) * dt;
    if (Math.abs(step) > maxStep) {
      step = Math.sign(step) * maxStep;
    }
    currentLog += step;
    return false;
  }

  function frame(now) {
    if (!lastFrameAt) lastFrameAt = now;
    const dt = clamp((now - lastFrameAt) / 1000, 0, 0.05);
    lastFrameAt = now;

    readScrollTarget();
    const settled = stepToward(dt);
    emit(settled);

    if (settled && Math.abs(targetLog - currentLog) < 0.0008) {
      // Keep a light idle loop so the next scroll doesn't hitch
      running = false;
      raf = 0;
      return;
    }
    raf = requestAnimationFrame(frame);
  }

  function ensureLoop() {
    if (running) return;
    running = true;
    lastFrameAt = 0;
    raf = requestAnimationFrame(frame);
  }

  function measure() {
    readScrollTarget();
    emit(false);
    ensureLoop();
  }

  function setActive(index) {
    if (
      index === activeIndex &&
      chapterEls[activeIndex]?.classList.contains("is-active")
    ) {
      return;
    }
    if (chapterEls[activeIndex]) {
      chapterEls[activeIndex].classList.remove("is-active");
    }
    activeIndex = index;
    if (chapterEls[activeIndex]) {
      chapterEls[activeIndex].classList.add("is-active");
    }
  }

  function start() {
    window.addEventListener("scroll", measure, { passive: true });
    window.addEventListener("resize", measure, { passive: true });
    requestAnimationFrame(() => {
      // Force the opening chapter active (setActive(0) used to no-op)
      activeIndex = -1;
      measure();
    });
  }

  function destroy() {
    window.removeEventListener("scroll", measure);
    window.removeEventListener("resize", measure);
    cancelAnimationFrame(raf);
    running = false;
  }

  return {
    register,
    start,
    destroy,
    measure,
    getState: () => ({ targetLog, currentLog, activeIndex }),
  };
}

function clamp(v, a, b) {
  return Math.min(b, Math.max(a, v));
}
