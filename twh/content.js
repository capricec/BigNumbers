/** 1 TWh expressed in watt-hours — the shared budget for this story. */
export const BUDGET_TWH = 1;
export const BUDGET_WH = 1e12; // 1 TWh = 10¹² Wh

export const WORLD_PEOPLE = 8.2e9;
export const WORLD_HOUSEHOLDS = 2.2e9;

/** Audience scales for per-person benefits. */
export const PERSON_SCALES = [
  { id: "1m", count: 1e6, label: "1 million" },
  { id: "10m", count: 1e7, label: "10 million" },
  { id: "100m", count: 1e8, label: "100 million" },
  { id: "1b", count: 1e9, label: "1 billion" },
  {
    id: "earth",
    count: WORLD_PEOPLE,
    label: "8.2 billion",
    note: "every person on Earth",
  },
];

/** Audience scales for per-household benefits. */
export const HOUSEHOLD_SCALES = [
  { id: "1m", count: 1e6, label: "1 million" },
  { id: "10m", count: 1e7, label: "10 million" },
  { id: "100m", count: 1e8, label: "100 million" },
  { id: "1b", count: 1e9, label: "1 billion" },
  {
    id: "earth",
    count: WORLD_HOUSEHOLDS,
    label: "2.2 billion",
    note: "every household on Earth",
  },
];

export const PARADIGMS = [
  {
    id: "person",
    unit: "people",
    unitSingular: "person",
    scales: PERSON_SCALES,
  },
  {
    id: "household",
    unit: "households",
    unitSingular: "household",
    scales: HOUSEHOLD_SCALES,
  },
];

/**
 * Everyday benefits measured in Wh per person or household for one serving.
 * Illustrative estimates, not measured universal appliance averages.
 */
export const BENEFITS = [
  {
    id: "phone",
    paradigm: "person",
    name: "A full phone charge",
    legend: "Phone Charging",
    wh: 15,
    detail: "One full smartphone charge",
    color: "#e85d8e",
    image: "./media/phone.svg",
  },
  {
    id: "light",
    paradigm: "person",
    name: "Six hours of light",
    legend: "Personal Lighting",
    wh: 30,
    detail: "Using a 5 W LED",
    color: "#f0b429",
    image: "./media/light.svg",
  },
  {
    id: "fan",
    paradigm: "household",
    name: "Eight hours of fan use",
    legend: "Fans",
    wh: 320,
    detail: "One 40-watt fan",
    color: "#8b6ccf",
    image: "./media/fan.svg",
  },
  {
    id: "computer",
    paradigm: "person",
    name: "8 Hours of laptop use",
    legend: "Computer Use",
    wh: 400,
    detail: "A laptop at 50 W for 8 hours · 0.4 kWh",
    color: "#5b8def",
    image: "./media/computer.svg",
  },
  {
    id: "laundry",
    paradigm: "household",
    name: "One load of laundry",
    legend: "Washing Machines",
    wh: 500,
    detail: "Approximate per-load energy",
    color: "#e8833a",
    image: "./media/laundry.svg",
  },
  {
    id: "fridge",
    paradigm: "household",
    name: "Keep a refrigerator running",
    legend: "Refrigeration",
    wh: 1000,
    detail: "1 kWh per day",
    color: "#2bb3a3",
    image: "./media/fridge.svg",
  },
  {
    id: "ac",
    paradigm: "household",
    name: "Air conditioning",
    legend: "Air Conditioning",
    wh: 6350,
    detail: "Average per household per day · 6.35 kWh",
    color: "#6c7cff",
    image: "./media/ac.svg",
  },
];

export function getParadigm(id) {
  return PARADIGMS.find((p) => p.id === id) ?? PARADIGMS[0];
}

export function getScale(paradigmId, scaleId) {
  const paradigm = getParadigm(paradigmId);
  return paradigm.scales.find((s) => s.id === scaleId) ?? null;
}

export function benefitsFor(paradigmId) {
  return BENEFITS.filter((b) => b.paradigm === paradigmId);
}

/** Energy cost to give one full serving to N people or households. */
export function costWh(count, benefitWh) {
  return count * benefitWh;
}

export function formatCount(n, unit) {
  const amount = formatAmount(n);
  return `${amount} ${unit}`;
}

export function formatAmount(n) {
  if (n >= 1e9) {
    const b = n / 1e9;
    return Number.isInteger(b) ? `${b} billion` : `${trim(b)} billion`;
  }
  if (n >= 1e6) {
    const m = n / 1e6;
    return Number.isInteger(m) ? `${m} million` : `${trim(m)} million`;
  }
  return n.toLocaleString("en-US");
}

export function formatWh(wh) {
  const abs = Math.abs(wh);
  const sign = wh < 0 ? "−" : "";
  if (abs >= 1e12) return `${sign}${trim(abs / 1e12)} TWh`;
  if (abs >= 1e9) return `${sign}${trim(abs / 1e9)} GWh`;
  if (abs >= 1e6) return `${sign}${trim(abs / 1e6)} MWh`;
  if (abs >= 1e3) return `${sign}${trim(abs / 1e3)} kWh`;
  return `${sign}${trim(abs)} Wh`;
}

/** Prefer TWh for budget readout when at least 0.001 TWh. */
export function formatBudgetWh(wh) {
  const twh = wh / 1e12;
  if (Math.abs(twh) >= 0.001 || wh === 0) {
    const rounded = Math.round(twh * 1000) / 1000;
    return `${rounded < 0 ? "−" : ""}${trim(Math.abs(rounded))} TWh`;
  }
  return formatWh(wh);
}

function trim(n) {
  const t = Math.round(n * 1000) / 1000;
  return Number.isInteger(t) ? String(t) : String(t);
}
