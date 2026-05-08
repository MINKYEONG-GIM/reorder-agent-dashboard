"use client";

import type { Pagination, PlanningDashboard } from "@/lib/types";

type Props = {
  dashboard: PlanningDashboard;
  query: string;
};

const number = new Intl.NumberFormat("ko-KR", { maximumFractionDigits: 0 });
const percent = new Intl.NumberFormat("ko-KR", { maximumFractionDigits: 1 });
const money = new Intl.NumberFormat("ko-KR", { maximumFractionDigits: 1 });

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
  const pageNumbers = Array.from({ length: windowEnd - windowStart + 1 }, (_, index) => windowStart + index);

  return (
    <div className="pager-shell">
      <div className="pager-meta">
        <strong>
          {pagination.currentPage} / {pagination.totalPages} 페이지
        </strong>
        <span>총 {pagination.totalRows}개 아이템</span>
      </div>
      <div className="pager">
        <a href={buildPageHref(query, previousPage)} className="pager-link">
          이전
        </a>
        {pageNumbers.map((page) => (
          <a
            key={`page-${page}`}
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
        <span className="kicker">대상 아이템</span>
        <strong>{number.format(dashboard.summary.totalItems)}개</strong>
        <p>검색 결과에 포함된 스타일 개수</p>
      </article>

      <article className="metric-card">
        <span className="kicker">누적 실제 판매</span>
        <strong>{number.format(dashboard.summary.totalActualQty)}장</strong>
        <p>현재까지 실제 판매수량 합계</p>
      </article>

      <article className="metric-card">
        <span className="kicker">엔딩 예상 판매</span>
        <strong>{number.format(dashboard.summary.totalProjectedQty)}장</strong>
        <p>작년 아이템군 주차 비중 기준 연말 예상 판매수량</p>
      </article>

      <article className="metric-card">
        <span className="kicker">엔딩 예상 매출</span>
        <strong>{money.format(dashboard.summary.totalProjectedRevenue / 100000000)}억</strong>
        <p>실제 평균 판매단가 기준 예상 매출</p>
      </article>
    </section>
  );
}

function ItemForecastTable({ dashboard }: { dashboard: PlanningDashboard }) {
  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <span className="kicker">엔딩 예측</span>
          <h2>아이템별 엔딩 판매량 예측</h2>
          <p>작년 아이템군 주차별 판매 비중을 쓰되, 할인율 50% 이상인 주차의 판매량은 0으로 처리한 뒤 비중을 계산했습니다.</p>
        </div>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>스타일코드</th>
              <th>스타일명</th>
              <th>아이템군</th>
              <th>비중 기준</th>
              <th>기준 연도</th>
              <th>현재 기준 주차</th>
              <th>누적 실제 판매</th>
              <th>잔여 예상 판매</th>
              <th>엔딩 예상 판매</th>
              <th>피크 주차</th>
              <th>할인 제외 판매량</th>
            </tr>
          </thead>
          <tbody>
            {dashboard.itemRows.map((row) => (
              <tr key={row.styleCode}>
                <td>{row.styleCode}</td>
                <td>{row.styleName || row.itemName || "-"}</td>
                <td>{row.categorySmall || row.categoryMiddle || row.categoryMajor || "-"}</td>
                <td>
                  {row.basisScope} / {row.basisLabel}
                </td>
                <td>{row.basisYear}</td>
                <td>{row.currentWeekLabel}</td>
                <td>{number.format(row.cumulativeActualQty)}장</td>
                <td>{number.format(row.remainingForecastQty)}장</td>
                <td>{number.format(row.projectedEndingQty)}장</td>
                <td>{row.peakWeekLabel}</td>
                <td className={row.basisExcludedQty > 0 ? "status-warn" : "status-ok"}>
                  {number.format(row.basisExcludedQty)}장
                </td>
              </tr>
            ))}
            {dashboard.itemRows.length === 0 ? (
              <tr>
                <td colSpan={11} className="empty-table-cell">
                  검색 조건과 일치하는 아이템이 없습니다.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function BasisCards({ row }: { row: PlanningDashboard["itemRows"][number] }) {
  return (
    <div className="summary-grid">
      <article className="metric-card">
        <span className="kicker">비중 기준군</span>
        <strong>{row.basisLabel}</strong>
        <p>
          {row.basisScope} 기준 / 작년 {row.basisYear}년 데이터 사용
        </p>
      </article>
      <article className="metric-card">
        <span className="kicker">기준 총판매량</span>
        <strong>{number.format(row.basisTotalEligibleQty)}장</strong>
        <p>할인율 50% 미만 주차만 합산한 판매량</p>
      </article>
      <article className="metric-card">
        <span className="kicker">할인 제외 판매량</span>
        <strong>{number.format(row.basisExcludedQty)}장</strong>
        <p>{row.basisExcludedWeeks}개 주차에서 할인율 50% 이상 판매량 제외</p>
      </article>
      <article className="metric-card">
        <span className="kicker">예측 방식</span>
        <strong>{percent.format(row.progressPct)}%</strong>
        <p>현재 누적 실제 판매량이 엔딩 예상 판매량에서 차지하는 비중</p>
      </article>
    </div>
  );
}

function ItemWeeklyForecastDetails({ dashboard }: { dashboard: PlanningDashboard }) {
  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <span className="kicker">주차 예측</span>
          <h2>아이템별 주차 판매량 예측</h2>
          <p>상세를 펼치면 작년 기준 판매량, 할인 제외 판매량, 주차 비중, 실제 판매량, 남은 주차 예상 판매량을 함께 보여줍니다.</p>
        </div>
      </div>

      <div className="sku-group-list">
        {dashboard.itemRows.map((row) => (
          <details key={`${row.styleCode}-details`} className="sku-group">
            <summary className="sku-group-summary">
              <div className="sku-group-main">
                <strong>
                  {row.styleCode} · {row.styleName || row.itemName || "-"}
                </strong>
                <span>
                  기준군 {row.basisScope} / {row.basisLabel} · 현재 {row.currentWeekLabel} · 엔딩 예상{" "}
                  {number.format(row.projectedEndingQty)}장 · 피크 {row.peakWeekLabel}
                </span>
              </div>
              <div className="sku-group-stats">
                <span>누적 실제 {number.format(row.cumulativeActualQty)}장</span>
                <span>잔여 예상 {number.format(row.remainingForecastQty)}장</span>
                <span>할인 제외 {number.format(row.basisExcludedQty)}장</span>
              </div>
            </summary>

            <BasisCards row={row} />

            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>주차</th>
                    <th>작년 기준 판매량</th>
                    <th>할인 제외 판매량</th>
                    <th>주차 비중</th>
                    <th>실제 판매량</th>
                    <th>예상 판매량</th>
                    <th>합계 판매량</th>
                    <th>예상 매출</th>
                  </tr>
                </thead>
                <tbody>
                  {row.weeklyForecast.map((cell) => (
                    <tr key={`${row.styleCode}-${cell.weekNo}`}>
                      <td>{cell.label}</td>
                      <td>{number.format(cell.basisQty + cell.excludedQty)}장</td>
                      <td className={cell.excludedQty > 0 ? "status-warn" : ""}>{number.format(cell.excludedQty)}장</td>
                      <td>{percent.format(cell.ratioPct)}%</td>
                      <td>{number.format(cell.actualQty)}장</td>
                      <td>{number.format(cell.forecastQty)}장</td>
                      <td className={cell.isFuture ? "status-warn" : ""}>{number.format(cell.totalQty)}장</td>
                      <td>{money.format(cell.totalRevenue / 10000)}만원</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        ))}
      </div>
    </section>
  );
}

function NotesPanel() {
  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <span className="kicker">계산 기준</span>
          <h2>이 화면은 이렇게 계산됩니다</h2>
        </div>
      </div>

      <ul className="note-list">
        <li className="note-item">
          <strong>기준 파일</strong>
          후아유 아이템별 주차별 판매.csv에서 아이템군별 주차 판매량을 읽고, 해당 아이템군의 연간 총판매량 대비 주차 비중을 계산합니다.
        </li>
        <li className="note-item">
          <strong>할인율 50% 이상 제외</strong>
          할인율이 50% 이상인 주차는 판매량을 0으로 보고 비중 계산에서 제외합니다. 제외된 판매량은 화면에서 별도로 보여줍니다.
        </li>
        <li className="note-item">
          <strong>엔딩 판매량 계산</strong>
          현재까지 실제 누적 판매량을 기준 주차 누적 비중으로 나눠 연말 총판매량을 추정하고, 남은 주차는 동일 비중으로 다시 나눕니다.
        </li>
      </ul>
    </section>
  );
}

export function ForecastPreview({ dashboard, query }: Props) {
  return (
    <div className="section-stack">
      <SummaryCards dashboard={dashboard} />
      <ItemForecastTable dashboard={dashboard} />
      <PaginationLinks query={query} pagination={dashboard.pagination} />
      <ItemWeeklyForecastDetails dashboard={dashboard} />
      <PaginationLinks query={query} pagination={dashboard.pagination} />
      <NotesPanel />
    </div>
  );
}
