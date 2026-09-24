use std::path::{Path, PathBuf};

use serde::Serialize;

const CREAM: (u8, u8, u8) = (247, 243, 236);
const BORDER: (u8, u8, u8) = (229, 223, 212);

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct WallpaperTheme {
    pub bg_rgb: String,
    pub accent: String,
    pub muted: String,
    pub sub_label: String,
    pub border: String,
}

fn mix(a: u8, b: u8, t: f32) -> u8 {
    (f32::from(a) + (f32::from(b) - f32::from(a)) * t).round() as u8
}

fn mix_rgb(a: (u8, u8, u8), b: (u8, u8, u8), t: f32) -> (u8, u8, u8) {
    (mix(a.0, b.0, t), mix(a.1, b.1, t), mix(a.2, b.2, t))
}

fn hex(rgb: (u8, u8, u8)) -> String {
    format!("#{:02x}{:02x}{:02x}", rgb.0, rgb.1, rgb.2)
}

fn rgb_to_hsl(r: u8, g: u8, b: u8) -> (f32, f32, f32) {
    let r = f32::from(r) / 255.0;
    let g = f32::from(g) / 255.0;
    let b = f32::from(b) / 255.0;
    let max = r.max(g).max(b);
    let min = r.min(g).min(b);
    let l = (max + min) / 2.0;
    let d = max - min;
    if d < f32::EPSILON {
        return (0.0, 0.0, l);
    }
    let s = d / (1.0 - (2.0 * l - 1.0).abs());
    let h = if (max - r).abs() < f32::EPSILON {
        ((g - b) / d + if g < b { 6.0 } else { 0.0 }) / 6.0
    } else if (max - g).abs() < f32::EPSILON {
        ((b - r) / d + 2.0) / 6.0
    } else {
        ((r - g) / d + 4.0) / 6.0
    };
    (h, s, l)
}

fn hue_to_rgb(p: f32, q: f32, mut t: f32) -> f32 {
    if t < 0.0 {
        t += 1.0;
    }
    if t > 1.0 {
        t -= 1.0;
    }
    if t < 1.0 / 6.0 {
        return p + (q - p) * 6.0 * t;
    }
    if t < 1.0 / 2.0 {
        return q;
    }
    if t < 2.0 / 3.0 {
        return p + (q - p) * (2.0 / 3.0 - t) * 6.0;
    }
    p
}

fn hsl_to_rgb(h: f32, s: f32, l: f32) -> (u8, u8, u8) {
    if s < f32::EPSILON {
        let v = (l * 255.0).round() as u8;
        return (v, v, v);
    }
    let q = if l < 0.5 { l * (1.0 + s) } else { l + s - l * s };
    let p = 2.0 * l - q;
    let r = hue_to_rgb(p, q, h + 1.0 / 3.0);
    let g = hue_to_rgb(p, q, h);
    let b = hue_to_rgb(p, q, h - 1.0 / 3.0);
    (
        (r * 255.0).round() as u8,
        (g * 255.0).round() as u8,
        (b * 255.0).round() as u8,
    )
}

pub fn theme_from_average(r: u8, g: u8, b: u8) -> WallpaperTheme {
    let (h, s, _) = rgb_to_hsl(r, g, b);
    let accent_s = (s * 0.55 + 0.30).clamp(0.28, 0.72);
    let muted_s = (s * 0.25 + 0.08).clamp(0.10, 0.36);
    let accent = if s < 0.07 {
        (196, 92, 62)
    } else {
        hsl_to_rgb(h, accent_s, 0.44)
    };
    let muted = if s < 0.07 {
        (122, 116, 104)
    } else {
        hsl_to_rgb(h, muted_s, 0.46)
    };
    let sub = if s < 0.07 {
        (154, 125, 104)
    } else {
        hsl_to_rgb(h, muted_s + 0.06, 0.48)
    };
    let bg = mix_rgb(CREAM, (r, g, b), 0.16);
    let border = mix_rgb(BORDER, (r, g, b), 0.12);
    WallpaperTheme {
        bg_rgb: format!("{}, {}, {}", bg.0, bg.1, bg.2),
        accent: hex(accent),
        muted: hex(muted),
        sub_label: hex(sub),
        border: hex(border),
    }
}

