import type {
  BasisProfile,
  DashboardPageData,
  DashboardSummary,
  ItemForecastRow,
  ItemForecastWeek,
  Pagination,
  PlanningDashboard,
  WeeklyShareCell,
} from "./types";

const PAGE_SIZE = 24;
const MAX_WEEK_NO = 53;
const CURRENT_WEEK_NO = 19;
const SALES_YEAR = 2026;

const CATEGORY_PROFILES = [
  { major: "상의", middle: "티셔츠", small: "그래픽 티셔츠", base: 184000, peak: 21, excluded: [7, 8, 52] },
  { major: "상의", middle: "후드", small: "스웨트 후드", base: 128000, peak: 39, excluded: [3, 4, 5] },
  { major: "상의", middle: "셔츠", small: "체크 셔츠", base: 93000, peak: 36, excluded: [6, 7] },
  { major: "하의", middle: "팬츠", small: "데님 팬츠", base: 142000, peak: 17, excluded: [1, 2, 50] },
  { major: "하의", middle: "스커트", small: "미니 스커트", base: 67000, peak: 24, excluded: [48, 49] },
  { major: "아우터", middle: "점퍼", small: "바람막이", base: 76000, peak: 14, excluded: [27, 28] },
  { major: "아우터", middle: "다운", small: "푸퍼", base: 101000, peak: 47, excluded: [20, 21] },
  { major: "잡화", middle: "모자", small: "볼캡", base: 82000, peak: 20, excluded: [9, 10] },
  { major: "잡화", middle: "가방", small: "백팩", base: 57000, peak: 35, excluded: [2, 3] },
  { major: "잡화", middle: "벨트", small: "웨스턴 벨트", base: 26000, peak: 31, excluded: [12, 13] },
];

const STYLE_PREFIXES = ["WH", "WH", "WH", "WH", "WH", "WH"];
const STYLE_NAMES = [
  "Steve Graphic Tee",
  "Campus Sweat Hoodie",
  "Heritage Check Shirt",
  "Wide Denim Pants",
  "Classic Mini Skirt",
  "Wind Track Jumper",
  "Mountain Puffer",
  "Logo Ball Cap",
  "Daily Backpack",
  "Western Belt",
  "Ringer Half Tee",
  "Terry Sweatshirt",
  "Pocket Shirt",
  "Carpenter Denim",
  "Pleated Skirt",
  "Nylon Anorak",
  "Cloud Down Jumper",
  "College Cap",
  "String Backpack",
  "Leather Belt",
  "Rugby Stripe Tee",
  "Vintage Hoodie",
  "Oxford Shirt",
  "Bootcut Denim",
  "Cargo Mini Skirt",
  "Rain Parka",
  "Short Puffer",
  "Washed Ball Cap",
  "City Backpack",
  "Slim Belt",
];

function getWeekLabel(weekNo: number) {
  return `W${String(weekNo).padStart(2, "0")}`;
}

