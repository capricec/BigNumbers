import {
  DEFAULT_TARGET_ID,
  MAGNITUDES,
  TARGETS,
  dollarsAtElapsed,
  formatDollars,
  formatDuration,
  formatExtinguishAt,
  getTarget,
  secondsFor,
} from "./content.js";

const ladderEl = document.getElementById("ladder");
const targetsEl = document.getElementById("targets");
const clockBtn = document.getElementById("clock-btn");
const meterEl = document.getElementById("meter");
const meterLabelEl = document.getElementById("meter-label");
const meterValueEl = document.getElementById("meter-value");

/** Fixed scale markers below the selected finish line. */
const SCALE_ROWS = MAGNITUDES.filter((m) => m.id === "million" || m.id === "billion");

const rows = new Map();
const targetButtons = new Map();
let selectedTarget = getTarget(DEFAULT_TARGET_ID);
let playing = false;
let startMs = 0;
let tickId = 0;
let anchorAt = new Date();

function targetCap() {
  return selectedTarget.amount;
}

function ladderStops() {
  return [
    ...SCALE_ROWS,
    {
      id: "target",
      name: selectedTarget.amountLabel.replace(/^\$/, ""),
      powerLabel: selectedTarget.cardSubject,
      value: selectedTarget.amount,
      isTarget: true,
    },
  ];
}

function mountTargets() {
  for (const target of TARGETS) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "target";
    btn.dataset.id = target.id;
    btn.setAttribute("role", "radio");
    btn.setAttribute("aria-checked", "false");
    btn.setAttribute(
      "aria-label",
      `${target.amountLabel}, ${target.cardSubject}`
    );

    const amount = document.createElement("span");
    amount.className = "target__amount";
    amount.textContent = target.amountLabel;

    const subject = document.createElement("span");
    subject.className = "target__subject";
    subject.textContent = target.cardSubject;

    btn.append(amount, subject);
    btn.addEventListener("click", () => selectTarget(target.id));
    targetsEl.append(btn);
    targetButtons.set(target.id, btn);
  }

  selectTarget(selectedTarget.id);
}

function selectTarget(id) {
  if (playing) return;
  selectedTarget = getTarget(id);

  for (const [tid, btn] of targetButtons) {
    const on = tid === selectedTarget.id;
    btn.classList.toggle("is-selected", on);
    btn.setAttribute("aria-checked", on ? "true" : "false");
  }

  rebuildLadder();
  setMeter(0, false);
}

function rebuildLadder() {
  ladderEl.replaceChildren();
  rows.clear();

  for (const stop of ladderStops()) {
    const seconds = secondsFor(stop.value);
    const li = document.createElement("li");

    const row = document.createElement("div");
    row.className = "rung";
    row.dataset.id = stop.id;

    const identity = document.createElement("div");
    identity.className = "rung__identity";

    const light = document.createElement("span");
    light.className = "rung__light";
    light.setAttribute("aria-hidden", "true");

    const copy = document.createElement("span");
    copy.className = "rung__copy";

    const name = document.createElement("span");
    name.className = "rung__name";
    name.textContent = stop.isTarget
      ? selectedTarget.amountLabel
      : `$1 ${stop.name}`;

    copy.append(name);
    identity.append(light, copy);

    const duration = document.createElement("span");
    duration.className = "rung__duration";

    const durationLabel = document.createElement("span");
    durationLabel.className = "rung__duration-label";
    durationLabel.textContent = formatDuration(seconds);

    const countdown = document.createElement("span");
    countdown.className = "rung__countdown";
    countdown.hidden = true;

    duration.append(durationLabel, countdown);

    const extinguish = document.createElement("span");
    extinguish.className = "rung__extinguish";

    row.append(identity, duration, extinguish);
    li.append(row);
    ladderEl.append(li);
    rows.set(stop.id, { row, countdown, extinguish, seconds, stop });
  }

  refreshExtinguishLabels(anchorAt);
}

function refreshExtinguishLabels(from) {
  for (const { row, extinguish, seconds, stop } of rows.values()) {
    const label = formatExtinguishAt(from, seconds);
    extinguish.textContent = label;
    const title = stop.isTarget
      ? selectedTarget.amountLabel
      : `$1 ${stop.name}`;
    row.setAttribute(
      "aria-label",
      `${title}, lights after ${formatDuration(seconds)}, on at ${label}`
    );
  }
}

function setMeter(amount, hitTarget) {
  meterLabelEl.textContent = hitTarget ? "Target reached" : "Running total";
  meterValueEl.textContent = formatDollars(amount);
  meterEl.classList.toggle("is-capped", Boolean(hitTarget));
}

function formatUntilLit(seconds) {
  if (seconds < 1) return `${Math.max(0, seconds).toFixed(1)}s until accumulated`;
  if (seconds < 60) return `${Math.ceil(seconds)}s until accumulated`;

  const s = Math.ceil(seconds);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;

  if (d > 0) return `${d}d ${h}h until accumulated`;
  if (h > 0) return `${h}h ${m}m until accumulated`;
  return `${m}:${String(r).padStart(2, "0")} until accumulated`;
}

function setAllUnlit() {
  for (const { row, countdown } of rows.values()) {
    row.classList.remove("is-lit", "is-active", "is-done");
    countdown.hidden = true;
    countdown.textContent = "";
  }
}

function setPlaying(on) {
  playing = on;
  clockBtn.textContent = on ? "Reset" : "Start the clock";
  clockBtn.classList.toggle("btn--primary", !on);
  clockBtn.classList.toggle("btn--ghost", on);
  clockBtn.setAttribute("aria-label", on ? "Reset" : "Start the clock");
  for (const btn of targetButtons.values()) {
    btn.disabled = on;
  }
}

function tick() {
  if (!playing) return;

  const elapsed = (performance.now() - startMs) / 1000;
  const cap = targetCap();
  const dollars = dollarsAtElapsed(elapsed, { cap });
  const hitTarget = dollars >= cap;
  setMeter(dollars, hitTarget);

  for (const { row, countdown, seconds } of rows.values()) {
    const until = seconds - elapsed;

    if (until <= 0) {
      // Counter has reached this value — light turns on and stays on
      row.classList.add("is-lit");
      row.classList.remove("is-active", "is-done");
      countdown.hidden = true;
      countdown.textContent = "";
    } else {
      // Not yet — light stays off
      row.classList.remove("is-lit", "is-done");
      row.classList.add("is-active");
      countdown.hidden = false;
      countdown.textContent = formatUntilLit(until);
    }
  }

  if (hitTarget) {
    finishClock();
    return;
  }

  tickId = window.setTimeout(tick, elapsed < 2 ? 50 : 100);
}

function startClock() {
  if (playing) return;
  window.clearTimeout(tickId);
  anchorAt = new Date();
  rebuildLadder();
  setAllUnlit();
  setMeter(0, false);
  startMs = performance.now();
  setPlaying(true);
  tick();
}

function finishClock() {
  window.clearTimeout(tickId);
  setPlaying(false);
}

function stopClock() {
  window.clearTimeout(tickId);
  setPlaying(false);
  anchorAt = new Date();
  rebuildLadder();
  setAllUnlit();
  setMeter(0, false);
}

mountTargets();
rebuildLadder();
setAllUnlit();
clockBtn.addEventListener("click", () => {
  if (playing) stopClock();
  else startClock();
});

window.__bignumbersTrillion = {
  TARGETS,
  secondsFor,
  formatDuration,
  formatExtinguishAt,
  formatDollars,
};
