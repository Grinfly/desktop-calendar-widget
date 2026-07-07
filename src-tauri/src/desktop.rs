#[cfg(target_os = "windows")]
mod imp {
    use std::ffi::c_void;
    use std::ptr::null_mut;
    use std::sync::Mutex;

    use windows::core::w;
    use windows::Win32::Foundation::{BOOL, HWND, LPARAM, WPARAM};
    use windows::Win32::UI::WindowsAndMessaging::{
        EnumWindows, FindWindowExW, FindWindowW, GetWindowLongPtrW, IsWindow, SendMessageW,
        SendMessageTimeoutW, SetParent, SetWindowLongPtrW, SetWindowPos, ShowWindow, GWL_EXSTYLE,
        GWL_STYLE, SMTO_NORMAL, SWP_FRAMECHANGED, SWP_NOACTIVATE, SWP_NOMOVE, SWP_NOSIZE,
        SWP_NOZORDER, SW_HIDE, SW_SHOWNA, WM_USER, WS_CHILD, WS_EX_LAYERED, WS_VISIBLE,
    };

    const SPAWN_WORKERW: u32 = 0x052C;
    const WM_SETREDRAW: u32 = 0x000B;

    static CACHED_WORKERW: Mutex<Option<isize>> = Mutex::new(None);

    struct EnumData {
        workerw: HWND,
    }

    fn is_valid(hwnd: HWND) -> bool {
        hwnd.0 != null_mut() && unsafe { IsWindow(hwnd).as_bool() }
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

    fn enum_workerw() -> Option<HWND> {
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

    fn spawn_workerw() -> Result<(), String> {
        let progman = unsafe { FindWindowW(w!("Progman"), None) }
            .map_err(|e| format!("FindWindowW(Progman) 失败: {e}"))?;
        if !is_valid(progman) {
            return Err("找不到 Progman 窗口".into());
        }

        unsafe {
            let mut result = 0usize;
            let _ = SendMessageTimeoutW(
                progman,
                WM_USER,
                WPARAM(SPAWN_WORKERW as usize),
                LPARAM(0),
                SMTO_NORMAL,
                1000,
                Some((&mut result) as *mut usize),
            );
        }

        Ok(())
    }

    fn find_workerw() -> Result<HWND, String> {
        if let Ok(cache) = CACHED_WORKERW.lock() {
            if let Some(hwnd_raw) = *cache {
                let hwnd = HWND(hwnd_raw as *mut c_void);
                if is_valid(hwnd) {
                    return Ok(hwnd);
                }
            }
        }

        if let Some(hwnd) = enum_workerw() {
            if let Ok(mut cache) = CACHED_WORKERW.lock() {
                *cache = Some(hwnd.0 as isize);
            }
            return Ok(hwnd);
        }

        spawn_workerw()?;

        let hwnd = enum_workerw().ok_or_else(|| "找不到 WorkerW 窗口".to_string())?;
        if let Ok(mut cache) = CACHED_WORKERW.lock() {
            *cache = Some(hwnd.0 as isize);
        }
        Ok(hwnd)
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
                SWP_NOMOVE | SWP_NOSIZE | SWP_NOZORDER | SWP_FRAMECHANGED | SWP_NOACTIVATE,
            );
        }
    }

    pub fn attach_to_desktop(hwnd_raw: isize) -> Result<(), String> {
        let hwnd = HWND(hwnd_raw as *mut c_void);
        let workerw = find_workerw()?;

        unsafe {
            let _ = ShowWindow(hwnd, SW_HIDE);
            suspend_redraw(hwnd);

            SetParent(hwnd, workerw).map_err(|e| format!("SetParent 失败: {e}"))?;

            let style = GetWindowLongPtrW(hwnd, GWL_STYLE) as u32;
            SetWindowLongPtrW(
                hwnd,
                GWL_STYLE,
                (style | WS_CHILD.0 | WS_VISIBLE.0) as isize,
            );

            let ex_style = GetWindowLongPtrW(hwnd, GWL_EXSTYLE) as u32;
            SetWindowLongPtrW(
                hwnd,
                GWL_EXSTYLE,
                (ex_style & !WS_EX_LAYERED.0) as isize,
            );

            resume_redraw(hwnd);
            let _ = ShowWindow(hwnd, SW_SHOWNA);
        }

        Ok(())
    }

    pub fn detach_to_floating(hwnd_raw: isize) -> Result<(), String> {
        let hwnd = HWND(hwnd_raw as *mut c_void);

        unsafe {
            let _ = ShowWindow(hwnd, SW_HIDE);
            suspend_redraw(hwnd);

            SetParent(hwnd, HWND::default()).map_err(|e| format!("SetParent(NULL) 失败: {e}"))?;

            let style = GetWindowLongPtrW(hwnd, GWL_STYLE) as u32;
            SetWindowLongPtrW(hwnd, GWL_STYLE, (style & !WS_CHILD.0) as isize);

            let ex_style = GetWindowLongPtrW(hwnd, GWL_EXSTYLE) as u32;
            SetWindowLongPtrW(
                hwnd,
                GWL_EXSTYLE,
                (ex_style | WS_EX_LAYERED.0) as isize,
            );

            resume_redraw(hwnd);
            let _ = ShowWindow(hwnd, SW_SHOWNA);
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
