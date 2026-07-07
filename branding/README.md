# 蚕豆 · 品牌资源

## 概念

- **中文名**：蚕豆
- **英文名**：CanDo（Calendar + Todo，谐音 Can Do / 蚕豆）
- **副标题**：桌面日历待办
- **图标**：蚕豆形轮廓 + 奶油色对勾（Can Do）

## 文件

| 文件 | 用途 |
|------|------|
| `icon-app.svg` | 1024 主图标源文件 |
| `icon-tray.svg` | 64 托盘简化版 |
| `icon-source.png` | 导出用位图源（由脚本生成） |
| `brand-board.html` | 品牌预览板 |

## 从原图生成图标

将 Concept 3 原图保存为 `checkmark-bean-original.png`，或放在下载目录：

```bash
cd desktop-calendar-widget
python branding/crop_icon_from_original.py
```

脚本会：
1. 自动裁剪蚕豆主体（去掉底部文案）
2. 导出 1024×1024 的 `icon-source.png`
3. 生成 `src-tauri/icons/` 全套图标

原图来源：`checkmark-bean-original.png`（Gemini Concept 3）

## 已应用位置

- `tauri.conf.json` → productName / title
- `index.html` → title
- `src-tauri/src/lib.rs` → 托盘 tooltip
