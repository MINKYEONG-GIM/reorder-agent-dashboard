create or replace function public.refresh_sku_weekly_base(p_style_code text default null)
returns void
language sql
as $$
  delete from public.sku_weekly_base
  where p_style_code is null
     or style_code = p_style_code;

  insert into public.sku_weekly_base (
    year_week,
    week_no,
    plant,
    style_code,
    sku,
    item_code,
    sale_qty,
    ipgo_qty,
    stock_change_qty,
    base_stock_qty,
    ending_stock_qty,
    stage,
    shape_type,
    peak_week,
    peak_month,
    last_year_ratio_pct,
    sale_end_date,
    is_peak_week,
    source_type
  )
  with raw_weekly as (
    select
      to_char(to_date(r."CALDAY"::text, 'YYYYMMDD'), 'IYYY-"W"IW') as year_week,
      extract(week from to_date(r."CALDAY"::text, 'YYYYMMDD'))::int as week_no,
      coalesce(r."PLANT", 'UNKNOWN') as plant,
      r."STYLE_CODE" as style_code,
      r."SKU" as sku,
      r."ITEM_CODE" as item_code,
      sum(coalesce(r."SALE_QTY", 0)) as sale_qty,
      sum(coalesce(r."IPGO_QTY", 0)) as ipgo_qty,
      sum(coalesce(r."STOCK_CHANGE_QTY", 0)) as stock_change_qty
    from public.raw_file r
    where r."STYLE_CODE" is not null
      and (p_style_code is null or r."STYLE_CODE" = p_style_code)
    group by 1, 2, 3, 4, 5, 6
  ),
  plc as (
    select
      item_code,
      year_week,
      stage,
      shape_type,
      peak_week,
      peak_month,
      last_year_ratio_pct,
      month,
      week_no
    from public.item_plc
  ),
  joined as (
    select
      r.*,
      p.stage,
      p.shape_type,
      p.peak_week,
      p.peak_month,
      p.last_year_ratio_pct,
      p.month
    from raw_weekly r
    left join plc p
      on p.item_code = r.item_code
     and p.year_week = r.year_week
  ),
  with_stock as (
    select
      j.*,
      greatest(
        sum(j.stock_change_qty) over (
          partition by j.style_code, j.sku, j.plant
          order by j.week_no
          rows between unbounded preceding and 1 preceding
        ),
        0
      ) as base_stock_qty
    from joined j
  )
  select
    year_week,
    week_no,
    plant,
    style_code,
    sku,
    item_code,
    sale_qty,
    ipgo_qty,
    stock_change_qty,
    base_stock_qty,
    greatest(base_stock_qty + ipgo_qty - sale_qty, 0) as ending_stock_qty,
    stage,
    shape_type,
    peak_week,
    peak_month,
    last_year_ratio_pct,
    (date_trunc('month', coalesce(month, now())) + interval '1 month - 1 day')::date as sale_end_date,
    case when peak_week is not null and peak_week = week_no then true else false end as is_peak_week,
    'actual'
  from with_stock;
$$;
