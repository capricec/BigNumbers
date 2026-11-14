import {
  SAND_STOPS,
  formatVolume,
  formatGrains,
  formatGrainsDigits,
} from "./data.js";

const byId = Object.fromEntries(SAND_STOPS.map((s) => [s.id, s]));

function stopMeta(id) {
  const s = byId[id];
  const volume = formatVolume(s.grains);
  return {
    ...s,
    volume,
    grainsLabel: formatGrains(s.grains),
    digitsLabel: formatGrainsDigits(s.grains),
  };
}

const g6 = stopMeta("gpt6");
const g4 = stopMeta("gpt4");
const g35 = stopMeta("gpt35");
const g2 = stopMeta("gpt2");
const g1 = stopMeta("gpt1");
const tri = stopMeta("trillion");

/**
 * One card per volume stop (plus the opening brand card).
 */
export const CHAPTERS = [
  {
    id: "brand",
    kicker: "",
    title: "Big Numbers",
    deck: "Case studies exploring the very large numbers we are seeing in AI headlines.",
    body: [
      "If each calculation used to train an AI model were a grain of sand (about <strong>0.5&nbsp;mm</strong> across), how much volume would that pile fill?",
    ],
    log10Target: Math.log10(g6.grains),
    isBrand: true,
  },
  {
    id: "gpt6",
    kicker: g6.digitsLabel,
    title: "GPT-6 Astra’s training.",
    body: [
      `About <strong>${g6.grainsLabel}</strong> floating point operations — as sand, a cube roughly <strong>${g6.volume.side}</strong> on a side (<strong>${g6.volume.primary}</strong>).`,
    ],
    log10Target: Math.log10(g6.grains),
    stopId: "gpt6",
  },
  {
    id: "gpt4",
    kicker: g4.digitsLabel,
    title: "GPT-4.",
    body: [
      `GPT-4’s budget was about <strong>${g4.grainsLabel}</strong> FLOP — a sand cube <strong>${g4.volume.side}</strong> across (<strong>${g4.volume.primary}</strong>).`,
    ],
    log10Target: Math.log10(g4.grains),
    stopId: "gpt4",
  },
  {
    id: "gpt35",
    kicker: g35.digitsLabel,
    title: "GPT-3.5.",
    body: [
      `GPT-3.5: roughly <strong>${g35.grainsLabel}</strong> FLOP → <strong>${g35.volume.primary}</strong> of sand (<strong>${g35.volume.side}</strong> cube).`,
    ],
    log10Target: Math.log10(g35.grains),
    stopId: "gpt35",
  },
  {
    id: "gpt2",
    kicker: g2.digitsLabel,
    title: "GPT-2.",
    body: [
      `GPT-2 used about <strong>${g2.grainsLabel}</strong> FLOP — only <strong>${g2.volume.primary}</strong> of sand (<strong>${g2.volume.side}</strong> on a side).`,
    ],
    log10Target: Math.log10(g2.grains),
    stopId: "gpt2",
  },
  {
    id: "gpt1",
    kicker: g1.digitsLabel,
    title: "GPT-1.",
    body: [
      `GPT-1: <strong>${g1.grainsLabel}</strong> FLOP as sand fills about <strong>${g1.volume.primary}</strong> — a cube <strong>${g1.volume.side}</strong> across.`,
    ],
    log10Target: Math.log10(g1.grains),
    stopId: "gpt1",
  },
  {
    id: "trillion",
    kicker: tri.digitsLabel,
    title: "1 trillion grains.",
    body: [
      `A trillion grains is only <strong>${tri.volume.primary}</strong> — a cube about <strong>${tri.volume.side}</strong> on a side. Still a lot of sand; tiny next to a modern training run.`,
    ],
    log10Target: Math.log10(tri.grains),
    stopId: "trillion",
  },
];

export const LADDER_STOPS = SAND_STOPS;
