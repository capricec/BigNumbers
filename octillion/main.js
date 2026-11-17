import {
  BRANCH_FACTOR,
  COLOR_TIERS,
  MAX_POWER,
  PRE_MILLION_COLOR,
  START_POWER,
  formatBigNumber,
  formatPowerLabel,
  formatTipCount,
} from "./content.js";
import { createTreeView } from "./treeView.js";

const stage = document.getElementById("tree-stage");
const numberValue = document.getElementById("number-value");
const numberMeta = document.getElementById("number-meta");
const addZeroBtn = document.getElementById("add-zero");
const resetBtn = document.getElementById("reset-tree");
const legendEl = document.getElementById("tier-legend");

const tree = createTreeView(stage);
let power = START_POWER;

/** Always-visible figure jumps (legend + skip links). */
const FIGURE_JUMPS = [
  { power: START_POWER, name: "Start", color: PRE_MILLION_COLOR },
  { power: 6, name: "Million", color: 0xf0b429 },
  { power: 9, name: "Billion", color: 0x5ec8ff },
  { power: 12, name: "Trillion", color: 0x7dffb3 },
  ...COLOR_TIERS.filter((t) => t.power > 12).map((t) => ({
    power: t.power,
    name: t.name,
    color: t.color,
  })),
];

function activeJumpIndex(currentPower) {
  let idx = 0;
  for (let i = 0; i < FIGURE_JUMPS.length; i += 1) {
    if (currentPower >= FIGURE_JUMPS[i].power) idx = i;
  }
  return idx;
}

function refreshLegend() {
  const active = activeJumpIndex(power);
  legendEl.replaceChildren();
  legendEl.hidden = false;

  for (let i = 0; i < FIGURE_JUMPS.length; i += 1) {
    const tier = FIGURE_JUMPS[i];
    const li = document.createElement("li");
    li.className = "tier-legend__item";

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "tier-legend__jump";
    if (i === active) {
      btn.classList.add("is-active");
      btn.setAttribute("aria-current", "true");
    }
    btn.title = `Skip to ${tier.name} (10${toSuperscript(tier.power)})`;
    btn.addEventListener("click", () => setPower(tier.power));

    const swatch = document.createElement("span");
    swatch.className = "tier-legend__swatch";
    const hex = `#${tier.color.toString(16).padStart(6, "0")}`;
    swatch.style.background = hex;
    swatch.style.color = hex;

    const label = document.createElement("span");
    label.className = "tier-legend__label";
    label.textContent = tier.name;

    btn.append(swatch, label);
    li.append(btn);
    legendEl.append(li);
  }
}

function toSuperscript(n) {
  const map = {
    0: "⁰",
    1: "¹",
    2: "²",
    3: "³",
    4: "⁴",
    5: "⁵",
    6: "⁶",
    7: "⁷",
    8: "⁸",
    9: "⁹",
  };
  return String(n)
    .split("")
    .map((d) => map[d] ?? d)
    .join("");
}

function refreshHud() {
  numberValue.textContent = formatBigNumber(power);
  numberMeta.textContent = `${formatPowerLabel(power)} · ${formatTipCount(power)} · ×${BRANCH_FACTOR} each step`;
  addZeroBtn.disabled = power >= MAX_POWER;
  addZeroBtn.textContent =
    power >= MAX_POWER ? "Octillion reached" : "Add a zero";
  refreshLegend();
}

function setPower(next) {
  power = Math.max(START_POWER, Math.min(MAX_POWER, next));
  tree.setPower(power);
  refreshHud();
}

addZeroBtn.addEventListener("click", () => {
  if (power >= MAX_POWER) return;
  setPower(power + 1);
});

resetBtn.addEventListener("click", () => {
  setPower(START_POWER);
});

refreshHud();

window.__bignumbersOctillion = {
  getPower: () => power,
  setPower,
  MAX_POWER,
  debug: () => tree.debug?.(),
};
