$ErrorActionPreference='Stop'
$taskRoot=Split-Path $PSScriptRoot -Parent
Set-Location -LiteralPath $taskRoot
# Authorization tests are a prerequisite, including on a new machine.
& "$PSScriptRoot\test-backend.ps1"
$env:UV_CACHE_DIR=Join-Path $taskRoot '.cache\uv'
$env:UV_HTTP_TIMEOUT='180'
uv -q pip install --python '.venv\Scripts\python.exe' torch==2.10.0 --index-url https://download.pytorch.org/whl/cpu
if($LASTEXITCODE -ne 0){throw 'CPU PyTorch installation failed.'}
uv -q pip install --python '.venv\Scripts\python.exe' -r backend/requirements-models.txt
if($LASTEXITCODE -ne 0){throw 'CPU runtime installation failed.'}
& '.venv\Scripts\python.exe' -X utf8 scripts/install_models.py
if($LASTEXITCODE -ne 0){throw 'Pinned model download failed.'}
& '.venv\Scripts\python.exe' -X utf8 scripts/benchmark_cpu.py
if($LASTEXITCODE -ne 0){throw 'CPU benchmark failed.'}
& '.venv\Scripts\python.exe' -X utf8 -m backend.register_models
