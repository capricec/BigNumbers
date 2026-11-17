import {
  BENEFITS,
  BUDGET_WH,
  PARADIGMS,
  costWh,
  formatBudgetWh,
  formatCount,
  formatWh,
  getParadigm,
  getScale,
} from "./content.js";

const benefitListEl = document.getElementById("benefit-list");
const meterLabelEl = document.getElementById("meter-label");
const meterTrackEl = document.getElementById("meter-track");
const meterLegendEl = document.getElementById("meter-legend");
const resetBtn = document.getElementById("spend-reset");

/** @type {Map<string, string | null>} benefitId → scaleId */
const allocations = new Map(BENEFITS.map((b) => [b.id, null]));

/** @type {Map<string, { root: HTMLElement, pops: Map<string, HTMLButtonElement> }>} */
const rows = new Map();

function allocationCost(benefitId) {
  const scaleId = allocations.get(benefitId);
  const benefit = BENEFITS.find((b) => b.id === benefitId);
  if (!scaleId || !benefit) return 0;
  const scale = getScale(benefit.paradigm, scaleId);
  if (!scale) return 0;
  return costWh(scale.count, benefit.wh);
}

function totalSpent() {
  let sum = 0;
  for (const id of allocations.keys()) sum += allocationCost(id);
  return sum;
}

function spentExcluding(benefitId) {
  let sum = 0;
  for (const id of allocations.keys()) {
    if (id === benefitId) continue;
    sum += allocationCost(id);
  }
  return sum;
}

function canAfford(benefitId, scaleId) {
  const benefit = BENEFITS.find((b) => b.id === benefitId);
  if (!benefit) return false;
  const scale = getScale(benefit.paradigm, scaleId);
  if (!scale) return false;
  const cost = costWh(scale.count, benefit.wh);
  return spentExcluding(benefitId) + cost <= BUDGET_WH + 1e-6;
}

function setAllocation(benefitId, scaleId) {
  const current = allocations.get(benefitId);
  if (current === scaleId) {
    allocations.set(benefitId, null);
  } else if (canAfford(benefitId, scaleId)) {
    allocations.set(benefitId, scaleId);
  }
  render();
}

function hasSelections() {
  for (const scaleId of allocations.values()) {
    if (scaleId) return true;
  }
  return false;
}

function clearAll() {
  for (const id of allocations.keys()) {
    allocations.set(id, null);
  }
  render();
}

function scaleButtonLabel(scale, paradigm) {
  if (scale.note) return scale.note;
  return `${scale.label} ${paradigm.unit}`;
}

function mount() {
  for (const benefit of BENEFITS) {
    const paradigm = getParadigm(benefit.paradigm);
    const li = document.createElement("li");
    li.className = "benefit";
    li.dataset.id = benefit.id;

    const media = document.createElement("img");
    media.className = "benefit__media";
    media.src = benefit.image;
    media.alt = "";
    media.width = 88;
    media.height = 88;

    const copy = document.createElement("div");
    copy.className = "benefit__copy";

    const name = document.createElement("h3");
    name.className = "benefit__name";
    name.textContent = benefit.name;

    const detail = document.createElement("p");
    detail.className = "benefit__detail";
    detail.textContent = `${benefit.wh} Wh`;
    copy.append(name, detail);

    const pops = document.createElement("div");
    pops.className = "pops";
    pops.setAttribute("role", "radiogroup");
    pops.setAttribute(
      "aria-label",
      `How many ${paradigm.unit} get ${benefit.name.toLowerCase()}`
    );

    const popButtons = new Map();
    for (const scale of paradigm.scales) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "pop";
      btn.dataset.scaleId = scale.id;
      btn.setAttribute("role", "radio");
      btn.setAttribute("aria-checked", "false");
      btn.setAttribute("aria-label", scaleButtonLabel(scale, paradigm));
      btn.textContent = scaleButtonLabel(scale, paradigm);
      btn.addEventListener("click", () => setAllocation(benefit.id, scale.id));
      pops.append(btn);
      popButtons.set(scale.id, btn);
    }

    li.append(media, copy, pops);
    benefitListEl.append(li);
    rows.set(benefit.id, { root: li, pops: popButtons });
  }

  render();
}

function renderMeter(spent) {
  const usedLabel = formatBudgetWh(spent);
  meterLabelEl.textContent = `${usedLabel} of 1 TWh used`;
  meterTrackEl.replaceChildren();
  meterLegendEl.replaceChildren();

  const active = [];
  for (const benefit of BENEFITS) {
    const cost = allocationCost(benefit.id);
    if (cost <= 0) continue;
    active.push({ benefit, cost });
  }

  for (const { benefit, cost } of active) {
    const seg = document.createElement("span");
    seg.className = "meter__seg";
    seg.style.flexGrow = String(cost);
    seg.style.background = benefit.color;
    seg.title = `${benefit.legend}: ${formatBudgetWh(cost)}`;
    meterTrackEl.append(seg);

    const item = document.createElement("li");
    item.className = "meter__legend-item";
    const swatch = document.createElement("span");
    swatch.className = "meter__swatch";
    swatch.style.background = benefit.color;
    const text = document.createElement("span");
    text.textContent = benefit.legend;
    item.append(swatch, text);
    meterLegendEl.append(item);
  }

  const unused = Math.max(0, BUDGET_WH - spent);
  if (unused > 1e-6 || active.length === 0) {
    const empty = document.createElement("span");
    empty.className = "meter__seg meter__seg--empty";
    empty.style.flexGrow = String(unused > 0 ? unused : BUDGET_WH);
    meterTrackEl.append(empty);
  }

  meterTrackEl.setAttribute(
    "aria-label",
    `${usedLabel} of 1 TWh used across ${active.length} categories`
  );
}

function render() {
  const spent = totalSpent();
  renderMeter(spent);
  resetBtn.hidden = !hasSelections();

  for (const benefit of BENEFITS) {
    const row = rows.get(benefit.id);
    const selectedId = allocations.get(benefit.id);

    row.root.classList.toggle("is-active", Boolean(selectedId));
    row.root.style.setProperty("--benefit-color", benefit.color);

    for (const [scaleId, btn] of row.pops) {
      const on = scaleId === selectedId;
      const affordable = on || canAfford(benefit.id, scaleId);
      btn.classList.toggle("is-selected", on);
      btn.classList.toggle("is-disabled", !affordable);
      btn.disabled = !affordable;
      btn.setAttribute("aria-checked", on ? "true" : "false");
    }
  }
}

resetBtn.addEventListener("click", clearAll);
mount();

window.__bignumbersTwh = {
  BENEFITS,
  PARADIGMS,
  BUDGET_WH,
  costWh,
  totalSpent,
  formatCount,
  formatWh,
};
