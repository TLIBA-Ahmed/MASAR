param([ValidateSet('local','demo')][string]$AiMode='local',[int]$FrontendPort=5173,[ValidateRange(1024,65535)][int]$ApiPort=8000)
$ErrorActionPreference='Stop'
$taskRoot=Split-Path $PSScriptRoot -Parent
Set-Location -LiteralPath $taskRoot
if(-not $PSBoundParameters.ContainsKey('ApiPort')){
  $apiPortSetting=Get-Content -LiteralPath (Join-Path $taskRoot '.env') | Where-Object {$_ -match '^MASAR_API_PORT=\d+$'} | Select-Object -Last 1
  if($apiPortSetting){$ApiPort=[int]($apiPortSetting.Split('=',2)[1])}
}
if($ApiPort -lt 1024 -or $ApiPort -gt 65535){throw 'MASAR_API_PORT must be between 1024 and 65535.'}
$env:MASAR_API_PORT="$ApiPort"
$python=Join-Path $taskRoot '.venv\Scripts\python.exe'
if(-not(Test-Path -LiteralPath $python)){throw 'Run scripts/setup-local.ps1 first.'}
$env:AI_MODE=$AiMode
$env:TEMP=Join-Path $taskRoot '.tmp'
$env:TMP=$env:TEMP
$logRoot=Join-Path $taskRoot '.tmp\services'
New-Item -ItemType Directory -Force -Path $logRoot | Out-Null
docker compose up -d --wait db
if($LASTEXITCODE -ne 0){throw 'PostgreSQL is not available.'}
$stamp=Get-Date -Format 'yyyyMMdd-HHmmss'
$started=@()
function Start-MasarProcess($name,$executable,$arguments,$port=0){
  if($port -and (Get-NetTCPConnection -State Listen -LocalPort $port -ErrorAction SilentlyContinue)){
    Write-Host "$name already has a listener on port $port; existing process left running."
    return
  }
  $process=Start-Process -FilePath $executable -ArgumentList $arguments -WorkingDirectory $taskRoot -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $logRoot "$stamp-$name.log") -RedirectStandardError (Join-Path $logRoot "$stamp-$name.err.log")
  $script:started+=@{name=$name;pid=$process.Id;start=$process.StartTime.ToUniversalTime().ToString('o')}
}
Start-MasarProcess 'gateway' $python @('-m','uvicorn','backend.model_gateway.app:app','--host','127.0.0.1','--port','8001','--workers','1','--no-access-log') 8001
Start-MasarProcess 'api' $python @('-m','uvicorn','backend.api.app:app','--host','127.0.0.1','--port',"$ApiPort",'--no-access-log') $ApiPort
Start-MasarProcess 'worker' $python @('-m','backend.workers.indexer')
$node=(Get-Command node).Source
Start-MasarProcess 'frontend' $node @('scripts/run.mjs','dev','--port',"$FrontendPort") $FrontendPort
$started | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $logRoot "$stamp-processes.json") -Encoding UTF8
$reachable=$false
for($attempt=0;$attempt -lt 20;$attempt++){
  try {$health=Invoke-RestMethod -Uri "http://127.0.0.1:$ApiPort/api/v1/health" -TimeoutSec 2;if($health.synthetic_only -eq $true){$reachable=$true;break}}
  catch {}
  Start-Sleep -Milliseconds 250
}
if(-not $reachable){throw 'MASAR API did not become ready. Inspect .tmp/services logs; existing unrelated processes were left untouched.'}
Write-Host "MASAR local: http://127.0.0.1:$FrontendPort/ | AI_MODE=$AiMode | logs: .tmp/services"
Write-Host 'No deployment performed. Model endpoints remain private to the backend.'
