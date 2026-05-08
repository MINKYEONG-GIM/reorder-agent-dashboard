create or replace function public.build_sku_forecast_plan(
  p_style_code text,
  p_lead_time_weeks integer default 2,
  p_safety_stock_ratio numeric default 0.15
)
returns uuid
language plpgsql
as $$
declare
  v_plan_run_id uuid := gen_random_uuid();
begin
  delete from public.sku_weekly_forecast_plan
  where style_code = p_style_code;

  with stock_totals as (
    select
      style_code,
      sku,
      sum(coalesce(stock_qty, 0)) as total_owned_stock_qty
    from public.center_stock
    where style_code = p_style_code
    group by 1, 2
  ),
  base as (
    select
      b.*,
      coalesce(s.total_owned_stock_qty, 0) as total_owned_stock_qty,
      sum(coalesce(b.sale_qty, 0)) over (
        partition by b.style_code, b.sku, b.plant
        order by b.week_no
      ) as cumulative_sale_qty,
      sum(coalesce(b.ipgo_qty, 0)) over (
        partition by b.style_code, b.sku, b.plant
        order by b.week_no
      ) as cumulative_ipgo_qty
    from public.sku_weekly_base b
    left join stock_totals s
      on s.style_code = b.style_code
     and s.sku = b.sku
    where b.style_code = p_style_code
  )
  insert into public.sku_weekly_forecast_plan (
    plan_run_id,
    year_week,
    week_no,
    plant,
    style_code,
    sku,
    stage,
    shape_type,
    last_year_ratio_pct,
    base_stock_qty,
    sale_qty,
    ipgo_qty,
    cumulative_sale_qty,
    cumulative_ipgo_qty,
    total_owned_stock_qty,
    depletion_rate_pct,
    is_peak_week,
    is_forecast,
    sale_end_date
  )
  select
    v_plan_run_id,
    year_week,
    week_no,
    plant,
    style_code,
    sku,
    stage,
    shape_type,
    last_year_ratio_pct,
    base_stock_qty,
    sale_qty,
    ipgo_qty,
    cumulative_sale_qty,
    cumulative_ipgo_qty,
    total_owned_stock_qty,
    case
      when total_owned_stock_qty + cumulative_ipgo_qty = 0 then 0
      else round((cumulative_sale_qty / (total_owned_stock_qty + cumulative_ipgo_qty)) * 100, 2)
    end as depletion_rate_pct,
    is_peak_week,
    case when source_type = 'forecast' then true else false end as is_forecast,
    sale_end_date
  from base;

  delete from public.store_season_need
  where style_code = p_style_code;

  insert into public.store_season_need (
    plan_run_id,
    style_code,
    sku,
    center,
    current_stock_qty,
    cumulative_ipgo_qty,
    cumulative_sale_qty,
    remaining_need_qty,
    season_end_date
  )
  with forecast_need as (
    select
      style_code,
      sku,
      max(sale_end_date) as season_end_date,
      sum(case when is_forecast then sale_qty else 0 end) as remaining_season_sale_qty,
      max(cumulative_ipgo_qty) as cumulative_ipgo_qty,
      max(cumulative_sale_qty) as cumulative_sale_qty
    from public.sku_weekly_forecast_plan
    where plan_run_id = v_plan_run_id
    group by 1, 2
  )
  select
    v_plan_run_id,
    c.style_code,
    c.sku,
    c.center,
    coalesce(c.stock_qty, 0),
    f.cumulative_ipgo_qty,
    f.cumulative_sale_qty,
    greatest(f.remaining_season_sale_qty - coalesce(c.stock_qty, 0), 0),
    f.season_end_date
  from public.center_stock c
  join forecast_need f
    on f.style_code = c.style_code
   and f.sku = c.sku
  where c.style_code = p_style_code;

  delete from public.purchase_recommendation
  where style_code = p_style_code;

  insert into public.purchase_recommendation (
    plan_run_id,
    style_code,
    sku,
    plant,
    recommended_order_week,
    recommended_order_qty,
    expected_shortage_week,
    safety_stock_qty,
    lead_time_weeks,
    reason
  )
  with sku_summary as (
    select
      style_code,
      sku,
      plant,
      sum(case when is_forecast then sale_qty else 0 end) as forecast_sale_qty,
      max(total_owned_stock_qty) as total_owned_stock_qty,
      ceil(sum(case when is_forecast then sale_qty else 0 end) * p_safety_stock_ratio) as safety_stock_qty
    from public.sku_weekly_forecast_plan
    where plan_run_id = v_plan_run_id
    group by 1, 2, 3
  ),
  shortage_week as (
    select distinct on (style_code, sku, plant)
      style_code,
      sku,
      plant,
      year_week as expected_shortage_week,
      week_no
    from public.sku_weekly_forecast_plan
    where plan_run_id = v_plan_run_id
      and is_forecast = true
      and (total_owned_stock_qty + cumulative_ipgo_qty - cumulative_sale_qty) < 0
    order by style_code, sku, plant, week_no
  )
  select
    v_plan_run_id,
    s.style_code,
    s.sku,
    s.plant,
    coalesce(
      (
        select f2.year_week
        from public.sku_weekly_forecast_plan f2
        where f2.plan_run_id = v_plan_run_id
          and f2.style_code = s.style_code
          and f2.sku = s.sku
          and f2.plant = s.plant
          and f2.week_no = greatest(coalesce(sw.week_no, f2.week_no) - p_lead_time_weeks, 1)
        limit 1
      ),
      (
        select min(year_week)
        from public.sku_weekly_forecast_plan f3
        where f3.plan_run_id = v_plan_run_id
          and f3.style_code = s.style_code
          and f3.sku = s.sku
          and f3.plant = s.plant
          and f3.is_forecast = true
      )
    ) as recommended_order_week,
    greatest(s.forecast_sale_qty + s.safety_stock_qty - s.total_owned_stock_qty, 0) as recommended_order_qty,
    sw.expected_shortage_week,
    s.safety_stock_qty,
    p_lead_time_weeks,
    'forecast sale + safety stock - owned stock'
  from sku_summary s
  left join shortage_week sw
    on sw.style_code = s.style_code
   and sw.sku = s.sku
   and sw.plant = s.plant;

  return v_plan_run_id;
end;
$$;
