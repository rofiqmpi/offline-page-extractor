[CmdletBinding()]
param(
  [string]$TargetUrl = "about:blank",
  [ValidateSet("Visual", "Clean")]
  [string]$Mode = "Visual",
  [string]$InstallDir = "$HOME\offline-page-extractor",
  [string]$ProfileDir = "$HOME\.offline-page-extractor-browser"
)

$ErrorActionPreference = "Stop"
$RepoUrl = "https://github.com/rofiqmpi/p2z.git"

if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
  throw "Git was not found. Install Git for Windows first."
}

if (Test-Path (Join-Path $InstallDir ".git")) {
  git -C $InstallDir pull --ff-only origin main
} else {
  if (Test-Path $InstallDir) { Remove-Item -Recurse -Force $InstallDir }
  git clone $RepoUrl $InstallDir
}

$browserCandidates = @(
  "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
  "$env:ProgramFiles(x86)\Google\Chrome\Application\chrome.exe",
  "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe",
  "$env:ProgramFiles(x86)\Microsoft\Edge\Application\msedge.exe",
  "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe",
  "$env:LOCALAPPDATA\Microsoft\Edge\Application\msedge.exe",
  "$env:ProgramFiles\BraveSoftware\Brave-Browser\Application\brave.exe",
  "$env:LOCALAPPDATA\BraveSoftware\Brave-Browser\Application\brave.exe"
)
$Browser = $browserCandidates | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $Browser) {
  throw "Chrome, Edge, or Brave was not found. Install one Chromium-based browser first."
}

New-Item -ItemType Directory -Force -Path $ProfileDir | Out-Null
$arguments = @(
  "--user-data-dir=$ProfileDir",
  "--load-extension=$InstallDir",
  "--new-window",
  $TargetUrl
)

Write-Host "Launching: $Browser"
Write-Host "Extension: $InstallDir"
Write-Host "Target: $TargetUrl"
Write-Host "Mode: $Mode (choose the matching button in the extension popup)"
Start-Process -FilePath $Browser -ArgumentList $arguments
