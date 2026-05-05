# Weekly Sales Forecast Web

This repo contains a local forecast dashboard plus a frontend structure that is ready to move to GitHub + Vercel later.

## Current Local Run

```powershell
powershell -ExecutionPolicy Bypass -File .\start_web.ps1
```

Open:

`http://127.0.0.1:8765`

## Deployment-Oriented Frontend Structure

The frontend is now split so it can move to Vercel more easily.

- `web/index.html`: entry HTML
- `web/static/app.js`: frontend bootstrap
- `web/static/data/dashboard-data.js`: dashboard data source
- `web/static/lib/constants.js`: shared constants
- `web/static/lib/formatters.js`: number and badge helpers
- `web/static/lib/state.js`: UI state
- `web/static/ui/dashboard.js`: rendering logic
- `web/static/styles.css`: page styling

## Vercel Notes

- `vercel.json` is included so Vercel can serve the app from the `web/` folder.
- `package.json` is included for repo-level scripts and future frontend tooling expansion.
- The current frontend is plain static HTML/CSS/JS, which keeps deployment simple.
- Later, if API routes are needed, the current split makes it easier to replace static data with real fetch calls.

## Existing Forecast Logic

- `src/sales_forecast_core.py`: shared forecast logic and Excel builder
- `forecast_weekly_sales.py`: CLI entry point
- `web/app.py`: local HTTP server
- `start_web.ps1`: local web app launcher
