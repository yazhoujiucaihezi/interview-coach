@echo off
chcp 65001 >nul
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js not found. Install Node 18+ from https://nodejs.org
  pause
  exit /b 1
)
echo Starting local proxy ...
node proxy.mjs %*
pause
