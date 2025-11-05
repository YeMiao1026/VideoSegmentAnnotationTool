# One-click local start for Windows (PowerShell)
# - Opens two PowerShell windows: backend (Flask) and frontend (Vite)
# - If Python venv or node_modules missing, will attempt to create/install them
# Usage: Right-click -> Run with PowerShell, or open PowerShell and run `./start-local.ps1`

$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Definition
Write-Host "Starting local dev environment from: $scriptRoot"

function Check-Command($name) {
    $null -ne (Get-Command $name -ErrorAction SilentlyContinue)
}

# quick checks
$hasPython = Check-Command python
$hasNode = Check-Command node
$hasNpm = Check-Command npm
$hasFFmpeg = Check-Command ffmpeg

if (-not $hasPython) { Write-Warning "Python not found in PATH. Backend requires Python. Please install Python 3.8+ and try again." }
if (-not $hasNode) { Write-Warning "Node.js not found in PATH. Frontend requires Node.js. Please install Node.js and try again." }
if (-not $hasNpm) { Write-Warning "npm not found in PATH. Please ensure Node.js installation includes npm." }
if (-not $hasFFmpeg) { Write-Warning "ffmpeg not found in PATH. The backend uses ffmpeg to cut clips. Please install ffmpeg and ensure it's in PATH." }

# Backend command
$backendDir = Join-Path $scriptRoot 'backend'
$backendCmd = @"
cd '$backendDir'
if (-not (Test-Path '.venv')) {
  Write-Host 'Creating virtual environment and installing Python requirements...'
  python -m venv .venv
  .\.venv\Scripts\Activate.ps1
  pip install -r requirements.txt
}
Write-Host 'Activating venv and starting backend (Flask)...'
.\.venv\Scripts\Activate.ps1
$env:FLASK_APP='app.py'
$env:FLASK_ENV='development'
flask run --host=127.0.0.1 --port=5000
"@

# Frontend command
$frontendDir = Join-Path $scriptRoot 'frontend'
$frontendCmd = @"
cd '$frontendDir'
if (-not (Test-Path 'node_modules')) {
  Write-Host 'Installing frontend dependencies...'
  npm install
}
Write-Host 'Starting frontend dev server (Vite)...'
npm run dev
"@

# Launch two separate PowerShell windows
Write-Host 'Launching backend window...'
Start-Process -FilePath powershell -ArgumentList '-NoExit', '-Command', $backendCmd
Start-Sleep -Milliseconds 400
Write-Host 'Launching frontend window...'
Start-Process -FilePath powershell -ArgumentList '-NoExit', '-Command', $frontendCmd

Write-Host 'Done. Two windows opened: backend and frontend. Close them to stop the servers.'
