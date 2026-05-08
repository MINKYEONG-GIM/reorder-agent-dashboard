import argparse
import subprocess
import sys

from common import parse_style_codes


def run_step(script_name: str, styles_arg: str):
    command = [sys.executable, script_name, "--styles", styles_arg]
    result = subprocess.run(command, check=False)
    if result.returncode != 0:
        raise SystemExit(result.returncode)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--styles", required=True, help="콤마 또는 줄바꿈으로 구분한 스타일코드")
    args = parser.parse_args()

    style_codes = parse_style_codes(args.styles)
    if not style_codes:
        raise SystemExit("스타일코드를 1개 이상 입력하세요.")

    styles_arg = ",".join(style_codes)

    run_step("scripts/01_build_raw_weekly_sales.py", styles_arg)
    run_step("scripts/02_build_style_ratio_weekly.py", styles_arg)
    run_step("scripts/03_build_sku_weekly_forecast.py", styles_arg)
    run_step("scripts/04_build_reorder_and_style_color_need.py", styles_arg)

    print("전체 파이프라인 실행 완료")


if __name__ == "__main__":
    main()
