import { CHAPTERS, LADDER_STOPS } from "./content.js";
import { formatAtoms, nearestStop } from "./data.js";
import { createMapView } from "./mapView.js";
import { createScrolly } from "../shared/scrolly.js";
import { createPlayer } from "../shared/player.js";

const mapEl = document.getElementById("map");
const scrollyRoot = document.getElementById("scrolly");
const scaleMenu = document.getElementById("scale-menu");
const scaleMenuList = document.getElementById("scale-menu-list");
const playBtn = document.getElementById("play-control");

const mapView = createMapView(mapEl);
const menuButtons = new Map();

function mountScaleMenu() {
  for (const stop of LADDER_STOPS) {
    const li = document.createElement("li");
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "scale-menu__item is-upcoming";
    btn.dataset.stopId = stop.id;
    btn.style.setProperty("--item-color", stop.color);
    btn.setAttribute(
      "aria-label",
      `${stop.label}, ${formatAtoms(stop.atoms)} atoms`
    );

    const swatch = document.createElement("span");
    swatch.className = "scale-menu__swatch";
    swatch.style.background = stop.color;
    swatch.setAttribute("aria-hidden", "true");

    const name = document.createElement("span");
    name.className = "scale-menu__name";
    name.textContent = stop.name;

    const power = document.createElement("span");
    power.className = "scale-menu__power";
    power.textContent = formatAtoms(stop.atoms);

    btn.append(swatch, name, power);
    btn.addEventListener("click", () => jumpToStop(stop));
    li.append(btn);
    scaleMenuList.append(li);
    menuButtons.set(stop.id, btn);
  }
  scaleMenu.classList.add("is-visible");
}

function jumpToStop(stop) {
  player.stop();
  let best = null;
  let bestDist = Infinity;
  const target = Math.log10(stop.atoms);
  for (const chapter of CHAPTERS) {
    const dist = Math.abs(chapter.log10Target - target);
    if (dist < bestDist) {
      bestDist = dist;
      best = chapter;
    }
  }
  const el = best ? document.getElementById(`chapter-${best.id}`) : null;
  if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
}

function updateScaleMenu(log10Visible) {
  const active = nearestStop(log10Visible);
  for (const stop of LADDER_STOPS) {
    const btn = menuButtons.get(stop.id);
    if (!btn) continue;
    btn.classList.remove("is-active", "is-passed", "is-upcoming");
    if (stop.id === active.id) {
      btn.classList.add("is-active");
      btn.setAttribute("aria-current", "true");
    } else if (Math.log10(stop.atoms) > log10Visible + 0.15) {
      btn.classList.add("is-passed");
      btn.removeAttribute("aria-current");
    } else {
      btn.classList.add("is-upcoming");
      btn.removeAttribute("aria-current");
    }
  }
}

function mountChapters() {
  CHAPTERS.forEach((chapter, index) => {
    const section = document.createElement("section");
    section.className = "chapter";
    if (chapter.isBrand) section.classList.add("chapter--brand");
    if (index === CHAPTERS.length - 1) {
      section.classList.add("chapter--finale");
    }
    section.dataset.chapter = chapter.id;
    section.id = `chapter-${chapter.id}`;

    const pin = document.createElement("div");
    pin.className = "chapter__pin";

    const panel = document.createElement("article");
    panel.className = chapter.isBrand
      ? "chapter__panel chapter__panel--brand"
      : "chapter__panel";

    if (chapter.kicker) {
      const kicker = document.createElement("p");
      kicker.className = "chapter__kicker";
      kicker.textContent = chapter.kicker;
      panel.append(kicker);
    }

    const title = document.createElement(chapter.isBrand ? "h1" : "h2");
    title.className = chapter.isBrand
      ? "chapter__title chapter__title--brand"
      : "chapter__title";
    title.textContent = chapter.title;
    panel.append(title);

    if (chapter.deck) {
      const deck = document.createElement("p");
      deck.className = "chapter__deck";
      deck.textContent = chapter.deck;
      panel.append(deck);
    }

    for (const paragraph of chapter.body) {
      const p = document.createElement("p");
      p.className = chapter.isBrand
        ? "chapter__body chapter__body--brand"
        : "chapter__body";
      p.innerHTML = paragraph;
      panel.append(p);
    }

    pin.append(panel);
    section.append(pin);
    scrollyRoot.append(section);
    scrolly.register(section, index);
  });
}

const scrolly = createScrolly({
  chapters: CHAPTERS,
  onProgress({ log10Current }) {
    mapView.setLog10Visible(log10Current);
    updateScaleMenu(log10Current);
  },
});

function setAutoplayLayout(on) {
  const doc = document.documentElement;
  const before = doc.scrollHeight;
  const y = window.scrollY;
  document.body.classList.toggle("is-autoplay", on);
  // Force layout so fixed/pin styles apply before auto-scroll starts
  void doc.offsetHeight;
  const after = doc.scrollHeight;
  if (before > 1 && after > 1 && Math.abs(after - before) > 8) {
    window.scrollTo(0, (y / before) * after);
  }
  scrolly.measure();
  mapView.resize();
}

let playerMode = "idle";

function getPlayStartY() {
  // Skip the brand intro — jump to the first story card (centered)
  const startChapter =
    CHAPTERS.find((c) => !c.isBrand) ?? CHAPTERS[1] ?? CHAPTERS[0];
  if (!startChapter) return 0;
  const el = document.getElementById(`chapter-${startChapter.id}`);
  if (!el) return 0;
  const top = el.getBoundingClientRect().top + window.scrollY;
  return Math.max(0, top + el.offsetHeight * 0.08);
}

const player = createPlayer({
  button: playBtn,
  getPlayStartY,
  onModeChange(mode) {
    playerMode = mode;
    // Pin only while Play / Zoom out are driving the page
    setAutoplayLayout(mode === "playing" || mode === "zoomingOut");
    syncPlayButtonVisibility();
    if (mode === "playing") {
      // Sync map to the skipped-ahead chapter after layout + scroll jump
      requestAnimationFrame(() => scrolly.measure());
    }
  },
});

function syncPlayButtonVisibility() {
  const driven =
    playerMode === "playing" ||
    playerMode === "zoomingOut" ||
    playerMode === "readyZoomOut";
  // Once you scroll the story yourself, Play ducks out of the way
  const scrolledPastIntro = window.scrollY > window.innerHeight * 0.45;
  playBtn.classList.toggle("is-scrolled-away", !driven && scrolledPastIntro);
}

mountScaleMenu();
mountChapters();
scrolly.start();
syncPlayButtonVisibility();

window.__bignumbers = { scrolly, mapView, player, CHAPTERS };

window.addEventListener("scroll", syncPlayButtonVisibility, { passive: true });
window.addEventListener(
  "resize",
  () => {
    mapView.resize();
    syncPlayButtonVisibility();
  },
  { passive: true }
);
