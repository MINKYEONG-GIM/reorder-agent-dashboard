import { dashboardData } from "../data/dashboard-data.js";
import { CUMULATIVE_WEEKS, HEAT_WEEKS, MONTH_LABELS } from "../lib/constants.js";
import {
  formatCompactBillion,
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
    weekCompareGrid,
    weeklyUnitsChart,
    explanationCards,
    selectedSummary,
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
          <td colspan="10">
            <div class="empty-state-text">검색 결과가 없습니다. 다른 스타일코드나 상품명으로 다시 검색해 보세요.</div>
          </td>
        </tr>
      `;
      return;
    }

    styleTableBody.innerHTML = visibleStyles.map((item) => `
      <tr class="style-row ${item.styleCode === state.selectedStyleCode ? "active" : ""}" data-style-code="${item.styleCode}">
        <td>${item.styleCode}</td>
        <td class="style-name">${item.itemName}</td>
        <td>${formatWeekLabel(item.peakWeek)}</td>
        <td>${formatCompactBillion(item.projectedRevenue)}</td>
        <td>${formatUnits(item.projectedUnits)}</td>
        <td>${item.growthRate > 0 ? "+" : ""}${item.growthRate.toFixed(1)}%</td>
        <td><span class="risk-pill ${riskClass(item.risk)}">${item.risk}</span></td>
        <td>${formatWeekText(item.stockOutWeek)}</td>
        <td>${item.lifecycle}</td>
        <td>${item.plcGroup}</td>
      </tr>
    `).join("");

    styleTableBody.querySelectorAll(".style-row").forEach((row) => {
      row.addEventListener("click", () => {
        setSelectedStyleCode(row.dataset.styleCode);
        renderDashboard();
        detailPanel.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    });
  }

  function renderDetailHeader(item) {
    detailTitle.textContent = item.styleCode;
    detailSubtitle.textContent = `${item.itemName} / 피크 ${formatWeekLabel(item.peakWeek)} / 예상 연매출 ${formatCompactBillion(item.projectedRevenue)}`;
    detailRiskBadge.innerHTML = `<span class="risk-pill ${riskClass(item.risk)}">${item.risk}</span>`;
  }

  function renderSelectedSummary(item) {
    const summaryItems = [
      ["피크 주차", formatWeekLabel(item.peakWeek), "가장 큰 매출 봉우리 예상 시점"],
      ["예상 연매출액", formatCompactBillion(item.projectedRevenue), "연말 누적 기준"],
      ["예상 총판매수량", formatUnits(item.projectedUnits), "상품 회전 기준"],
      ["성장률", `${item.growthRate > 0 ? "+" : ""}${item.growthRate.toFixed(1)}%`, "최근 흐름 기준"],
      ["재고 소진 예상", formatWeekText(item.stockOutWeek), "리오더 검토 시점"],
      ["라이프사이클", item.lifecycle, "현재 판매 단계"],
      ["PLC 유사군", item.plcGroup, `유사도 ${item.plcSimilarity}점 / 속도지수 ${item.velocityIndex}`],
      ["이번 주 - 다음 주", `${formatCompactBillion(item.currentWeekRevenue)} → ${formatCompactBillion(item.nextWeekRevenue)}`, "주간 매출 비교"]
    ];

    selectedSummary.innerHTML = summaryItems.map(([label, value, sub]) => `
      <article class="summary-card">
        <span class="label">${label}</span>
        <span class="value">${value}</span>
        <span class="sub">${sub}</span>
      </article>
    `).join("");
  }

  function renderWeekComparison(item) {
    const deltaPct = ((item.nextWeekRevenue - item.currentWeekRevenue) / item.currentWeekRevenue) * 100;
    const directionClass = deltaPct >= 0 ? "delta-up" : "delta-down";
    const directionText = deltaPct >= 0 ? "상승" : "하락";

    weekCompareGrid.innerHTML = `
      <article class="mini-card">
        <h4>${item.styleCode}</h4>
        <p class="soft-copy">${item.itemName}</p>
        <p class="soft-copy">이번 주 ${formatCompactBillion(item.currentWeekRevenue)} / 다음 주 ${formatCompactBillion(item.nextWeekRevenue)}</p>
        <div class="delta-pill ${directionClass}">${directionText} ${deltaPct >= 0 ? "+" : ""}${deltaPct.toFixed(1)}%</div>
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
    const labelWeeks = new Set([1, 5, 9, 13, 17, 21, 25, 29, 33, 37, 41, 45, 49, 52, item.peakWeek]);

    const bars = item.weeklySalesUnits.map((value, index) => {
      const weekNo = index + 1;
      const ratio = item.weeklyRatioPct[index];
      const x = margin.left + index * barWidth;
      const barHeight = Math.max(6, (value / maxUnits) * innerHeight);
      const y = margin.top + innerHeight - barHeight;
      const label = labelWeeks.has(weekNo)
        ? `<text x="${x + (barWidth / 2)}" y="${height - 14}" text-anchor="middle" class="axis-label">${formatWeekLabel(weekNo)}</text>`
        : "";

      return `
        <g class="week-bar-group">
          <rect
            x="${x + 1}"
            y="${y}"
            width="${Math.max(6, barWidth - 2)}"
            height="${barHeight}"
            rx="7"
            class="week-bar"
          >
            <title>${formatWeekLabel(weekNo)} / 판매량 ${formatUnits(value)} / PLC 비중 ${ratio.toFixed(3)}%</title>
          </rect>
          ${label}
        </g>
      `;
    }).join("");

    const peakX = margin.left + (item.peakWeek - 0.5) * barWidth;

    weeklyUnitsChart.innerHTML = `
      <div class="weekly-chart-frame">
        <svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" class="weekly-chart-svg" aria-label="주차별 판매량 차트">
          <defs>
            <linearGradient id="weeklyGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="#7dd3fc"></stop>
              <stop offset="100%" stop-color="#0a84ff"></stop>
            </linearGradient>
          </defs>
          <line x1="${margin.left}" y1="${margin.top + innerHeight}" x2="${width - margin.right}" y2="${margin.top + innerHeight}" stroke="#cbd5e1"></line>
          <line x1="${peakX}" y1="${margin.top}" x2="${peakX}" y2="${margin.top + innerHeight}" class="peak-guide"></line>
          ${bars}
        </svg>
        <div class="weekly-chart-note">막대에 마우스를 올리면 주차별 판매량과 PLC 비중을 볼 수 있습니다.</div>
      </div>
    `;
  }

  function renderExplanation(item) {
    const explanationItems = [
      ["1. 매칭 기준", item.explanation.basis],
      ["2. 총량 기준", item.explanation.total],
      ["3. 주차 분배 방식", item.explanation.distribution],
      ["4. 피크 주차 판단", item.explanation.peak],
      ["5. 월별 합산 결과", item.explanation.topMonth],
      ["6. 현재 시점 해석", item.explanation.current]
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
          <div class="bar-value">${value}억</div>
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
      return { x, y, week: CUMULATIVE_WEEKS[index] };
    });

    const polyline = points.map((point) => `${point.x},${point.y}`).join(" ");
    const labels = points.map((point) => `
      <circle cx="${point.x}" cy="${point.y}" r="3.8" fill="#0a84ff"></circle>
      <text x="${point.x}" y="${height - 10}" text-anchor="middle" class="axis-label">${formatWeekLabel(point.week)}</text>
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
        <p class="soft-copy">${item.itemName}</p>
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
      .map((value) => `<div class="heat-cell" title="${item.styleCode} ${value}" style="background:${heatColor(value)}"></div>`)
      .join("");

    heatmapWrap.innerHTML = `<div class="heatmap">${headCells}${valueCells}</div>`;
  }

  function renderPlcCompare(item) {
    plcCompareGrid.innerHTML = `
      <article class="compare-card">
        <div class="compare-row">
          <div>
            <h4>${item.styleCode}</h4>
            <p>${item.plcGroup}</p>
          </div>
          <div class="accent-number">${item.plcSimilarity}점</div>
        </div>
        <p class="soft-copy">PLC 피크 차이 ${item.plcPeakGapWeeks > 0 ? "+" : ""}${item.plcPeakGapWeeks}주 / 속도지수 ${item.velocityIndex}</p>
        <div class="metric-rail"><div class="metric-fill" style="width:${item.plcSimilarity}%"></div></div>
      </article>
    `;
  }

  function renderLifecycle(item) {
    lifecycleGrid.innerHTML = `
      <article class="life-card">
        <div class="compare-row">
          <div>
            <h4>${item.styleCode}</h4>
            <p>${item.itemName}</p>
          </div>
          <div class="life-pill ${riskClass(item.risk)}">${item.lifecycle}</div>
        </div>
        <p class="soft-copy">재고 소진 예상 ${formatWeekText(item.stockOutWeek)} / 성장률 ${item.growthRate > 0 ? "+" : ""}${item.growthRate.toFixed(1)}% / 위험도 ${item.risk}</p>
      </article>
    `;
  }

  function renderReasons(item) {
    reasonCards.innerHTML = `
      <article class="reason-card">
        <h4>${formatWeekText(item.reasonTitle)}</h4>
        <p>1. ${formatWeekText(item.reasons[0])}</p>
        <p>2. ${formatWeekText(item.reasons[1])}</p>
        <p>3. ${formatWeekText(item.reasons[2])}</p>
      </article>
    `;
  }

  function renderActions(item) {
    actionList.innerHTML = `
      <article class="action-item">
        <h4>${item.styleCode}</h4>
        <p>${formatWeekText(item.action)}</p>
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
    renderSelectedSummary(item);
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
