import { readFileSync, statSync } from "node:fs";

import type {
  DashboardPageData,
  DashboardSummary,
  ItemForecastRow,
  Pagination,
  PlanningDashboard,
  WeeklyForecastCell,
} from "@/lib/types";

const PAGE_SIZE = 40;
const SALES_CSV_PATH =
  process.env.SALES_CSV_PATH ?? "C:/Users/kim_minkyeong07/Downloads/후아유 주차별 매출.csv";
const ITEM_WEEKLY_CSV_PATH =
  process.env.ITEM_WEEKLY_CSV_PATH ?? "C:/Users/kim_minkyeong07/Downloads/후아유 아이템별 주차별 판매.csv";
const DISCOUNT_CUTOFF_PCT = 50;

type MutableStyleYearGroup = {
  styleCode: string;
  itemRefCode: string;
  brandName: string;
  season: string;
  salesYear: number;
  styleName: string;
  itemName: string;
  categoryMajor: string;
  categoryMiddle: string;
  categorySmall: string;
  latestSaleDate: string;
  currentWeekNo: number;
  weeklyActualQty: number[];
  weeklyActualRevenue: number[];
};

type BasisSeries = {
  basisYear: number;
  scope: string;
  label: string;
  weeklyEligibleQty: number[];
  weeklyRawQty: number[];
  weeklyExcludedQty: number[];
  weeklyRatioPct: number[];
  totalEligibleQty: number;
  totalRawQty: number;
  excludedQty: number;
  excludedWeeks: number;
};

let cachedSourceKey = "";
let cachedRows: ItemForecastRow[] = [];
let cachedSummary: DashboardSummary | null = null;

function parseCsvLine(line: string) {
  const out: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];

    if (char === '"') {
      if (inQuotes && line[index + 1] === '"') {
        current += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      out.push(current);
      current = "";
      continue;
    }

    current += char;
  }

  out.push(current);
  return out;
}

function normalizeHeader(value: string) {
  return value.replace(/^\uFEFF/, "").trim();
}

function toNumber(value: string | undefined) {
  const number = Number(String(value ?? "").replace(/,/g, "").trim());
  return Number.isFinite(number) ? number : 0;
}

function normalizePage(page?: number | string) {
  const value = Number(page ?? 1);
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : 1;
}

function normalizeQuery(query?: string) {
  return query?.trim().toLowerCase() ?? "";
}

function getWeekNoFromYearWeekCode(value: string) {
  const digits = String(value).replace(/\D/g, "");
  if (digits.length < 6) {
    return 0;
  }
  return Number(digits.slice(-2));
}

function getYearFromYearWeekCode(value: string) {
  const digits = String(value).replace(/\D/g, "");
  if (digits.length < 6) {
    return 0;
  }
  return Number(digits.slice(0, 4));
}

function getIsoWeekStartDate(year: number, weekNumber: number) {
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const jan4Day = jan4.getUTCDay() || 7;
  const week1Monday = new Date(jan4);
  week1Monday.setUTCDate(jan4.getUTCDate() - jan4Day + 1);

  const target = new Date(week1Monday);
  target.setUTCDate(week1Monday.getUTCDate() + (weekNumber - 1) * 7);
  return target;
}

function formatWeekLabel(weekNumber: number, year: number) {
  const date = getIsoWeekStartDate(year, weekNumber);
  const month = date.getUTCMonth() + 1;
  const day = date.getUTCDate();
  const ordinal = Math.floor((day - 1) / 7) + 1;
  return `${month}월 ${ordinal}주차`;
}

function paginate<T>(rows: T[], page: number): { rows: T[]; meta: Pagination } {
  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const currentPage = Math.min(Math.max(1, page), totalPages);
  const startIndex = (currentPage - 1) * PAGE_SIZE;

  return {
    rows: rows.slice(startIndex, startIndex + PAGE_SIZE),
    meta: {
      currentPage,
      pageSize: PAGE_SIZE,
      totalRows: rows.length,
      totalPages,
    },
  };
}

function createEmptyWeekSeries() {
  return Array.from({ length: 53 }, () => 0);
}

function buildSourceKey() {
  const salesStat = statSync(SALES_CSV_PATH);
  const itemWeeklyStat = statSync(ITEM_WEEKLY_CSV_PATH);
  return [
    SALES_CSV_PATH,
    salesStat.size,
    Math.round(salesStat.mtimeMs),
    ITEM_WEEKLY_CSV_PATH,
    itemWeeklyStat.size,
    Math.round(itemWeeklyStat.mtimeMs),
  ].join("|");
}

