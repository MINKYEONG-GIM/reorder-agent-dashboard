import { ForecastPreview } from "../components/forecast-preview";
import { getDashboardPageData } from "../lib/data";

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
          <p className="eyebrow">WHO.A.U Mock Forecast</p>
          <h1>목업 데이터로 주차별 판매 예측 웹을 빠르게 확인합니다.</h1>
          <p className="hero-copy">
            실제 CSV 대신 후아유 스타일의 샘플 아이템군과 올해 판매 흐름을 생성했습니다. 할인율 50% 이상 주차를
            제외한 주차 비중, 아이템별 연말 판매량, 남은 주차 예측량을 바로 볼 수 있습니다.
          </p>

          <form className="search-form" action="/" method="get">
            <label className="search-label" htmlFor="q">
              스타일코드, 스타일명, 아이템군 검색
            </label>
            <div className="search-row">
              <input
                id="q"
                name="q"
                type="text"
                placeholder="예: hoodie, 볼캡, denim"
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
          <span>목업 기준</span>
          <strong>{pageData.ok ? `${pageData.dashboard.summary.latestSalesYear}년 샘플 판매` : "데이터 확인 필요"}</strong>
          <p>
            {pageData.ok
              ? `샘플 ${pageData.dashboard.summary.totalItems}개 아이템을 기준으로 연말 판매량과 주차별 예측량을 계산했습니다.`
              : "목업 데이터를 만들지 못했습니다."}
          </p>
        </div>
      </section>

      {pageData.ok ? (
        <ForecastPreview dashboard={pageData.dashboard} query={pageData.query} />
      ) : (
        <section className="panel empty-state">
          <span className="kicker">데이터 오류</span>
          <h2>예측용 데이터를 불러오지 못했습니다.</h2>
          <p>{pageData.message}</p>
        </section>
      )}
    </main>
  );
}
