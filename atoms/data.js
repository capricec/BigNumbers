/**
 * One unit = one atom, laid flat.
 * Assumed footprint: 10⁻²⁰ m² per atom.
 *
 * Area(N) = N × 10⁻²⁰ m²
 * Side of square = √Area
 *
 * Octillion atoms (10²⁷) → 10⁷ m² = 10 km² → ~3.16 km on a side.
 */

export const ATOM_AREA_M2 = 1e-20;

/**
 * Editable map focus — swap these later without touching the rest.
 * Belvedere greenspace pin (user-tuned): 40.77927, -73.96848.
 */
export const MAP_CENTER = {
  name: "Belvedere greenspace, Central Park",
  lng: -73.96848,
  lat: 40.77927,
};

/**
 * Manhattan’s street grid is ~29° clockwise from true north.
 * Map bearing + square rotation share this so avenue/street lines
 * match the square edges.
 */
export const MANHATTAN_BEARING = 29;

/** Street/topo tiles are sharp through here. */
export const MAP_MAX_ZOOM = 19;

/**
 * Deep overzoom past Esri’s native ~z19.
 * GPT-1 ~z28; a slow nudge past that for the trillion speck (~z30).
 */
export const MAP_MAX_ZOOM_SATELLITE = 32;

/** Below this on-screen size, the square is past what the map can resolve. */
export const MIN_READABLE_SIDE_PX = 16;

/**
 * Topo → satellite near GPT-4. Custom zoom photos cover the soft stretch
 * past satellite; GPT-1 still wants imagery beyond tile overzoom.
 */
export const ZOOM_BREAK = {
  lastOkId: "gpt35",
  firstBrokenId: "gpt2",
  lastOkZoom: 18.4,
  firstBrokenZoom: 22.9,
  mapMaxZoom: MAP_MAX_ZOOM,
  satelliteMaxZoom: MAP_MAX_ZOOM_SATELLITE,
  summary:
    "Topo → satellite near GPT-4. Zoom photos cover GPT-2 → GPT-1; final stop still needs custom imagery beyond tiles.",
};

/**
 * Web-Mercator meters per pixel at a given zoom + latitude.
 * MapLibre’s world size uses tileSize 512 (not 256), so the equator
 * constant is circumference/512 ≈ 78271.52 — using the 256-based
 * 156543 made photo overlays render at half the square size.
 */
export function metersPerPixel(zoom, lat) {
  return (
    (78271.51696 * Math.cos((lat * Math.PI) / 180)) / 2 ** zoom
  );
}

/** Approximate map zoom needed to frame `sideMeters` in a viewport. */
export function zoomToFitSide(sideMeters, viewportMinPx, lat, paddingFrac = 0.35) {
  const usable = viewportMinPx * (1 - paddingFrac);
  const targetMpp = sideMeters / Math.max(usable, 1);
  const zoom =
    Math.log2((78271.51696 * Math.cos((lat * Math.PI) / 180)) / targetMpp);
  return zoom;
}

/**
 * Zoom stops, largest → smallest (scroll zooms in).
 * Counts are training-FLOP stand-ins expressed as atom counts for area.
 */
export const ATOM_STOPS = [
  {
    id: "octillion",
    name: "1 octillion",
    label: "1 octillion atoms",
    atoms: 1e27,
    color: "#1c2a33",
    accent: "#0f1a22",
  },
  {
    id: "gpt6",
    name: "GPT-6",
    label: "GPT-6 Astra",
    atoms: 940e24, // 9.4 × 10²⁶
    multiplier: "50× GPT-4",
    color: "#1a4f8b",
    accent: "#0d3a6b",
  },
  {
    id: "gpt4",
    name: "GPT-4",
    label: "GPT-4",
    atoms: 21e24, // 2.1 × 10²⁵
    multiplier: "1,000,000× GPT-1",
    color: "#c45c26",
    accent: "#a34818",
  },
  {
    id: "gpt35",
    name: "GPT-3.5",
    label: "GPT-3.5",
    atoms: 2.6e24,
    multiplier: "140,000× GPT-1",
    color: "#0d7c6e",
    accent: "#0a5f54",
  },
  {
    id: "gpt2",
    name: "GPT-2",
    label: "GPT-2",
    atoms: 5e21,
    multiplier: "300× GPT-1",
    color: "#7a5ad4",
    accent: "#5a3ab0",
  },
  {
    id: "gpt1",
    name: "GPT-1",
    label: "GPT-1",
    atoms: 18e18, // 1.8 × 10¹⁹
    multiplier: "baseline",
    color: "#2f7fd4",
    accent: "#1a5fad",
  },
  {
    id: "trillion",
    name: "1 trillion",
    label: "A trillion atoms",
    // 10¹² × 10⁻²⁰ m² = 10⁻⁸ m² → side 10⁻⁴ m = 0.1 mm ≈ one pixel
    atoms: 1e12,
    multiplier: "1 / 18,000,000 of GPT-1",
    color: "#c45c26",
    accent: "#a34818",
  },
];

export function areaM2(atoms) {
  return atoms * ATOM_AREA_M2;
}

export function sideMeters(atoms) {
  return Math.sqrt(areaM2(atoms));
}

export function log10Atoms(atoms) {
  return Math.log10(atoms);
}

export function atomsFromLog10(log10) {
  return 10 ** log10;
}

