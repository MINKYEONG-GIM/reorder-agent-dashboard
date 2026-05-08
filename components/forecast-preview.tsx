"use client";

import { useEffect, useMemo, useState } from "react";

import type { PlanningDashboard, ItemForecastRow, Pagination } from "../lib/types";

type Props = {
  dashboard: PlanningDashboard;
  query: string;
};

const number = new Intl.NumberFormat("ko-KR", { maximumFractionDigits: 0 });
const percent = new Intl.NumberFormat("ko-KR", { maximumFractionDigits: 1 });
const money = new Intl.NumberFormat("ko-KR", { maximumFractionDigits: 0 });

function buildPageHref(query: string, page: number) {
  const params = new URLSearchParams();
  if (query) {
    params.set("q", query);
  }
  params.set("page", String(page));
  return `/?${params.toString()}`;
}

function PaginationLinks({ query, pagination }: { query: string; pagination: Pagination }) {
  if (pagination.totalPages <= 1) {
    return null;
  }

  const previousPage = Math.max(1, pagination.currentPage - 1);
  const nextPage = Math.min(pagination.totalPages, pagination.currentPage + 1);
  const windowStart = Math.max(1, pagination.currentPage - 2);
  const windowEnd = Math.min(pagination.totalPages, pagination.currentPage + 2);
  const pages = Array.from({ length: windowEnd - windowStart + 1 }, (_, index) => windowStart + index);

  return (
    <div className="pager-shell">
      <div className="pager-meta">
        <strong>
          페이지 {pagination.currentPage} / {pagination.totalPages}
        </strong>
        <span>검색 결과 {number.format(pagination.totalRows)}개 스타일</span>
      </div>
      <div className="pager">
        <a href={buildPageHref(query, previousPage)} className="pager-link">
          이전
        </a>
        {pages.map((page) => (
          <a
            key={page}
            href={buildPageHref(query, page)}
            className={`pager-link${page === pagination.currentPage ? " pager-link-active" : ""}`}
          >
            {page}
          </a>
        ))}
        <a href={buildPageHref(query, nextPage)} className="pager-link">
          다음
        </a>
      </div>
    </div>
  );
}

function SummaryCards({ dashboard }: { dashboard: PlanningDashboard }) {
  return (
    <section className="summary-grid">
      <article className="metric-card">
        <span className="kicker">전체 스타일</span>
        <strong>{number.format(dashboard.summary.totalItems)}개</strong>
        <p>현재 검색 결과에 포함된 스타일 수입니다.</p>
      </article>
      <article className="metric-card">
        <span className="kicker">누적 실제 판매</span>
        <strong>{number.format(dashboard.summary.totalActualQty)}장</strong>
        <p>현재 주차까지 실제로 판매된 누적 수량입니다.</p>
      </article>
      <article className="metric-card">
        <span className="kicker">잔여 예상 판매</span>
        <strong>{number.format(dashboard.summary.totalRemainingQty)}장</strong>
        <p>현재 이후 주차에 추가로 판매될 것으로 보는 수량입니다.</p>
      </article>
      <article className="metric-card">
        <span className="kicker">연말 예상 판매</span>
        <strong>{number.format(dashboard.summary.totalProjectedQty)}장</strong>
        <p>스타일별 주차 비중을 반영한 연말 예상 총판매량입니다.</p>
      </article>
    </section>
  );
}

function WeekBars({ row }: { row: ItemForecastRow }) {
  const maxQty = Math.max(...row.weeklyForecast.map((cell) => cell.totalQty), 1);

  return (
    <div className="weekly-bars-card">
      <div className="weekly-bars">
        {row.weeklyForecast.map((cell) => (
          <div key={`${row.styleCode}-${cell.weekNo}`} className="weekly-bar-wrap">
            <div
              className={`weekly-bar ${cell.isFuture ? "weekly-bar-future" : ""}`}
              style={{ height: `${Math.max(10, (cell.totalQty / maxQty) * 180)}px` }}
              title={`${cell.label}
총 ${number.format(cell.totalQty)}장
실제 ${number.format(cell.actualQty)}장
예상 ${number.format(cell.forecastQty)}장
기준 비중 ${percent.format(cell.basisRatioPct)}%`}
            />
            <span className="weekly-bar-label">{cell.label}</span>
          </div>
        ))}
      </div>
      <p className="bars-caption">
        진한 막대는 이미 판매된 주차, 강조 막대는 앞으로 판매될 것으로 예측한 주차입니다.
      </p>
    </div>
  );
}

