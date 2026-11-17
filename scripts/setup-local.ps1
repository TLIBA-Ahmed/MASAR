$ErrorActionPreference = 'Stop'
$taskRoot = Split-Path $PSScriptRoot -Parent
Set-Location -LiteralPath $taskRoot
$env:TEMP = Join-Path $taskRoot '.tmp'
$env:TMP = $env:TEMP
$env:UV_CACHE_DIR = Join-Path $taskRoot '.cache\uv'
New-Item -ItemType Directory -Force -Path $env:TEMP,$env:UV_CACHE_DIR | Out-Null
if (-not (Test-Path -LiteralPath '.env')) {
  @'
from pathlib import Path
import secrets
p=Path('.env.example').read_text()
for key in ('POSTGRES_PASSWORD','POSTGRES_APP_PASSWORD','POSTGRES_WORKER_PASSWORD','SESSION_SECRET','MODEL_GATEWAY_TOKEN'):
    p=p.replace(key+'=GENERATE_WITH_SETUP_SCRIPT', key+'='+secrets.token_hex(32))
Path('.env').write_text(p,encoding='utf-8')
print('Local environment generated; credentials are not displayed.')
'@ | python -X utf8 -
}
if (-not (Test-Path -LiteralPath '.venv\Scripts\python.exe')) { python -m venv .venv }
$env:UV_HTTP_TIMEOUT = '180'
uv -q pip install --python '.venv\Scripts\python.exe' -r backend/requirements.txt
if ($LASTEXITCODE -ne 0) { throw 'Python dependency installation failed.' }
docker compose up -d --wait db
if ($LASTEXITCODE -ne 0) { throw 'PostgreSQL could not start.' }
node scripts/export-seed.mjs
if ($LASTEXITCODE -ne 0) { throw 'Synthetic seed export failed.' }
& '.venv\Scripts\python.exe' -m backend.bootstrap
if ($LASTEXITCODE -ne 0) { throw 'Database bootstrap failed.' }
