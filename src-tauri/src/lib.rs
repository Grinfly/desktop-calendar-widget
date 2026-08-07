mod desktop;
mod storage;

use std::sync::Mutex;

use serde::Deserialize;
use tauri::{
    image::Image,
    menu::{CheckMenuItem, Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Emitter, Manager, PhysicalPosition, PhysicalSize, WindowEvent,
};

static CURRENT_PIN_MODE: Mutex<Option<String>> = Mutex::new(None);

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
    let previous = {
        let current = CURRENT_PIN_MODE.lock().map_err(|e| e.to_string())?;
        if current.as_deref() == Some(mode) {
            return Ok(());
        }
        current.clone()
    };

    #[cfg(windows)]
    {
        let hwnd = window.hwnd().map_err(|e| e.to_string())?;
        let hwnd_raw = hwnd.0 as isize;
        let was_desktop = previous.as_deref() == Some("desktop");
        let will_desktop = mode == "desktop";

        // Only attach/detach when crossing the desktop boundary.
        // floating <-> normal should only flip always-on-top (no hide/show flash).
        if was_desktop && !will_desktop {
            desktop::detach_to_floating(hwnd_raw)?;
            apply_window_rounded_clip(window);
        } else if !was_desktop && will_desktop {
            window
                .set_always_on_top(false)
                .map_err(|e| e.to_string())?;
            desktop::attach_to_desktop(hwnd_raw)?;
            apply_window_rounded_clip(window);
        }

        if !will_desktop {
            window
                .set_always_on_top(mode == "floating")
                .map_err(|e| e.to_string())?;
        }
    }

    #[cfg(not(windows))]
    {
        let _ = previous;
        let floating = mode == "floating";
        window
            .set_always_on_top(floating)
            .map_err(|e| e.to_string())?;
    }

    if let Ok(mut current) = CURRENT_PIN_MODE.lock() {
        *current = Some(mode.to_string());
    }

    Ok(())
}

fn persist_pin_mode(mode: &str) -> Result<(), String> {
    let raw = storage::load_data()?;
    let mut value: serde_json::Value =
        serde_json::from_str(&raw).map_err(|e| e.to_string())?;

    if let Some(settings) = value.get_mut("settings") {
        settings["pinMode"] = serde_json::json!(mode);
    }

    storage::save_data(serde_json::to_string_pretty(&value).map_err(|e| e.to_string())?)
}

fn read_pin_mode() -> String {
    storage::load_data()
        .ok()
        .and_then(|raw| serde_json::from_str::<AppData>(&raw).ok())
        .map(|data| data.settings.pin_mode)
        .filter(|mode| mode == "floating" || mode == "normal" || mode == "desktop")
        .unwrap_or_else(|| "floating".into())
}

struct TrayPinChecks {
    floating: CheckMenuItem<tauri::Wry>,
    desktop: CheckMenuItem<tauri::Wry>,
}

fn sync_tray_pin_checks(app: &tauri::AppHandle, mode: &str) {
    if let Some(items) = app.try_state::<TrayPinChecks>() {
        let _ = items.floating.set_checked(mode == "floating");
        let _ = items.desktop.set_checked(mode == "desktop");
    }
}

fn switch_pin_mode(app: &tauri::AppHandle, window: &tauri::WebviewWindow, mode: &str) {
    match apply_pin_mode(window, mode) {
        Ok(()) => {
            let _ = persist_pin_mode(mode);
            sync_tray_pin_checks(app, mode);
            let _ = app.emit("pin-mode-changed", mode);
        }
        Err(error) => {
            // Keep checkmarks in sync with actual mode after a failed click auto-toggle.
            sync_tray_pin_checks(
                app,
                CURRENT_PIN_MODE
                    .lock()
                    .ok()
                    .and_then(|guard| guard.clone())
                    .unwrap_or_else(read_pin_mode)
                    .as_str(),
            );
            eprintln!("切换钉住模式失败: {error}");
            let _ = app.emit("pin-mode-error", error);
        }
    }
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
    apply_window_rounded_clip(&window);

    Ok(())
}