fn average_color(path: &Path) -> Result<(u8, u8, u8), String> {
    let bytes = std::fs::read(path).map_err(|e| e.to_string())?;
    let image = image::load_from_memory(&bytes)
        .or_else(|_| image::open(path))
        .map_err(|e| e.to_string())?
        .resize(48, 48, image::imageops::FilterType::Triangle)
        .to_rgb8();
    let mut r = 0u64;
    let mut g = 0u64;
    let mut b = 0u64;
    let mut n = 0u64;
    for pixel in image.pixels() {
        r += u64::from(pixel[0]);
        g += u64::from(pixel[1]);
        b += u64::from(pixel[2]);
        n += 1;
    }
    if n == 0 {
        return Err("壁纸为空".into());
    }
    Ok(((r / n) as u8, (g / n) as u8, (b / n) as u8))
}

fn transcoded_wallpaper() -> Option<PathBuf> {
    let roaming = dirs::config_dir()?;
    let path = roaming
        .join("Microsoft")
        .join("Windows")
        .join("Themes")
        .join("TranscodedWallpaper");
    path.exists().then_some(path)
}

fn file_mtime_ms(path: &Path) -> Option<u64> {
    let meta = std::fs::metadata(path).ok()?;
    let modified = meta.modified().ok()?;
    Some(
        modified
            .duration_since(std::time::UNIX_EPOCH)
            .ok()?
            .as_millis() as u64,
    )
}

fn spi_wallpaper_path() -> Option<PathBuf> {
    #[cfg(windows)]
    {
        use windows::Win32::UI::WindowsAndMessaging::{
            SystemParametersInfoW, SPI_GETDESKWALLPAPER, SYSTEM_PARAMETERS_INFO_UPDATE_FLAGS,
        };

        let mut buf = [0u16; 260];
        let ok = unsafe {
            SystemParametersInfoW(
                SPI_GETDESKWALLPAPER,
                buf.len() as u32,
                Some(buf.as_mut_ptr().cast()),
                SYSTEM_PARAMETERS_INFO_UPDATE_FLAGS(0),
            )
        };
        if ok.is_err() {
            return None;
        }
        let len = buf.iter().position(|&c| c == 0).unwrap_or(buf.len());
        if len == 0 {
            return None;
        }
        let path = PathBuf::from(String::from_utf16_lossy(&buf[..len]));
        return path.exists().then_some(path);
    }
    #[cfg(not(windows))]
    {
        None
    }
}

fn wallpaper_candidates() -> Vec<PathBuf> {
    let mut paths = Vec::new();
    if let Some(path) = transcoded_wallpaper() {
        paths.push(path);
    }
    if let Some(path) = spi_wallpaper_path() {
        if !paths.iter().any(|existing| existing == &path) {
            paths.push(path);
        }
    }
    paths
}

fn desktop_wallpaper_path() -> Option<PathBuf> {
    wallpaper_candidates()
        .into_iter()
        .max_by_key(|path| file_mtime_ms(path).unwrap_or(0))
}

fn source_revision() -> u64 {
    let mut revision = 0u64;
    for path in wallpaper_candidates() {
        let Ok(meta) = std::fs::metadata(&path) else {
            continue;
        };
        let time = file_mtime_ms(&path).unwrap_or(0);
        revision ^= time.wrapping_mul(0x9E37) ^ meta.len();
        for byte in path.to_string_lossy().as_bytes() {
            revision = revision.wrapping_mul(16777619) ^ u64::from(*byte);
        }
    }
    revision
}

#[tauri::command]
pub fn sample_wallpaper_theme() -> Option<WallpaperTheme> {
    let path = desktop_wallpaper_path()?;
    let (r, g, b) = average_color(&path).ok()?;
    Some(theme_from_average(r, g, b))
}

#[tauri::command]
pub fn wallpaper_source_revision() -> u32 {
    source_revision() as u32
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn gray_wallpaper_keeps_default_accent() {
        let theme = theme_from_average(128, 128, 128);
        assert_eq!(theme.accent, "#c45c3e");
    }

    #[test]
    fn blue_wallpaper_tints_accent() {
        let theme = theme_from_average(60, 110, 180);
        assert_ne!(theme.accent, "#c45c3e");
        assert!(theme.bg_rgb.starts_with("2"));
    }
}
