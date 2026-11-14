/**
 * Scroll-driven sand cube: side length scales with ∛volume.
 * Largest stop (GPT-6) nearly fills the upper stage; smaller piles shrink with it.
 */

import {
  SAND_STOPS,
  cubeSideMeters,
  formatVolume,
  formatGrains,
  grainsFromLog10,
  nearestStop,
  stopNeighborhood,
} from "./data.js";

const LOG_MAX = Math.log10(SAND_STOPS[0].grains);
const SIDE_MAX_M = cubeSideMeters(SAND_STOPS[0].grains);

export function createVolumeView(container) {
  container.classList.add("volume-stage");

  const scene = document.createElement("div");
  scene.className = "volume-scene";

  const cube = document.createElement("div");
  cube.className = "sand-cube";
  cube.innerHTML = `
    <span class="sand-cube__face sand-cube__face--top"></span>
    <span class="sand-cube__face sand-cube__face--left"></span>
    <span class="sand-cube__face sand-cube__face--right"></span>
  `;

  const readout = document.createElement("div");
  readout.className = "volume-readout";
  readout.innerHTML = `
    <p class="volume-readout__stop"></p>
    <p class="volume-readout__volume"></p>
    <p class="volume-readout__side"></p>
  `;

  const ghosts = document.createElement("div");
  ghosts.className = "volume-ghosts";

  scene.append(cube, ghosts, readout);
  container.append(scene);

  const stopEl = readout.querySelector(".volume-readout__stop");
  const volumeEl = readout.querySelector(".volume-readout__volume");
  const sideEl = readout.querySelector(".volume-readout__side");

  let log10Visible = LOG_MAX;

  // Nested outline cubes for neighboring stops
  for (const stop of SAND_STOPS) {
    const g = document.createElement("div");
    g.className = "sand-ghost";
    g.dataset.stopId = stop.id;
    g.style.setProperty("--ghost-color", stop.accent);
    ghosts.append(g);
  }

  function usableHeight() {
    const h = container.clientHeight || window.innerHeight;
    const w = container.clientWidth || window.innerWidth;
    const isMobile = w < 720;
    // Leave room for cards on mobile (bottom band)
    return h * (isMobile ? 0.42 : 0.55);
  }

  function pxForSide(sideM) {
    const maxPx = usableHeight();
    return Math.max(4, maxPx * (sideM / SIDE_MAX_M));
  }

  function applyLog10(log10) {
    log10Visible = log10;
    const grains = grainsFromLog10(log10);
    const sideM = cubeSideMeters(grains);
    const px = pxForSide(sideM);
    const stop = nearestStop(log10);
    const vol = formatVolume(grains);
    const hood = stopNeighborhood(log10);

    cube.style.setProperty("--cube-size", `${px.toFixed(1)}px`);
    cube.style.setProperty("--cube-color", stop.color);
    cube.style.setProperty("--cube-accent", stop.accent);

    stopEl.textContent = stop.name;
    volumeEl.textContent = vol.primary;
    sideEl.textContent = `${vol.side} cube · ${formatGrains(grains)} grains`;

    for (const g of ghosts.children) {
      const s = SAND_STOPS.find((x) => x.id === g.dataset.stopId);
      if (!s) continue;
      const gPx = pxForSide(cubeSideMeters(s.grains));
      g.style.setProperty("--ghost-size", `${gPx.toFixed(1)}px`);
      let opacity = 0;
      if (s.id === hood.active.id) opacity = 0;
      else if (s.id === hood.incoming?.id) opacity = 0.22 * hood.progress;
      else if (s.id === hood.outgoing?.id) opacity = 0.18 * (1 - hood.progress);
      g.style.opacity = String(opacity);
    }

    return { log10Visible, grains, stop, volume: vol };
  }

  function resize() {
    applyLog10(log10Visible);
  }

  applyLog10(log10Visible);

  return {
    setLog10Visible: applyLog10,
    resize,
    destroy() {
      scene.remove();
    },
  };
}
