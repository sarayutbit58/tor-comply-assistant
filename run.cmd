@echo off
set "CODEX_PYTHON=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe"
if not exist "%CODEX_PYTHON%" (
  echo Codex Python not found: %CODEX_PYTHON%
  exit /b 1
)
"%CODEX_PYTHON%" "%~dp0app.py"
