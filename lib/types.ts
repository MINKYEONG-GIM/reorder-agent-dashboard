export type Pagination = {
  currentPage: number;
  pageSize: number;
  totalRows: number;
  totalPages: number;
};

export type WeeklyForecastCell = {
  weekNo: number;
  label: string;
  basisYear: number;
  basisQty: number;
  excludedQty: number;
  actualQty: number;
  forecastQty: number;
  totalQty: number;
  actualRevenue: number;
  forecastRevenue: number;
  totalRevenue: number;
  ratioPct: number;
  isFuture: boolean;
};

export type ItemForecastRow = {
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
  currentWeekLabel: string;
  basisYear: number;
  basisScope: string;
  basisLabel: string;
  basisTotalEligibleQty: number;
  basisTotalRawQty: number;
  basisExcludedQty: number;
  basisExcludedWeeks: number;
  cumulativeActualQty: number;
  cumulativeActualRevenue: number;
  projectedEndingQty: number;
  projectedEndingRevenue: number;
  remainingForecastQty: number;
  remainingForecastRevenue: number;
  progressPct: number;
  peakWeekNo: number;
  peakWeekLabel: string;
  peakMonthLabel: string;
  weeklyForecast: WeeklyForecastCell[];
};

export type DashboardSummary = {
  totalItems: number;
  latestSalesYear: number;
  totalActualQty: number;
  totalProjectedQty: number;
  totalProjectedRevenue: number;
};

export type PlanningDashboard = {
  query: string;
  summary: DashboardSummary;
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
