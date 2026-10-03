# Publica el proyecto en un repositorio PRIVADO de GitHub.
# Uso (PowerShell, desde la carpeta hikariro-companion):
#   powershell -ExecutionPolicy Bypass -File .\scripts\publicar-en-github.ps1
# Se puede volver a ejecutar: si el repositorio ya existe, solo sube los cambios.

param(
  [string]$RepoName = 'hikariro-companion'
)

$ErrorActionPreference = 'Stop'
Set-Location (Split-Path -Parent $PSScriptRoot)

function Paso($texto) { Write-Host "`n==> $texto" -ForegroundColor Yellow }
function Falla($texto) { Write-Host "`nERROR: $texto" -ForegroundColor Red; exit 1 }
# Ejecuta un comando en silencio y devuelve si terminó bien (sin cortar el script).
function Prueba {
  $previo = $ErrorActionPreference
  $ErrorActionPreference = 'Continue'
  & $args[0] $args[1..($args.Length - 1)] *> $null
  $ok = $LASTEXITCODE -eq 0
  $ErrorActionPreference = $previo
  return $ok
}
function Ejecuta {
  & $args[0] $args[1..($args.Length - 1)]
  if ($LASTEXITCODE -ne 0) { Falla "Falló: $($args -join ' ')" }
}

# ─── Herramientas ───────────────────────────────────────────────────────────
Paso 'Comprobando Git y GitHub CLI'
if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
  Falla 'Git no está instalado. Instálalo con:  winget install --id Git.Git -e   y vuelve a abrir PowerShell.'
}
if (-not (Get-Command gh -ErrorAction SilentlyContinue)) {
  Write-Host 'Instalando GitHub CLI con winget...'
  winget install --id GitHub.cli -e --accept-source-agreements --accept-package-agreements
  $env:Path = [Environment]::GetEnvironmentVariable('Path', 'Machine') + ';' + [Environment]::GetEnvironmentVariable('Path', 'User')
  if (-not (Get-Command gh -ErrorAction SilentlyContinue)) {
    Falla 'No se encontró gh tras instalarlo. Cierra y abre PowerShell y ejecuta de nuevo el script.'
  }
}

# ─── Sesión en GitHub (la haces tú en el navegador) ────────────────────────
Paso 'Comprobando la sesión de GitHub'
if (-not (Prueba gh auth status)) {
  Write-Host 'Se abrirá el navegador: copia el código que aparece aquí y autoriza GitHub CLI.'
  Ejecuta gh auth login --hostname github.com --git-protocol https --web --scopes 'repo,workflow'
}
Ejecuta gh auth setup-git
$usuario = (gh api user --jq .login).Trim()
Write-Host "Conectado como $usuario"

# ─── Repositorio local ─────────────────────────────────────────────────────
Paso 'Preparando el repositorio local'
if (-not (Test-Path .git)) { Ejecuta git init -b main }
Ejecuta git config core.autocrlf true

if (-not (git config user.name)) {
  $nombre = Read-Host 'Nombre para los commits'
  Ejecuta git config user.name $nombre
}
if (-not (git config user.email)) {
  Write-Host "Puedes usar el correo privado de GitHub: $usuario@users.noreply.github.com"
  $correo = Read-Host 'Correo para los commits'
  Ejecuta git config user.email $correo
}

# ─── Comprobación de secretos ──────────────────────────────────────────────
Paso 'Comprobando que no se suben secretos'
Ejecuta git add -A
$prohibidos = git diff --cached --name-only | Where-Object { $_ -match '(^|/)\.env($|\.)' -and $_ -notmatch '\.env\.example$' }
if ($prohibidos) {
  git reset -q
  Falla "Estos archivos con secretos iban a subirse y se han parado: $($prohibidos -join ', ')"
}
Write-Host '.env queda fuera del repositorio.'

# ─── Commit ────────────────────────────────────────────────────────────────
git diff --cached --quiet
if ($LASTEXITCODE -ne 0) {
  Paso 'Creando el commit'
  Ejecuta git commit -m 'HikariRO Companion'
} else {
  Write-Host 'No hay cambios nuevos que guardar.'
}

# ─── Repositorio en GitHub ─────────────────────────────────────────────────
Paso "Publicando en github.com/$usuario/$RepoName (privado)"
if (-not (Prueba gh repo view "$usuario/$RepoName")) {
  Ejecuta gh repo create $RepoName --private --source . --remote origin --push --description 'Companion web no oficial para HikariRO'
} else {
  if (-not (git remote | Select-String -Quiet '^origin$')) {
    Ejecuta git remote add origin "https://github.com/$usuario/$RepoName.git"
  }
  Ejecuta git push -u origin main
}

Paso 'Listo'
Write-Host "Repositorio: https://github.com/$usuario/$RepoName"
Write-Host 'La CI (tests, e2e y build de Docker) ya se está ejecutando en la pestaña Actions:'
Write-Host "  https://github.com/$usuario/$RepoName/actions"
Write-Host "`nPara subir cambios más adelante:  git add -A ; git commit -m 'mensaje' ; git push"
