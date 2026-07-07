mod storage;

use serde::Deserialize;
use tauri::{
    image::Image,
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Manager, PhysicalPosition, PhysicalSize, WindowEvent,
};

#[derive(Debug, Deserialize)]
struct Size {
    width: u32,
    height: u32,
}

impl Default for Size {
    fn default() -> Self {
        Self {
            width: 300,
            height: 360,
        }
    }
}

#[derive(Debug, Deserialize)]
struct Settings {
    #[serde(rename = "pinMode")]
    pin_mode: String,
    position: Position,
    #[serde(default)]
    size: Size,
}

#[derive(Debug, Deserialize)]
struct Position {
    x: i32,
    y: i32,
}

#[derive(Debug, Deserialize)]
struct AppData {
    settings: Settings,
}

fn apply_pin_mode(window: &tauri::WebviewWindow, mode: &str) -> Result<(), String> {
    let floating = mode != "desktop";
    let current = window.is_always_on_top().map_err(|e| e.to_string())?;

    if current == floating {
        return Ok(());
    }

    window
        .set_always_on_top(floating)
        .map_err(|e| e.to_string())
}

fn restore_window_state(app: &tauri::AppHandle) -> Result<(), String> {
    let window = app
        .get_webview_window("main")
        .ok_or("找不到主窗口")?;

    let raw = storage::load_data()?;
    let data: AppData = serde_json::from_str(&raw).map_err(|e| e.to_string())?;

    let _ = window.set_position(PhysicalPosition::new(
        data.settings.position.x,
        data.settings.position.y,
    ));
    let _ = window.set_size(PhysicalSize::new(
        data.settings.size.width,
        data.settings.size.height,
    ));
    apply_pin_mode(&window, &data.settings.pin_mode)?;

    Ok(())
}

#[tauri::command]
fn load_data() -> Result<String, String> {
    storage::load_data()
}

#[tauri::command]
fn save_data(json: String) -> Result<(), String> {
    storage::save_data(json)
}

#[tauri::command]
async fn set_pin_mode(window: tauri::WebviewWindow, mode: String) -> Result<(), String> {
    apply_pin_mode(&window, &mode)
}

#[tauri::command]
async fn save_window_bounds(window: tauri::WebviewWindow) -> Result<(), String> {
    let position = window.outer_position().map_err(|e| e.to_string())?;
    let size = window.outer_size().map_err(|e| e.to_string())?;
    let raw = storage::load_data()?;
    let mut value: serde_json::Value =
        serde_json::from_str(&raw).map_err(|e| e.to_string())?;

    if let Some(settings) = value.get_mut("settings") {
        settings["position"] = serde_json::json!({
            "x": position.x,
            "y": position.y
        });
        settings["size"] = serde_json::json!({
            "width": size.width,
            "height": size.height
        });
    }

    storage::save_data(serde_json::to_string_pretty(&value).map_err(|e| e.to_string())?)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            load_data,
            save_data,
            set_pin_mode,
            save_window_bounds
        ])
        .setup(|app| {
            let show_item = MenuItem::with_id(app, "show", "显示窗口", true, None::<&str>)?;
            let hide_item = MenuItem::with_id(app, "hide", "隐藏窗口", true, None::<&str>)?;
            let pin_floating =
                MenuItem::with_id(app, "pin_floating", "悬浮置顶", true, None::<&str>)?;
            let pin_desktop =
                MenuItem::with_id(app, "pin_desktop", "贴到桌面", true, None::<&str>)?;
            let quit_item = MenuItem::with_id(app, "quit", "退出", true, None::<&str>)?;

            let menu = Menu::with_items(
                app,
                &[
                    &show_item,
                    &hide_item,
                    &pin_floating,
                    &pin_desktop,
                    &quit_item,
                ],
            )?;

            let tray_icon = Image::from_bytes(include_bytes!("../icons/tray-32.png"))
                .map_err(|error| format!("无法加载托盘图标: {error}"))?;

            if let Some(window) = app.get_webview_window("main") {
                if let Ok(window_icon) = Image::from_bytes(include_bytes!("../icons/32x32.png")) {
                    let _ = window.set_icon(window_icon);
                }
            }

            let _tray = TrayIconBuilder::new()
                .icon(tray_icon)
                .tooltip("蚕豆")
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_menu_event(|app, event| {
                    let window = match app.get_webview_window("main") {
                        Some(window) => window,
                        None => return,
                    };

                    match event.id.as_ref() {
                        "show" => {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                        "hide" => {
                            let _ = window.hide();
                        }
                        "pin_floating" => {
                            let _ = apply_pin_mode(&window, "floating");
                        }
                        "pin_desktop" => {
                            let _ = apply_pin_mode(&window, "desktop");
                        }
                        "quit" => {
                            app.exit(0);
                        }
                        _ => {}
                    }
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        let app = tray.app_handle();
                        if let Some(window) = app.get_webview_window("main") {
                            let visible = window.is_visible().unwrap_or(false);
                            if visible {
                                let _ = window.hide();
                            } else {
                                let _ = window.show();
                                let _ = window.set_focus();
                            }
                        }
                    }
                })
                .build(app)?;

            let _ = restore_window_state(app.handle());

            Ok(())
        })
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                let _ = window.hide();
                api.prevent_close();
            }

            if let WindowEvent::Moved { .. } | WindowEvent::Resized { .. } = event {
                if let Some(main_window) = window.app_handle().get_webview_window("main") {
                    let _ = tauri::async_runtime::block_on(async {
                        save_window_bounds(main_window).await
                    });
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
