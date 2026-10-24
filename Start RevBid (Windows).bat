@echo off
cd /d "%~dp0"
where node >nul 2>nul || (echo RevBid needs Node.js. Install the LTS version from nodejs.org, then run this again. & start https://nodejs.org/en/download & pause & exit /b 1)
echo Starting RevBid. Leave this window open while you use the site.
start "" cmd /c "timeout /t 2 >nul & start http://localhost:3000"
node --disable-warning=ExperimentalWarning src/server.ts
pause
