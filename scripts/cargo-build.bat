@echo off
setlocal EnableExtensions
set "RUST_GNU_BIN=%USERPROFILE%\.rustup\toolchains\stable-x86_64-pc-windows-gnu\lib\rustlib\x86_64-pc-windows-gnu\bin\self-contained"
set "PATH=%USERPROFILE%\.cargo\bin;%RUST_GNU_BIN%;C:\Program Files\Git\mingw64\bin;C:\Windows\system32;C:\Windows;C:\Windows\System32\Wbem"
cd /d "C:\Users\Grinf\Desktop\desktop-calendar-widget\src-tauri"
echo Starting cargo build (gnu toolchain)... > "C:\Users\Grinf\Desktop\desktop-calendar-widget\build.log"
where cargo >> "C:\Users\Grinf\Desktop\desktop-calendar-widget\build.log" 2>&1
where dlltool >> "C:\Users\Grinf\Desktop\desktop-calendar-widget\build.log" 2>&1
rustc -vV >> "C:\Users\Grinf\Desktop\desktop-calendar-widget\build.log" 2>&1
cargo build >> "C:\Users\Grinf\Desktop\desktop-calendar-widget\build.log" 2>&1
echo EXIT_CODE=%ERRORLEVEL% >> "C:\Users\Grinf\Desktop\desktop-calendar-widget\build.log"
exit /b %ERRORLEVEL%