function WeeklyForecastTable({ row }: { row: ItemForecastRow }) {
  const visibleRows = row.weeklyForecast.filter((cell) => cell.actualQty > 0 || cell.forecastQty > 0);

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>주차</th>
            <th>실제 판매</th>
            <th>예상 판매</th>
            <th>총 판매</th>
            <th>기준 비중</th>
            <th>기준 판매량</th>
            <th>제외 판매량</th>
          </tr>
        </thead>
        <tbody>
          {visibleRows.map((cell) => (
            <tr key={`${row.styleCode}-${cell.weekNo}`}>
              <td>{cell.label}</td>
              <td>{number.format(cell.actualQty)}장</td>
              <td className={cell.isFuture ? "status-warn" : ""}>{number.format(cell.forecastQty)}장</td>
              <td>{number.format(cell.totalQty)}장</td>
              <td>{percent.format(cell.basisRatioPct)}%</td>
              <td>{number.format(cell.basisEligibleQty)}장</td>
              <td className={cell.excludedQty > 0 ? "status-danger" : ""}>{number.format(cell.excludedQty)}장</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SelectedStyleSection({ row }: { row: ItemForecastRow | null }) {
  if (!row) {
    return (
      <section className="panel empty-state">
        <span className="kicker">스타일 상세</span>
        <h2>스타일코드를 클릭하면 주차별 판매량 예측이 열립니다</h2>
        <p>
          위 표에서 원하는 스타일코드를 선택하면, 해당 스타일의 실제 판매량과 앞으로 주차별로 몇 장이 더
          판매될지를 바로 아래에서 확인할 수 있습니다.
        </p>
      </section>
    );
  }

  return (
    <section className="panel">
      <div className="panel-header detail-header">
        <div>
          <span className="kicker">선택 스타일</span>
          <h2>
            {row.styleCode} 주차별 판매량 예측
          </h2>
          <p>
            {row.styleName || row.itemName || "-"} / 기준군 {row.basisScope} {row.basisLabel}
          </p>
        </div>
        <div className="detail-meta">
          <span className="tag">현재 기준 {row.currentWeekLabel}</span>
          <span className="tag">피크 예상 {row.peakWeekLabel}</span>
        </div>
      </div>

      <div className="detail-grid">
        <article className="metric-card">
          <span className="kicker">누적 실제 판매</span>
          <strong>{number.format(row.cumulativeActualQty)}장</strong>
          <p>{row.currentWeekLabel}까지 실제로 판매된 수량입니다.</p>
        </article>
        <article className="metric-card">
          <span className="kicker">잔여 예상 판매</span>
          <strong>{number.format(row.remainingForecastQty)}장</strong>
          <p>현재 이후 주차에 추가로 판매될 것으로 보는 수량입니다.</p>
        </article>
        <article className="metric-card">
          <span className="kicker">연말 예상 총판매</span>
          <strong>{number.format(row.projectedEndingQty)}장</strong>
          <p>현재 실적과 작년 주차 비중을 반영한 연말 총판매 예측입니다.</p>
        </article>
        <article className="metric-card">
          <span className="kicker">판매 진행률</span>
          <strong>{percent.format(row.progressPct)}%</strong>
          <p>연말 예상 판매량 대비 현재까지 판매된 비중입니다.</p>
        </article>
      </div>

      <div className="detail-section">
        <div className="section-head-inline">
          <span className="kicker">주차별 판매량</span>
          <h3>한 눈에 보는 주차별 판매량 예측</h3>
        </div>
        <WeekBars row={row} />
      </div>

      <div className="detail-section">
        <div className="section-head-inline">
          <span className="kicker">주차별 표</span>
          <h3>스타일코드별 실제 판매와 예상 판매</h3>
        </div>
        <WeeklyForecastTable row={row} />
      </div>
    </section>
  );
}

function StyleListSection({
  dashboard,
  selectedStyleCode,
  onSelect,
}: {
  dashboard: PlanningDashboard;
  selectedStyleCode: string | null;
  onSelect: (styleCode: string) => void;
}) {
  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <span className="kicker">스타일 리스트</span>
          <h2>스타일코드별 연말 판매량 예측</h2>
          <p>스타일코드 검색 후 행을 클릭하면 아래에 주차별 판매량 예측이 바로 열립니다.</p>
        </div>
      </div>

      <div className="selection-guide">
        <strong>클릭 안내</strong>
        <span>
          스타일코드 행을 클릭하면 주차별 실제 판매와 앞으로 판매될 예상 수량을 바로 아래에서 확인할 수
          있습니다.
        </span>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>스타일코드</th>
              <th>스타일명</th>
              <th>현재 주차</th>
              <th>누적 실제 판매</th>
              <th>잔여 예상 판매</th>
              <th>연말 예상 총판매</th>
              <th>피크 주차</th>
              <th>기준군</th>
            </tr>
          </thead>
          <tbody>
            {dashboard.itemRows.map((row) => {
              const isActive = row.styleCode === selectedStyleCode;
              return (
                <tr
                  key={`${row.styleCode}-${row.salesYear}`}
                  className={`clickable-row${isActive ? " clickable-row-active" : ""}`}
                  onClick={() => onSelect(row.styleCode)}
                >
                  <td>{row.styleCode}</td>
                  <td>{row.styleName || row.itemName || "-"}</td>
                  <td>{row.currentWeekLabel}</td>
                  <td>{number.format(row.cumulativeActualQty)}장</td>
                  <td className="status-warn">{number.format(row.remainingForecastQty)}장</td>
                  <td>{number.format(row.projectedEndingQty)}장</td>
                  <td>{row.peakWeekLabel}</td>
                  <td>
                    {row.basisScope} / {row.basisLabel}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function BasisPanel({ dashboard }: { dashboard: PlanningDashboard }) {
  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <span className="kicker">계산 기준</span>
          <h2>작년 아이템군 주차 비중을 이렇게 사용했습니다</h2>
          <p>할인율 50% 이상 주차는 제외하고, 그 남은 판매량만으로 주차별 비중을 계산했습니다.</p>
        </div>
      </div>

      <ul className="note-list">
        <li className="note-item">
          <strong>주차 비중 기준</strong>
          후아유 아이템별 주차별 판매 데이터를 기준으로, 같은 아이템군의 작년 주차별 판매량 비중을
          계산했습니다.
        </li>
        <li className="note-item">
          <strong>할인 제외 조건</strong>
          할인율 50% 이상인 주차 판매량은 비중 계산에서 0으로 처리했습니다.
        </li>
        <li className="note-item">
          <strong>스타일별 예측 방식</strong>
          올해 실제 판매 누적 수량을 현재까지의 누적 비중으로 나누어 연말 총판매량을 추정하고, 남은
          수량을 이후 주차 비중대로 배분했습니다.
        </li>
      </ul>
    </section>
  );
}

export function ForecastPreview({ dashboard, query }: Props) {
  const [selectedStyleCode, setSelectedStyleCode] = useState<string | null>(null);

  useEffect(() => {
    setSelectedStyleCode(null);
  }, [dashboard.itemRows]);

  const selectedRow = useMemo(
    () => dashboard.itemRows.find((row) => row.styleCode === selectedStyleCode) ?? null,
    [dashboard.itemRows, selectedStyleCode],
  );

  return (
    <div className="section-stack">
      <SummaryCards dashboard={dashboard} />
      <StyleListSection
        dashboard={dashboard}
        selectedStyleCode={selectedStyleCode}
        onSelect={setSelectedStyleCode}
      />
      <PaginationLinks query={query} pagination={dashboard.pagination} />
      <SelectedStyleSection row={selectedRow} />
      <BasisPanel dashboard={dashboard} />
    </div>
  );
}
