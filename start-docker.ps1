# One-click Docker start for Windows
# - Requires Docker Desktop (Docker CLI) to be installed and running
# - If docker-compose.yml exists in the repo root, this script will run `docker-compose up -d --build`
# Usage: ./start-docker.ps1

$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Definition
Write-Host "Docker start helper from: $scriptRoot"

function Check-Command($name) {
    $null -ne (Get-Command $name -ErrorAction SilentlyContinue)
}

if (-not (Check-Command 'docker')) {
    Write-Error "Docker CLI not found. Please install Docker Desktop and ensure 'docker' is available in PATH."
    exit 1
}

$composeFile = Join-Path $scriptRoot 'docker-compose.yml'
if (-not (Test-Path $composeFile)) {
    Write-Warning "No docker-compose.yml found in project root.\nYou can either run the local startup script (start-local.ps1) or create docker-compose.yml.\nIf you want, I can add example Dockerfiles and a compose file to this repo."
    Write-Host "Would you like to run start-local.ps1 instead? (Y/N)"
    $input = Read-Host
    if ($input -match '^[Yy]') {
        & "$scriptRoot\start-local.ps1"
        exit 0
    } else {
        exit 1
    }
}

# run docker-compose
Write-Host 'Running docker-compose up -d --build'
Push-Location $scriptRoot
try {
    docker-compose up -d --build
} catch {
    Write-Error "docker-compose failed: $_"
} finally {
    Pop-Location
}

Write-Host 'If containers started successfully, wait a few seconds and then open the frontend URL shown by your frontend service (or http://localhost:5173 for Vite dev).'
