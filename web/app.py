from __future__ import annotations

import json
import mimetypes
import os
import sys
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, quote, urlparse

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from src.sales_forecast_core import (  # noqa: E402
    build_excel_bytes,
    build_forecast_dataset,
    discover_default_plc_path,
    result_preview,
    write_summary_csv,
    write_weekly_csv,
)


WEB_DIR = ROOT / "web"
STATIC_DIR = WEB_DIR / "static"
HOST = "127.0.0.1"
PORT = int(os.environ.get("FORECAST_WEB_PORT", "8765"))
RESULTS: dict[str, dict] = {}
PLC_PATH = discover_default_plc_path()


def discover_default_sales_path(downloads_dir: Path | None = None) -> Path:
    home = Path.home()
    base_dir = downloads_dir or (home / "Downloads")
    exact = base_dir / "일자별 매출.csv"
    if exact.exists():
        return exact

    matches = sorted(base_dir.glob("*일자별 매출*.csv"), key=lambda item: item.stat().st_mtime, reverse=True)
    if matches:
        return matches[0]

    raise FileNotFoundError("Daily sales CSV file was not found in Downloads.")


SALES_PATH = discover_default_sales_path()


class ForecastHandler(BaseHTTPRequestHandler):
    server_version = "LocalForecastWeb/1.0"

    def do_GET(self) -> None:
        parsed = urlparse(self.path)
        route = parsed.path

        if route == "/":
            self.serve_file(WEB_DIR / "index.html", "text/html; charset=utf-8")
            return
        if route.startswith("/static/"):
            file_path = STATIC_DIR / route.replace("/static/", "", 1)
            content_type = mimetypes.guess_type(str(file_path))[0] or "application/octet-stream"
            self.serve_file(file_path, content_type)
            return
        if route == "/api/config":
            self.send_json(
                {
                    "plc_path": str(PLC_PATH),
                    "sales_path": str(SALES_PATH),
                    "host": HOST,
                    "port": PORT,
                }
            )
            return
        if route == "/api/default-forecast":
            self.handle_default_forecast(parsed.query)
            return
        if route == "/api/download/xlsx":
            self.handle_xlsx_download(parsed.query)
            return
        if route == "/api/download/summary.csv":
            self.handle_csv_download(parsed.query, summary=True)
            return
        if route == "/api/download/weekly.csv":
            self.handle_csv_download(parsed.query, summary=False)
            return

        self.send_error(HTTPStatus.NOT_FOUND, "Not found")

    def do_POST(self) -> None:
        self.send_error(HTTPStatus.NOT_FOUND, "Not found")

    def handle_default_forecast(self, query: str) -> None:
        params = parse_qs(query)
        forecast_year = None
        year_text = params.get("forecast_year", [""])[0]
        if year_text:
            forecast_year = int(year_text)

        try:
            result = build_forecast_dataset(
                sales_csv_bytes=SALES_PATH.read_bytes(),
                plc_path=PLC_PATH,
                forecast_year=forecast_year,
                source_name=SALES_PATH.name,
            )
        except Exception as exc:
            self.send_json({"error": str(exc)}, status=HTTPStatus.BAD_REQUEST)
            return

        RESULTS[result["result_id"]] = result
        self.send_json(result_preview(result))

    def handle_xlsx_download(self, query: str) -> None:
        result = self.require_result(query)
        if result is None:
            return

        binary = build_excel_bytes(result)
        filename = f"{Path(result['source_name']).stem}_forecast.xlsx"
        self.send_bytes(
            binary,
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            filename,
        )

    def handle_csv_download(self, query: str, summary: bool) -> None:
        result = self.require_result(query)
        if result is None:
            return

        if summary:
            binary = write_summary_csv(result["summary_rows"])
            filename = f"{Path(result['source_name']).stem}_summary_forecast.csv"
        else:
            binary = write_weekly_csv(result["weekly_rows"])
            filename = f"{Path(result['source_name']).stem}_weekly_forecast.csv"

        self.send_bytes(binary, "text/csv; charset=utf-8", filename)

    def require_result(self, query: str) -> dict | None:
        result_id = parse_qs(query).get("result_id", [""])[0]
        result = RESULTS.get(result_id)
        if result is None:
            self.send_json({"error": "Result not found. Upload the file again."}, status=HTTPStatus.NOT_FOUND)
            return None
        return result

    def serve_file(self, path: Path, content_type: str) -> None:
        if not path.exists() or not path.is_file():
            self.send_error(HTTPStatus.NOT_FOUND, "Not found")
            return

        content = path.read_bytes()
        self.send_response(HTTPStatus.OK)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(content)))
        self.end_headers()
        self.wfile.write(content)

    def send_json(self, payload: dict, status: HTTPStatus = HTTPStatus.OK) -> None:
        encoded = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(encoded)))
        self.end_headers()
        self.wfile.write(encoded)

    def send_bytes(self, payload: bytes, content_type: str, filename: str) -> None:
        safe_name = filename.encode("ascii", "ignore").decode("ascii") or "download.bin"
        utf8_name = quote(filename)
        self.send_response(HTTPStatus.OK)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(payload)))
        self.send_header(
            "Content-Disposition",
            f"attachment; filename=\"{safe_name}\"; filename*=UTF-8''{utf8_name}",
        )
        self.end_headers()
        self.wfile.write(payload)

    def log_message(self, format: str, *args) -> None:
        return


def main() -> None:
    server = ThreadingHTTPServer((HOST, PORT), ForecastHandler)
    print(f"Forecast web app running on http://{HOST}:{PORT}")
    print(f"Using PLC file: {PLC_PATH}")
    server.serve_forever()


if __name__ == "__main__":
    main()
