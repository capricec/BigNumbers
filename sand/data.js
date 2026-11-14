/**
 * Sand story data.
 * One unit = one grain of sand.
 * Assumed volume per grain (medium quartz sand ≈ 0.5 mm across as a cube):
 *   (5×10⁻⁴ m)³ = 1.25×10⁻¹⁰ m³
 */

export const GRAIN_VOLUME_M3 = 1.25e-10;

/**
 * Same training-FLOP stand-ins as the Atoms story — here each FLOP is a grain.
 * Ordered large → small (scroll zooms the pile down).
 */
export const SAND_STOPS = [
  {
    id: "gpt6",
    name: "GPT-6",
    label: "GPT-6 Astra",
    grains: 940e24, // 9.4 × 10²⁶
    color: "#1a4f8b",
    accent: "#0d3a6b",
  },
  {
    id: "gpt4",
    name: "GPT-4",
    label: "GPT-4",
    grains: 21e24,
    color: "#c45c26",
    accent: "#a34818",
  },
  {
    id: "gpt35",
    name: "GPT-3.5",
    label: "GPT-3.5",
    grains: 2.6e24,
    color: "#0d7c6e",
    accent: "#0a5f54",
  },
  {
    id: "gpt2",
    name: "GPT-2",
    label: "GPT-2",
    grains: 5e21,
    color: "#7a5ad4",
    accent: "#5a3ab0",
  },
  {
    id: "gpt1",
    name: "GPT-1",
    label: "GPT-1",
    grains: 18e18,
    color: "#2f7fd4",
    accent: "#1a5fad",
  },
  {
    id: "trillion",
    name: "1 trillion",
    label: "A trillion grains",
    grains: 1e12,
    color: "#c45c26",
    accent: "#a34818",
  },
];

export function volumeM3(grains) {
  return grains * GRAIN_VOLUME_M3;
}

/** Side of a cube with the same volume as N grains. */
export function cubeSideMeters(grains) {
  return Math.cbrt(volumeM3(grains));
}

export function log10Grains(grains) {
  return Math.log10(grains);
}

export function grainsFromLog10(log10) {
  return 10 ** log10;
}

export function nearestStop(log10) {
  let best = SAND_STOPS[0];
  let bestDist = Infinity;
  for (const stop of SAND_STOPS) {
    const d = Math.abs(log10Grains(stop.grains) - log10);
    if (d < bestDist) {
      bestDist = d;
      best = stop;
    }
  }
  return best;
}

export function stopNeighborhood(log10) {
  for (let i = 0; i < SAND_STOPS.length - 1; i++) {
    const larger = SAND_STOPS[i];
    const smaller = SAND_STOPS[i + 1];
    const lo = log10Grains(smaller.grains);
    const hi = log10Grains(larger.grains);
    if (log10 <= hi && log10 >= lo) {
      const t = (hi - log10) / Math.max(hi - lo, 1e-9);
      return {
        larger,
        smaller,
        progress: t,
        active: t < 0.5 ? larger : smaller,
        incoming: smaller,
        outgoing: larger,
      };
    }
  }
  const active = nearestStop(log10);
  const idx = SAND_STOPS.findIndex((s) => s.id === active.id);
  return {
    larger: SAND_STOPS[Math.max(0, idx - 1)] ?? active,
    smaller: SAND_STOPS[Math.min(SAND_STOPS.length - 1, idx + 1)] ?? active,
    progress: 0,
    active,
    incoming: SAND_STOPS[Math.min(SAND_STOPS.length - 1, idx + 1)] ?? active,
    outgoing: SAND_STOPS[Math.max(0, idx - 1)] ?? active,
  };
}

export function formatVolume(grains) {
  const m3 = volumeM3(grains);
  if (m3 >= 1e9) {
    return {
      primary: `${trimNum(m3 / 1e9)} km³`,
      detail: `${trimNum(m3)} m³`,
      side: formatLength(cubeSideMeters(grains)),
    };
  }
  if (m3 >= 1e6) {
    return {
      primary: `${trimNum(m3 / 1e6)} million m³`,
      detail: `${trimNum(m3)} m³`,
      side: formatLength(cubeSideMeters(grains)),
    };
  }
  if (m3 >= 1) {
    return {
      primary: `${trimNum(m3)} m³`,
      detail: `${trimNum(m3 * 1e3)} L`,
      side: formatLength(cubeSideMeters(grains)),
    };
  }
  if (m3 >= 1e-3) {
    return {
      primary: `${trimNum(m3 * 1e3)} L`,
      detail: `${trimNum(m3 * 1e6)} mL`,
      side: formatLength(cubeSideMeters(grains)),
    };
  }
  if (m3 >= 1e-6) {
    return {
      primary: `${trimNum(m3 * 1e6)} mL`,
      detail: `${trimNum(m3 * 1e9)} µL`,
      side: formatLength(cubeSideMeters(grains)),
    };
  }
  return {
    primary: `${trimNum(m3 * 1e9)} mm³`,
    detail: `${trimNum(m3)} m³`,
    side: formatLength(cubeSideMeters(grains)),
  };
}

export function formatLength(meters) {
  if (meters >= 1000) return `${trimNum(meters / 1000)} km`;
  if (meters >= 1) return `${trimNum(meters)} m`;
  if (meters >= 0.01) return `${trimNum(meters * 100)} cm`;
  if (meters >= 1e-3) return `${trimNum(meters * 1e3)} mm`;
  if (meters >= 1e-6) return `${trimNum(meters * 1e6)} µm`;
  return `${trimNum(meters * 1e9)} nm`;
}

export function formatGrains(grains) {
  const exp = Math.floor(Math.log10(grains));
  const coeff = grains / 10 ** exp;
  if (Math.abs(coeff - 1) < 0.05) return `10${toSuperscript(exp)}`;
  return `${trimNum(coeff)}×10${toSuperscript(exp)}`;
}

export function formatGrainsDigits(grains) {
  if (!Number.isFinite(grains) || grains <= 0) return "0";
  const exp = Math.floor(Math.log10(grains) + 1e-12);
  const rounded = Number((grains / 10 ** exp).toPrecision(3));
  const coeffStr = rounded.toString();
  if (/e/i.test(coeffStr)) {
    return `1${"0".repeat(exp)}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  }
  const [whole, frac = ""] = coeffStr.split(".");
  const zeros = Math.max(0, exp - frac.length);
  const digits = `${whole}${frac}${"0".repeat(zeros)}`;
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function trimNum(n) {
  if (n >= 100) return n.toFixed(0);
  if (n >= 10) return n.toFixed(1).replace(/\.0$/, "");
  if (n >= 1) return n.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
  return n.toPrecision(2);
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
    "-": "⁻",
  };
  return String(n)
    .split("")
    .map((c) => map[c] ?? c)
    .join("");
}
