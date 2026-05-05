import { dashboardData } from "../data/dashboard-data.js";
import {
  CURRENT_WEEK,
  CUMULATIVE_WEEKS,
  HEAT_WEEKS,
  MONTH_LABELS,
  REORDER_PLAN_WEEKS
} from "../lib/constants.js";
import {
  formatCompactBillion,
  formatSignedPercent,
  formatUnits,
  formatWeekLabel,
  formatWeekText,
  riskClass
} from "../lib/formatters.js";
import { state, setSearchQuery, setSelectedStyleCode } from "../lib/state.js";

function getSelectedStyle() {
  return dashboardData.styles.find((item) => item.styleCode === state.selectedStyleCode) || null;
}

function getFilteredStyles() {
  const query = state.searchQuery.trim().toLowerCase();
  if (!query) return dashboardData.styles;

  return dashboardData.styles.filter((item) => {
    return item.styleCode.toLowerCase().includes(query) || item.itemName.toLowerCase().includes(query);
  });
}

function parseWeekNumber(value) {
  const match = String(value || "").match(/\d+/);
  return match ? Number(match[0]) : null;
}

function sumRange(values, startIndex, endIndex) {
  return values.slice(startIndex, endIndex).reduce((total, value) => total + value, 0);
}

function normalizeRisk(risk) {
  const text = String(risk || "");
  if (text.includes("낮")) return "낮음";
  if (text.includes("중")) return "중간";
  if (text.includes("높")) return "높음";
  return text || "중간";
}

function normalizeLifecycle(value) {
  const text = String(value || "");
  if (text.includes("성")) return "성장";
  if (text.includes("확")) return "확장";
  if (text.includes("안")) return "안정";
  if (text.includes("조")) return "조정";
  if (text.includes("도")) return "도입";
  return text || "-";
}

function cleanText(value) {
  return String(value || "").replace(/\?/g, "").trim();
}

function getCurrentWeekUnits(item) {
  return item.weeklySalesUnits[CURRENT_WEEK - 1] || 0;
}

function getNextWeekUnits(item) {
  return item.weeklySalesUnits[CURRENT_WEEK] || 0;
}

function getNextDemandUnits(item, weeks) {
  return sumRange(item.weeklySalesUnits, CURRENT_WEEK - 1, Math.min(item.weeklySalesUnits.length, CURRENT_WEEK - 1 + weeks));
}

function getRemainingForecastUnits(item) {
  return sumRange(item.weeklySalesUnits, CURRENT_WEEK - 1, item.weeklySalesUnits.length);
}

function getCurrentInventoryUnits(item) {
  const stockOutWeek = parseWeekNumber(item.stockOutWeek) || CURRENT_WEEK + 4;
  const coverUntil = Math.min(item.weeklySalesUnits.length, stockOutWeek);
  const baseCover = sumRange(item.weeklySalesUnits, CURRENT_WEEK - 1, coverUntil);
  const cushion = Math.round((item.weeklySalesUnits[Math.max(CURRENT_WEEK - 1, stockOutWeek - 1)] || 0) * 0.35);
  return baseCover + cushion;
}

function getRecommendedOrderUnits(item) {
  const remainingForecastUnits = getRemainingForecastUnits(item);
  const currentInventoryUnits = getCurrentInventoryUnits(item);
  const safetyStockUnits = Math.round(getNextDemandUnits(item, 4) * 0.3);
  return Math.max(0, remainingForecastUnits + safetyStockUnits - currentInventoryUnits);
}

