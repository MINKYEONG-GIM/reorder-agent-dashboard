import { createDashboardRenderer } from "./ui/dashboard.js";

const elements = {
  styleSearchInput: document.getElementById("styleSearchInput"),
  styleCountLabel: document.getElementById("styleCountLabel"),
  styleTableBody: document.getElementById("styleTableBody"),
  detailPanel: document.getElementById("detailPanel"),
  detailTitle: document.getElementById("detailTitle"),
  detailSubtitle: document.getElementById("detailSubtitle"),
  detailRiskBadge: document.getElementById("detailRiskBadge"),
  reorderFocusGrid: document.getElementById("reorderFocusGrid"),
  weeklyPlanBoard: document.getElementById("weeklyPlanBoard"),
  weekCompareGrid: document.getElementById("weekCompareGrid"),
  weeklyUnitsChart: document.getElementById("weeklyUnitsChart"),
  explanationCards: document.getElementById("explanationCards"),
  monthlyChart: document.getElementById("monthlyChart"),
  cumulativeChart: document.getElementById("cumulativeChart"),
  priceTrendGrid: document.getElementById("priceTrendGrid"),
  heatmapWrap: document.getElementById("heatmapWrap"),
  plcCompareGrid: document.getElementById("plcCompareGrid"),
  lifecycleGrid: document.getElementById("lifecycleGrid"),
  reasonCards: document.getElementById("reasonCards"),
  actionList: document.getElementById("actionList")
};

const dashboard = createDashboardRenderer(elements);
dashboard.renderDashboard();