export function nearestStop(log10) {
  let best = ATOM_STOPS[0];
  let bestDist = Infinity;
  for (const stop of ATOM_STOPS) {
    const d = Math.abs(log10Atoms(stop.atoms) - log10);
    if (d < bestDist) {
      bestDist = d;
      best = stop;
    }
  }
  return best;
}

/**
 * Which named squares matter for the current scroll position.
 * Stops are ordered large → small; "incoming" is the next smaller footprint.
 */
export function stopNeighborhood(log10) {
  for (let i = 0; i < ATOM_STOPS.length - 1; i++) {
    const larger = ATOM_STOPS[i];
    const smaller = ATOM_STOPS[i + 1];
    const lo = log10Atoms(smaller.atoms);
    const hi = log10Atoms(larger.atoms);
    if (log10 <= hi && log10 >= lo) {
      const t = (hi - log10) / Math.max(hi - lo, 1e-9); // 0 at larger, 1 at smaller
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
  const idx = ATOM_STOPS.findIndex((s) => s.id === active.id);
  return {
    larger: ATOM_STOPS[Math.max(0, idx - 1)] ?? active,
    smaller: ATOM_STOPS[Math.min(ATOM_STOPS.length - 1, idx + 1)] ?? active,
    progress: 0,
    active,
    incoming: ATOM_STOPS[Math.min(ATOM_STOPS.length - 1, idx + 1)] ?? active,
    outgoing: ATOM_STOPS[Math.max(0, idx - 1)] ?? active,
  };
}

/** Human-readable area for copy and HUD. */
export function formatArea(atoms) {
  const m2 = areaM2(atoms);
  // Prefer km² once we're into city-block scale (e.g. GPT-4 → 0.21 km²)
  if (m2 >= 1e4) {
    const km2 = m2 / 1e6;
    return {
      primary: `${trimNum(km2)} km²`,
      detail: `${trimNum(m2)} m²`,
      side: formatLength(sideMeters(atoms)),
    };
  }
  if (m2 >= 1) {
    return {
      primary: `${trimNum(m2)} m²`,
      detail: `${trimNum(m2 * 1e6)} mm²`,
      side: formatLength(sideMeters(atoms)),
    };
  }
  // Fractions of a square meter (e.g. GPT-1 → 0.18 m²) stay in m² —
  // avoid unreadable values like "180000 mm²".
  if (m2 >= 0.001) {
    return {
      primary: `${trimNum(m2)} m²`,
      detail: `${trimNum(m2 * 1e4)} cm²`,
      side: formatLength(sideMeters(atoms)),
    };
  }
  if (m2 >= 1e-6) {
    return {
      primary: `${trimNum(m2 * 1e6)} mm²`,
      detail: `${trimNum(m2)} m²`,
      side: formatLength(sideMeters(atoms)),
    };
  }
  return {
    primary: `${trimNum(m2 * 1e12)} µm²`,
    detail: `${trimNum(m2)} m²`,
    side: formatLength(sideMeters(atoms)),
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

export function formatAtoms(atoms) {
  const exp = Math.floor(Math.log10(atoms));
  const coeff = atoms / 10 ** exp;
  if (Math.abs(coeff - 1) < 0.05) return `10${toSuperscript(exp)}`;
  return `${trimNum(coeff)}×10${toSuperscript(exp)}`;
}

/** Full digit string with commas, e.g. 940,000,000,000,000,000,000,000,000 */
export function formatAtomsDigits(atoms) {
  if (!Number.isFinite(atoms) || atoms <= 0) return "0";
  const exp = Math.floor(Math.log10(atoms) + 1e-12);
  const rounded = Number((atoms / 10 ** exp).toPrecision(3));
  const coeffStr = rounded.toString();
  if (/e/i.test(coeffStr)) {
    // Extremely large/small edge case — fall back to 1 + zeros
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

/**
 * Square of `sideMeters` centered on lng/lat, rotated by `bearingDeg`
 * (clockwise from north) so edges can match Manhattan’s grid.
 */
export function squareRing(lng, lat, sideMeters, bearingDeg = MANHATTAN_BEARING) {
  const half = sideMeters / 2;
  const corners = [
    [-half, -half],
    [half, -half],
    [half, half],
    [-half, half],
    [-half, -half],
  ];
  // Clockwise rotation — same convention as MapLibre map bearing
  const a = (bearingDeg * Math.PI) / 180;
  const cosB = Math.cos(a);
  const sinB = Math.sin(a);
  const cosLat = Math.max(Math.cos((lat * Math.PI) / 180), 0.2);

  return corners.map(([x, y]) => {
    const rx = x * cosB + y * sinB;
    const ry = -x * sinB + y * cosB;
    return [lng + rx / (111_320 * cosLat), lat + ry / 111_320];
  });
}

export function squareBounds(lng, lat, sideMeters, bearingDeg = MANHATTAN_BEARING) {
  const ring = squareRing(lng, lat, sideMeters, bearingDeg);
  let west = Infinity;
  let south = Infinity;
  let east = -Infinity;
  let north = -Infinity;
  for (const [x, y] of ring) {
    west = Math.min(west, x);
    east = Math.max(east, x);
    south = Math.min(south, y);
    north = Math.max(north, y);
  }
  return [
    [west, south],
    [east, north],
  ];
}
