$ErrorActionPreference = "Continue"

Write-Host "OptiMe pnpm environment diagnostics"
Write-Host "=================================="

Write-Host ""
Write-Host "Node version:"
node --version

Write-Host ""
Write-Host "pnpm version:"
pnpm --version

Write-Host ""
Write-Host "pnpm path:"
where.exe pnpm

$userPnpm = Join-Path $env:APPDATA "npm\pnpm.cmd"
if (Test-Path -LiteralPath $userPnpm) {
  Write-Host ""
  Write-Host "User pnpm version:"
  & $userPnpm --version

  Write-Host ""
  Write-Host "User pnpm store path:"
  & $userPnpm store path
}

Write-Host ""
Write-Host "pnpm store path:"
pnpm store path

Write-Host ""
Write-Host "Root packageManager:"
$packageJson = Get-Content -Raw -LiteralPath "package.json" | ConvertFrom-Json
$packageJson.packageManager

Write-Host ""
Write-Host "CI environment value:"
if ($env:CI) { $env:CI } else { "(not set)" }

Write-Host ""
Write-Host "Project-local .pnpm-store exists:"
Test-Path -LiteralPath ".pnpm-store"

Write-Host ""
Write-Host "Git status summary:"
git status --short
