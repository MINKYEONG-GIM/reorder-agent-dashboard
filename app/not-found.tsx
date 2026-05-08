export default function NotFound() {
  return (
    <main className="page-shell">
      <section className="panel empty-state">
        <span className="kicker">404</span>
        <h1>페이지를 찾을 수 없습니다.</h1>
        <p>주소를 다시 확인하거나 대시보드 첫 화면으로 돌아가 주세요.</p>
        <a className="pager-link" href="/">
          대시보드로 이동
        </a>
      </section>
    </main>
  );
}