function buildBasisMap() {
  const lines = readFileSync(ITEM_WEEKLY_CSV_PATH, "utf8").split(/\r?\n/).filter(Boolean);
  const header = parseCsvLine(lines[0]).map(normalizeHeader);

  const weekIndex = header.indexOf("주차");
  const majorIndex = header.indexOf("아이템대분류");
  const middleIndex = header.indexOf("중분류");
  const smallIndex = header.indexOf("소분류");
  const qtyIndex = header.indexOf("판매량");
  const discountIndex = header.indexOf("할인율(%)");

  if ([weekIndex, majorIndex, middleIndex, smallIndex, qtyIndex, discountIndex].some((value) => value < 0)) {
    throw new Error("후아유 아이템별 주차별 판매.csv의 필수 컬럼을 찾지 못했습니다.");
  }

  const grouped = new Map<string, BasisSeries>();

  function ensureSeries(year: number, scope: string, label: string) {
    const key = `${year}__${scope}__${label || "ALL"}`;
    const existing = grouped.get(key);
    if (existing) {
      return existing;
    }

    const created: BasisSeries = {
      basisYear: year,
      scope,
      label: label || "전체 평균",
      weeklyEligibleQty: createEmptyWeekSeries(),
      weeklyRawQty: createEmptyWeekSeries(),
      weeklyExcludedQty: createEmptyWeekSeries(),
      weeklyRatioPct: createEmptyWeekSeries(),
      totalEligibleQty: 0,
      totalRawQty: 0,
      excludedQty: 0,
      excludedWeeks: 0,
    };
    grouped.set(key, created);
    return created;
  }

  for (let lineIndex = 1; lineIndex < lines.length; lineIndex += 1) {
    const columns = parseCsvLine(lines[lineIndex]);
    const weekCode = toNumber(columns[weekIndex]);
    const basisYear = Math.floor(weekCode / 100);
    const weekNo = weekCode % 100;
    const major = normalizeHeader(columns[majorIndex] ?? "");
    const middle = normalizeHeader(columns[middleIndex] ?? "");
    const small = normalizeHeader(columns[smallIndex] ?? "");
    const qty = toNumber(columns[qtyIndex]);
    const discountPct = toNumber(columns[discountIndex]);
    const eligibleQty = discountPct >= DISCOUNT_CUTOFF_PCT ? 0 : qty;
    const excludedQty = discountPct >= DISCOUNT_CUTOFF_PCT ? qty : 0;

    if (basisYear <= 0 || weekNo <= 0 || weekNo > 52) {
      continue;
    }

    const targets: Array<{ scope: string; label: string }> = [
      { scope: "소분류", label: small },
      { scope: "중분류", label: middle },
      { scope: "대분류", label: major },
      { scope: "전체 평균", label: "" },
    ];

    for (const target of targets) {
      const series = ensureSeries(basisYear, target.scope, target.label);
      series.weeklyRawQty[weekNo] += qty;
      series.weeklyEligibleQty[weekNo] += eligibleQty;
      series.weeklyExcludedQty[weekNo] += excludedQty;
      series.totalRawQty += qty;
      series.totalEligibleQty += eligibleQty;
      series.excludedQty += excludedQty;
    }
  }

  for (const series of grouped.values()) {
    for (let weekNo = 1; weekNo <= 52; weekNo += 1) {
      series.weeklyRatioPct[weekNo] =
        series.totalEligibleQty > 0 ? (series.weeklyEligibleQty[weekNo] / series.totalEligibleQty) * 100 : 0;
      if (series.weeklyExcludedQty[weekNo] > 0) {
        series.excludedWeeks += 1;
      }
    }
  }

  return grouped;
}

function resolveBasisSeries(
  basisMap: Map<string, BasisSeries>,
  basisYear: number,
  categorySmall: string,
  categoryMiddle: string,
  categoryMajor: string,
) {
  const candidates = [
    { scope: "소분류", label: categorySmall },
    { scope: "중분류", label: categoryMiddle },
    { scope: "대분류", label: categoryMajor },
    { scope: "전체 평균", label: "" },
  ];

  for (const candidate of candidates) {
    const key = `${basisYear}__${candidate.scope}__${candidate.label || "ALL"}`;
    const matched = basisMap.get(key);
    if (matched && matched.totalEligibleQty > 0) {
      return matched;
    }
  }

  const previousYears = [...basisMap.values()]
    .map((value) => value.basisYear)
    .filter((year) => year < basisYear)
    .sort((a, b) => b - a);

  for (const previousYear of previousYears) {
    for (const candidate of candidates) {
      const key = `${previousYear}__${candidate.scope}__${candidate.label || "ALL"}`;
      const matched = basisMap.get(key);
      if (matched && matched.totalEligibleQty > 0) {
        return matched;
      }
    }
  }

  throw new Error("아이템 기준 주차 비중을 찾지 못했습니다.");
}

