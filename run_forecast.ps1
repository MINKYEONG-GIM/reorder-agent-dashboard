param(
    [Parameter(Mandatory = $true)]
    [string]$SalesPath,

    [string]$PlcPath = "",

    [string]$OutputDir = ".\outputs",

    [int]$ForecastYear = 0
)

$scriptPath = Join-Path $PSScriptRoot "forecast_weekly_sales.py"

if (-not $PlcPath -or -not (Test-Path -LiteralPath $PlcPath)) {
    $plcCandidate = Get-ChildItem -LiteralPath "C:\Users\kim_minkyeong07\Downloads" -Filter "*PLC*.csv" -ErrorAction SilentlyContinue |
        Sort-Object LastWriteTime -Descending |
        Select-Object -First 1

    if (-not $plcCandidate) {
        throw "Downloads 폴더에서 PLC CSV 파일을 찾지 못했습니다. -PlcPath로 직접 지정해 주세요."
    }

    $PlcPath = $plcCandidate.FullName
}

$args = @($scriptPath, $SalesPath, "--plc-path", $PlcPath, "--output-dir", $OutputDir)

if ($ForecastYear -gt 0) {
    $args += @("--forecast-year", "$ForecastYear")
}

$bundledPython = "C:\Users\kim_minkyeong07\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe"

if (Test-Path -LiteralPath $bundledPython) {
    & $bundledPython @args
    exit $LASTEXITCODE
}

$python = Get-Command python -ErrorAction SilentlyContinue
if ($python -and $python.Source -notlike "*WindowsApps*") {
    & $python.Source @args
    exit $LASTEXITCODE
}

$py = Get-Command py -ErrorAction SilentlyContinue
if ($py) {
    & $py.Source @args
    exit $LASTEXITCODE
}

throw "실행 가능한 Python을 찾지 못했습니다. 번들 Python, python, py 순서로 확인했지만 모두 사용할 수 없었습니다."
