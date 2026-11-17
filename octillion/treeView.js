import {
  BRANCH_FACTOR,
  COLOR_TIERS,
  PRE_MILLION_COLOR,
  bundleStyleForWeight,
} from "./content.js";

/**
 * Top-down canopy:
 * - Grow one organic figure through 1 Million → freeze
 * - Million → Billion: meeting-triangle field of million-figures
 * - Freeze the billion cluster → Trillion: even circular rings → lock
 * - Trillion → Quadrillion: meeting-triangle of 10, then Sierpinski nesting (hole filled) to 1Q
 */
const MAX_SEGMENTS = 140000;
const MAX_DEPTH_DRAW = 9;
const MILLION_POWER = 6;
const BILLION_POWER = 9;
const TRILLION_POWER = 12;
const QUADRILLION_POWER = 15;
const BILLION_COLOR = COLOR_TIERS.find((t) => t.power === BILLION_POWER).color;
const TRILLION_COLOR = COLOR_TIERS.find((t) => t.power === TRILLION_POWER).color;
const QUADRILLION_COLOR = COLOR_TIERS.find(
  (t) => t.power === QUADRILLION_POWER
).color;
const MILLION_COLOR = COLOR_TIERS.find((t) => t.power === MILLION_POWER).color;

export function createTreeView(container) {
  const canvas = document.createElement("canvas");
  canvas.style.display = "block";
  canvas.style.width = "100%";
  canvas.style.height = "100%";
  container.appendChild(canvas);
  const ctx = canvas.getContext("2d");

  let power = 1;
  let w = 1;
  let h = 1;
  let dpr = 1;
  let raf = 0;
  let rotation = 0;

  /** Live / frozen million motif geometry (local coords). */
  let motifSegments = [];
  let motifRadius = 1;

  /** Stamp sprites of the frozen million motif (gold original + blue copies). */
  let stampGold = null;
  let stampBlue = null;
  let stampGreen = null; // trillion-tint million motif for nested builds

  /** Locked billion cluster (raster of the finished million-triangle field). */
  let billionStamp = null;
  let billionStampGreen = null;
  let billionRadius = 1;
  let billionLeaves = [];

  /** Locked trillion figure (even ring of billion clusters). */
  let trillionLeaves = [];
  let trillionRadius = 1;
  let trillionLocked = false;
  let trillionStamp = null;
  let trillionStampPink = null;

  /** Locked quadrillion (triangle seed → Sierpinski of trillions). */
  let quadrillionLeaves = [];
  let quadrillionRadius = 1;
  let quadrillionLocked = false;

  /**
   * What we stamp on screen:
   * - "million" → individual million canopies
   * - "billion" → locked billion clusters
   * - "trillion" → locked trillion figures
   */
  let stampMode = "million";
  let instances = [{ x: 0, y: 0, rot: 0, original: true, scale: 1 }];
  let contentRadius = 1;

  let cameraScale = 1;
  let targetCameraScale = 1;

  const resizeObserver = new ResizeObserver(() => resize());
  resizeObserver.observe(container);
  resize();

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = container.clientWidth || 1;
    h = container.clientHeight || 1;
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    rebuild();
  }

  function hash01(i, salt = 0) {
    const x = Math.sin(i * 127.1 + salt * 311.7) * 43758.5453;
    return x - Math.floor(x);
  }

  function hexRgb(hex) {
    const n =
      typeof hex === "number" ? hex : parseInt(String(hex).replace("#", ""), 16);
    return {
      r: (n >> 16) & 255,
      g: (n >> 8) & 255,
      b: n & 255,
    };
  }

  function strokeForWeight(weight, totalTips, depth) {
    const style = bundleStyleForWeight(weight);
    const share = Math.max(0, Math.min(1, weight / Math.max(totalTips, 1)));
    const byShare = Math.pow(share, 0.38);
    const byDepth = Math.pow(0.5, depth);
    let px = 0.2 + byShare * byDepth * 28;

    if (style.kind === "trillion") px = Math.max(px, 20);
    else if (style.kind === "billion") px = Math.max(px, 13);
    else if (style.kind === "million") px = Math.max(px, 8);
    else px = Math.min(px, 1.6);

    return Math.max(0.22, px);
  }

  function colorForMotifSegment(seg, tint) {
    if (tint === "blue" || tint === "green") {
      const base = hexRgb(tint === "green" ? TRILLION_COLOR : BILLION_COLOR);
      if (seg.weight < 10) {
        return {
          r: Math.min(255, base.r + 45),
          g: Math.min(255, base.g + 35),
          b: Math.min(255, base.b + 25),
        };
      }
      return base;
    }
    const style = bundleStyleForWeight(seg.weight);
    if (style.kind !== "thin") return hexRgb(style.color);
    const base = hexRgb(PRE_MILLION_COLOR);
    return {
      r: Math.min(255, Math.floor(base.r * 0.55 + 160)),
      g: Math.min(255, Math.floor(base.g * 0.55 + 150)),
      b: Math.min(255, Math.floor(base.b * 0.55 + 130)),
    };
  }

  function parentsCapFor(depthCount) {
    return Math.max(
      24,
      Math.floor(MAX_SEGMENTS / (BRANCH_FACTOR * Math.max(depthCount, 1)))
    );
  }

  function growMotif({ depthCount, totalTips, salt, baseLen, lenScale }) {
    const segs = [];
    let maxR = 0;
    let tips = [
      {
        x: 0,
        y: 0,
        angle: -Math.PI / 2,
        weight: totalTips,
      },
    ];
    const cap = parentsCapFor(depthCount);

    for (let depth = 0; depth < depthCount; depth += 1) {
      let parents = tips;
      if (parents.length > cap) {
        const picked = [];
        for (let p = 0; p < cap; p += 1) {
          const idx = Math.floor(((p + 0.5) * parents.length) / cap);
          picked.push(parents[idx]);
        }
        const boost = parents.length / cap;
        parents = picked.map((n) => ({ ...n, weight: n.weight * boost }));
      }

      const next = [];
      const sector = (Math.PI * 2) / BRANCH_FACTOR;
      const spread =
        depth === 0
          ? Math.PI * 2
          : Math.min(sector * 0.92, 0.48 + depth * 0.04);
      const lenBase =
        baseLen *
        (depth === 0 ? 1 : Math.pow(0.7, depth)) *
        lenScale;

      for (let t = 0; t < parents.length; t += 1) {
        const node = parents[t];
        const len =
          lenBase * (0.78 + hash01(t * 3 + depth, salt) * 0.44);

        for (let b = 0; b < BRANCH_FACTOR; b += 1) {
          let angle;
          if (depth === 0) {
            angle =
              -Math.PI / 2 +
              ((b + 0.5) / BRANCH_FACTOR) * Math.PI * 2 +
              (hash01(b, salt + 3) - 0.5) * 0.1;
          } else {
            angle =
              node.angle -
              spread / 2 +
              ((b + 0.5) / BRANCH_FACTOR) * spread +
              (hash01(t * 11 + b, depth + salt) - 0.5) * 0.1;
          }

          const x2 = node.x + Math.cos(angle) * len;
          const y2 = node.y + Math.sin(angle) * len;
          const wgt = node.weight / BRANCH_FACTOR;

          segs.push({
            x1: node.x,
            y1: node.y,
            x2,
            y2,
            weight: wgt,
            depth,
          });

          const r = Math.hypot(x2, y2);
          if (r > maxR) maxR = r;
          next.push({ x: x2, y: y2, angle, weight: wgt });
        }
      }
      tips = next;
    }

    return { segments: segs, maxRadius: Math.max(1, maxR) };
  }

  function fillTaperOn(target, x1, y1, x2, y2, wStart, wEnd) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len;
    const ny = dx / len;
    const a = wStart / 2;
    const b = wEnd / 2;
    target.beginPath();
    target.moveTo(x1 + nx * a, y1 + ny * a);
    target.lineTo(x2 + nx * b, y2 + ny * b);
    target.lineTo(x2 - nx * b, y2 - ny * b);
    target.lineTo(x1 - nx * a, y1 - ny * a);
    target.closePath();
    target.fill();
  }

  function paintMotifSegments(target, segments, totalTips, scale, tint) {
    const ordered = segments.slice().sort((a, b) => a.weight - b.weight);
    target.lineCap = "round";
    target.lineJoin = "round";

    for (const seg of ordered) {
      const { r, g: gg, b } = colorForMotifSegment(seg, tint);
      const tipW = strokeForWeight(seg.weight, totalTips, seg.depth);
      const rootW = strokeForWeight(
        seg.weight * BRANCH_FACTOR,
        totalTips,
        Math.max(0, seg.depth - 1)
      );
      const wStart = Math.max(tipW, rootW * 0.85) / scale;
      const wEnd = (tipW * 0.55) / scale;
      const isHeavy = seg.weight >= 1e5 || seg.depth < 3;

      target.fillStyle = `rgb(${r},${gg},${b})`;
      target.globalAlpha = isHeavy
        ? 0.98
        : 0.16 + Math.min(0.26, 0.04 * Math.max(0, 6 - seg.depth));

      if (tipW < 1.2) {
        target.beginPath();
        target.moveTo(seg.x1, seg.y1);
        target.lineTo(seg.x2, seg.y2);
        target.strokeStyle = target.fillStyle;
        target.lineWidth = Math.max(wEnd, 0.25 / scale);
        target.stroke();
      } else {
        fillTaperOn(target, seg.x1, seg.y1, seg.x2, seg.y2, wStart, wEnd);
      }
    }
    target.globalAlpha = 1;
  }

  /** Rasterize the frozen million motif for fast organic stamping. */
  function bakeMillionStamps() {
    const pad = 1.08;
    const worldR = motifRadius * pad;
    const px = Math.min(720, Math.max(220, Math.floor(Math.min(w, h) * 0.7)));
    const stampScale = px / (worldR * 2);

    function makeStamp(tint) {
      const off = document.createElement("canvas");
      off.width = px;
      off.height = px;
      const octx = off.getContext("2d");
      octx.translate(px / 2, px / 2);
      octx.scale(stampScale, stampScale);
      paintMotifSegments(
        octx,
        motifSegments,
        10 ** MILLION_POWER,
        stampScale,
        tint
      );
      const seed =
        tint === "green"
          ? TRILLION_COLOR
          : tint === "blue"
            ? BILLION_COLOR
            : MILLION_COLOR;
      octx.fillStyle = `#${seed.toString(16).padStart(6, "0")}`;
      octx.beginPath();
      octx.arc(0, 0, 2.4 / stampScale, 0, Math.PI * 2);
      octx.fill();
      return off;
    }

    stampGold = makeStamp("gold");
    stampBlue = makeStamp("blue");
    stampGreen = makeStamp("green");
  }

  /**
   * ×10 meeting-triangle layout (not a 10-spoke ring):
   * three equilateral triangles share corner vertices, so ends meet
   * into one pattern. Slots = center + 3 shared corners + 3 tips + 3 centroids.
   */
  function triangleTenSlots(cx, cy, baseAng, unitR, salt) {
    const slots = [];
    slots.push({ x: cx, y: cy, rot: baseAng, kind: "center" });

    // Shared corners sit just outside the center unit so ends can meet there
    const shareR = unitR * 2.05;
    const shares = [];
    for (let g = 0; g < 3; g += 1) {
      const ang =
        baseAng -
        Math.PI / 2 +
        (g + 0.5) * ((Math.PI * 2) / 3) +
        (hash01(g + salt, 21) - 0.5) * 0.03;
      shares.push({
        x: cx + Math.cos(ang) * shareR,
        y: cy + Math.sin(ang) * shareR,
        ang,
      });
    }

    for (let g = 0; g < 3; g += 1) {
      const a = shares[g];
      const b = shares[(g + 1) % 3];
      const side = Math.hypot(b.x - a.x, b.y - a.y);
      const mx = (a.x + b.x) / 2;
      const my = (a.y + b.y) / 2;
      const bis = Math.atan2(my - cy, mx - cx);
      const h = (Math.sqrt(3) / 2) * side;
      const tipX = mx + Math.cos(bis) * h;
      const tipY = my + Math.sin(bis) * h;
      const cxTri = (a.x + b.x + tipX) / 3;
      const cyTri = (a.y + b.y + tipY) / 3;

      // Shared corner (each once)
      slots.push({
        x: a.x,
        y: a.y,
        rot: a.ang + (hash01(g, 4) - 0.5) * 0.2,
        kind: "share",
        group: g,
      });
      // Outer tip of this triangle
      slots.push({
        x: tipX,
        y: tipY,
        rot: bis + (hash01(g, 8) - 0.5) * 0.2,
        kind: "tip",
        group: g,
      });
      // Triangle centroid — fills the pattern so we still get ×10
      slots.push({
        x: cxTri,
        y: cyTri,
        rot: bis + Math.PI / 2,
        kind: "centroid",
        group: g,
      });
    }

    return slots;
  }

  function layoutMeetingFractal(depth, unitR) {
    if (depth <= 0) {
      return {
        leaves: [{ x: 0, y: 0, rot: 0, original: true, scale: 1 }],
      };
    }

    const leaves = [];
    let leafIndex = 0;

    function sprout(cx, cy, facing, level, onGoldPath) {
      const nesting = depth - level + 1;
      // Nested cells sized so each child cluster’s triangles can meet
      const cellR = unitR * Math.pow(3.35, Math.max(0, nesting - 1));
      const slots = triangleTenSlots(
        cx,
        cy,
        facing,
        cellR,
        level * 17 + Math.floor(cx * 0.01 + cy * 0.01)
      );

      for (let i = 0; i < slots.length; i += 1) {
        const slot = slots[i];
        const childGold = onGoldPath && i === 0;
        if (level >= depth) {
          leaves.push({
            x: slot.x,
            y: slot.y,
            rot: slot.rot,
            scale: childGold ? 1.08 : 0.92 + hash01(leafIndex, 8) * 0.1,
            original: childGold,
          });
          leafIndex += 1;
        } else {
          sprout(slot.x, slot.y, slot.rot, level + 1, childGold);
        }
      }
    }

    sprout(0, 0, 0, 1, true);
    return { leaves };
  }

  /** Bake the finished billion field (1000 million-figures) into one stamp. */
  function bakeBillionStamps() {
    billionLeaves = layoutMeetingFractal(3, motifRadius).leaves;
    let maxR = motifRadius;
    for (const leaf of billionLeaves) {
      const r =
        Math.hypot(leaf.x, leaf.y) + motifRadius * (leaf.scale ?? 1) * 1.08;
      if (r > maxR) maxR = r;
    }
    billionRadius = maxR;

    const px = Math.min(960, Math.max(420, Math.floor(Math.min(w, h) * 0.95)));
    const stampScale = px / (billionRadius * 2);

    function paintBillion(useGreenCopies) {
      const off = document.createElement("canvas");
      off.width = px;
      off.height = px;
      const octx = off.getContext("2d");
      octx.translate(px / 2, px / 2);
      octx.scale(stampScale, stampScale);

      const ordered = billionLeaves
        .slice()
        .sort((a, b) => {
          if (a.original !== b.original) return a.original ? 1 : -1;
          return Math.hypot(b.x, b.y) - Math.hypot(a.x, a.y);
        });

      for (const leaf of ordered) {
        const src = leaf.original
          ? stampGold
          : useGreenCopies
            ? stampGreen
            : stampBlue;
        if (!src) continue;
        const s = leaf.scale ?? 1;
        const diam = motifRadius * 2 * 1.08 * s;
        octx.save();
        octx.translate(leaf.x, leaf.y);
        octx.rotate(leaf.rot);
        octx.globalAlpha = leaf.original ? 1 : 0.92;
        octx.drawImage(src, -diam / 2, -diam / 2, diam, diam);
        octx.restore();
      }
      return off;
    }

    billionStamp = paintBillion(false);
    // Soften the green trillion copies so the jagged billion silhouette
    // reads rounder when tiled in the hex field
    billionStampGreen = softenStamp(paintBillion(true));
  }

  function softenStamp(src) {
    const out = document.createElement("canvas");
    out.width = src.width;
    out.height = src.height;
    const octx = out.getContext("2d");
    // Soft bloom: stack slight offsets so hard triangle corners melt
    const offsets = [
      [0, 0, 0.55],
      [1.2, 0, 0.12],
      [-1.2, 0, 0.12],
      [0, 1.2, 0.12],
      [0, -1.2, 0.12],
      [0.9, 0.9, 0.08],
      [-0.9, -0.9, 0.08],
    ];
    for (const [ox, oy, a] of offsets) {
      octx.globalAlpha = a;
      octx.drawImage(src, ox, oy);
    }
    octx.globalAlpha = 1;
    return out;
  }

  function ensureMillionMotif() {
    const baseLen = Math.min(w, h) * 0.4;
    const grown = growMotif({
      depthCount: MILLION_POWER,
      totalTips: 10 ** MILLION_POWER,
      salt: 17,
      baseLen,
      lenScale: 0.8 + 0.2 * (MILLION_POWER / MAX_DEPTH_DRAW),
    });
    motifSegments = grown.segments;
    motifRadius = grown.maxRadius;
    bakeMillionStamps();
  }

  function radiusOfInstances(list, unitR) {
    let maxR = unitR;
    for (const inst of list) {
      const s = inst.scale ?? 1;
      const r = Math.hypot(inst.x, inst.y) + unitR * s * 1.08;
      if (r > maxR) maxR = r;
    }
    return maxR;
  }

  function rebuildGrowingPreMillion() {
    stampGold = null;
    stampBlue = null;
    stampGreen = null;
    billionStamp = null;
    billionStampGreen = null;
    billionLeaves = [];
    trillionLeaves = [];
    trillionRadius = 1;
    trillionLocked = false;
    trillionStamp = null;
    trillionStampPink = null;
    quadrillionLeaves = [];
    quadrillionRadius = 1;
    quadrillionLocked = false;
    stampMode = "million";
    instances = [{ x: 0, y: 0, rot: 0, original: true, scale: 1 }];

    const totalTips = 10 ** power;
    const drawDepth = Math.min(power, MAX_DEPTH_DRAW);
    const baseLen = Math.min(w, h) * 0.4;
    const grown = growMotif({
      depthCount: drawDepth,
      totalTips,
      salt: 17,
      baseLen,
      lenScale: 0.8 + 0.2 * (drawDepth / MAX_DEPTH_DRAW),
    });

    motifSegments = grown.segments;
    motifRadius = grown.maxRadius;
    contentRadius = motifRadius;
  }

  function rebuildMillionToBillion() {
    ensureMillionMotif();
    billionStamp = null;
    billionStampGreen = null;
    stampMode = "million";

    const depth = Math.max(
      0,
      Math.min(power, BILLION_POWER) - MILLION_POWER
    );
    instances = layoutMeetingFractal(depth, motifRadius).leaves;
    contentRadius = radiusOfInstances(instances, motifRadius);
  }

  /**
   * Trillion cell (×10): center + 9 evenly spaced on one circle.
   * Equal arc steps → smooth, even ring (no jagged or uneven gaps).
   */
  function hexTenSlots(cx, cy, baseAng, unitR) {
    const slots = [];
    slots.push({
      x: cx,
      y: cy,
      rot: baseAng,
      kind: "center",
      scaleMul: 1,
    });

    const ringR = unitR * 2.0;
    const around = 9;
    for (let i = 0; i < around; i += 1) {
      const ang = baseAng - Math.PI / 2 + (i / around) * Math.PI * 2;
      slots.push({
        x: cx + Math.cos(ang) * ringR,
        y: cy + Math.sin(ang) * ringR,
        rot: ang + Math.PI / 2,
        kind: "ring",
        scaleMul: 1,
      });
    }

    return slots;
  }

  function layoutHexFractal(depth, unitR) {
    if (depth <= 0) {
      return {
        leaves: [{ x: 0, y: 0, rot: 0, original: true, scale: 1 }],
      };
    }

    const leaves = [];
    let leafIndex = 0;

    function sprout(cx, cy, facing, level, onGoldPath) {
      const nesting = depth - level + 1;
      // Gentler nesting so nested hexes stay round, not stretched stars
      const cellR = unitR * Math.pow(3.05, Math.max(0, nesting - 1));
      const slots = hexTenSlots(cx, cy, facing, cellR);

      for (let i = 0; i < slots.length; i += 1) {
        const slot = slots[i];
        const childGold = onGoldPath && i === 0;
        if (level >= depth) {
          leaves.push({
            x: slot.x,
            y: slot.y,
            rot: slot.rot,
            scale: childGold ? 1.02 : 1,
            original: childGold,
            soft: true,
          });
          leafIndex += 1;
        } else {
          sprout(slot.x, slot.y, slot.rot, level + 1, childGold);
        }
      }
    }

    sprout(0, 0, 0, 1, true);
    return { leaves };
  }

  function ensureTrillionFigure() {
    ensureMillionMotif();
    if (!billionStamp || !billionStampGreen) {
      bakeBillionStamps();
    }
    // Fixed depth-3 even ring — the locked trillion silhouette
    trillionLeaves = layoutHexFractal(3, billionRadius).leaves;
    trillionRadius = radiusOfInstances(trillionLeaves, billionRadius);
    trillionLocked = true;
  }

  function bakeTrillionStamps() {
    ensureTrillionFigure();
    const px = Math.min(
      900,
      Math.max(400, Math.floor(Math.min(w, h) * 0.9))
    );
    const stampScale = px / (trillionRadius * 2);

    function paintTrillion() {
      const off = document.createElement("canvas");
      off.width = px;
      off.height = px;
      const octx = off.getContext("2d");
      octx.translate(px / 2, px / 2);
      octx.scale(stampScale, stampScale);

      const ordered = trillionLeaves
        .slice()
        .sort((a, b) => {
          if (a.original !== b.original) return a.original ? 1 : -1;
          return Math.hypot(b.x, b.y) - Math.hypot(a.x, a.y);
        });

      for (const leaf of ordered) {
        const src = leaf.original ? billionStamp : billionStampGreen;
        if (!src) continue;
        const s = leaf.scale ?? 1;
        const diam = billionRadius * 2 * 1.08 * s;
        octx.save();
        octx.translate(leaf.x, leaf.y);
        octx.rotate(leaf.rot);
        octx.globalAlpha = leaf.original ? 1 : 0.9;
        octx.drawImage(src, -diam / 2, -diam / 2, diam, diam);
        octx.restore();
      }
      return off;
    }

    trillionStamp = paintTrillion();
    // Hot punchy pink so quadrillion copies read immediately
    trillionStampPink = tintStamp(trillionStamp, QUADRILLION_COLOR, 0.92);
  }

  function tintStamp(src, color, amount = 0.35) {
    const { r, g, b } = hexRgb(color);
    const out = document.createElement("canvas");
    out.width = src.width;
    out.height = src.height;
    const octx = out.getContext("2d");
    octx.drawImage(src, 0, 0);
    octx.globalCompositeOperation = "source-atop";
    octx.fillStyle = `rgba(${r},${g},${b},${amount})`;
    octx.fillRect(0, 0, out.width, out.height);
    octx.globalCompositeOperation = "source-over";
    return out;
  }

  /**
   * ×10 Sierpinski cell: one in the classic empty middle, plus a tiny
   * triangle of three in each corner (9) — gasket with the hole filled.
   */
  function sierpinskiTenSlots(cx, cy, baseAng, unitR) {
    const slots = [];

    // The empty middle — filled
    slots.push({
      x: cx,
      y: cy,
      rot: baseAng,
      kind: "hole",
    });

    const arm = unitR * 2.38;
    const smallR = unitR * 1.04;

    for (let g = 0; g < 3; g += 1) {
      const gang = baseAng - Math.PI / 2 + (g * Math.PI * 2) / 3;
      const ox = cx + Math.cos(gang) * arm;
      const oy = cy + Math.sin(gang) * arm;
      // Mini-triangle at this corner, pointing outward
      for (let k = 0; k < 3; k += 1) {
        const ang = gang + (k * Math.PI * 2) / 3;
        slots.push({
          x: ox + Math.cos(ang) * smallR,
          y: oy + Math.sin(ang) * smallR,
          rot: ang + Math.PI / 2,
          kind: "corner",
          group: g,
        });
      }
    }

    return slots;
  }

  function layoutSierpinskiFractal(depth, unitR) {
    if (depth <= 0) {
      return {
        leaves: [{ x: 0, y: 0, rot: 0, original: true, scale: 1 }],
      };
    }

    const leaves = [];

    function sprout(cx, cy, facing, level, onGoldPath) {
      const nesting = depth - level + 1;
      const cellR = unitR * Math.pow(2.9, Math.max(0, nesting - 1));
      const slots = sierpinskiTenSlots(cx, cy, facing, cellR);

      for (let i = 0; i < slots.length; i += 1) {
        const slot = slots[i];
        const childGold = onGoldPath && i === 0;
        if (level >= depth) {
          leaves.push({
            x: slot.x,
            y: slot.y,
            rot: slot.rot,
            scale: childGold ? 1.04 : 0.98,
            original: childGold,
            soft: true,
          });
        } else {
          sprout(slot.x, slot.y, slot.rot, level + 1, childGold);
        }
      }
    }

    sprout(0, 0, 0, 1, true);
    return { leaves };
  }

  /**
   * 10T keeps the meeting-triangle; further ×10 nest those clusters in a
   * Sierpinski gasket with the hole filled.
   */
  function layoutTriangleThenSierpinski(depth, unitR) {
    if (depth <= 1) {
      return layoutMeetingFractal(Math.max(depth, 0), unitR);
    }

    const seedLeaves = layoutMeetingFractal(1, unitR).leaves;
    const seedR = radiusOfInstances(seedLeaves, unitR);
    // Slightly under the seed circumcircle — dense, but clusters don't crush
    const packR = seedR * 0.78;
    const outer = layoutSierpinskiFractal(depth - 1, packR).leaves;
    const leaves = [];

    for (const cell of outer) {
      const cs = cell.scale ?? 1;
      const cos = Math.cos(cell.rot);
      const sin = Math.sin(cell.rot);
      for (const seed of seedLeaves) {
        const ss = (seed.scale ?? 1) * cs;
        const sx = seed.x * cs;
        const sy = seed.y * cs;
        leaves.push({
          x: cell.x + cos * sx - sin * sy,
          y: cell.y + sin * sx + cos * sy,
          rot: cell.rot + seed.rot,
          original: Boolean(cell.original && seed.original),
          scale: ss,
          soft: true,
        });
      }
    }

    return { leaves };
  }

  function rebuildBillionToTrillion() {
    ensureMillionMotif();
    if (!billionStamp || !billionStampGreen) {
      bakeBillionStamps();
    }
    stampMode = "billion";
    trillionLocked = false;

    const depth = Math.max(
      0,
      Math.min(power, TRILLION_POWER) - BILLION_POWER
    );
    if (depth === 0) {
      // Locked billion: keep the live million field (crisper than the stamp)
      stampMode = "million";
      instances = billionLeaves.length
        ? billionLeaves
        : layoutMeetingFractal(3, motifRadius).leaves;
      contentRadius = radiusOfInstances(instances, motifRadius);
      return;
    }

    if (power >= TRILLION_POWER) {
      // Lock the finished even-ring trillion figure
      ensureTrillionFigure();
      stampMode = "billion";
      instances = trillionLeaves;
      contentRadius = trillionRadius;
      return;
    }

    instances = layoutHexFractal(depth, billionRadius).leaves;
    contentRadius = radiusOfInstances(instances, billionRadius);
  }

  function rebuildTrillionToQuadrillion() {
    if (!trillionStamp || !trillionStampPink) {
      bakeTrillionStamps();
    }
    stampMode = "trillion";
    quadrillionLocked = false;

    const depth = Math.max(
      0,
      Math.min(power, QUADRILLION_POWER) - TRILLION_POWER
    );
    if (depth === 0) {
      // Still on the locked trillion (shouldn't normally hit via this path)
      stampMode = "billion";
      instances = trillionLeaves;
      contentRadius = trillionRadius;
      return;
    }

    instances = layoutTriangleThenSierpinski(depth, trillionRadius).leaves;
    contentRadius = radiusOfInstances(instances, trillionRadius);

    if (power >= QUADRILLION_POWER) {
      quadrillionLeaves = instances;
      quadrillionRadius = contentRadius;
      quadrillionLocked = true;
    }
  }

  function rebuildPastQuadrillion() {
    if (!quadrillionLocked || !quadrillionLeaves.length) {
      if (!trillionStamp) bakeTrillionStamps();
      quadrillionLeaves = layoutTriangleThenSierpinski(3, trillionRadius).leaves;
      quadrillionRadius = radiusOfInstances(quadrillionLeaves, trillionRadius);
      quadrillionLocked = true;
    }
    stampMode = "trillion";
    instances = quadrillionLeaves;
    contentRadius = quadrillionRadius;
  }

  function updateCameraTarget() {
    const fit = Math.min(w, h);
    if (power < MILLION_POWER) {
      targetCameraScale = (fit * 0.48) / Math.max(contentRadius, 1);
    } else if (power === MILLION_POWER) {
      targetCameraScale = (fit * 0.28) / Math.max(motifRadius, 1);
    } else if (power === BILLION_POWER) {
      targetCameraScale = (fit * 0.3) / Math.max(contentRadius, 1);
    } else if (power === TRILLION_POWER) {
      targetCameraScale = (fit * 0.32) / Math.max(trillionRadius || contentRadius, 1);
    } else if (power === QUADRILLION_POWER) {
      targetCameraScale =
        (fit * 0.34) / Math.max(quadrillionRadius || contentRadius, 1);
    } else if (power > QUADRILLION_POWER) {
      targetCameraScale =
        (fit * 0.36) / Math.max(quadrillionRadius || contentRadius, 1);
    } else {
      targetCameraScale = (fit * 0.47) / Math.max(contentRadius, 1);
    }
  }

  function rebuild() {
    if (power < MILLION_POWER) {
      rebuildGrowingPreMillion();
    } else if (power <= BILLION_POWER) {
      rebuildMillionToBillion();
    } else if (power <= TRILLION_POWER) {
      rebuildBillionToTrillion();
    } else if (power <= QUADRILLION_POWER) {
      rebuildTrillionToQuadrillion();
    } else {
      rebuildPastQuadrillion();
    }
    updateCameraTarget();
    if (power < MILLION_POWER || cameraScale === 1) {
      cameraScale = targetCameraScale;
    }
  }

  function drawLiveMotif(scale) {
    paintMotifSegments(
      ctx,
      motifSegments,
      10 ** Math.min(power, MILLION_POWER),
      scale,
      "gold"
    );
    ctx.globalAlpha = 1;
    ctx.fillStyle = `#${MILLION_COLOR.toString(16).padStart(6, "0")}`;
    ctx.beginPath();
    ctx.arc(0, 0, 2.8 / scale, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawStamp(inst) {
    const s = inst.scale ?? 1;
    let stamp;
    let unitR;
    if (stampMode === "trillion") {
      stamp = inst.original ? trillionStamp : trillionStampPink;
      unitR = trillionRadius;
    } else if (stampMode === "billion") {
      stamp = inst.original ? billionStamp : billionStampGreen;
      unitR = billionRadius;
    } else {
      stamp = inst.original ? stampGold : stampBlue;
      unitR = motifRadius;
    }
    if (!stamp) return;
    const worldDiameter = unitR * 2 * 1.08 * s;

    ctx.save();
    ctx.translate(inst.x, inst.y);
    ctx.rotate(inst.rot);
    // Keep pink trillion copies vivid; only gently thin stacked soft stamps
    ctx.globalAlpha = inst.soft
      ? stampMode === "trillion"
        ? instances.length > 100
          ? 0.92
          : 0.98
        : instances.length > 100
          ? 0.78
          : 0.9
      : instances.length > 100
        ? 0.85
        : 1;
    ctx.drawImage(
      stamp,
      -worldDiameter / 2,
      -worldDiameter / 2,
      worldDiameter,
      worldDiameter
    );
    ctx.restore();
  }

  function draw() {
    ctx.clearRect(0, 0, w, h);

    const zoomGap =
      Math.abs(targetCameraScale - cameraScale) /
      Math.max(Math.abs(targetCameraScale), Math.abs(cameraScale), 1e-9);
    const lerp = zoomGap > 0.45 ? 0.22 : zoomGap > 0.2 ? 0.12 : 0.08;
    cameraScale += (targetCameraScale - cameraScale) * lerp;
    const scale = cameraScale;

    ctx.save();
    ctx.translate(w / 2, h / 2);
    ctx.rotate(rotation);
    ctx.scale(scale, scale);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    if (power < MILLION_POWER) {
      drawLiveMotif(scale);
    } else if (stampGold && stampBlue) {
      const ordered = instances
        .map((inst) => ({ inst }))
        .sort((a, b) => {
          if (a.inst.original !== b.inst.original) {
            return a.inst.original ? 1 : -1;
          }
          const ra = Math.hypot(a.inst.x, a.inst.y);
          const rb = Math.hypot(b.inst.x, b.inst.y);
          return rb - ra;
        });
      for (const { inst } of ordered) {
        drawStamp(inst);
      }
    } else {
      drawLiveMotif(scale);
    }

    ctx.restore();
  }

  function frame() {
    raf = requestAnimationFrame(frame);
    rotation += 0.00028;
    draw();
  }

  function setPower(nextPower) {
    const prev = power;
    power = nextPower;
    rebuild();
    if (power < MILLION_POWER) {
      cameraScale = targetCameraScale;
    } else {
      const ratio =
        cameraScale / Math.max(targetCameraScale, 1e-9);
      // After a big jump (or first lock-in), start near the target so the
      // fractal copies aren't left off-screen while the camera crawls in.
      if (ratio > 2.2 || ratio < 0.45 || Math.abs(power - prev) > 1) {
        cameraScale = targetCameraScale;
      } else if (
        (prev < MILLION_POWER && power >= MILLION_POWER) ||
        (prev < BILLION_POWER && power >= BILLION_POWER) ||
        (prev < TRILLION_POWER && power >= TRILLION_POWER) ||
        (prev < QUADRILLION_POWER && power >= QUADRILLION_POWER)
      ) {
        cameraScale = targetCameraScale * 1.35;
      } else if (power > prev && power > MILLION_POWER) {
        cameraScale = Math.max(cameraScale, targetCameraScale * 1.2);
      }
    }
    draw();
  }

  rebuild();
  raf = requestAnimationFrame(frame);

  return {
    setPower,
    getPower: () => power,
    debug: () => ({
      power,
      instances: instances.length,
      motifSegs: motifSegments.length,
      motifRadius,
      contentRadius,
      cameraScale,
      targetCameraScale,
      hasStamps: !!(stampGold && stampBlue),
    }),
    dispose() {
      cancelAnimationFrame(raf);
      resizeObserver.disconnect();
      if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
    },
  };
}