function buildItemForecastRows() {
  const basisMap = buildBasisMap();
  const salesLines = readFileSync(SALES_CSV_PATH, "utf8").split(/\r?\n/).filter(Boolean);
  const header = parseCsvLine(salesLines[0]).map(normalizeHeader);

  const weekCodeIndex = header.indexOf("주차");
  const brandIndex = header.indexOf("브랜드명");
  const yearIndex = header.indexOf("연도");
  const seasonIndex = header.indexOf("시즌");
  const styleCodeIndex = header.indexOf("스타일코드");
  const styleNameIndex = header.indexOf("스타일명");
  const itemNameIndex = header.indexOf("상품명");
  const qtyIndex = header.indexOf("판매수량");
  const revenueIndex = header.indexOf("판매액");
  const majorIndex = header.indexOf("대분류");
  const middleIndex = header.indexOf("중분류");
  const smallIndex = header.indexOf("소분류");

  if (
    [
      weekCodeIndex,
      brandIndex,
      yearIndex,
      seasonIndex,
      styleCodeIndex,
      styleNameIndex,
      itemNameIndex,
      qtyIndex,
      revenueIndex,
      majorIndex,
      middleIndex,
      smallIndex,
    ].some((value) => value < 0)
  ) {
    throw new Error("후아유 일자별 매출.csv의 필수 컬럼을 찾지 못했습니다.");
  }

  const grouped = new Map<string, Map<number, MutableStyleYearGroup>>();

  for (let lineIndex = 1; lineIndex < salesLines.length; lineIndex += 1) {
    const columns = parseCsvLine(salesLines[lineIndex]);
    const styleCode = normalizeHeader(columns[styleCodeIndex] ?? "");
    const weekCode = normalizeHeader(columns[weekCodeIndex] ?? "");

    if (!styleCode || !weekCode) {
      continue;
    }

    const salesYear = toNumber(columns[yearIndex]) || getYearFromYearWeekCode(weekCode);
    const weekNo = getWeekNoFromYearWeekCode(weekCode);
    const qty = toNumber(columns[qtyIndex]);
    const revenue = toNumber(columns[revenueIndex]);

    const yearMap = grouped.get(styleCode) ?? new Map<number, MutableStyleYearGroup>();
    const group = yearMap.get(salesYear) ?? {
      styleCode,
      itemRefCode: styleCode.slice(2, 4),
      brandName: normalizeHeader(columns[brandIndex] ?? ""),
      season: normalizeHeader(columns[seasonIndex] ?? ""),
      salesYear,
      styleName: normalizeHeader(columns[styleNameIndex] ?? ""),
      itemName: normalizeHeader(columns[itemNameIndex] ?? ""),
      categoryMajor: normalizeHeader(columns[majorIndex] ?? ""),
      categoryMiddle: normalizeHeader(columns[middleIndex] ?? ""),
      categorySmall: normalizeHeader(columns[smallIndex] ?? ""),
      latestSaleDate: weekCode,
      currentWeekNo: weekNo,
      weeklyActualQty: createEmptyWeekSeries(),
      weeklyActualRevenue: createEmptyWeekSeries(),
    };

    group.brandName ||= normalizeHeader(columns[brandIndex] ?? "");
    group.season ||= normalizeHeader(columns[seasonIndex] ?? "");
    group.styleName ||= normalizeHeader(columns[styleNameIndex] ?? "");
    group.itemName ||= normalizeHeader(columns[itemNameIndex] ?? "");
    group.categoryMajor ||= normalizeHeader(columns[majorIndex] ?? "");
    group.categoryMiddle ||= normalizeHeader(columns[middleIndex] ?? "");
    group.categorySmall ||= normalizeHeader(columns[smallIndex] ?? "");

    if (weekCode > group.latestSaleDate) {
      group.latestSaleDate = weekCode;
      group.currentWeekNo = weekNo;
    }

    group.weeklyActualQty[weekNo] += qty;
    group.weeklyActualRevenue[weekNo] += revenue;

    yearMap.set(salesYear, group);
    grouped.set(styleCode, yearMap);
  }

  const rows: ItemForecastRow[] = [];

  for (const yearMap of grouped.values()) {
    const activeYear = Math.max(...yearMap.keys());
    const group = yearMap.get(activeYear);
    if (!group) {
      continue;
    }

    const basisSeries = resolveBasisSeries(
      basisMap,
      group.salesYear - 1,
      group.categorySmall,
      group.categoryMiddle,
      group.categoryMajor,
    );

    const cumulativeBasisRatio = basisSeries.weeklyRatioPct
      .slice(1, group.currentWeekNo + 1)
      .reduce((total, value) => total + value, 0);
    const actualCumulativeQty = group.weeklyActualQty.slice(1, group.currentWeekNo + 1).reduce((total, value) => total + value, 0);
    const actualCumulativeRevenue = group.weeklyActualRevenue
      .slice(1, group.currentWeekNo + 1)
      .reduce((total, value) => total + value, 0);
    const projectedEndingQty =
      cumulativeBasisRatio > 0
        ? Math.max(Math.round((actualCumulativeQty * 100) / cumulativeBasisRatio), actualCumulativeQty)
        : actualCumulativeQty;
    const remainingForecastQty = Math.max(0, projectedEndingQty - actualCumulativeQty);
    const futureRatioSum = basisSeries.weeklyRatioPct
      .slice(group.currentWeekNo + 1)
      .reduce((total, value) => total + value, 0);
    const averageUnitPrice = actualCumulativeQty > 0 ? actualCumulativeRevenue / actualCumulativeQty : 0;

    const futureForecastRaw = Array.from({ length: 53 }, (_, index) => {
      if (index <= group.currentWeekNo || futureRatioSum <= 0) {
        return 0;
      }
      return (remainingForecastQty * basisSeries.weeklyRatioPct[index]) / futureRatioSum;
    });

    const futureRounded = futureForecastRaw.map((value) => Math.round(value));
    const roundedFutureSum = futureRounded.reduce((total, value) => total + value, 0);
    const roundingDiff = remainingForecastQty - roundedFutureSum;
    for (let weekNo = 52; weekNo >= group.currentWeekNo + 1; weekNo -= 1) {
      futureRounded[weekNo] += roundingDiff;
      break;
    }

    const weeklyForecast: WeeklyForecastCell[] = Array.from({ length: 52 }, (_, index) => {
      const weekNo = index + 1;
      const actualQty = weekNo <= group.currentWeekNo ? Math.round(group.weeklyActualQty[weekNo]) : 0;
      const actualRevenue = weekNo <= group.currentWeekNo ? Math.round(group.weeklyActualRevenue[weekNo]) : 0;
      const forecastQty = weekNo > group.currentWeekNo ? Math.max(0, futureRounded[weekNo]) : 0;
      const forecastRevenue = weekNo > group.currentWeekNo ? Math.round(forecastQty * averageUnitPrice) : 0;

      return {
        weekNo,
        label: formatWeekLabel(weekNo, group.salesYear),
        basisYear: basisSeries.basisYear,
        basisQty: Math.round(basisSeries.weeklyEligibleQty[weekNo]),
        excludedQty: Math.round(basisSeries.weeklyExcludedQty[weekNo]),
        actualQty,
        forecastQty,
        totalQty: actualQty + forecastQty,
        actualRevenue,
        forecastRevenue,
        totalRevenue: actualRevenue + forecastRevenue,
        ratioPct: basisSeries.weeklyRatioPct[weekNo] ?? 0,
        isFuture: weekNo > group.currentWeekNo,
      };
    });

    const peakWeek = weeklyForecast.reduce(
      (best, cell) => (cell.totalQty > best.totalQty ? { weekNo: cell.weekNo, totalQty: cell.totalQty } : best),
      { weekNo: 1, totalQty: 0 },
    ).weekNo;
    const projectedEndingRevenue = Math.round(projectedEndingQty * averageUnitPrice);
    const remainingForecastRevenue = Math.max(0, projectedEndingRevenue - actualCumulativeRevenue);
    const peakWeekDate = getIsoWeekStartDate(group.salesYear, peakWeek);

    rows.push({
      styleCode: group.styleCode,
      itemRefCode: group.itemRefCode,
      brandName: group.brandName,
      season: group.season,
      salesYear: group.salesYear,
      styleName: group.styleName,
      itemName: group.itemName,
      categoryMajor: group.categoryMajor,
      categoryMiddle: group.categoryMiddle,
      categorySmall: group.categorySmall,
      latestSaleDate: group.latestSaleDate,
      currentWeekNo: group.currentWeekNo,
      currentWeekLabel: formatWeekLabel(group.currentWeekNo, group.salesYear),
      basisYear: basisSeries.basisYear,
      basisScope: basisSeries.scope,
      basisLabel: basisSeries.label,
      basisTotalEligibleQty: Math.round(basisSeries.totalEligibleQty),
      basisTotalRawQty: Math.round(basisSeries.totalRawQty),
      basisExcludedQty: Math.round(basisSeries.excludedQty),
      basisExcludedWeeks: basisSeries.excludedWeeks,
      cumulativeActualQty: actualCumulativeQty,
      cumulativeActualRevenue: actualCumulativeRevenue,
      projectedEndingQty,
      projectedEndingRevenue,
      remainingForecastQty,
      remainingForecastRevenue,
      progressPct: projectedEndingQty > 0 ? (actualCumulativeQty / projectedEndingQty) * 100 : 0,
      peakWeekNo: peakWeek,
      peakWeekLabel: formatWeekLabel(peakWeek, group.salesYear),
      peakMonthLabel: `${peakWeekDate.getUTCMonth() + 1}월`,
      weeklyForecast,
    });
  }

  rows.sort((a, b) => {
    if (b.projectedEndingQty !== a.projectedEndingQty) {
      return b.projectedEndingQty - a.projectedEndingQty;
    }
    return a.styleCode.localeCompare(b.styleCode);
  });

  const latestSalesYear = rows.reduce((maxYear, row) => Math.max(maxYear, row.salesYear), 0);
  const summary: DashboardSummary = {
    totalItems: rows.length,
    latestSalesYear,
    totalActualQty: rows.reduce((total, row) => total + row.cumulativeActualQty, 0),
    totalProjectedQty: rows.reduce((total, row) => total + row.projectedEndingQty, 0),
    totalProjectedRevenue: rows.reduce((total, row) => total + row.projectedEndingRevenue, 0),
  };

  return { rows, summary };
}

