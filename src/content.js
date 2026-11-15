import {
  ATOM_STOPS,
  formatArea,
  formatAtoms,
  formatAtomsDigits,
} from "./atoms.js";

/** Flip to `true` to include the 1-octillion chapter + ladder stop. */
export const SHOW_OCTILLION_CHAPTER = false;

const byId = Object.fromEntries(ATOM_STOPS.map((s) => [s.id, s]));

function stopMeta(id) {
  const s = byId[id];
  const area = formatArea(s.atoms);
  const digits = formatAtomsDigits(s.atoms);
  return {
    ...s,
    area,
    atomsLabel: formatAtoms(s.atoms),
    digitsLabel: digits,
  };
}

const oct = stopMeta("octillion");
const g6 = stopMeta("gpt6");
const g4 = stopMeta("gpt4");
const g35 = stopMeta("gpt35");
const g2 = stopMeta("gpt2");
const g1 = stopMeta("gpt1");
const tri = stopMeta("trillion");

const openingStop = SHOW_OCTILLION_CHAPTER ? oct : g6;

/**
 * One card per zoom stop (plus the opening brand card).
 * Scroll between cards eases log10 — no intermediate “zooming in” cards.
 */
const ALL_CHAPTERS = [
  {
    id: "brand",
    kicker: "",
    title: "Big Numbers",
    deck: "Case studies exploring the very large numbers we are seeing in AI headlines.",
    body: [
      "If each calculation used to train an AI model were represented by a hydrogen atom laid flat on a map (covering approximately 10⁻²⁰ m²), how much ground would the atoms cover?",
    ],
    log10Target: Math.log10(openingStop.atoms),
    isBrand: true,
  },
  {
    id: "octillion",
    kicker: oct.digitsLabel,
    title: "1 octillion atoms",
    body: [
      `A square of an octillion hydrogen atoms laid flat is roughly <strong>${oct.area.primary}</strong>. Here we can see the footprint of an octillion atoms lined up in a square on top of New York City.`,
    ],
    log10Target: Math.log10(oct.atoms),
    stopId: "octillion",
  },
  {
    id: "gpt6",
    kicker: g6.digitsLabel,
    title: "GPT-6 Astra’s training.",
    body: [
      `About <strong>${g6.atomsLabel}</strong> floating point operations (arithmetic calculations like addition or multiplication) were used to train the model, just shy of an octillion.`,
      `A square of this many atoms laid flat would cover almost 37 blocks of New York City from Henry Hudson Parkway to 1st Avenue.`,
    ],
    log10Target: Math.log10(g6.atoms),
    stopId: "gpt6",
  },
  {
    id: "gpt4",
    kicker: g4.digitsLabel,
    title: "GPT-4.",
    body: [
      `Just three years earlier, in 2023, GPT-4 used <strong>${g4.atomsLabel}</strong> floating point operations (FLOP), a little over 2% of that used by GPT-6. This amount of hydrogen atoms laid flat would cover almost 52 acres of Central Park.`,
    ],
    log10Target: Math.log10(g4.atoms),
    stopId: "gpt4",
  },
  {
    id: "gpt35",
    kicker: g35.digitsLabel,
    title: "GPT-3.5.",
    body: [
      `In 2022, GPT-3.5 used an estimated <strong>${g35.atomsLabel}</strong> FLOP to train.  That amount of atoms laid flat would cover <strong>${g35.area.primary}</strong>, roughly the area of six football fields.`,
    ],
    log10Target: Math.log10(g35.atoms),
    stopId: "gpt35",
  },
  {
    id: "gpt2",
    kicker: g2.digitsLabel,
    title: "GPT-2.",
    body: [
      `In 2019, GPT-2 used an estimated <strong>${g2.atomsLabel}</strong> FLOP, 1/188,000 of that used by GPT-6. That amount of hydrogen atoms laid flat would cover <strong>${g2.area.primary}</strong>, about the span of a small picnic on the lawn.`,
    ],
    log10Target: Math.log10(g2.atoms),
    stopId: "gpt2",
  },
  {
    id: "gpt1",
    kicker: g1.digitsLabel,
    title: "GPT-1.",
    body: [
      `GPT-1 was trained on an estimated <strong>${g1.atomsLabel}</strong> FLOP. This amount of hydrogen atoms laid flat would cover roughly a pizza box on the grass. This is about 52 million times fewer calculations than GPT-6 used just 8 years later
      .`,
    ],
    log10Target: Math.log10(g1.atoms),
    stopId: "gpt1",
  },
  {
    id: "trillion",
    kicker: tri.digitsLabel,
    title: "1 trillion atoms.",
    body: [
      `But numerically, this is still quite a large number. To put it to scale, one trillion hydrogen atoms laid flat would be a speck on that pizza box, just perceptible to the naked eye.`,
    ],
    log10Target: Math.log10(tri.atoms),
    stopId: "trillion",
  },
];

export const CHAPTERS = ALL_CHAPTERS.filter(
  (chapter) => SHOW_OCTILLION_CHAPTER || chapter.id !== "octillion"
);

/** Stops shown in the zoom ladder (respects the octillion toggle). */
export const LADDER_STOPS = ATOM_STOPS.filter(
  (stop) => SHOW_OCTILLION_CHAPTER || stop.id !== "octillion"
);
