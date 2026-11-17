$ErrorActionPreference='Stop'
$taskRoot=Split-Path $PSScriptRoot -Parent
Set-Location -LiteralPath $taskRoot
$env:PYTEST_DISABLE_PLUGIN_AUTOLOAD='1'
$env:TEMP=Join-Path $taskRoot '.tmp'
$env:TMP=$env:TEMP
& '.venv\Scripts\python.exe' -X utf8 -m pytest backend/tests -q --tb=short
if($LASTEXITCODE -ne 0){throw 'Backend tests failed.'}
