@echo off
title Cobro Textile FX - Local Web Server
echo Starting Cobro Textile Pay on http://localhost:8080 ...
echo This allows all browser wallet extensions (MetaMask, Rabby, Coinbase) to inject automatically!
echo.
powershell -ExecutionPolicy Bypass -File "%~dp0start-server.ps1"
pause
