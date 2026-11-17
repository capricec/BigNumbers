/** Start at 10¹; each “Add a zero” raises the power by 1, up to octillion. */
export const START_POWER = 1;
export const MAX_POWER = 27; // octillion = 10²⁷
export const BRANCH_FACTOR = 10;

/** Bundle thresholds — limb thickness encodes how many tips sit under a branch. */
export const MILLION = 1e6;
export const BILLION = 1e9;
export const TRILLION = 1e12;

export const COLOR_TIERS = [
  { power: 6, name: "Million", color: 0xf0b429, minWeight: MILLION },
  { power: 9, name: "Billion", color: 0x5ec8ff, minWeight: BILLION },
  { power: 12, name: "Trillion", color: 0x7dffb3, minWeight: TRILLION },
  { power: 15, name: "Quadrillion", color: 0xff3db8, minWeight: 1e15 },
  { power: 18, name: "Quintillion", color: 0xff8f5c, minWeight: 1e18 },
  { power: 21, name: "Sextillion", color: 0xb49cff, minWeight: 1e21 },
  { power: 24, name: "Septillion", color: 0x4fd1c5, minWeight: 1e24 },
  { power: 27, name: "Octillion", color: 0xffe66d, minWeight: 1e27 },
];

export const PRE_MILLION_COLOR = 0xd4a017;

const TIER_NAMES = [
  { power: 3, name: "Thousand" },
  ...COLOR_TIERS.map(({ power, name }) => ({ power, name })),
];

export function colorForLayerPower(layerPower) {
  if (layerPower < 6) return PRE_MILLION_COLOR;
  let color = COLOR_TIERS[0].color;
  for (const t of COLOR_TIERS) {
    if (layerPower >= t.power) color = t.color;
  }
  return color;
}

/**
 * Color + thickness from how many tips sit under a limb.
 * Thresholds are a bit below the round -illion so the 10 primary arms
 * at 1 Million (1e5 tips each) already read as million bundles.
 */
export function bundleStyleForWeight(weight) {
  if (weight >= 1e11) {
    return {
      name: "Trillion bundle",
      color: 0x7dffb3,
      radius: 0.24,
      kind: "trillion",
    };
  }
  if (weight >= 1e8) {
    return {
      name: "Billion bundle",
      color: 0x5ec8ff,
      radius: 0.15,
      kind: "billion",
    };
  }
  if (weight >= 1e5) {
    return {
      name: "Million bundle",
      color: 0xf0b429,
      radius: 0.09,
      kind: "million",
    };
  }
  return {
    name: "branch",
    color: PRE_MILLION_COLOR,
    radius: 0,
    kind: "thin",
  };
}

export function visibleColorTiers(power) {
  if (power < 6) return [];
  return COLOR_TIERS.filter((t) => power >= t.power);
}

export function valueForPower(power) {
  return 10 ** power;
}

export function formatBigNumber(power) {
  if (power < 3) {
    return valueForPower(power).toLocaleString("en-US");
  }

  let tier = TIER_NAMES[0];
  for (const t of TIER_NAMES) {
    if (power >= t.power) tier = t;
  }

  const leading = 10 ** (power - tier.power);
  if (leading === 1) return `1 ${tier.name}`;
  return `${leading.toLocaleString("en-US")} ${tier.name}`;
}

export function formatPowerLabel(power) {
  return `10${toSuperscript(power)}`;
}

export function formatTipCount(power) {
  return `${formatBigNumber(power)} tips`;
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
