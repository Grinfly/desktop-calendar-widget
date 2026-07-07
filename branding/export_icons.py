"""从 icon-app.svg 导出 icon-source.png，供 tauri icon 使用。"""

from pathlib import Path
import subprocess
import sys

ROOT = Path(__file__).resolve().parent
SVG = ROOT / "icon-app.svg"
OUT = ROOT / "icon-source.png"


def export_with_resvg() -> None:
    subprocess.run(
        [
            "npx",
            "--yes",
            "@resvg/resvg-js-cli",
            str(SVG),
            str(OUT),
            "--fit-width",
            "1024",
        ],
        check=True,
    )


def export_with_cairosvg() -> None:
    import cairosvg

    OUT.write_bytes(
        cairosvg.svg2png(url=str(SVG), output_width=1024, output_height=1024)
    )


def main() -> None:
    try:
        export_with_resvg()
    except (subprocess.CalledProcessError, FileNotFoundError):
        try:
            export_with_cairosvg()
        except ImportError as exc:
            raise SystemExit(
                "请安装 Node 后运行本脚本，或：pip install cairosvg（需 cairo 库）\n"
                "也可手动将 icon-app.svg 导出为 1024x1024 PNG 保存为 icon-source.png"
            ) from exc

    print(f"已生成 {OUT}")


if __name__ == "__main__":
    main()
