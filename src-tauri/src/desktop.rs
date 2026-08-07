#[cfg(target_os = "windows")]
mod imp {
    use std::ffi::c_void;
    use std::ptr::null_mut;
    use std::sync::Mutex;

    use windows::core::w;
    use windows::Win32::Foundation::{BOOL, HWND, LPARAM, POINT, RECT, WPARAM};
    use windows::Win32::Graphics::Gdi::ScreenToClient;
    use windows::Win32::UI::WindowsAndMessaging::{
        EnumWindows, FindWindowExW, FindWindowW, GetWindowLongPtrW, GetWindowRect, IsWindow,
        SendMessageTimeoutW, SendMessageW, SetParent, SetWindowLongPtrW, SetWindowPos, ShowWindow,
        GWL_EXSTYLE, GWL_STYLE, HWND_BOTTOM, SMTO_NORMAL, SWP_FRAMECHANGED, SWP_NOACTIVATE,
        SWP_NOMOVE, SWP_NOSIZE, SWP_SHOWWINDOW, SW_HIDE, SW_SHOWNA, WS_CHILD, WS_EX_LAYERED,
        WS_VISIBLE,
    };

    const SPAWN_WORKERW: u32 = 0x052C;
    const WM_SETREDRAW: u32 = 0x000B;
    /// Progman on Windows 11 24H2+ raised desktop.
    const WS_EX_NOREDIRECTIONBITMAP: u32 = 0x0020_0000;

    static CACHED_WORKERW: Mutex<Option<isize>> = Mutex::new(None);

    struct EnumData {
        workerw: HWND,
    }

    fn is_valid(hwnd: HWND) -> bool {
        hwnd.0 != null_mut() && unsafe { IsWindow(hwnd).as_bool() }
    }

    fn find_progman() -> Result<HWND, String> {
        let progman = unsafe { FindWindowW(w!("Progman"), None) }
            .map_err(|e| format!("FindWindowW(Progman) 失败: {e}"))?;
        if !is_valid(progman) {
            return Err("找不到 Progman 窗口".into());
        }
        Ok(progman)
    }

    fn is_new_desktop_shell(progman: HWND) -> bool {
        let ex = unsafe { GetWindowLongPtrW(progman, GWL_EXSTYLE) } as u32;
        (ex & WS_EX_NOREDIRECTIONBITMAP) != 0
    }

    fn raise_desktop(progman: HWND) {
        unsafe {
            let mut result = 0usize;
            // Win11 24H2+ raised-desktop spawn
            let _ = SendMessageTimeoutW(
                progman,
                SPAWN_WORKERW,
                WPARAM(0xD),
                LPARAM(0x1),
                SMTO_NORMAL,
                1000,
                Some((&mut result) as *mut usize),
            );
            // Classic spawn
            let _ = SendMessageTimeoutW(
                progman,
                SPAWN_WORKERW,
                WPARAM(0),
                LPARAM(0),
                SMTO_NORMAL,
                1000,
                Some((&mut result) as *mut usize),
            );
            let _ = result;
        }
    }

    unsafe extern "system" fn enum_windows_proc(hwnd: HWND, lparam: LPARAM) -> BOOL {
        let data = &mut *(lparam.0 as *mut EnumData);

        if let Ok(shell_dll) = FindWindowExW(hwnd, None, w!("SHELLDLL_DefView"), None) {
            if is_valid(shell_dll) {
                if let Ok(workerw) = FindWindowExW(None, hwnd, w!("WorkerW"), None) {
                    if is_valid(workerw) {
                        data.workerw = workerw;
                        return BOOL(0);
                    }
                }
            }
        }
        BOOL(1)
    }

    fn enum_classic_workerw() -> Option<HWND> {
        let mut data = EnumData {
            workerw: HWND::default(),
        };
        unsafe {
            let _ = EnumWindows(Some(enum_windows_proc), LPARAM(&mut data as *mut _ as isize));
        }

        if is_valid(data.workerw) {
            Some(data.workerw)
        } else {
            None
        }
    }

