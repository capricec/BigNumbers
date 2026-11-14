/**
 * Continuous scroll → log10 target.
 * Cards pin via CSS; zoom never plateaus — it always lerps between
 * chapter waypoints as you scroll.
 */

export function createScrolly({ chapters, onProgress }) {
  const chapterEls = [];
  let targetLog = chapters[0]?.log10Target ?? 27;
  let currentLog = targetLog;
  let activeIndex = 0;
  let raf = 0;
  let running = false;
  let lastFrameAt = 0;

  const TAU = 0.38;
  const MAX_LOG_PER_SEC = 0.85;
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
    const anchor = window.scrollY + vh * 0.5;

    const chaptersGeo = [];
    for (let i = 0; i < chapterEls.length; i++) {
      const el = chapterEls[i];
      if (!el) continue;
      const top = el.getBoundingClientRect().top + window.scrollY;
      const height = el.offsetHeight || el.getBoundingClientRect().height;
      chaptersGeo.push({
        index: i,
        y: top + height * 0.4,
        log: chapters[i].log10Target,
        id: chapters[i].id,
        top,
        bottom: top + height,
      });
    }
    if (!chaptersGeo.length) return;

    // Zoom waypoints: drop consecutive duplicate logs (e.g. brand == gpt6)
    // so scroll isn't dead while cards change but framing doesn't.
    const points = [];
    for (let i = 0; i < chaptersGeo.length; i++) {
      const p = chaptersGeo[i];
      const next = chaptersGeo[i + 1];
      const sameAsNext =
        next && Math.abs(next.log - p.log) < 0.001;
      if (sameAsNext) continue;
      points.push(p);
    }
    if (!points.length) points.push(chaptersGeo[0]);

    if (anchor <= points[0].y) {
      targetLog = points[0].log;
    } else if (anchor >= points[points.length - 1].y) {
      targetLog = points[points.length - 1].log;
    } else {
      let lo = points[0];
      let hi = points[1];
      for (let i = 0; i < points.length - 1; i++) {
        if (anchor >= points[i].y && anchor <= points[i + 1].y) {
          lo = points[i];
          hi = points[i + 1];
          break;
        }
      }
      const span = Math.max(1, hi.y - lo.y);
      let t = clamp((anchor - lo.y) / span, 0, 1);
      if (lo.id === "gpt1" && hi.id === "trillion") {
        t = Math.pow(t, 0.65);
      }
      targetLog = lo.log + (hi.log - lo.log) * t;
    }

    let active = chaptersGeo[0].index;
    for (let i = 0; i < chaptersGeo.length; i++) {
      const p = chaptersGeo[i];
      if (anchor >= p.top && anchor < p.bottom) {
        active = p.index;
        break;
      }
      if (anchor >= p.top) active = p.index;
    }
    setActive(active);
  }

  function stepToward(dt) {
    const delta = targetLog - currentLog;
    if (Math.abs(delta) < 0.0008) {
      currentLog = targetLog;
      return true;
    }

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
