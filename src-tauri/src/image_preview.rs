use std::sync::Mutex;

use serde::Serialize;
use tauri::{
    LogicalSize, Manager, PhysicalPosition, WebviewUrl, WebviewWindow, WebviewWindowBuilder,
};

pub const LABEL: &str = "task-image-preview";
const MIN_WIDTH: f64 = 240.0;
const MIN_HEIGHT: f64 = 150.0;
const TOOLBAR_HEIGHT: f64 = 48.0;
const FRAME_PADDING: f64 = 24.0;
static PREVIEW: Mutex<Option<Preview>> = Mutex::new(None);

struct Preview {
    images: Vec<String>,
    initial_index: usize,
}

#[derive(Serialize)]
pub struct PreviewImage {
    src: String,
    index: usize,
    count: usize,
}

pub fn clear() {
    if let Ok(mut preview) = PREVIEW.lock() {
        *preview = None;
    }
}

#[tauri::command]
pub fn load_task_image_preview(
    window: WebviewWindow,
    index: Option<usize>,
) -> Result<PreviewImage, String> {
    if window.label() != LABEL {
        return Err("图片预览只在预览窗口可用".into());
    }
    let preview = PREVIEW.lock().map_err(|err| err.to_string())?;
    let preview = preview.as_ref().ok_or("图片预览已关闭")?;
    let index = index.unwrap_or(preview.initial_index);
    let image = preview.images.get(index).ok_or("找不到这张图片")?;
    Ok(PreviewImage {
        src: image.clone(),
        index,
        count: preview.images.len(),
    })
}

fn fit_preview_size(image: LogicalSize<f64>, limit: LogicalSize<f64>) -> LogicalSize<f64> {
    let scale = ((limit.width - FRAME_PADDING).max(1.0) / image.width)
        .min((limit.height - TOOLBAR_HEIGHT - FRAME_PADDING).max(1.0) / image.height)
        .min(1.0);
    LogicalSize::new(
        ((image.width * scale).ceil() + FRAME_PADDING).max(MIN_WIDTH),
        ((image.height * scale).ceil() + FRAME_PADDING + TOOLBAR_HEIGHT).max(MIN_HEIGHT),
    )
}

fn valid_image(image: &str) -> bool {
    const MAX_DATA_URL_LENGTH: usize = 4 * (5 * 1024 * 1024_usize).div_ceil(3) + 32;
    image.len() <= MAX_DATA_URL_LENGTH
        && image.split_once(";base64,").is_some_and(|(prefix, body)| {
            matches!(
                prefix,
                "data:image/png"
                    | "data:image/jpeg"
                    | "data:image/gif"
                    | "data:image/webp"
                    | "data:image/bmp"
                    | "data:image/avif"
            ) && !body.is_empty()
                && body
                    .bytes()
                    .all(|byte| byte.is_ascii_alphanumeric() || matches!(byte, b'+' | b'/' | b'='))
        })
}

#[tauri::command]
pub async fn open_task_image_preview(
    window: WebviewWindow,
    images: Vec<String>,
    index: usize,
    image_width: u32,
    image_height: u32,
) -> Result<(), String> {
    if window.label() != "main" {
        return Err("请从待办详情打开图片预览".into());
    }
    if image_width == 0
        || image_height == 0
        || index >= images.len()
        || !images.iter().all(|image| valid_image(image))
    {
        return Err("无效的图片数据".into());
    }

    *PREVIEW.lock().map_err(|err| err.to_string())? = Some(Preview {
        images,
        initial_index: index,
    });
    let app = window.app_handle();
    let result = (|| -> tauri::Result<()> {
        let monitor = window.current_monitor()?.or(window.primary_monitor()?);
        let limit = monitor
            .as_ref()
            .map_or(LogicalSize::new(1200.0, 800.0), |monitor| {
                let area = monitor
                    .work_area()
                    .size
                    .to_logical::<f64>(monitor.scale_factor());
                LogicalSize::new(area.width * 0.9, area.height * 0.9)
            });
        let preferred = fit_preview_size(
            LogicalSize::new(f64::from(image_width), f64::from(image_height)),
            limit,
        );
        let existing = app.get_webview_window(LABEL);
        let reused = existing.is_some();
        let preview = if let Some(preview) = existing {
            preview.unminimize()?;
            if preview.is_maximized()? {
                preview.unmaximize()?;
            }
            preview
        } else {
            WebviewWindowBuilder::new(
                app,
                LABEL,
                WebviewUrl::App("index.html#image-preview".into()),
            )
            .title("蚕豆 · 图片预览")
            .inner_size(preferred.width, preferred.height)
            .min_inner_size(MIN_WIDTH, MIN_HEIGHT)
            .always_on_top(true)
            .visible(false)
            .build()?
        };

        if let Some(monitor) = monitor {
            let area = monitor.work_area();
            let size = preferred.to_physical::<u32>(monitor.scale_factor());
            preview.set_position(PhysicalPosition::new(
                area.position.x + (area.size.width.saturating_sub(size.width) / 2) as i32,
                area.position.y + (area.size.height.saturating_sub(size.height) / 2) as i32,
            ))?;
            preview.set_size(size)?;
        } else {
            preview.set_size(preferred)?;
            preview.center()?;
        }
        if reused {
            preview.eval("location.reload()")?;
        }
        preview.show()?;
        preview.set_focus()
    })();
    if result.is_err() {
        clear();
    }
    result.map_err(|err| err.to_string())
}
