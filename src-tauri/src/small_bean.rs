use std::{
    fs,
    sync::{
        atomic::{AtomicBool, Ordering},
        Mutex,
    },
};

use serde::{Deserialize, Serialize};
use tauri::{LogicalSize, WebviewWindow};

const BEAN_SIZE: u32 = 56;
static SWITCHING: AtomicBool = AtomicBool::new(false);
static STATE: Mutex<BeanState> = Mutex::new(BeanState {
    enabled: false,
    collapsed: false,
    position: None,
    origin: None,
    expanded: None,
});

#[derive(Clone, Copy, Debug, Deserialize, PartialEq, Serialize)]
struct Point {
    x: i32,
    y: i32,
}

#[derive(Clone, Copy, Deserialize, PartialEq, Serialize)]
struct Bounds {
    position: Point,
    width: u32,
    height: u32,
}

#[derive(Clone, Copy, Default, Deserialize, PartialEq, Serialize)]
#[serde(default, rename_all = "camelCase")]
struct BeanState {
    enabled: bool,
    #[serde(skip)]
    collapsed: bool,
    position: Option<Point>,
    origin: Option<Point>,
    expanded: Option<Bounds>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Presentation {
    available: bool,
    enabled: bool,
    collapsed: bool,
}

fn state() -> BeanState {
    *STATE.lock().unwrap_or_else(|err| err.into_inner())
}

fn state_path() -> Result<std::path::PathBuf, String> {
    Ok(crate::storage::app_data_dir()?.join("small-bean.json"))
}

fn store(next: BeanState) -> Result<(), String> {
    let mut current = STATE.lock().map_err(|err| err.to_string())?;
    write_state(&mut current, next)
}

fn write_state(current: &mut BeanState, next: BeanState) -> Result<(), String> {
    let json = serde_json::to_vec(&next).map_err(|err| err.to_string())?;
    fs::write(state_path()?, json).map_err(|err| err.to_string())?;
    *current = next;
    Ok(())
}

fn bounds(window: &WebviewWindow) -> tauri::Result<Bounds> {
    let pos = window.outer_position()?;
    let size = window
        .inner_size()?
        .to_logical::<u32>(window.scale_factor()?);
    Ok(Bounds {
        position: Point { x: pos.x, y: pos.y },
        width: size.width,
        height: size.height,
    })
}

fn clamp_rect(position: i32, length: u32, start: i32, available: u32) -> i32 {
    position.clamp(
        start,
        start.saturating_add_unsigned(available.saturating_sub(length)),
    )
}

fn monitor_for(window: &WebviewWindow, point: Point) -> tauri::Result<Option<tauri::Monitor>> {
    let monitor = window.available_monitors()?.into_iter().find(|m| {
        let p = m.position();
        let s = m.size();
        (p.x..p.x.saturating_add_unsigned(s.width)).contains(&point.x)
            && (p.y..p.y.saturating_add_unsigned(s.height)).contains(&point.y)
    });
    Ok(monitor
        .or(window.current_monitor()?)
        .or(window.primary_monitor()?))
}

fn clamp_to_monitor(rect: Bounds, monitor: Option<&tauri::Monitor>) -> Point {
    let Some(monitor) = monitor else {
        return rect.position;
    };
    let area = monitor.work_area();
    let size = LogicalSize::new(rect.width, rect.height).to_physical::<u32>(monitor.scale_factor());
    Point {
        x: clamp_rect(
            rect.position.x,
            size.width,
            area.position.x,
            area.size.width,
        ),
        y: clamp_rect(
            rect.position.y,
            size.height,
            area.position.y,
            area.size.height,
        ),
    }
}

fn place(window: &WebviewWindow, rect: Bounds, compact: bool) -> tauri::Result<()> {
    let position =
        crate::desktop::screen_to_window_position(window, rect.position.x, rect.position.y)?;
    window.set_resizable(true)?;
    window.set_min_size(None::<LogicalSize<u32>>)?;
    window.set_position(position)?;
    window.set_size(LogicalSize::new(rect.width, rect.height))?;
    if compact {
        window.set_resizable(false)?;
    } else {
        window.set_min_size(Some(LogicalSize::new(
            crate::MIN_WINDOW_WIDTH,
            crate::MIN_WINDOW_HEIGHT,
        )))?;
    }
    Ok(())
}

struct Transition;
impl Transition {
    fn begin() -> Result<Self, String> {
        SWITCHING
            .compare_exchange(false, true, Ordering::AcqRel, Ordering::Acquire)
            .map(|_| Self)
            .map_err(|_| "小蚕豆正在切换".into())
    }
}
impl Drop for Transition {
    fn drop(&mut self) {
        SWITCHING.store(false, Ordering::Release);
    }
}

fn collapse(
    window: &WebviewWindow,
    expanded: Bounds,
    saved: BeanState,
) -> tauri::Result<BeanState> {
    let anchor_monitor = monitor_for(window, expanded.position)?;
    let scale = anchor_monitor.as_ref().map_or(1.0, |m| m.scale_factor());
    let origin = Point {
        x: expanded.position.x.saturating_add(
            ((expanded.width.saturating_sub(BEAN_SIZE)) as f64 * scale).round() as i32,
        ),
        y: expanded.position.y,
    };
    let wanted = saved.position.unwrap_or(origin);
    let monitor = monitor_for(window, wanted)?;
    let mut rect = Bounds {
        position: wanted,
        width: BEAN_SIZE,
        height: BEAN_SIZE,
    };
    rect.position = clamp_to_monitor(rect, monitor.as_ref());
    place(window, rect, true)?;
    Ok(BeanState {
        enabled: true,
        collapsed: true,
        position: Some(rect.position),
        origin: saved.origin.or(Some(rect.position)),
        expanded: Some(expanded),
    })
}

fn expand(window: &WebviewWindow, current: BeanState, position: Point) -> tauri::Result<Bounds> {
    let mut rect = current.expanded.unwrap_or(Bounds {
        position,
        width: crate::DEFAULT_WINDOW_WIDTH,
        height: crate::DEFAULT_WINDOW_HEIGHT,
    });
    let moved = current.origin != Some(position);
    let monitor = monitor_for(window, if moved { position } else { rect.position })?;
    if let Some(monitor) = &monitor {
        let available = monitor
            .work_area()
            .size
            .to_logical::<u32>(monitor.scale_factor());
        rect.width = rect.width.min(available.width.max(crate::MIN_WINDOW_WIDTH));
        rect.height = rect
            .height
            .min(available.height.max(crate::MIN_WINDOW_HEIGHT));
    }
    if moved {
        let scale = monitor.as_ref().map_or(1.0, |m| m.scale_factor());
        rect.position = expanded_origin(position, rect.width, scale);
    }
    rect.position = clamp_to_monitor(rect, monitor.as_ref());
    place(window, rect, false)?;
    Ok(rect)
}

fn expanded_origin(position: Point, width: u32, scale: f64) -> Point {
    Point {
        x: position
            .x
            .saturating_sub((f64::from(width.saturating_sub(BEAN_SIZE)) * scale).round() as i32),
        y: position.y,
    }
}

fn change(window: &WebviewWindow, enabled: bool, collapsed: bool) -> Result<Presentation, String> {
    let _transition = Transition::begin()?;
    let current = state();
    if current.enabled == enabled && current.collapsed == collapsed {
        return Ok(get_small_bean_state());
    }
    let before = bounds(window).map_err(|err| err.to_string())?;
    let result = (|| {
        let next = if collapsed {
            collapse(window, before, BeanState::default()).map_err(|err| err.to_string())?
        } else {
            let expanded = if current.collapsed {
                expand(window, current, before.position).map_err(|err| err.to_string())?
            } else {
                before
            };
            if current.collapsed {
                let size = window.outer_size().map_err(|err| err.to_string())?;
                crate::persist_window_bounds(
                    expanded.position.x,
                    expanded.position.y,
                    size.width,
                    size.height,
                )?;
            }
            BeanState {
                enabled,
                expanded: enabled.then_some(expanded),
                ..BeanState::default()
            }
        };
        store(next)?;
        Ok(get_small_bean_state())
    })();
    if result.is_err() && current.collapsed != collapsed {
        let _ = place(window, before, current.collapsed);
    }
    result
}

pub fn restore(window: &WebviewWindow) {
    if !cfg!(windows) {
        return;
    }
    let saved: BeanState = state_path()
        .ok()
        .and_then(|path| fs::read(path).ok())
        .and_then(|bytes| serde_json::from_slice(&bytes).ok())
        .unwrap_or_default();
    if !saved.enabled {
        return;
    }
    let Ok(_transition) = Transition::begin() else {
        return;
    };
    let Ok(before) = bounds(window) else { return };
    if let Ok(next) = collapse(window, saved.expanded.unwrap_or(before), saved) {
        *STATE.lock().unwrap_or_else(|err| err.into_inner()) = next;
    } else {
        let _ = place(window, before, false);
    }
}

pub fn is_collapsed() -> bool {
    state().collapsed
}

pub fn ensure_on_screen(window: &WebviewWindow) {
    let Ok(rect) = bounds(window) else { return };
    if let Ok(monitor) = monitor_for(window, rect.position) {
        let point = clamp_to_monitor(rect, monitor.as_ref());
        if point != rect.position {
            if let Ok(position) =
                crate::desktop::screen_to_window_position(window, point.x, point.y)
            {
                let _ = window.set_position(position);
            }
        }
    }
}

/// Returns true in compact mode or during a resize sequence so normal bounds cannot be overwritten.
pub fn handle_bounds(window: &WebviewWindow) -> bool {
    if SWITCHING.load(Ordering::Acquire) {
        return true;
    }
    let current = state();
    if current.enabled {
        if let Ok(rect) = bounds(window) {
            if !crate::is_plausible_position(rect.position.x, rect.position.y) {
                return current.collapsed;
            }
            let mut next = current;
            if current.collapsed {
                next.position = Some(rect.position);
            } else if rect.width >= crate::MIN_WINDOW_WIDTH
                && rect.height >= crate::MIN_WINDOW_HEIGHT
            {
                next.expanded = Some(rect);
            }
            if next != current {
                if let Ok(mut live) = STATE.lock() {
                    if *live == current && !SWITCHING.load(Ordering::Acquire) {
                        let _ = write_state(&mut live, next);
                    }
                }
            }
        }
    }
    current.collapsed
}

#[tauri::command]
pub fn get_small_bean_state() -> Presentation {
    let current = state();
    Presentation {
        available: cfg!(windows),
        enabled: current.enabled,
        collapsed: current.collapsed,
    }
}

#[tauri::command]
pub async fn set_small_bean_mode(
    window: WebviewWindow,
    enabled: bool,
) -> Result<Presentation, String> {
    if !cfg!(windows) {
        return Err("小蚕豆模式仅支持 Windows".into());
    }
    change(&window, enabled, enabled)
}

#[tauri::command]
pub async fn set_small_bean_collapsed(
    window: WebviewWindow,
    collapsed: bool,
) -> Result<Presentation, String> {
    if !state().enabled {
        return Err("小蚕豆模式尚未开启".into());
    }
    change(&window, true, collapsed)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn clamp_to_desktop_work_area_with_negative_coordinates() {
        assert_eq!(clamp_rect(-20, 56, -1920, 1920), -56);
        assert_eq!(clamp_rect(-2200, 56, -1920, 1920), -1920);
        assert_eq!(clamp_rect(500, 640, 100, 320), 100);
        assert_eq!(clamp_rect(42, 56, 0, 1920), 42);
    }

    #[test]
    fn moving_the_bean_on_a_scaled_screen_keeps_the_top_right_anchor() {
        assert_eq!(
            expanded_origin(Point { x: -100, y: 80 }, 360, 1.25),
            Point { x: -480, y: 80 }
        );
    }

    #[test]
    fn compact_position_is_saved_independently_of_expanded_bounds() {
        let compact: BeanState = serde_json::from_str(
            r#"{"enabled":true,"position":{"x":1800,"y":80},"expanded":{"position":{"x":1500,"y":80},"width":356,"height":410}}"#,
        ).unwrap();
        assert!(compact.enabled);
        assert!(!compact.collapsed);
        assert_eq!(compact.position, Some(Point { x: 1800, y: 80 }));
        assert_eq!(compact.expanded.unwrap().width, 356);
    }
}