    fn find_classic_workerw(progman: HWND) -> Result<HWND, String> {
        if let Ok(cache) = CACHED_WORKERW.lock() {
            if let Some(hwnd_raw) = *cache {
                let hwnd = HWND(hwnd_raw as *mut c_void);
                if is_valid(hwnd) {
                    return Ok(hwnd);
                }
            }
        }

        raise_desktop(progman);

        let hwnd = enum_classic_workerw()
            .or_else(|| {
                unsafe { FindWindowExW(progman, None, w!("WorkerW"), None) }
                    .ok()
                    .filter(|h| is_valid(*h))
            })
            .ok_or_else(|| "找不到 WorkerW 窗口".to_string())?;

        if let Ok(mut cache) = CACHED_WORKERW.lock() {
            *cache = Some(hwnd.0 as isize);
        }
        Ok(hwnd)
    }

    fn find_defview(progman: HWND) -> Result<HWND, String> {
        let def = unsafe { FindWindowExW(progman, None, w!("SHELLDLL_DefView"), None) }
            .map_err(|e| format!("FindWindowExW(SHELLDLL_DefView) 失败: {e}"))?;
        if !is_valid(def) {
            return Err("找不到 SHELLDLL_DefView".into());
        }
        Ok(def)
    }

    fn find_progman_workerw(progman: HWND, def_view: HWND) -> Option<HWND> {
        unsafe { FindWindowExW(progman, def_view, w!("WorkerW"), None) }
            .ok()
            .filter(|h| is_valid(*h))
            .or_else(|| {
                unsafe { FindWindowExW(progman, None, w!("WorkerW"), None) }
                    .ok()
                    .filter(|h| is_valid(*h))
            })
    }

    fn suspend_redraw(hwnd: HWND) {
        unsafe {
            let _ = SendMessageW(hwnd, WM_SETREDRAW, WPARAM(0), LPARAM(0));
        }
    }

    fn resume_redraw(hwnd: HWND) {
        unsafe {
            let _ = SendMessageW(hwnd, WM_SETREDRAW, WPARAM(1), LPARAM(0));
            let _ = SetWindowPos(
                hwnd,
                HWND::default(),
                0,
                0,
                0,
                0,
                SWP_NOMOVE | SWP_NOSIZE | SWP_FRAMECHANGED | SWP_NOACTIVATE,
            );
        }
    }

    fn screen_to_parent_client(parent: HWND, hwnd: HWND) -> Result<(i32, i32), String> {
        let mut rect = RECT::default();
        unsafe {
            GetWindowRect(hwnd, &mut rect).map_err(|e| format!("GetWindowRect 失败: {e}"))?;
        }
        let mut pt = POINT {
            x: rect.left,
            y: rect.top,
        };
        unsafe {
            let _ = ScreenToClient(parent, &mut pt);
        }
        Ok((pt.x, pt.y))
    }

    fn prepare_child_styles(hwnd: HWND) {
        unsafe {
            let style = GetWindowLongPtrW(hwnd, GWL_STYLE) as u32;
            SetWindowLongPtrW(
                hwnd,
                GWL_STYLE,
                (style | WS_CHILD.0 | WS_VISIBLE.0) as isize,
            );

            // Keep layered style — WebView2 transparency depends on it.
            let ex_style = GetWindowLongPtrW(hwnd, GWL_EXSTYLE) as u32;
            SetWindowLongPtrW(hwnd, GWL_EXSTYLE, (ex_style | WS_EX_LAYERED.0) as isize);
        }
    }

    fn restore_toplevel_styles(hwnd: HWND) {
        unsafe {
            let style = GetWindowLongPtrW(hwnd, GWL_STYLE) as u32;
            SetWindowLongPtrW(hwnd, GWL_STYLE, (style & !WS_CHILD.0) as isize);

            let ex_style = GetWindowLongPtrW(hwnd, GWL_EXSTYLE) as u32;
            SetWindowLongPtrW(hwnd, GWL_EXSTYLE, (ex_style | WS_EX_LAYERED.0) as isize);
        }
    }

