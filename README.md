<div align="center">

# CanDo · 蚕豆

**Put your calendar and todos gently on the desktop.**

<br />

[![Version](https://img.shields.io/badge/version-0.1.1-blue?style=flat-square)](./src/lib/version.ts)
[![Platform](https://img.shields.io/badge/platform-Windows-0078D6?style=flat-square)](#)
[![GitHub](https://img.shields.io/badge/GitHub-Grinfly%2Fdesktop--calendar--widget-181717?style=flat-square&logo=github)](https://github.com/Grinfly/desktop-calendar-widget)
[![Tauri](https://img.shields.io/badge/Tauri-2-FFC131?style=flat-square&logo=tauri&logoColor=black)](https://tauri.app)
[![React](https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react&logoColor=black)](https://react.dev)

**English** | **[简体中文](./README.zh-CN.md)**

</div>

---

**CanDo（蚕豆）** is a lightweight Windows desktop widget that combines a calendar with a daily todo list. The name plays on *Calendar + Todo* — and sounds like *Can Do* in Chinese (*candou*, broad bean).

Small, translucent, and pin-able — see the date, lunar calendar, and what you need to do today at a glance.

## Features

| Module | Description |
|--------|-------------|
| Month view | Gregorian calendar with lunar date, solar terms, and festivals |
| Task progress | Colored bar under lunar text: yellow = pending, green = done, split by ratio |
| Daily todos | Add, check off, edit, delete; row colors and expandable long text |
| Pin modes | Floating (always on top) / Desktop (release always-on-top) |
| Transparency | Adjustable background opacity 20%–100% in Settings |
| System tray | Show / hide, switch pin mode, quit |
| Local storage | Data saved to `%APPDATA%/desktop-calendar-widget/data.json` |

## Screenshots

<p align="center">
  <table>
    <tr>
      <td align="center"><img src="docs/screenshots/calendar.png" alt="Calendar view" width="240" /></td>
      <td align="center"><img src="docs/screenshots/tasks-color.png" alt="Task list with color picker" width="240" /></td>
      <td align="center"><img src="docs/screenshots/tasks-empty.png" alt="Empty task list" width="240" /></td>
    </tr>
  </table>
</p>

<p align="center">
  <sub>Month view · Daily todos with row colors · Add a new task</sub>
</p>

## Requirements

- Windows 10 / 11
- Node.js 18+
- Rust (MSVC toolchain)
- Visual Studio 2022 C++ Build Tools
- Windows 10 SDK
- WebView2 (usually pre-installed)

## Development

```bash
git clone https://github.com/Grinfly/desktop-calendar-widget.git
cd desktop-calendar-widget
npm install
npm run tauri dev
```

If linking fails under Git Bash, use:

```bash
scripts/build-windows.bat
```

## Build

```bash
scripts/build-windows.bat
```

Installer output: `src-tauri/target/release/bundle/`

## Tech Stack

- **Frontend**: React 19 · TypeScript · Vite
- **Desktop**: Tauri 2
- **Calendar**: date-fns · lunar-javascript (lunar / solar terms / festivals)

## Branding

App icon and brand board live in [`branding/`](./branding/).

---

<div align="center">

**CanDo · 蚕豆** — Stay light. Stay on top of your day.

</div>
