import { ForecastPreview } from "@/components/forecast-preview";
import { getDashboardPageData } from "@/lib/data";

type HomeProps = {
  searchParams?: Promise<{
    q?: string;
    page?: string;
  }>;
};

export const dynamic = "force-dynamic";

export default async function Home({ searchParams }: HomeProps) {
  const params = (await searchParams) ?? {};
  const pageData = await getDashboardPageData(params.q, params.page);

  return (
    <main className="page-shell">
      <section className="hero">
        <div>
          <p className="eyebrow">Who.A.U Item Weekly Basis Forecast</p>
          <h1>작년 아이템군 주차 비중과 할인 제외 기준으로 아이템별 엔딩 판매량을 예측합니다</h1>
          <p className="hero-copy">
            이 화면은 <strong>후아유 일자별 매출.csv</strong>의 실제 판매 데이터를 기준으로,{" "}
            <strong>후아유 아이템별 주차별 판매.csv</strong>에서 읽은 작년 아이템군 주차 비중을 적용해 엔딩 판매량을 계산합니다.
            특히 <strong>할인율 50% 이상인 주차 판매량은 0으로 보고 비중 계산에서 제외</strong>합니다.
          </p>

          <form className="search-form" action="/" method="get">
            <label className="search-label" htmlFor="q">
              스타일코드, 스타일명, 상품명, 아이템군 검색
            </label>
            <div className="search-row">
              <input
                id="q"
                name="q"
                type="text"
                placeholder="예: WHACG1111A 또는 모자"
                defaultValue={pageData.query}
                className="search-input"
              />
              <button type="submit" className="search-button">
                검색
              </button>
            </div>
          </form>
        </div>

        <div className="hero-card">
          <span>현재 기준</span>
          <strong>{pageData.query || "전체 아이템"}</strong>
          <p>
            {pageData.ok
              ? `${pageData.dashboard.summary.totalItems}개 아이템 / ${pageData.dashboard.summary.latestSalesYear}년 판매 기준`
              : "CSV 파일을 읽지 못하면 여기에서 오류 안내를 보여줍니다."}
          </p>
        </div>
      </section>

      {pageData.ok ? (
        <ForecastPreview dashboard={pageData.dashboard} query={pageData.query} />
      ) : (
        <section className="panel empty-state">
          <span className="kicker">데이터 확인</span>
          <h2>CSV 기반 예측 데이터를 불러오지 못했습니다</h2>
          <p>{pageData.message}</p>
        </section>
      )}
    </main>
  );
}