/// Disable DWM corner rounding (it draws a system drop-shadow) and clear any region clip.
fn apply_window_rounded_clip(window: &tauri::WebviewWindow) {
    #[cfg(windows)]
    {
        use std::ffi::c_void;

        use windows::Win32::Foundation::HWND;
        use windows::Win32::Graphics::Gdi::{SetWindowRgn, HRGN};

        const DWMWA_WINDOW_CORNER_PREFERENCE: u32 = 33;
        const DWMWCP_DONOTROUND: u32 = 1;

        #[link(name = "dwmapi")]
        extern "system" {
            fn DwmSetWindowAttribute(
                hwnd: *mut c_void,
                dw_attribute: u32,
                pv_attribute: *const c_void,
                cb_attribute: u32,
            ) -> i32;
        }

        let Ok(tauri_hwnd) = window.hwnd() else {
            return;
        };
        let hwnd = HWND(tauri_hwnd.0 as *mut c_void);

        unsafe {
            let _ = SetWindowRgn(hwnd, HRGN::default(), true);

            // Avoid Win11 DWM rounded-frame shadow; CSS handles the radius.
            let preference = DWMWCP_DONOTROUND;
            let _ = DwmSetWindowAttribute(
                hwnd.0,
                DWMWA_WINDOW_CORNER_PREFERENCE,
                &preference as *const u32 as *const c_void,
                std::mem::size_of_val(&preference) as u32,
            );
        }
    }

    #[cfg(not(windows))]
    {
        let _ = window;
    }
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
async fn set_pin_mode(
    app: tauri::AppHandle,
    window: tauri::WebviewWindow,
    mode: String,
) -> Result<(), String> {
    apply_pin_mode(&window, &mode)?;
    sync_tray_pin_checks(&app, &mode);
    Ok(())
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
            let initial_pin_mode = read_pin_mode();
            let show_item = MenuItem::with_id(app, "show", "显示窗口", true, None::<&str>)?;
            let hide_item = MenuItem::with_id(app, "hide", "隐藏窗口", true, None::<&str>)?;
            let pin_floating = CheckMenuItem::with_id(
                app,
                "pin_floating",
                "悬浮置顶",
                true,
                initial_pin_mode == "floating",
                None::<&str>,
            )?;
            let pin_desktop = CheckMenuItem::with_id(
                app,
                "pin_desktop",
                "贴到桌面",
                true,
                initial_pin_mode == "desktop",
                None::<&str>,
            )?;
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

            app.manage(TrayPinChecks {
                floating: pin_floating,
                desktop: pin_desktop,
            });

            let tray_icon = Image::from_bytes(include_bytes!("../icons/tray-32.png"))
                .map_err(|error| format!("无法加载托盘图标: {error}"))?;

            if let Some(window) = app.get_webview_window("main") {
                if let Ok(window_icon) = Image::from_bytes(include_bytes!("../icons/32x32.png")) {
                    let _ = window.set_icon(window_icon);
                }
                let _ = window.set_shadow(false);
                // Fully transparent clear color — non-zero alpha on Windows
                // paints an opaque rectangle and leaks past CSS border-radius.
                let _ = window.set_background_color(Some(tauri::window::Color(0, 0, 0, 0)));
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
                            switch_pin_mode(app, &window, "floating");
                        }
                        "pin_desktop" => {
                            switch_pin_mode(app, &window, "desktop");
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
            let mode_after_restore = CURRENT_PIN_MODE
                .lock()
                .ok()
                .and_then(|guard| guard.clone())
                .unwrap_or_else(read_pin_mode);
            sync_tray_pin_checks(app.handle(), &mode_after_restore);
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
                let _ = window.set_shadow(false);
                apply_window_rounded_clip(&window);
            }

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
