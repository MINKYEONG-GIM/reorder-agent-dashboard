import argparse

import pandas as pd

from common import (
    delete_style_codes,
    fetch_all_rows,
    get_supabase_client,
    parse_style_codes,
    safe_float,
    safe_int,
    upsert_rows,
)


def get_ref_item_code(style_code: str):
    style_code = (style_code or "").strip()
    return style_code[2:4] if len(style_code) >= 4 else style_code


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--styles", required=True, help="콤마 또는 줄바꿈으로 구분한 스타일코드")
    args = parser.parse_args()

    style_codes = parse_style_codes(args.styles)
    client = get_supabase_client()

    raw_rows = fetch_all_rows(client, "raw_weekly_sales", "style_code,year_week,week_no")
    raw_df = pd.DataFrame(raw_rows)
    raw_df = raw_df[raw_df["style_code"].isin(style_codes)].copy()

    plc_rows = fetch_all_rows(
        client,
        "item_plc",
        "item_code,item_name,year_week,week_no,last_year_ratio_pct,stage,shape_type,peak_week",
    )
    plc_df = pd.DataFrame(plc_rows)

    if raw_df.empty or plc_df.empty:
        print("raw_weekly_sales 또는 item_plc 데이터가 없습니다.")
        return

    plc_df = plc_df.sort_values(["item_code", "week_no"]).drop_duplicates(
        ["item_code", "year_week"],
        keep="first",
    )
    plc_map = {
        (str(row["item_code"]).strip(), str(row["year_week"]).strip()): row
        for _, row in plc_df.iterrows()
        if pd.notna(row["item_code"]) and pd.notna(row["year_week"])
    }

    payload = []
    for style_code in style_codes:
        ref_code = get_ref_item_code(style_code)
        weeks = (
            raw_df[raw_df["style_code"] == style_code][["year_week", "week_no"]]
            .drop_duplicates()
            .sort_values("week_no")
        )

        for _, week_row in weeks.iterrows():
            year_week = str(week_row["year_week"]).strip()
            week_no = safe_int(week_row["week_no"])
            matched = plc_map.get((ref_code, year_week))
            ratio_source = "matched"

            if matched is None:
                matched = plc_map.get(("평균", year_week))
                ratio_source = "average_fallback"

            payload.append(
                {
                    "style_code": style_code,
                    "ref_item_code": ref_code,
                    "year_week": year_week,
                    "week_no": week_no,
                    "last_year_ratio_pct": safe_float(
                        matched["last_year_ratio_pct"] if matched is not None else 0
                    ),
                    "stage": matched["stage"] if matched is not None else None,
                    "shape_type": matched["shape_type"] if matched is not None else None,
                    "peak_week": safe_int(
                        matched["peak_week"] if matched is not None else None,
                        default=None,
                    ),
                    "ratio_source": ratio_source,
                }
            )

    delete_style_codes(client, "style_ratio_weekly", style_codes)
    upsert_rows(client, "style_ratio_weekly", payload, on_conflict="style_code,year_week")
    print(f"style_ratio_weekly 적재 완료: {len(payload)}건")


if __name__ == "__main__":
    main()