function buildWeeklyPlan(item) {
  const plans = [];
  let inventory = getCurrentInventoryUnits(item);
  let cumulativeDemand = 0;

  for (let offset = 0; offset < REORDER_PLAN_WEEKS; offset += 1) {
    const weekNumber = CURRENT_WEEK + offset;
    if (weekNumber > item.weeklySalesUnits.length) break;

    const demandUnits = item.weeklySalesUnits[weekNumber - 1] || 0;
    cumulativeDemand += demandUnits;

    const projectedEndingInventory = Math.max(0, inventory - demandUnits);
    const nextTwoWeeksDemand = sumRange(
      item.weeklySalesUnits,
      Math.min(item.weeklySalesUnits.length, weekNumber),
      Math.min(item.weeklySalesUnits.length, weekNumber + 2)
    );
    const targetReadyInventory = Math.round(nextTwoWeeksDemand * 1.1);
    const suggestedOrderUnits = Math.max(0, targetReadyInventory - projectedEndingInventory);
    const readyInventoryAfterOrder = projectedEndingInventory + suggestedOrderUnits;

    plans.push({
      weekNumber,
      demandUnits,
      cumulativeDemand,
      projectedEndingInventory,
      suggestedOrderUnits,
      readyInventoryAfterOrder
    });

    inventory = readyInventoryAfterOrder;
  }

  return plans;
}

function getSummaryMetrics(item) {
  const currentInventoryUnits = getCurrentInventoryUnits(item);
  const next4WeeksDemandUnits = getNextDemandUnits(item, 4);
  const remainingForecastUnits = getRemainingForecastUnits(item);
  const recommendedOrderUnits = getRecommendedOrderUnits(item);
  const currentWeekUnits = getCurrentWeekUnits(item);

  return {
    currentInventoryUnits,
    next4WeeksDemandUnits,
    remainingForecastUnits,
    recommendedOrderUnits,
    currentWeekUnits
  };
}

function heatColor(value) {
  const alpha = 0.14 + (value / 100) * 0.86;
  return `rgba(10, 132, 255, ${alpha.toFixed(2)})`;
}