    /// Win11 24H2+: parent to Progman, Z-order under DefView (icons), above WorkerW.
    fn attach_new_shell(hwnd: HWND, progman: HWND) -> Result<(), String> {
        raise_desktop(progman);
        let def_view = find_defview(progman)?;
        let worker = find_progman_workerw(progman, def_view);

        unsafe {
            let _ = ShowWindow(hwnd, SW_HIDE);
            suspend_redraw(hwnd);

            SetParent(hwnd, progman).map_err(|e| format!("SetParent(Progman) 失败: {e}"))?;
            prepare_child_styles(hwnd);

            let (x, y) = screen_to_parent_client(progman, hwnd)?;
            // Place below DefView so desktop icons stay on top.
            SetWindowPos(
                hwnd,
                def_view,
                x,
                y,
                0,
                0,
                SWP_NOSIZE | SWP_NOACTIVATE | SWP_SHOWWINDOW | SWP_FRAMECHANGED,
            )
            .map_err(|e| format!("SetWindowPos 失败: {e}"))?;

            if let Some(worker) = worker {
                // Keep system wallpaper WorkerW behind our widget.
                let _ = SetWindowPos(
                    worker,
                    hwnd,
                    0,
                    0,
                    0,
                    0,
                    SWP_NOMOVE | SWP_NOSIZE | SWP_NOACTIVATE,
                );
            }

            resume_redraw(hwnd);
            let _ = ShowWindow(hwnd, SW_SHOWNA);
        }

        Ok(())
    }

    fn attach_classic(hwnd: HWND, progman: HWND) -> Result<(), String> {
        let workerw = find_classic_workerw(progman)?;

        unsafe {
            let _ = ShowWindow(hwnd, SW_HIDE);
            suspend_redraw(hwnd);

            SetParent(hwnd, workerw).map_err(|e| format!("SetParent(WorkerW) 失败: {e}"))?;
            prepare_child_styles(hwnd);

            let (x, y) = screen_to_parent_client(workerw, hwnd)?;
            SetWindowPos(
                hwnd,
                HWND_BOTTOM,
                x,
                y,
                0,
                0,
                SWP_NOSIZE | SWP_NOACTIVATE | SWP_SHOWWINDOW | SWP_FRAMECHANGED,
            )
            .map_err(|e| format!("SetWindowPos 失败: {e}"))?;

            resume_redraw(hwnd);
            let _ = ShowWindow(hwnd, SW_SHOWNA);
        }

        Ok(())
    }

    pub fn attach_to_desktop(hwnd_raw: isize) -> Result<(), String> {
        let hwnd = HWND(hwnd_raw as *mut c_void);
        if !is_valid(hwnd) {
            return Err("无效窗口句柄".into());
        }

        let progman = find_progman()?;
        if is_new_desktop_shell(progman) {
            attach_new_shell(hwnd, progman)
        } else {
            attach_classic(hwnd, progman)
        }
    }

    pub fn detach_to_floating(hwnd_raw: isize) -> Result<(), String> {
        let hwnd = HWND(hwnd_raw as *mut c_void);
        if !is_valid(hwnd) {
            return Err("无效窗口句柄".into());
        }

        unsafe {
            let _ = ShowWindow(hwnd, SW_HIDE);
            suspend_redraw(hwnd);

            SetParent(hwnd, HWND::default())
                .map_err(|e| format!("SetParent(NULL) 失败: {e}"))?;
            restore_toplevel_styles(hwnd);

            resume_redraw(hwnd);
            let _ = ShowWindow(hwnd, SW_SHOWNA);
            let _ = SetWindowPos(
                hwnd,
                HWND::default(),
                0,
                0,
                0,
                0,
                SWP_NOMOVE | SWP_NOSIZE | SWP_FRAMECHANGED | SWP_SHOWWINDOW | SWP_NOACTIVATE,
            );
        }

        if let Ok(mut cache) = CACHED_WORKERW.lock() {
            *cache = None;
        }

        Ok(())
    }
}

#[cfg(target_os = "windows")]
pub use imp::{attach_to_desktop, detach_to_floating};

#[cfg(not(target_os = "windows"))]
pub fn attach_to_desktop(_hwnd_raw: isize) -> Result<(), String> {
    Err("桌面模式仅支持 Windows".into())
}

#[cfg(not(target_os = "windows"))]
pub fn detach_to_floating(_hwnd_raw: isize) -> Result<(), String> {
    Ok(())
}