function ensureDatasetLoaded() {
  const sourceKey = buildSourceKey();
  if (cachedSummary && cachedSourceKey === sourceKey) {
    return { rows: cachedRows, summary: cachedSummary };
  }

  const dataset = buildItemForecastRows();
  cachedSourceKey = sourceKey;
  cachedRows = dataset.rows;
  cachedSummary = dataset.summary;
  return dataset;
}

export async function getDashboardPageData(query?: string, page?: number | string): Promise<DashboardPageData> {
  const normalizedQuery = normalizeQuery(query);
  const normalizedPage = normalizePage(page);

  try {
    const dataset = ensureDatasetLoaded();
    const filteredRows = normalizedQuery
      ? dataset.rows.filter((row) =>
          [
            row.styleCode,
            row.styleName,
            row.itemName,
            row.itemRefCode,
            row.brandName,
            row.categoryMajor,
            row.categoryMiddle,
            row.categorySmall,
            row.basisLabel,
          ]
            .join(" ")
            .toLowerCase()
            .includes(normalizedQuery),
        )
      : dataset.rows;

    const paginated = paginate(filteredRows, normalizedPage);
    const dashboard: PlanningDashboard = {
      query: query?.trim() ?? "",
      summary: {
        totalItems: filteredRows.length,
        latestSalesYear: dataset.summary.latestSalesYear,
        totalActualQty: filteredRows.reduce((total, row) => total + row.cumulativeActualQty, 0),
        totalProjectedQty: filteredRows.reduce((total, row) => total + row.projectedEndingQty, 0),
        totalProjectedRevenue: filteredRows.reduce((total, row) => total + row.projectedEndingRevenue, 0),
      },
      itemRows: paginated.rows,
      pagination: paginated.meta,
    };

    return {
      ok: true,
      dashboard,
      query: query?.trim() ?? "",
      page: normalizedPage,
    };
  } catch (error) {
    return {
      ok: false,
      query: query?.trim() ?? "",
      page: normalizedPage,
      message: error instanceof Error ? error.message : "데이터를 불러오지 못했습니다.",
    };
  }
}