function paginate<T>(rows: T[], page: number): { rows: T[]; meta: Pagination } {
  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const currentPage = Math.min(Math.max(1, Number(page) || 1), totalPages);
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

function seasonalWeight(weekNo: number, peakWeekNo: number, width = 9) {
  const distance = Math.abs(weekNo - peakWeekNo);
  const mainCurve = Math.max(0.1, 1 - distance / width);
  const baseline = 0.28 + Math.sin((weekNo / MAX_WEEK_NO) * Math.PI * 2) * 0.08;
  return baseline + mainCurve;
}

function makeWeeklyShare(profile: (typeof CATEGORY_PROFILES)[number]) {
  const rawWeights = Array.from({ length: MAX_WEEK_NO }, (_, index) => {
    const weekNo = index + 1;
    const eligible = profile.excluded.includes(weekNo) ? 0 : seasonalWeight(weekNo, profile.peak);
    return eligible;
  });
  const totalWeight = rawWeights.reduce((total, value) => total + value, 0);
  let peakWeekNo = 1;
  let peakQty = 0;

  const weeklyShare: WeeklyShareCell[] = rawWeights.map((weight, index) => {
    const weekNo = index + 1;
    const eligibleQty = Math.round((profile.base * weight) / totalWeight);
    const excludedQty = profile.excluded.includes(weekNo)
      ? Math.round(profile.base * (0.008 + (weekNo % 3) * 0.004))
      : 0;

    if (eligibleQty > peakQty) {
      peakQty = eligibleQty;
      peakWeekNo = weekNo;
    }

    return {
      weekNo,
      label: getWeekLabel(weekNo),
      eligibleQty,
      excludedQty,
      ratioPct: totalWeight > 0 ? (weight / totalWeight) * 100 : 0,
    };
  });

  return {
    weeklyShare,
    peakWeekNo,
  };
}

function buildBasisProfiles(): BasisProfile[] {
  return CATEGORY_PROFILES.map((profile) => {
    const { weeklyShare, peakWeekNo } = makeWeeklyShare(profile);
    const totalEligibleQty = weeklyShare.reduce((total, cell) => total + cell.eligibleQty, 0);
    const excludedQty = weeklyShare.reduce((total, cell) => total + cell.excludedQty, 0);

    return {
      scope: "소분류",
      label: profile.small,
      totalEligibleQty,
      totalRawQty: totalEligibleQty + excludedQty,
      excludedQty,
      excludedWeeks: weeklyShare.filter((cell) => cell.excludedQty > 0).length,
      peakWeekNo,
      peakWeekLabel: getWeekLabel(peakWeekNo),
      weeklyShare,
    };
  }).sort((a, b) => b.totalEligibleQty - a.totalEligibleQty);
}

function makeStyleCode(index: number) {
  const prefix = STYLE_PREFIXES[index % STYLE_PREFIXES.length];
  const letters = String.fromCharCode(65 + (index % 26)) + String.fromCharCode(65 + ((index + 7) % 26));
  return `${prefix}${letters}${SALES_YEAR.toString().slice(-2)}${String(index + 101).padStart(3, "0")}A`;
}

function buildItemRows(basisProfiles: BasisProfile[]) {
  const rows: ItemForecastRow[] = [];

  for (let index = 0; index < STYLE_NAMES.length; index += 1) {
    const sourceProfile = CATEGORY_PROFILES[index % CATEGORY_PROFILES.length];
    const basisProfile = basisProfiles.find((profile) => profile.label === sourceProfile.small) ?? basisProfiles[0];
    const launchFactor = 0.56 + ((index % 7) * 0.07);
    const averageUnitPrice = 25900 + (index % 8) * 7000;
    const weeklyForecast: ItemForecastWeek[] = basisProfile.weeklyShare.map((cell) => {
      const actualQty =
        cell.weekNo <= CURRENT_WEEK_NO
          ? Math.round(cell.eligibleQty * launchFactor * (0.9 + ((cell.weekNo + index) % 5) * 0.04))
          : 0;
      const forecastQty = cell.weekNo > CURRENT_WEEK_NO ? Math.round(cell.eligibleQty * launchFactor) : 0;
      const totalQty = actualQty + forecastQty;

      return {
        weekNo: cell.weekNo,
        label: cell.label,
        basisRatioPct: cell.ratioPct,
        basisEligibleQty: cell.eligibleQty,
        excludedQty: cell.excludedQty,
        actualQty,
        forecastQty,
        totalQty,
        totalRevenue: Math.round(totalQty * averageUnitPrice),
        isFuture: cell.weekNo > CURRENT_WEEK_NO,
      };
    });
    const cumulativeActualQty = weeklyForecast
      .filter((cell) => !cell.isFuture)
      .reduce((total, cell) => total + cell.actualQty, 0);
    const remainingForecastQty = weeklyForecast
      .filter((cell) => cell.isFuture)
      .reduce((total, cell) => total + cell.forecastQty, 0);
    const projectedEndingQty = cumulativeActualQty + remainingForecastQty;
    const peakWeekNo = weeklyForecast.reduce(
      (best, cell) => (cell.totalQty > best.totalQty ? { weekNo: cell.weekNo, totalQty: cell.totalQty } : best),
      { weekNo: 1, totalQty: 0 },
    ).weekNo;

    rows.push({
      styleCode: makeStyleCode(index),
      brandName: "WH",
      salesYear: SALES_YEAR,
      season: String((index % 4) + 1),
      styleName: STYLE_NAMES[index],
      itemName: `${STYLE_NAMES[index]} / ${makeStyleCode(index)}`,
      categoryMajor: sourceProfile.major,
      categoryMiddle: sourceProfile.middle,
      categorySmall: sourceProfile.small,
      latestSaleWeekCode: `${SALES_YEAR}${String(CURRENT_WEEK_NO).padStart(2, "0")}`,
      currentWeekNo: CURRENT_WEEK_NO,
      currentWeekLabel: getWeekLabel(CURRENT_WEEK_NO),
      basisScope: basisProfile.scope,
      basisLabel: basisProfile.label,
      basisTotalEligibleQty: basisProfile.totalEligibleQty,
      basisExcludedQty: basisProfile.excludedQty,
      cumulativeActualQty,
      cumulativeActualRevenue: Math.round(cumulativeActualQty * averageUnitPrice),
      projectedEndingQty,
      projectedEndingRevenue: Math.round(projectedEndingQty * averageUnitPrice),
      remainingForecastQty,
      progressPct: projectedEndingQty > 0 ? (cumulativeActualQty / projectedEndingQty) * 100 : 0,
      peakWeekNo,
      peakWeekLabel: getWeekLabel(peakWeekNo),
      weeklyForecast,
    });
  }

  return rows.sort((a, b) => b.projectedEndingQty - a.projectedEndingQty);
}

function buildDashboardDataset() {
  const basisProfiles = buildBasisProfiles();
  const itemRows = buildItemRows(basisProfiles);
  const summary: DashboardSummary = {
    totalItems: itemRows.length,
    latestSalesYear: SALES_YEAR,
    totalActualQty: itemRows.reduce((total, row) => total + row.cumulativeActualQty, 0),
    totalProjectedQty: itemRows.reduce((total, row) => total + row.projectedEndingQty, 0),
    totalProjectedRevenue: itemRows.reduce((total, row) => total + row.projectedEndingRevenue, 0),
    totalRemainingQty: itemRows.reduce((total, row) => total + row.remainingForecastQty, 0),
  };

  return {
    basisProfiles,
    itemRows,
    summary,
  };
}

export async function getDashboardPageData(query?: string, page?: number | string): Promise<DashboardPageData> {
  const dataset = buildDashboardDataset();
  const normalizedQuery = query?.trim().toLowerCase() ?? "";
  const filteredRows = normalizedQuery
    ? dataset.itemRows.filter((row) =>
        [
          row.styleCode,
          row.styleName,
          row.itemName,
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
    : dataset.itemRows;
  const paginated = paginate(filteredRows, Number(page ?? 1));

  const dashboard: PlanningDashboard = {
    query: query?.trim() ?? "",
    summary: {
      totalItems: filteredRows.length,
      latestSalesYear: dataset.summary.latestSalesYear,
      totalActualQty: filteredRows.reduce((total, row) => total + row.cumulativeActualQty, 0),
      totalProjectedQty: filteredRows.reduce((total, row) => total + row.projectedEndingQty, 0),
      totalProjectedRevenue: filteredRows.reduce((total, row) => total + row.projectedEndingRevenue, 0),
      totalRemainingQty: filteredRows.reduce((total, row) => total + row.remainingForecastQty, 0),
    },
    basisProfiles: dataset.basisProfiles,
    itemRows: paginated.rows,
    pagination: paginated.meta,
  };

  return {
    ok: true,
    dashboard,
    query: query?.trim() ?? "",
    page: paginated.meta.currentPage,
  };
}
