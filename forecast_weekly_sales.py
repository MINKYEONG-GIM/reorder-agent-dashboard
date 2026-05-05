from __future__ import annotations

import argparse
from pathlib import Path

from src.sales_forecast_core import (
    SUMMARY_HEADERS,
    WEEKLY_HEADERS,
    build_forecast_dataset,
    discover_default_plc_path,
    write_csv_bytes,
)


DEFAULT_OUTPUT_DIR = Path("outputs")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Forecast weekly sales from a daily sales CSV using the fixed PLC reference CSV."
    )
    parser.add_argument("sales_path", help="Path to the daily sales CSV file")
    parser.add_argument("--plc-path", default=None, help="Path to the fixed PLC CSV file")
    parser.add_argument("--output-dir", default=str(DEFAULT_OUTPUT_DIR), help="Output directory for result CSV files")
    parser.add_argument("--forecast-year", type=int, default=None, help="Override forecast year")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    sales_path = Path(args.sales_path)
    if not sales_path.exists():
        raise FileNotFoundError(f"Sales CSV file was not found: {sales_path}")

    plc_path = Path(args.plc_path) if args.plc_path else discover_default_plc_path()
    if not plc_path.exists():
        raise FileNotFoundError(f"PLC CSV file was not found: {plc_path}")

    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    result = build_forecast_dataset(
        sales_csv_bytes=sales_path.read_bytes(),
        plc_path=plc_path,
        forecast_year=args.forecast_year,
        source_name=sales_path.name,
    )

    summary_path = output_dir / f"{sales_path.stem}_style_summary_forecast.csv"
    weekly_path = output_dir / f"{sales_path.stem}_weekly_forecast.csv"
    warning_path = output_dir / f"{sales_path.stem}_forecast_warnings.txt"

    summary_path.write_bytes(write_csv_bytes(SUMMARY_HEADERS, result["summary_rows"]))
    weekly_path.write_bytes(write_csv_bytes(WEEKLY_HEADERS, result["weekly_rows"]))
    warning_path.write_text("\n".join(result["warnings"]) if result["warnings"] else "warnings: none", encoding="utf-8")

    print(f"forecast_year: {result['forecast_year']}")
    print(f"latest_actual_date: {result['latest_actual_date']} (week {result['latest_actual_week_no']})")
    print(f"summary_output: {summary_path.resolve()}")
    print(f"weekly_output: {weekly_path.resolve()}")
    print(f"warnings_output: {warning_path.resolve()}")
    print()
    for row in result["summary_rows"]:
        print(
            f"{row['style_code']} | PLC={row['plc_code']} | "
            f"actual_qty={round(row['actual_ytd_qty']):,} | "
            f"future_qty={round(row['projected_future_qty']):,} | "
            f"full_year_qty={round(row['projected_full_year_qty']):,}"
        )


if __name__ == "__main__":
    main()
