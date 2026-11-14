import { Map, setWorkerUrl } from "maplibre-gl";
import maplibreWorker from "maplibre-gl/dist/maplibre-gl-worker.mjs?url";
import "maplibre-gl/dist/maplibre-gl.css";
import {
  ATOM_STOPS,
  MAP_CENTER,
  MAP_MAX_ZOOM,
  MAP_MAX_ZOOM_SATELLITE,
  MANHATTAN_BEARING,
  MIN_READABLE_SIDE_PX,
  ZOOM_BREAK,
  atomsFromLog10,
  sideMeters,
  squareRing,
  formatArea,
  formatAtoms,
  formatLength,
  nearestStop,
  stopNeighborhood,
  metersPerPixel,
  zoomToFitSide,
} from "./data.js";

// Vite serves the worker as a separate asset; point MapLibre at it explicitly.
setWorkerUrl(maplibreWorker);

const ESRI_ATTR = 'Tiles &copy; <a href="https://www.esri.com/">Esri</a>';

/**
 * Free raster basemaps (no API key). Topo crossfades to World Imagery
 * near GPT-4. Tile path is {z}/{y}/{x}.
 */
const BASEMAP_STYLE = {
  version: 8,
  name: "Esri Topo → Satellite",
  sources: {
    topo: {
      type: "raster",
      tiles: [
        "https://services.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}",
      ],
      tileSize: 256,
      attribution: ESRI_ATTR,
      maxzoom: 19,
    },
    satellite: {
      type: "raster",
      tiles: [
        "https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      ],
      tileSize: 256,
      attribution: ESRI_ATTR,
      // Native tiles ~z19; MapLibre overzooms beyond for GPT-2 → GPT-1
      maxzoom: 19,
    },
  },
  layers: [
    {
      id: "basemap-topo",
      type: "raster",
      source: "topo",
      paint: { "raster-opacity": 1 },
    },
    {
      id: "basemap-satellite",
      type: "raster",
      source: "satellite",
      paint: { "raster-opacity": 0 },
    },
  ],
};

const LOG_GPT6 = Math.log10(940e24);
const LOG_GPT4 = Math.log10(21e24);
const LOG_GPT35 = Math.log10(2.6e24);
const LOG_GPT2 = Math.log10(5e21);
const LOG_GPT1 = Math.log10(18e18);
const LOG_TRILLION = Math.log10(1e12);

/** Linear interpolate in log10 space (a → b by t∈[0,1]). */
function lerpLog(a, b, t) {
  return a + (b - a) * t;
}

/**
 * Zoom imagery — independent of GPT squares. Plates stack bottom→top:
 * only the first fades in from the basemap; later plates fade in on top
 * and stay. Each plate is sized by `groundSideM` with `anchor` (pizza box)
 * pinned to MAP_CENTER — same origin as the GPT squares.
 */
/** GPT-1 side ≈ pizza-box side — square + photo share this. */
const GPT1_SIDE_M = sideMeters(18e18);

const assetUrl = (path) =>
  `${import.meta.env.BASE_URL}${path.replace(/^\//, "")}`;

const ZOOM_PHOTOS = [
  {
    id: "wide",
    src: assetUrl("media/atoms/gpt-wide-picnic.jpg"),
    className: "map-photo map-photo--wide",
    zIndex: 1,
    groundSideM: 30.53,
    // Box slightly above image center in the wide plate
    anchor: [0.499, 0.488],
    fadeIn: [lerpLog(LOG_GPT35, LOG_GPT2, 0.08), lerpLog(LOG_GPT35, LOG_GPT2, 0.28)],
  },
  {
    id: "picnic",
    src: assetUrl("media/atoms/gpt2-picnic.jpg"),
    className: "map-photo map-photo--picnic",
    zIndex: 2,
    groundSideM: 5.92,
    anchor: [0.5, 0.5],
    fadeIn: [lerpLog(LOG_GPT35, LOG_GPT2, 0.45), lerpLog(LOG_GPT35, LOG_GPT2, 0.75)],
  },
  {
    id: "pizza",
    src: assetUrl("media/atoms/gpt1-pizza.jpg"),
    className: "map-photo map-photo--pizza",
    zIndex: 3,
    // Box ≈ 52.6% of cover crop → scale so box side = GPT1_SIDE_M
    groundSideM: GPT1_SIDE_M / 0.526,
    anchor: [0.5, 0.5],
    fadeIn: [lerpLog(LOG_GPT2, LOG_GPT1, 0.35), lerpLog(LOG_GPT2, LOG_GPT1, 0.7)],
  },
];

/**
 * Scroll-driven MapLibre view + SVG squares (drawn in screen space so they
 * always show, even when GeoJSON layers misbehave).
 */
export function createMapView(container) {
  let log10Visible = Math.log10(1e27);
  let ready = false;
  let pendingLog = null;
  let lastBreakdown = null;
  let easedZoom = null;
  let targetZoomHeld = null;
  let zoomRaf = 0;

  const overlay = document.createElement("div");
  overlay.className = "map-square-overlay";
  overlay.setAttribute("aria-hidden", "true");

  const photoLayer = document.createElement("div");
  photoLayer.className = "map-photo-layer";
  const photoImgs = Object.fromEntries(
    ZOOM_PHOTOS.map((layer) => {
      const img = document.createElement("img");
      img.className = layer.className;
      img.src = layer.src;
      img.alt = "";
      img.style.zIndex = String(layer.zIndex);
      photoLayer.appendChild(img);
      return [layer.id, img];
    })
  );
  overlay.appendChild(photoLayer);

  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("class", "map-square-svg");
  overlay.appendChild(svg);

  const map = new Map({
    container,
    style: BASEMAP_STYLE,
    center: [MAP_CENTER.lng, MAP_CENTER.lat],
    zoom: 12,
    bearing: MANHATTAN_BEARING,
    maxZoom: MAP_MAX_ZOOM_SATELLITE,
    attributionControl: { compact: true },
    interactive: false,
    fadeDuration: 0,
  });

  // Append after MapLibre builds its DOM so the SVG sits above the canvas
  container.appendChild(overlay);

  map.on("load", () => {
    ready = true;
    applyLog10(pendingLog ?? log10Visible);
    drawSquares();
  });

  map.on("move", drawSquares);
  map.on("resize", drawSquares);

  function roleFor(stop, neighborhood) {
    if (stop.id === neighborhood.active.id) return "active";
    if (stop.id === neighborhood.incoming.id) return "incoming";
    if (stop.id === neighborhood.outgoing.id) return "outgoing";
    return "other";
  }

  /**
   * 0 = full topo … 1 = full satellite.
   * Fade in around the GPT-4 stop (late GPT-6→4 → settled by GPT-3.5).
   */
  function satelliteAmount(log10) {
    const start = lerpLog(LOG_GPT6, LOG_GPT4, 0.7);
    const end = lerpLog(LOG_GPT4, LOG_GPT35, 0.55);
    const t = clamp((start - log10) / Math.max(start - end, 1e-9), 0, 1);
    return smoothstep(0, 1, t);
  }

  /**
   * Zoom ceiling: topo z19 → ~z24 by GPT-2 → ~z28 at GPT-1 → a short
   * nudge so the trillion speck is just perceptible.
   */
  function maxZoomFor(log10) {
    const sat = satelliteAmount(log10);
    const intoGpt2 = clamp(
      (LOG_GPT35 - log10) / Math.max(LOG_GPT35 - LOG_GPT2, 1e-9),
      0,
      1
    );
    const intoGpt1 = clamp(
      (LOG_GPT2 - log10) / Math.max(LOG_GPT2 - LOG_GPT1, 1e-9),
      0,
      1
    );
    const intoTrillion = clamp(
      (LOG_GPT1 - log10) / Math.max(LOG_GPT1 - LOG_TRILLION, 1e-9),
      0,
      1
    );
    const toGpt2 =
      MAP_MAX_ZOOM +
      (24 - MAP_MAX_ZOOM) * Math.max(sat, smoothstep(0, 1, intoGpt2));
    const toGpt1 = toGpt2 + (28 - 24) * smoothstep(0, 1, intoGpt1);
    return toGpt1 + 4.5 * intoTrillion;
  }

  /** Map zoom where `sideM` subtends `px` screen pixels. */
  function zoomForSidePx(sideM, px) {
    const mpp = sideM / Math.max(px, 1);
    return Math.log2(
      (78271.51696 * Math.cos((MAP_CENTER.lat * Math.PI) / 180)) / mpp
    );
  }

  function contextFor(side) {
    // Lower multipliers = closer entrance framing (less empty map around the square)
    if (side > 1500) return 1.35;
    if (side > 400) return 1.3;
    if (side > 80) return 1.25;
    if (side > 20) return 1.2;
    if (side > 5) return 1.12;
    return 1.0;
  }

  function applySatelliteMix(log10) {
    if (!map.getLayer("basemap-satellite")) return;
    const sat = satelliteAmount(log10);
    map.setPaintProperty("basemap-satellite", "raster-opacity", sat);
    // Keep topo underneath so the blend isn’t a hard cut
    if (map.getLayer("basemap-topo")) {
      map.setPaintProperty("basemap-topo", "raster-opacity", 1);
    }
    overlay.classList.toggle("is-satellite", sat > 0.45);
  }

  /**
   * Stacked plates: each only fades in (no fade-out). Lower layers stay
   * opaque underneath so the basemap never shows through between photos.
   * fadeIn is [hiLog, loLog] — log drops as we zoom in.
   */
  function photoOpacities(log10) {
    const out = {};
    let peak = 0;
    for (const layer of ZOOM_PHOTOS) {
      const [inHi, inLo] = layer.fadeIn;
      const a = smoothstep(
        0,
        1,
        (inHi - log10) / Math.max(inHi - inLo, 1e-9)
      );
      out[layer.id] = a;
      peak = Math.max(peak, a);
    }
    out.peak = peak;
    out.towardGpt1 = clamp(
      (LOG_GPT2 - log10) / Math.max(LOG_GPT2 - LOG_GPT1, 1e-9),
      0,
      1
    );
    return out;
  }

  /** Screen-pixel length of one side of a ground square at MAP_CENTER. */
  function projectedSidePx(sideM) {
    const ring = squareRing(
      MAP_CENTER.lng,
      MAP_CENTER.lat,
      sideM,
      MANHATTAN_BEARING
    );
    const a = map.project(ring[0]);
    const b = map.project(ring[1]);
    return Math.hypot(b.x - a.x, b.y - a.y);
  }

  /**
   * Place a zoom plate so `layer.anchor` (pizza box) lands on MAP_CENTER —
   * same point the GPT squares use, so GPT-1 sits on the box.
   */
  function placePhoto(img, layer, opacity) {
    if (opacity < 0.02) {
      img.style.opacity = "0";
      img.style.visibility = "hidden";
      return;
    }
    // Measure ground meters via the same projection the GPT squares use,
    // so the pizza box and GPT-1 outline share one scale.
    const sidePx = Math.max(2, projectedSidePx(layer.groundSideM));
    const feather = 1.45;
    const elSize = sidePx * feather;

    const origin = map.project([MAP_CENTER.lng, MAP_CENTER.lat]);
    const cx = origin.x;
    const cy = origin.y;

    const iw = img.naturalWidth || 1024;
    const ih = img.naturalHeight || 768;
    const [ax, ay] = layer.anchor ?? [0.5, 0.5];
    // Scale so min image side = groundSide meters; pin anchor → MAP_CENTER
    const scale = sidePx / Math.min(iw, ih);
    const dispW = iw * scale;
    const dispH = ih * scale;
    const left = cx - ax * dispW;
    const top = cy - ay * dispH;

    img.style.visibility = "visible";
    img.style.opacity = String(opacity);
    img.style.left = `${left}px`;
    img.style.top = `${top}px`;
    img.style.width = `${dispW}px`;
    img.style.height = `${dispH}px`;
    img.style.objectFit = "fill";

    // Soft radial mask centered on the box, larger than the ground square
    const maskSize = elSize;
    const maskLeft = ax * dispW - maskSize / 2;
    const maskTop = ay * dispH - maskSize / 2;
    const mask = `radial-gradient(closest-side, #000 0%, #000 30%, rgba(0,0,0,0.7) 50%, rgba(0,0,0,0.22) 72%, transparent 100%)`;
    img.style.webkitMaskImage = mask;
    img.style.maskImage = mask;
    img.style.webkitMaskRepeat = "no-repeat";
    img.style.maskRepeat = "no-repeat";
    img.style.webkitMaskSize = `${maskSize}px ${maskSize}px`;
    img.style.maskSize = `${maskSize}px ${maskSize}px`;
    img.style.webkitMaskPosition = `${maskLeft}px ${maskTop}px`;
    img.style.maskPosition = `${maskLeft}px ${maskTop}px`;
  }

  function drawSquares() {
    if (!ready) return;

    const w = container.clientWidth || 1;
    const h = container.clientHeight || 1;
    svg.setAttribute("viewBox", `0 0 ${w} ${h}`);
    svg.setAttribute("width", String(w));
    svg.setAttribute("height", String(h));

    const neighborhood = stopNeighborhood(log10Visible);
    const { progress } = neighborhood;
    const sat = satelliteAmount(log10Visible);
    const photos = photoOpacities(log10Visible);
    const towardTrillion =
      neighborhood.larger?.id === "gpt1" &&
      neighborhood.smaller?.id === "trillion"
        ? neighborhood.progress
        : clamp(
            (LOG_GPT1 - log10Visible) /
              Math.max(LOG_GPT1 - LOG_TRILLION, 1e-9),
            0,
            1
          );
    const largerFade = 1 - smoothstep(0.4, 0.82, photos.towardGpt1);
    // Hold the pizza-box square until the speck is nearly in; fade late
    const deepFade = 1 - smoothstep(0.55, 0.95, towardTrillion);
    // Don't solo-cut GPT-1 mid-handoff — that read as a pause/hitch
    const soloId =
      neighborhood.active.id === "trillion" && towardTrillion > 0.9
        ? "trillion"
        : null;

    for (const layer of ZOOM_PHOTOS) {
      placePhoto(photoImgs[layer.id], layer, photos[layer.id]);
    }

    const parts = [];

    // Paint large → small so smaller squares sit on top
    const ordered = [...ATOM_STOPS].reverse();

    for (const stop of ordered) {
      const role = roleFor(stop, neighborhood);

      // Only the current square at rest; reveal the next once zoom starts.
      // Exception: GPT-1 stays nested inside GPT-2 so the pizza-box square
      // is visible at the picnic framing, not only deep into that zoom.
      let visibility = 0;
      if (role === "active") {
        visibility = 1;
      } else if (role === "incoming") {
        if (stop.id === "gpt1") {
          visibility = 0.7 + 0.3 * smoothstep(0, 0.15, progress);
        } else {
          visibility = smoothstep(0.08, 0.32, progress);
        }
      } else if (role === "outgoing") {
        visibility = 1 - smoothstep(0.55, 0.95, progress);
      } else if (
        stop.id === "gpt1" &&
        (neighborhood.active.id === "gpt2" ||
          neighborhood.larger?.id === "gpt2")
      ) {
        visibility = 0.7;
      } else {
        continue;
      }

      if (soloId && stop.id !== soloId && role !== "incoming") continue;
      if (stop.id !== "gpt1" && stop.id !== "trillion" && photos.towardGpt1 > 0.05) {
        visibility *= largerFade;
      }
      if (stop.id === "gpt1" && towardTrillion > 0.05) {
        visibility *= deepFade;
      }
      // Speck comes in with the nudge, not only after the midpoint cut
      if (stop.id === "trillion" && role === "incoming") {
        visibility = Math.max(visibility, smoothstep(0.05, 0.35, towardTrillion));
      }
      if (visibility < 0.03) continue;

      const side = sideMeters(stop.atoms);
      const ring = squareRing(
        MAP_CENTER.lng,
        MAP_CENTER.lat,
        side,
        MANHATTAN_BEARING
      );
      const pts = ring.map(([lng, lat]) => {
        const p = map.project([lng, lat]);
        return `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
      });

      // Squares stay independent of zoom photos — just ease fill when a
      // plate is covering the grass so outlines stay readable.
      const underPhoto = photos.peak;
      const nestedGpt1 = stop.id === "gpt1" && role !== "active";
      let fillOpacity =
        (role === "active" ? 0.18 : role === "incoming" ? 0.1 : 0.05) *
        visibility *
        (1 - underPhoto * 0.85);
      let strokeWidth =
        role === "active" ? 3 : role === "incoming" || nestedGpt1 ? 2.5 : 1.75;
      let strokeOpacity =
        (role === "outgoing" ? 0.65 : 0.9) *
        visibility *
        (0.45 + 0.55 * (1 - underPhoto * 0.35));
      // Keep the nested GPT-1 outline crisp on the picnic photo
      if (nestedGpt1) {
        fillOpacity = Math.max(fillOpacity, 0.08 * visibility);
        strokeOpacity = Math.max(strokeOpacity, 0.85 * visibility);
        strokeWidth = Math.max(strokeWidth, 2.75);
      }
      const stroke = stop.accent;
      const sw = strokeWidth + (sat > 0.35 ? 0.5 : 0);

      parts.push(
        `<polygon points="${pts.join(" ")}" fill="${stop.color}" fill-opacity="${fillOpacity}" stroke="${stroke}" stroke-width="${sw}" stroke-opacity="${strokeOpacity}" stroke-linejoin="round" />`
      );

      const ne = map.project(ring[2]);
      const nw = map.project(ring[3]);
      const swPt = map.project(ring[0]);
      const sePt = map.project(ring[1]);
      const sidePx = Math.hypot(ne.x - nw.x, ne.y - nw.y);
      const cx = (ne.x + nw.x + swPt.x + sePt.x) / 4;
      const cy = (ne.y + nw.y + swPt.y + sePt.y) / 4;
      const showLabel =
        visibility > 0.35 &&
        (role === "active" ||
          (role === "incoming" && visibility > 0.5) ||
          (role === "outgoing" && sidePx > 48 && visibility > 0.5));
      if (showLabel) {
        const lx = sidePx > 40 ? (ne.x + nw.x) / 2 : cx;
        const ly =
          sidePx > 40
            ? Math.min(ne.y, nw.y) - 10
            : cy - Math.max(14, sidePx * 0.6);
        const labelClass =
          role === "active" && sidePx < 40
            ? "map-square-label map-square-label--active map-square-label--tiny"
            : `map-square-label map-square-label--${role}`;
        parts.push(
          `<text x="${lx.toFixed(1)}" y="${ly.toFixed(1)}" text-anchor="middle" class="${labelClass}" fill="${stop.accent}">${stop.name}</text>`
        );
      }

      // Side-length scale on the bottom edge + area (e.g. 10 km²) inside
      // the bottom-right corner. Both ride with the square.
      if (visibility > 0.25 && sidePx > 28) {
        parts.push(
          scaleBarSvg({
            swPt,
            sePt,
            center: { x: cx, y: cy },
            sideM: side,
            areaLabel: formatArea(stop.atoms).primary,
            areaColor: stop.accent,
            opacity: strokeOpacity,
          })
        );
      }
    }

    svg.innerHTML = parts.join("");
  }

  /**
   * White bar + end ticks spanning the square’s full south edge
   * (ring[0]→ring[1]). Side length outside left; area inside bottom-right.
   */
  function scaleBarSvg({
    swPt,
    sePt,
    center,
    sideM,
    areaLabel,
    areaColor,
    opacity,
  }) {
    const ex = sePt.x - swPt.x;
    const ey = sePt.y - swPt.y;
    const edgeLen = Math.hypot(ex, ey);
    if (edgeLen < 20) return "";
    const ux = ex / edgeLen;
    const uy = ey / edgeLen;
    // Outward normal (away from square center)
    let nx = -uy;
    let ny = ux;
    if (
      (center.x - (swPt.x + sePt.x) / 2) * nx +
        (center.y - (swPt.y + sePt.y) / 2) * ny >
      0
    ) {
      nx = -nx;
      ny = -ny;
    }
    const gap = Math.max(6, Math.min(14, edgeLen * 0.03));
    const x0 = swPt.x + nx * gap;
    const y0 = swPt.y + ny * gap;
    const x1 = sePt.x + nx * gap;
    const y1 = sePt.y + ny * gap;
    const tick = Math.max(5, Math.min(10, edgeLen * 0.04));
    const tx0x = x0 + nx * tick;
    const tx0y = y0 + ny * tick;
    const tx1x = x1 + nx * tick;
    const tx1y = y1 + ny * tick;
    const sideLabel = formatLength(sideM);
    const lx = x0 + nx * (tick + 4) + ux * 2;
    const ly = y0 + ny * (tick + 4) + uy * 2;
    // Area inside the square: up (inward) and slightly left of SE corner
    const inset = Math.max(10, Math.min(22, edgeLen * 0.06));
    const ax = sePt.x - nx * inset - ux * inset * 0.85;
    const ay = sePt.y - ny * inset - uy * inset * 0.85;
    let deg = (Math.atan2(uy, ux) * 180) / Math.PI;
    if (deg > 90 || deg < -90) deg += 180;
    const o = opacity.toFixed(3);
    return [
      `<g class="map-scale" opacity="${o}">`,
      `<line x1="${x0.toFixed(1)}" y1="${y0.toFixed(1)}" x2="${x1.toFixed(1)}" y2="${y1.toFixed(1)}" class="map-scale__bar" />`,
      `<line x1="${x0.toFixed(1)}" y1="${y0.toFixed(1)}" x2="${tx0x.toFixed(1)}" y2="${tx0y.toFixed(1)}" class="map-scale__tick" />`,
      `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${tx1x.toFixed(1)}" y2="${tx1y.toFixed(1)}" class="map-scale__tick" />`,
      `<text x="${lx.toFixed(1)}" y="${ly.toFixed(1)}" class="map-scale__label" transform="rotate(${deg.toFixed(1)} ${lx.toFixed(1)} ${ly.toFixed(1)})">${sideLabel}</text>`,
      `<text x="${ax.toFixed(1)}" y="${ay.toFixed(1)}" text-anchor="end" class="map-scale__area" fill="${areaColor}" transform="rotate(${deg.toFixed(1)} ${ax.toFixed(1)} ${ay.toFixed(1)})">${areaLabel}</text>`,
      `</g>`,
    ].join("");
  }

  function measureBreakdown(atoms) {
    const side = sideMeters(atoms);
    const w = container.clientWidth || window.innerWidth;
    const h = container.clientHeight || window.innerHeight;
    const neededZoom = zoomToFitSide(
      side,
      Math.min(w, h),
      MAP_CENTER.lat,
      0.4
    );
    const maxZ = maxZoomFor(log10Visible);
    const zoomCapped = neededZoom > maxZ + 0.05;
    const mppAtCap = metersPerPixel(maxZ, MAP_CENTER.lat);
    const sidePxAtCap = side / mppAtCap;
    const unreadable = sidePxAtCap < MIN_READABLE_SIDE_PX;

    const firstBrokenStop =
      ATOM_STOPS.find((s) => s.id === ZOOM_BREAK.firstBrokenId) ?? null;
    const lastOkStop =
      ATOM_STOPS.find((s) => s.id === ZOOM_BREAK.lastOkId) ?? null;

    return {
      zoomCapped,
      unreadable,
      broken: zoomCapped || unreadable,
      neededZoom,
      maxZoom: maxZ,
      sidePx:
        side / metersPerPixel(Math.min(neededZoom, maxZ), MAP_CENTER.lat),
      sidePxAtCap,
      firstBrokenStop,
      lastOkStop,
      rangeSummary: ZOOM_BREAK.summary,
      message:
        zoomCapped || unreadable
          ? `Camera capped at z${maxZ} — this square is ~${Math.max(1, Math.round(sidePxAtCap))}px. GPT-1 still needs custom imagery beyond satellite overzoom.`
          : null,
    };
  }

  function applyLog10(log10) {
    log10Visible = log10;
    if (!ready) {
      pendingLog = log10;
      return snapshot();
    }

    const atoms = atomsFromLog10(log10);
    const side = sideMeters(atoms);
    lastBreakdown = measureBreakdown(atoms);

    // Frame a wider area than the square itself so the opening view shows
    // neighborhood context (especially the big octillion / GPT-6 stops).
    const padding = getPadding();
    const w = container.clientWidth || window.innerWidth;
    const h = container.clientHeight || window.innerHeight;
    const usable = Math.min(
      w - padding.left - padding.right,
      h - padding.top - padding.bottom
    );
    const maxZ = maxZoomFor(log10);
    const context = contextFor(side);
    let fitZoom = zoomToFitSide(
      Math.max(side, 1e-9) * context,
      usable,
      MAP_CENTER.lat,
      0.02
    );
    // Past GPT-1: short linear nudge until the speck is just visible (~2.5px).
    // Linear in neighborhood progress — no smoothstep dead-zone at the start.
    if (log10 < LOG_GPT1) {
      const gpt1Side = sideMeters(18e18);
      const gpt1Zoom = zoomToFitSide(
        gpt1Side * contextFor(gpt1Side),
        usable,
        MAP_CENTER.lat,
        0.02
      );
      const hood = stopNeighborhood(log10);
      const intoTri =
        hood.larger?.id === "gpt1" && hood.smaller?.id === "trillion"
          ? hood.progress
          : clamp(
              (LOG_GPT1 - log10) / Math.max(LOG_GPT1 - LOG_TRILLION, 1e-9),
              0,
              1
            );
      const speckZoom = zoomForSidePx(sideMeters(1e12), 2.5);
      const nudgeTarget =
        gpt1Zoom + Math.max(0, speckZoom - gpt1Zoom) * intoTri;
      // Continuous with GPT-1 framing at the boundary (intoTri → 0)
      fitZoom = Math.min(fitZoom, Math.max(gpt1Zoom, nudgeTarget));
    }
    targetZoomHeld = Math.min(maxZ, fitZoom);

    applySatelliteMix(log10);
    // Zoom eases on its own RAF — scroll can settle before the camera
    // catches up through GPT-2 → GPT-1, so don’t rely on scrolly frames.
    ensureZoomLoop();
    return snapshot();
  }

  function ensureZoomLoop() {
    if (zoomRaf) return;
    const tick = () => {
      zoomRaf = 0;
      if (!ready || targetZoomHeld == null) return;

      if (easedZoom == null) easedZoom = targetZoomHeld;
      const zoomDelta = targetZoomHeld - easedZoom;
      // Tiny trillion nudge should land in ~2s with the log ease, not crawl
      const deep =
        log10Visible < LOG_GPT1 &&
        Math.abs(targetZoomHeld - easedZoom) > 0.001;
      const maxZoomStep = deep ? 0.08 : 0.045;
      if (Math.abs(zoomDelta) <= maxZoomStep) {
        easedZoom = targetZoomHeld;
      } else {
        easedZoom += Math.sign(zoomDelta) * maxZoomStep;
      }

      const maxZ = maxZoomFor(log10Visible);
      map.setMaxZoom(Math.max(maxZ, easedZoom + 0.01, targetZoomHeld + 0.01));
      map.jumpTo({
        center: [MAP_CENTER.lng, MAP_CENTER.lat],
        zoom: easedZoom,
        bearing: MANHATTAN_BEARING,
        pitch: 0,
        padding: getPadding(),
      });
      drawSquares();

      if (Math.abs(targetZoomHeld - easedZoom) > 0.001) {
        zoomRaf = requestAnimationFrame(tick);
      }
    };
    zoomRaf = requestAnimationFrame(tick);
  }

  function getPadding() {
    const w = container.clientWidth || window.innerWidth;
    const h = container.clientHeight || window.innerHeight;
    const isMobile = w < 720;
    return {
      // Mobile: keep the framed square in the upper ~half so cards sit below
      top: Math.round(h * (isMobile ? 0.04 : 0.1)),
      bottom: Math.round(h * (isMobile ? 0.52 : 0.1)),
      left: Math.round(w * (isMobile ? 0.06 : 0.28)),
      right: Math.round(w * (isMobile ? 0.06 : 0.16)),
    };
  }

  function snapshot() {
    const atoms = atomsFromLog10(log10Visible);
    const stop = nearestStop(log10Visible);
    const area = formatArea(atoms);
    const breakdown = lastBreakdown ?? measureBreakdown(atoms);
    return {
      log10Visible,
      atoms,
      stop,
      area,
      atomsLabel: formatAtoms(atoms),
      center: MAP_CENTER,
      breakdown,
      mapZoom: ready ? map.getZoom() : null,
    };
  }

  function setLog10Visible(value) {
    return applyLog10(value);
  }

  function resize() {
    map.resize();
    applyLog10(log10Visible);
  }

  function destroy() {
    if (zoomRaf) cancelAnimationFrame(zoomRaf);
    zoomRaf = 0;
    map.off("move", drawSquares);
    map.off("resize", drawSquares);
    overlay.remove();
    map.remove();
  }

  return {
    map,
    setLog10Visible,
    resize,
    destroy,
    getSnapshot: snapshot,
  };
}

function clamp(v, a, b) {
  return Math.min(b, Math.max(a, v));
}

function smoothstep(edge0, edge1, x) {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

