# Sincroniza la wiki del Hub con la wiki online de HikariRO y sube los cambios a GitHub.
# Lo ejecuta la tarea programada de Windows "Hikari Hub - Sincronizar wiki" (ver README.md, apartado Wiki).
# Tiene que salir desde este PC: HikariRO rechaza (403) las peticiones desde los servidores de GitHub.
#
# Solo toca la carpeta wiki/. No hace nada si el repositorio no está en main o si hay commits
# locales sin subir, para no publicar por accidente trabajo a medias.
# Registro: scripts\wiki-sync.log (no se sube a GitHub)

$ErrorActionPreference = 'Stop'
# Los títulos de los artículos llevan acentos: la salida de node y git se lee como UTF-8.
[Console]::OutputEncoding = [Text.Encoding]::UTF8
$started = $false
$repo = Split-Path -Parent $PSScriptRoot
$log = Join-Path $PSScriptRoot 'wiki-sync.log'

function Write-Log([string]$message) {
  $line = '{0}  {1}' -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $message
  Add-Content -Path $log -Value $line -Encoding utf8
  Write-Output $line
}

# Ejecuta un programa y devuelve su salida; falla si el programa termina con error.
function Invoke-Tool([string]$name, [string[]]$arguments) {
  $previous = $ErrorActionPreference
  $ErrorActionPreference = 'Continue'
  try { $output = & $name @arguments 2>&1 | ForEach-Object { "$_" } }
  finally { $ErrorActionPreference = $previous }
  if ($LASTEXITCODE -ne 0) {
    throw "$name $($arguments -join ' ') terminó con código ${LASTEXITCODE}: $(($output | Select-Object -Last 3) -join ' | ')"
  }
  return $output
}

try {
  # El registro no crece sin límite.
  if ((Test-Path $log) -and (Get-Item $log).Length -gt 1MB) {
    Set-Content -Path $log -Value (Get-Content $log -Tail 200) -Encoding utf8
  }
  Set-Location $repo

  $branch = (Invoke-Tool 'git' @('rev-parse', '--abbrev-ref', 'HEAD')) | Select-Object -Last 1
  if ($branch -ne 'main') { Write-Log "Omitido: el repositorio está en la rama '$branch', no en main."; exit 0 }
  if (Invoke-Tool 'git' @('status', '--porcelain', '--', 'wiki')) {
    Write-Log 'Omitido: hay cambios sin subir en wiki/ de una ejecución anterior. Revísalos a mano.'; exit 0
  }

  Invoke-Tool 'git' @('fetch', '--quiet', 'origin', 'main') | Out-Null
  $ahead = (Invoke-Tool 'git' @('rev-list', '--count', 'origin/main..HEAD')) | Select-Object -Last 1
  if ([int]$ahead -gt 0) { Write-Log "Omitido: hay $ahead commits locales sin subir en main."; exit 0 }
  Invoke-Tool 'git' @('pull', '--quiet', '--rebase', '--autostash', 'origin', 'main') | Out-Null

  $started = $true
  # Con WIKI_STRICT la sincronización no escribe nada si la web falla a medias.
  $env:WIKI_STRICT = '1'
  Set-Location (Join-Path $repo 'apps\api')
  $result = (Invoke-Tool 'node' @('node_modules\tsx\dist\cli.mjs', 'scripts\sync-wiki.ts')) | Select-Object -Last 1
  Set-Location $repo

  if (-not (Invoke-Tool 'git' @('status', '--porcelain', '--', 'wiki'))) {
    Write-Log "Sin cambios. $result"; exit 0
  }

  $message = (Invoke-Tool 'node' @('apps\api\scripts\wiki-changes.mjs')) | Select-Object -Last 1
  Invoke-Tool 'git' @('add', '--', 'wiki') | Out-Null
  Invoke-Tool 'git' @('commit', '--quiet', '-m', $message, '-m', 'Sincronización automática con la wiki online de HikariRO.', '--', 'wiki') | Out-Null
  Invoke-Tool 'git' @('push', '--quiet', 'origin', 'main') | Out-Null
  Write-Log "Subido a GitHub. $message"
}
catch {
  Set-Location $repo
  # Si falló a mitad de la descarga, se descarta para que la próxima ejecución empiece limpia.
  if ($started) {
    & git checkout --quiet -- wiki 2>$null
    & git clean -fdq -- wiki 2>$null
  }
  Write-Log "ERROR: $($_.Exception.Message)"
  exit 1
}
