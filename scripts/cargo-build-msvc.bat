@echo off
setlocal
call "C:\Program Files\Microsoft Visual Studio\2022\Community\VC\Auxiliary\Build\vcvars64.bat" >nul
set "PATH=%USERPROFILE%\.cargo\bin;%PATH%"
cd /d "C:\Users\Grinf\Desktop\desktop-calendar-widget\src-tauri"
cargo build %*
exit /b %ERRORLEVEL%
