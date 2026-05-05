param(
    [int]$Port = 8765
)

$python = "C:\Users\kim_minkyeong07\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe"
if (-not (Test-Path -LiteralPath $python)) {
    throw "Bundled Python was not found: $python"
}

$env:FORECAST_WEB_PORT = "$Port"
& $python (Join-Path $PSScriptRoot "web\\app.py")
