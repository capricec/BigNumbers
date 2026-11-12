import { CHAPTERS } from "./content.js";
import { ATOM_STOPS, formatAtoms, nearestStop } from "./atoms.js";
import { createMapView } from "./mapView.js";
import { createScrolly } from "./scrolly.js";
import { createPlayer } from "./player.js";

const mapEl = document.getElementById("map");
const scrollyRoot = document.getElementById("scrolly");
const scaleMenu = document.getElementById("scale-menu");
const scaleMenuList = document.getElementById("scale-menu-list");
const playBtn = document.getElementById("play-control");

const mapView = createMapView(mapEl);
const menuButtons = new Map();

function mountScaleMenu() {
  for (const stop of ATOM_STOPS) {
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
  for (const stop of ATOM_STOPS) {
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

    section.append(panel);
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

const player = createPlayer({ button: playBtn });

mountScaleMenu();
mountChapters();
scrolly.start();

window.__bignumbers = { scrolly, mapView, player, CHAPTERS };

window.addEventListener(
  "resize",
  () => {
    mapView.resize();
  },
  { passive: true }
);
