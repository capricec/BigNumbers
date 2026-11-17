/** Short-scale names: each step is ×1,000. Million flash = 0.01s. */
export const MILLION_SECONDS = 0.01;
export const TRILLION = 1e12;

/** Dollars per second so $1M lands when the million light goes out. */
export const DOLLARS_PER_SECOND = 1e6 / MILLION_SECONDS;

/** Full short-scale ladder; viz currently focuses through trillion. */
export const ALL_MAGNITUDES = [
  { id: "million", name: "Million", power: 6, value: 1e6 },
  { id: "billion", name: "Billion", power: 9, value: 1e9 },
  { id: "trillion", name: "Trillion", power: 12, value: 1e12 },
  { id: "quadrillion", name: "Quadrillion", power: 15, value: 1e15 },
  { id: "quintillion", name: "Quintillion", power: 18, value: 1e18 },
  { id: "sextillion", name: "Sextillion", power: 21, value: 1e21 },
  { id: "septillion", name: "Septillion", power: 24, value: 1e24 },
  { id: "octillion", name: "Octillion", power: 27, value: 1e27 },
];

/** Flip to false later to restore the full ladder past a trillion. */
export const LIMIT_TO_TRILLION = true;

export const MAGNITUDES = LIMIT_TO_TRILLION
  ? ALL_MAGNITUDES.filter((m) => m.value <= TRILLION)
  : ALL_MAGNITUDES;

/**
 * Real-world figures near $1 trillion. Selecting one sets the running-total target.
 * Scale stays fixed: $1 million = MILLION_SECONDS.
 */
export const TARGETS = [
  {
    id: "ai-investment-2026",
    amount: 1e12,
    amountLabel: "$1 Trillion",
    cardSubject: "Global AI Investments in 2026",
    subject: "Global AI investment in 2026",
    when: "2026",
    summary:
      "Goldman Sachs estimates worldwide AI investment will reach $1 trillion in 2026. It estimates cumulative investment since 2022 will reach $1.8 trillion by the end of 2026.",
    note: "This is a broader measure than just hyperscaler capital expenditure.",
  },
  {
    id: "musk",
    amount: 1.1e12,
    amountLabel: "$1.1 Trillion",
    cardSubject: "Elon Musk net worth",
    subject: "Elon Musk",
    when: "June 12, 2026",
    summary:
      "Forbes declared him the world's first trillionaire after SpaceX began trading publicly. His estimated fortune rose to $1.1 trillion.",
    note: "",
  },
  {
    id: "anthropic",
    amount: 1.4e12,
    amountLabel: "$1.4 Trillion",
    cardSubject: "Anthropic proposed IPO valuation",
    subject: "Anthropic",
    when: "November 2026",
    summary:
      "Its proposed IPO valuation, on a fully diluted basis. Reuters reports approximately $1 trillion excluding options and restricted stock.",
    note: "A particularly interesting example because the headline number and the underlying valuation calculation differ substantially.",
  },
];

export const DEFAULT_TARGET_ID = "ai-investment-2026";

export function getTarget(id) {
  return TARGETS.find((t) => t.id === id) ?? TARGETS[0];
}

export function secondsFor(value) {
  return (value / 1e6) * MILLION_SECONDS;
}

export function dollarsAtElapsed(elapsedSeconds, { cap = Infinity } = {}) {
  return Math.min(elapsedSeconds * DOLLARS_PER_SECOND, cap);
}

export function formatDollars(amount) {
  if (amount < 1000) {
    return `$${Math.floor(amount).toLocaleString("en-US")}`;
  }
  if (amount < 1e6) {
    return `$${Math.floor(amount).toLocaleString("en-US")}`;
  }
  if (amount < 1e9) {
    return `$${trimMoney(amount / 1e6)} million`;
  }
  if (amount < 1e12) {
    return `$${trimMoney(amount / 1e9)} billion`;
  }
  if (amount < 1e15) {
    return `$${trimMoney(amount / 1e12)} trillion`;
  }
  if (amount < 1e18) {
    return `$${trimMoney(amount / 1e15)} quadrillion`;
  }
  if (amount < 1e21) {
    return `$${trimMoney(amount / 1e18)} quintillion`;
  }
  if (amount < 1e24) {
    return `$${trimMoney(amount / 1e21)} sextillion`;
  }
  if (amount < 1e27) {
    return `$${trimMoney(amount / 1e24)} septillion`;
  }
  return `$${trimMoney(amount / 1e27)} octillion`;
}

