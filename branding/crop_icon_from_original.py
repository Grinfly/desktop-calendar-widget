"""从 Concept 3 原图裁剪蚕豆对勾图标，导出 Tauri 所需高清资源。"""

from __future__ import annotations

import shutil
import subprocess
from pathlib import Path

from PIL import Image, ImageChops, ImageStat

ROOT = Path(__file__).resolve().parent
PROJECT = ROOT.parent
ORIGINAL_CANDIDATES = [
    ROOT / "checkmark-bean-original.png",
    Path.home() / "Downloads" / "Gemini_Generated_Image_aaojzsaaojzsaaoj.png",
]
OUT_SOURCE = ROOT / "icon-source.png"
OUT_TRAY = PROJECT / "src-tauri" / "icons" / "tray-32.png"


def find_original() -> Path:
    for path in ORIGINAL_CANDIDATES:
        if path.exists():
            return path
    raise SystemExit(
        "未找到原图。请将 Concept 3 原图保存为 branding/checkmark-bean-original.png"
    )


def background_color(image: Image.Image) -> tuple[int, int, int]:
    corners = [
        image.getpixel((0, 0))[:3],
        image.getpixel((image.width - 1, 0))[:3],
        image.getpixel((0, image.height - 1))[:3],
        image.getpixel((image.width - 1, image.height - 1))[:3],
    ]
    return tuple(int(sum(color[i] for color in corners) / len(corners)) for i in range(3))


def crop_icon_square(image: Image.Image) -> Image.Image:
    rgb = image.convert("RGB")
    bg = Image.new("RGB", rgb.size, background_color(rgb))
    diff = ImageChops.difference(rgb, bg)
    mask = diff.convert("L").point(lambda value: 255 if value > 18 else 0)

    # 只在上部区域找主体，避免底部文案干扰
    top_limit = int(image.height * 0.72)
    upper = mask.crop((0, 0, image.width, top_limit))
    bbox = upper.getbbox()
    if not bbox:
        raise RuntimeError("无法识别图标主体，请检查原图")

    left, top, right, bottom = bbox
    width = right - left
    height = bottom - top
    side = int(max(width, height) * 1.18)
    center_x = (left + right) // 2
    center_y = (top + bottom) // 2

    x0 = max(0, center_x - side // 2)
    y0 = max(0, center_y - side // 2)
    x1 = x0 + side
    y1 = y0 + side

    if x1 > image.width:
        x0 = max(0, image.width - side)
        x1 = image.width
    if y1 > image.height:
        y0 = max(0, image.height - side)
        y1 = image.height

    side = min(x1 - x0, y1 - y0)
    cropped = image.crop((x0, y0, x0 + side, y0 + side))
    return cropped.resize((1024, 1024), Image.Resampling.LANCZOS)


def export_tray(source: Image.Image) -> None:
    tray = source.resize((32, 32), Image.Resampling.LANCZOS)
    OUT_TRAY.parent.mkdir(parents=True, exist_ok=True)
    tray.save(OUT_TRAY, format="PNG", optimize=True)


def run_tauri_icon() -> None:
    subprocess.run(
        "npm run tauri icon branding/icon-source.png",
        cwd=PROJECT,
        check=True,
        shell=True,
    )


def main() -> None:
    original = find_original()
    stored = ROOT / "checkmark-bean-original.png"
    if original != stored:
        shutil.copy2(original, stored)

    image = Image.open(stored).convert("RGBA")
    icon = crop_icon_square(image)
    icon.save(OUT_SOURCE, format="PNG", optimize=True)
    export_tray(icon)

    favicon = PROJECT / "public" / "favicon.png"
    shutil.copy2(OUT_SOURCE, favicon)

    run_tauri_icon()
    print(f"原图: {stored}")
    print(f"已导出: {OUT_SOURCE} (1024x1024)")
    print(f"已导出: {OUT_TRAY}")
    print("已生成 src-tauri/icons/ 全套图标")


if __name__ == "__main__":
    main()