export function createDashboardRenderer(elements) {
  const {
    styleSearchInput,
    styleCountLabel,
    styleTableBody,
    detailPanel,
    detailTitle,
    detailSubtitle,
    detailRiskBadge,
    reorderFocusGrid,
    weeklyPlanBoard,
    weekCompareGrid,
    weeklyUnitsChart,
    explanationCards,
    monthlyChart,
    cumulativeChart,
    priceTrendGrid,
    heatmapWrap,
    plcCompareGrid,
    lifecycleGrid,
    reasonCards,
    actionList
  } = elements;

  function renderStyleTable() {
    const visibleStyles = getFilteredStyles();
    styleCountLabel.textContent = `${visibleStyles.length}개 스타일`;

    if (state.selectedStyleCode && !visibleStyles.some((item) => item.styleCode === state.selectedStyleCode)) {
      setSelectedStyleCode(null);
    }

    if (!visibleStyles.length) {
      styleTableBody.innerHTML = `
        <tr>
          <td colspan="9">
            <div class="empty-state-text">검색 결과가 없습니다. 다른 스타일코드나 상품명으로 다시 검색해 보세요.</div>
          </td>
        </tr>
      `;
      return;
    }

    styleTableBody.innerHTML = visibleStyles.map((item) => {
      const metrics = getSummaryMetrics(item);
      const risk = normalizeRisk(item.risk);

      return `
        <tr class="style-row ${item.styleCode === state.selectedStyleCode ? "active" : ""}" data-style-code="${item.styleCode}">
          <td>${item.styleCode}</td>
          <td class="style-name">${cleanText(item.itemName)}</td>
          <td>${formatUnits(metrics.currentInventoryUnits)}</td>
          <td>${formatUnits(metrics.currentWeekUnits)}</td>
          <td>${formatUnits(metrics.next4WeeksDemandUnits)}</td>
          <td>${formatUnits(metrics.remainingForecastUnits)}</td>
          <td class="emphasis-cell">${formatUnits(metrics.recommendedOrderUnits)}</td>
          <td>${formatWeekText(item.stockOutWeek)}</td>
          <td>${formatWeekLabel(item.peakWeek)}</td>
        </tr>
      `;
    }).join("");

    styleTableBody.querySelectorAll(".style-row").forEach((row) => {
      row.addEventListener("click", () => {
        setSelectedStyleCode(row.dataset.styleCode);
        renderDashboard();
        detailPanel.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    });
  }

  function renderDetailHeader(item) {
    const metrics = getSummaryMetrics(item);
    const risk = normalizeRisk(item.risk);

    detailTitle.textContent = `${item.styleCode} · ${cleanText(item.itemName)}`;
    detailSubtitle.textContent = `현재 재고 ${formatUnits(metrics.currentInventoryUnits)} / 잔여 시즌 예상 판매 ${formatUnits(metrics.remainingForecastUnits)} / 추가 발주 필요 ${formatUnits(metrics.recommendedOrderUnits)}`;
    detailRiskBadge.innerHTML = `<span class="risk-pill ${riskClass(risk)}">${risk}</span>`;
  }

  function renderReorderFocus(item) {
    const metrics = getSummaryMetrics(item);
    const weeklyPlan = buildWeeklyPlan(item);
    const firstOrderWeek = weeklyPlan.find((plan) => plan.suggestedOrderUnits > 0);

    const cards = [
      {
        label: "현재 재고",
        value: formatUnits(metrics.currentInventoryUnits),
        sub: `${formatWeekText(item.stockOutWeek)}까지 커버 예상`
      },
      {
        label: "잔여 시즌 예상 판매",
        value: formatUnits(metrics.remainingForecastUnits),
        sub: "현재 주차부터 연말까지 예상 판매량"
      },
      {
        label: "추가 발주 필요",
        value: formatUnits(metrics.recommendedOrderUnits),
        sub: firstOrderWeek ? `${formatWeekLabel(firstOrderWeek.weekNumber)}부터 보충 필요` : "현재 재고만으로 커버 가능"
      },
      {
        label: "이번 주 예상 판매",
        value: formatUnits(metrics.currentWeekUnits),
        sub: "가장 먼저 빠질 것으로 보는 주간 판매량"
      },
      {
        label: "다음 4주 예상 판매",
        value: formatUnits(metrics.next4WeeksDemandUnits),
        sub: "단기 발주 판단에 가장 중요한 구간"
      },
      {
        label: "피크 주차",
        value: formatWeekLabel(item.peakWeek),
        sub: "연중 가장 판매량이 크게 잡히는 주차"
      }
    ];

    reorderFocusGrid.innerHTML = cards.map((card, index) => `
      <article class="focus-card ${index === 2 ? "focus-card-primary" : ""}">
        <span class="label">${card.label}</span>
        <span class="value">${card.value}</span>
        <span class="sub">${card.sub}</span>
      </article>
    `).join("");
  }

  function renderWeeklyPlan(item) {
    const weeklyPlan = buildWeeklyPlan(item);

    const hero = weeklyPlan.slice(0, 3).map((plan) => `
      <article class="plan-mini-card">
        <span class="label">${formatWeekLabel(plan.weekNumber)}</span>
        <strong>${formatUnits(plan.demandUnits)} 판매 예상</strong>
        <span class="sub">권장 발주 ${formatUnits(plan.suggestedOrderUnits)} / 판매 후 재고 ${formatUnits(plan.projectedEndingInventory)}</span>
      </article>
    `).join("");

    const rows = weeklyPlan.map((plan) => `
      <tr>
        <td>${formatWeekLabel(plan.weekNumber)}</td>
        <td>${formatUnits(plan.demandUnits)}</td>
        <td>${formatUnits(plan.cumulativeDemand)}</td>
        <td>${formatUnits(plan.projectedEndingInventory)}</td>
        <td class="plan-order-cell">${formatUnits(plan.suggestedOrderUnits)}</td>
        <td>${formatUnits(plan.readyInventoryAfterOrder)}</td>
      </tr>
    `).join("");

    weeklyPlanBoard.innerHTML = `
      <div class="plan-hero-row">${hero}</div>
      <div class="table-wrap plan-table-wrap">
        <table class="plan-table">
          <thead>
            <tr>
              <th>주차</th>
              <th>예상 판매량</th>
              <th>누적 판매량</th>
              <th>판매 후 재고</th>
              <th>권장 추가 발주</th>
              <th>발주 후 가용 재고</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `;
  }

  function renderWeekComparison(item) {
    const currentWeekUnits = getCurrentWeekUnits(item);
    const nextWeekUnits = getNextWeekUnits(item);
    const deltaPct = currentWeekUnits === 0 ? 0 : ((nextWeekUnits - currentWeekUnits) / currentWeekUnits) * 100;
    const directionClass = deltaPct >= 0 ? "delta-up" : "delta-down";
    const directionText = deltaPct >= 0 ? "증가" : "감소";

    weekCompareGrid.innerHTML = `
      <article class="mini-card">
        <h4>${item.styleCode}</h4>
        <p class="soft-copy">${cleanText(item.itemName)}</p>
        <p class="soft-copy">이번 주 ${formatUnits(currentWeekUnits)} / 다음 주 ${formatUnits(nextWeekUnits)}</p>
        <div class="delta-pill ${directionClass}">${directionText} ${formatSignedPercent(deltaPct)}</div>
      </article>
    `;
  }

  function renderWeeklyUnits(item) {
    const width = 1040;
    const height = 300;
    const margin = { top: 20, right: 18, bottom: 52, left: 18 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;
    const maxUnits = Math.max(...item.weeklySalesUnits);
    const barWidth = innerWidth / item.weeklySalesUnits.length;
    const labelWeeks = new Set([1, 5, 9, 13, 17, 21, 25, 29, 33, 37, 41, 45, 49, item.peakWeek, CURRENT_WEEK]);

    const bars = item.weeklySalesUnits.map((value, index) => {
      const weekNo = index + 1;
      const ratio = item.weeklyRatioPct[index];
      const x = margin.left + index * barWidth;
      const barHeight = Math.max(6, (value / maxUnits) * innerHeight);
      const y = margin.top + innerHeight - barHeight;
      const label = labelWeeks.has(weekNo)
        ? `<text x="${x + (barWidth / 2)}" y="${height - 14}" text-anchor="middle" class="axis-label">${formatWeekLabel(weekNo)}</text>`
        : "";
      const currentWeekClass = weekNo === CURRENT_WEEK ? "week-bar current-week-bar" : "week-bar";

      return `
        <g class="week-bar-group">
          <rect
            x="${x + 1}"
            y="${y}"
            width="${Math.max(6, barWidth - 2)}"
            height="${barHeight}"
            rx="7"
            class="${currentWeekClass}"
          >
            <title>${formatWeekLabel(weekNo)} / 예상 판매량 ${formatUnits(value)} / PLC 비중 ${ratio.toFixed(3)}%</title>
          </rect>
          ${label}
        </g>
      `;
    }).join("");

    const peakX = margin.left + (item.peakWeek - 0.5) * barWidth;
    const currentX = margin.left + (CURRENT_WEEK - 0.5) * barWidth;

    weeklyUnitsChart.innerHTML = `
      <div class="weekly-chart-frame">
        <svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" class="weekly-chart-svg" aria-label="주차별 판매량 차트">
          <defs>
            <linearGradient id="weeklyGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="#7dd3fc"></stop>
              <stop offset="100%" stop-color="#0a84ff"></stop>
            </linearGradient>
            <linearGradient id="currentWeekGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="#34c759"></stop>
              <stop offset="100%" stop-color="#16a34a"></stop>
            </linearGradient>
          </defs>
          <line x1="${margin.left}" y1="${margin.top + innerHeight}" x2="${width - margin.right}" y2="${margin.top + innerHeight}" stroke="#cbd5e1"></line>
          <line x1="${peakX}" y1="${margin.top}" x2="${peakX}" y2="${margin.top + innerHeight}" class="peak-guide"></line>
          <line x1="${currentX}" y1="${margin.top}" x2="${currentX}" y2="${margin.top + innerHeight}" class="current-guide"></line>
          ${bars}
        </svg>
        <div class="weekly-chart-note">막대에 마우스를 올리면 주차별 예상 판매량과 PLC 비중을 바로 볼 수 있습니다. 초록 막대는 현재 주차입니다.</div>
      </div>
    `;
  }

  function renderExplanation(item) {
    const explanationItems = [
      ["스타일 매칭", cleanText(item.explanation.basis)],
      ["총량 기준", cleanText(item.explanation.total)],
      ["주차 배분 방식", cleanText(item.explanation.distribution)],
      ["피크 주차 판단", cleanText(item.explanation.peak)],
      ["월별 합산 결과", cleanText(item.explanation.topMonth)],
      ["현재 시점 해석", cleanText(item.explanation.current)]
    ];

    explanationCards.innerHTML = explanationItems.map(([title, body]) => `
      <article class="explanation-card">
        <h4>${title}</h4>
        <p>${formatWeekText(body)}</p>
      </article>
    `).join("");
  }

  function renderMonthlyChart(item) {
    const maxRevenue = Math.max(...item.monthlyRevenue);
    monthlyChart.innerHTML = item.monthlyRevenue.map((value, index) => {
      const height = Math.max(24, (value / maxRevenue) * 170);
      return `
        <div class="bar-col">
          <div class="bar-value">${value.toFixed(1)}억</div>
          <div class="bar-stack">
            <div class="bar-fill" style="height:${height}px"></div>
          </div>
          <div class="bar-label">${MONTH_LABELS[index]}</div>
        </div>
      `;
    }).join("");
  }

  function renderCumulativeChart(item) {
    const width = 720;
    const height = 240;
    const margin = { top: 20, right: 20, bottom: 38, left: 36 };
    const maxValue = Math.max(...item.cumulativeRevenue);
    const usableWidth = width - margin.left - margin.right;
    const usableHeight = height - margin.top - margin.bottom;

    const points = item.cumulativeRevenue.map((total, index) => {
      const x = margin.left + (index / (item.cumulativeRevenue.length - 1)) * usableWidth;
      const y = margin.top + usableHeight - (total / maxValue) * usableHeight;
      return { x, y, week: CUMULATIVE_WEEKS[index], total };
    });

    const polyline = points.map((point) => `${point.x},${point.y}`).join(" ");
    const labels = points.map((point) => `
      <g>
        <circle cx="${point.x}" cy="${point.y}" r="3.8" fill="#0a84ff">
          <title>${formatWeekLabel(point.week)} / 누적 매출 ${point.total.toFixed(1)}억</title>
        </circle>
        <text x="${point.x}" y="${height - 10}" text-anchor="middle" class="axis-label">${formatWeekLabel(point.week)}</text>
      </g>
    `).join("");

    cumulativeChart.innerHTML = `
      <svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="none">
        <line x1="${margin.left}" y1="${height - margin.bottom}" x2="${width - margin.right}" y2="${height - margin.bottom}" stroke="#cbd5e1"></line>
        <polyline fill="none" stroke="#0a84ff" stroke-width="4" points="${polyline}"></polyline>
        ${labels}
      </svg>
    `;
  }

  function renderPriceTrend(item) {
    const maxValue = Math.max(...item.avgPriceSeries);
    priceTrendGrid.innerHTML = `
      <article class="trend-card">
        <h4>${item.styleCode}</h4>
        <p class="soft-copy">${cleanText(item.itemName)}</p>
        <p class="soft-copy">최근 평균 판매가 ${item.avgPriceSeries[item.avgPriceSeries.length - 1].toFixed(2)}만원</p>
        <div class="sparkline">
          ${item.avgPriceSeries.map((value) => `
            <div class="spark-bar" style="height:${Math.max(18, (value / maxValue) * 82)}px"></div>
          `).join("")}
        </div>
      </article>
    `;
  }

  function renderHeatmap(item) {
    const headCells = [`<div class="heat-head">주차</div>`]
      .concat(HEAT_WEEKS.map((week) => `<div class="heat-head">${formatWeekLabel(week)}</div>`))
      .join("");

    const valueCells = `<div class="heat-style">${item.styleCode}</div>` + item.heatmapValues
      .map((value, index) => `<div class="heat-cell" title="${item.styleCode} ${formatWeekLabel(HEAT_WEEKS[index])} ${value}" style="background:${heatColor(value)}"></div>`)
      .join("");

    heatmapWrap.innerHTML = `<div class="heatmap">${headCells}${valueCells}</div>`;
  }

  function renderPlcCompare(item) {
    plcCompareGrid.innerHTML = `
      <article class="compare-card">
        <div class="compare-row">
          <div>
            <h4>${item.styleCode}</h4>
            <p>${cleanText(item.plcGroup)}</p>
          </div>
          <div class="accent-number">${item.plcSimilarity}점</div>
        </div>
        <p class="soft-copy">PLC 피크 차이 ${item.plcPeakGapWeeks > 0 ? "+" : ""}${item.plcPeakGapWeeks}주 / 속도 지수 ${item.velocityIndex}</p>
        <div class="metric-rail"><div class="metric-fill" style="width:${item.plcSimilarity}%"></div></div>
      </article>
    `;
  }

  function renderLifecycle(item) {
    const risk = normalizeRisk(item.risk);
    lifecycleGrid.innerHTML = `
      <article class="life-card">
        <div class="compare-row">
          <div>
            <h4>${item.styleCode}</h4>
            <p>${cleanText(item.itemName)}</p>
          </div>
          <div class="life-pill ${riskClass(risk)}">${normalizeLifecycle(item.lifecycle)}</div>
        </div>
        <p class="soft-copy">재고 커버 종료 ${formatWeekText(item.stockOutWeek)} / 성장률 ${formatSignedPercent(item.growthRate)} / 위험도 ${risk}</p>
      </article>
    `;
  }

  function renderReasons(item) {
    reasonCards.innerHTML = `
      <article class="reason-card">
        <h4>${formatWeekText(cleanText(item.reasonTitle))}</h4>
        <p>1. ${formatWeekText(cleanText(item.reasons[0]))}</p>
        <p>2. ${formatWeekText(cleanText(item.reasons[1]))}</p>
        <p>3. ${formatWeekText(cleanText(item.reasons[2]))}</p>
      </article>
    `;
  }

  function renderActions(item) {
    const firstPlan = buildWeeklyPlan(item).find((plan) => plan.suggestedOrderUnits > 0);
    const firstPlanText = firstPlan
      ? `${formatWeekLabel(firstPlan.weekNumber)}에 ${formatUnits(firstPlan.suggestedOrderUnits)} 발주 검토`
      : "현재 재고만으로 단기 커버 가능";

    actionList.innerHTML = `
      <article class="action-item">
        <h4>${item.styleCode}</h4>
        <p>${firstPlanText}. ${formatWeekText(cleanText(item.action))}</p>
      </article>
    `;
  }

  function renderDashboard() {
    renderStyleTable();

    const item = getSelectedStyle();
    if (!item) {
      detailPanel.classList.add("hidden");
      return;
    }

    detailPanel.classList.remove("hidden");
    renderDetailHeader(item);
    renderReorderFocus(item);
    renderWeeklyPlan(item);
    renderWeekComparison(item);
    renderWeeklyUnits(item);
    renderExplanation(item);
    renderMonthlyChart(item);
    renderCumulativeChart(item);
    renderPriceTrend(item);
    renderHeatmap(item);
    renderPlcCompare(item);
    renderLifecycle(item);
    renderReasons(item);
    renderActions(item);
  }

  styleSearchInput.addEventListener("input", (event) => {
    setSearchQuery(event.target.value || "");
    renderDashboard();
  });

  return { renderDashboard };
}