function trimMoney(n) {
  if (n >= 100) return String(Math.round(n));
  if (n >= 10) return String(Math.round(n * 10) / 10);
  return String(Math.round(n * 100) / 100);
}

export function formatDuration(seconds) {
  if (seconds < 1) {
    return "1/100 of a second";
  }
  if (seconds < 60) {
    return `${roundNice(seconds)} seconds`;
  }

  const minutes = seconds / 60;
  if (minutes < 60) {
    const m = Math.floor(minutes);
    const s = Math.round(seconds - m * 60);
    if (s === 0) return `${m} minute${m === 1 ? "" : "s"}`;
    return `${m} minute${m === 1 ? "" : "s"} ${s} second${s === 1 ? "" : "s"}`;
  }

  const hours = seconds / 3600;
  if (hours < 24) {
    const h = Math.floor(hours);
    const m = Math.round((seconds - h * 3600) / 60);
    if (m === 0) return `${h} hour${h === 1 ? "" : "s"}`;
    return `${h} hour${h === 1 ? "" : "s"} ${m} minute${m === 1 ? "" : "s"}`;
  }

  const days = seconds / 86400;
  if (days < 365) {
    const d = Math.floor(days);
    const h = Math.round((seconds - d * 86400) / 3600);
    if (h === 0) return `${d} day${d === 1 ? "" : "s"}`;
    return `${d} day${d === 1 ? "" : "s"} ${h} hour${h === 1 ? "" : "s"}`;
  }

  const years = seconds / (365.25 * 86400);
  if (years < 1e6) {
    return `${formatCount(years)} years`;
  }
  if (years < 1e9) {
    return `${formatCount(years / 1e6)} million years`;
  }
  if (years < 1e12) {
    return `${formatCount(years / 1e9)} billion years`;
  }
  return `${formatCount(years / 1e12)} trillion years`;
}

function roundNice(n) {
  if (n >= 10) return String(Math.round(n));
  const t = Math.round(n * 10) / 10;
  return String(t);
}

function formatCount(n) {
  if (n >= 100) return String(Math.round(n));
  if (n >= 10) return String(Math.round(n * 10) / 10);
  return String(Math.round(n * 100) / 100);
}

const MS_PER_DAY = 86400000;
/** JS Date is safe roughly through year 275760. */
const DATE_SAFE_YEAR = 275000;

/**
 * Absolute wall-clock moment when a light would turn on if the clock
 * starts at `from`.
 */
export function formatExtinguishAt(from, seconds) {
  const yearsAhead = seconds / (365.25 * 86400);
  const targetYear = from.getFullYear() + yearsAhead;

  if (!Number.isFinite(targetYear) || targetYear > DATE_SAFE_YEAR) {
    if (yearsAhead >= 1e12) {
      return `year ${formatCount(targetYear / 1e12)} trillion`;
    }
    if (yearsAhead >= 1e9) {
      return `year ${formatCount(targetYear / 1e9)} billion`;
    }
    if (yearsAhead >= 1e6) {
      return `year ${formatCount(targetYear / 1e6)} million`;
    }
    return `year ${Math.round(targetYear).toLocaleString("en-US")}`;
  }

  const at = new Date(from.getTime() + seconds * 1000);
  if (Number.isNaN(at.getTime())) {
    return `year ${Math.round(targetYear).toLocaleString("en-US")}`;
  }

  const time = at.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: seconds < 60 ? "2-digit" : undefined,
  });

  const sameDay =
    at.getFullYear() === from.getFullYear() &&
    at.getMonth() === from.getMonth() &&
    at.getDate() === from.getDate();

  if (sameDay) {
    return time;
  }

  const dayDiff = (startOfDay(at) - startOfDay(from)) / MS_PER_DAY;

  if (dayDiff > 0 && dayDiff < 7) {
    const weekday = at.toLocaleDateString("en-US", { weekday: "long" });
    return `${weekday} at ${time}`;
  }

  if (yearsAhead < 2) {
    const date = at.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: at.getFullYear() === from.getFullYear() ? undefined : "numeric",
    });
    return `${date} at ${time}`;
  }

  if (yearsAhead < 100) {
    return at.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }

  return `year ${at.getFullYear().toLocaleString("en-US")}`;
}

function startOfDay(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}
