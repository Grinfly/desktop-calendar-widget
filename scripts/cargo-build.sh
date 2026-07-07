#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
LOG="$ROOT/build.log"
VCVARS="/c/Program Files/Microsoft Visual Studio/2022/Community/VC/Auxiliary/Build/vcvars64.bat"

export PATH="$HOME/.cargo/bin:$PATH"
export PATH="$(echo "$PATH" | tr ':' '\n' | grep -vi 'git/usr/bin' | grep -vi '^/usr/bin$' | tr '\n' ':' | sed 's/:$//')"

cd "$ROOT/src-tauri"

MSYS_NO_PATHCONV=1 cmd.exe //c "\"${VCVARS}\" && cd /d C:\\Users\\Grinf\\Desktop\\desktop-calendar-widget\\src-tauri && cargo build $*\"" >"$LOG" 2>&1 || {
  echo "BUILD_FAILED" >>"$LOG"
  exit 1
}

echo "BUILD_OK" >>"$LOG"
echo "Build finished. See build.log"
