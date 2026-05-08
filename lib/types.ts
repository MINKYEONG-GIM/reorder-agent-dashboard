export type Pagination = {
  currentPage: number;
  pageSize: number;
  totalRows: number;
  totalPages: number;
};

export type WeeklyShareCell = {
  weekNo: number;
  label: string;
  eligibleQty: number;
  excludedQty: number;
  ratioPct: number;
};

export type BasisProfile = {
  scope: string;
  label: string;
  totalEligibleQty: number;
  totalRawQty: number;
  excludedQty: number;
  excludedWeeks: number;
  peakWeekNo: number;
  peakWeekLabel: string;
  weeklyShare: WeeklyShareCell[];
};

export type ItemForecastWeek = {
  weekNo: number;
  label: string;
  basisRatioPct: number;
  basisEligibleQty: number;
  excludedQty: number;
  actualQty: number;
  forecastQty: number;
  totalQty: number;
  totalRevenue: number;
  isFuture: boolean;
};

export type ItemForecastRow = {
  styleCode: string;
  brandName: string;
  salesYear: number;
  season: string;
  styleName: string;
  itemName: string;
  categoryMajor: string;
  categoryMiddle: string;
  categorySmall: string;
  latestSaleWeekCode: string;
  currentWeekNo: number;
  currentWeekLabel: string;
  basisScope: string;
  basisLabel: string;
  basisTotalEligibleQty: number;
  basisExcludedQty: number;
  cumulativeActualQty: number;
  cumulativeActualRevenue: number;
  projectedEndingQty: number;
  projectedEndingRevenue: number;
  remainingForecastQty: number;
  progressPct: number;
  peakWeekNo: number;
  peakWeekLabel: string;
  weeklyForecast: ItemForecastWeek[];
};

export type DashboardSummary = {
  totalItems: number;
  latestSalesYear: number;
  totalActualQty: number;
  totalProjectedQty: number;
  totalProjectedRevenue: number;
  totalRemainingQty: number;
};

export type PlanningDashboard = {
  query: string;
  summary: DashboardSummary;
  basisProfiles: BasisProfile[];
  itemRows: ItemForecastRow[];
  pagination: Pagination;
};

export type DashboardPageData =
  | {
      ok: true;
      dashboard: PlanningDashboard;
      query: string;
      page: number;
    }
  | {
      ok: false;
      query: string;
      page: number;
      message: string;
    };
