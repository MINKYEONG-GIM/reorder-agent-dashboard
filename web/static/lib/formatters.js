export const numberFormatter = new Intl.NumberFormat("ko-KR");

const FORECAST_YEAR = 2026;

export function formatWon(valueInWon) {
  return `${numberFormatter.format(Math.round(valueInWon))}원`;
}

export function formatCompactBillion(valueInWon) {
  return `${(valueInWon / 100000000).toFixed(1)}억`;
}

export function formatUnits(value) {
  return `${numberFormatter.format(Math.round(value))}장`;
}

export function formatSignedPercent(value) {
  return `${value > 0 ? "+" : ""}${value.toFixed(1)}%`;
}

export function riskClass(risk) {
  if (risk === "낮음") return "risk-low";
  if (risk === "중간") return "risk-mid";
  return "risk-high";
}

function isoWeekStartDate(year, weekNumber) {
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const jan4Day = jan4.getUTCDay() || 7;
  const week1Monday = new Date(jan4);
  week1Monday.setUTCDate(jan4.getUTCDate() - jan4Day + 1);

  const target = new Date(week1Monday);
  target.setUTCDate(week1Monday.getUTCDate() + (weekNumber - 1) * 7);
  return target;
}

export function formatWeekLabel(weekNumber, year = FORECAST_YEAR) {
  const numericWeek = Number(weekNumber);
  if (!Number.isFinite(numericWeek) || numericWeek <= 0) {
    return "-";
  }

  const date = isoWeekStartDate(year, numericWeek);
  const month = date.getUTCMonth() + 1;
  const day = date.getUTCDate();
  const ordinal = Math.floor((day - 1) / 7) + 1;
  return `${month}월 ${ordinal}주차`;
}

export function formatWeekText(text, year = FORECAST_YEAR) {
  if (!text) return "-";
  return String(text).replace(/(\d+)(?:주차|二쇱감)/g, (_, week) => formatWeekLabel(Number(week), year));
}
