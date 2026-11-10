use std::fs;
use std::path::PathBuf;

pub fn app_data_dir() -> Result<PathBuf, String> {
    let base = dirs::data_dir().ok_or("无法获取 AppData 目录")?;
    let dir = base.join("desktop-calendar-widget");
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir)
}

fn data_path() -> Result<PathBuf, String> {
    Ok(app_data_dir()?.join("data.json"))
}

pub fn default_data_json() -> String {
    r#"{
  "tasks": {},
  "settings": {
    "pinMode": "floating",
    "position": { "x": 120, "y": 80 },
    "size": { "width": 300, "height": 360 },
    "lastView": "calendar",
    "selectedDate": ""
  }
}"#
    .to_string()
}

pub fn load_data() -> Result<String, String> {
    let path = data_path()?;
    if !path.exists() {
        return Ok(default_data_json());
    }
    fs::read_to_string(&path).map_err(|e| e.to_string())
}

pub fn save_data(json: String) -> Result<(), String> {
    let path = data_path()?;
    fs::write(&path, json).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn export_task_backup(
    window: tauri::WebviewWindow,
    json: String,
    file_name: String,
) -> Result<bool, String> {
    let Some(path) = rfd::FileDialog::new()
        .set_parent(&window)
        .set_title("导出待办备份")
        .set_file_name(&file_name)
        .add_filter("JSON 文件", &["json"])
        .save_file()
    else {
        return Ok(false);
    };

    let live_data = data_path()?;
    if path == live_data
        || path
            .canonicalize()
            .ok()
            .zip(live_data.canonicalize().ok())
            .is_some_and(|(backup, live)| backup == live)
    {
        return Err("请选择其他位置，不能覆盖应用的数据文件".into());
    }
    fs::write(path, json).map_err(|e| e.to_string())?;
    Ok(true)
}

#[tauri::command]
pub fn read_task_backup(window: tauri::WebviewWindow) -> Result<Option<String>, String> {
    let Some(path) = rfd::FileDialog::new()
        .set_parent(&window)
        .set_title("导入待办备份")
        .add_filter("JSON 文件", &["json"])
        .pick_file()
    else {
        return Ok(None);
    };
    fs::read_to_string(path)
        .map(Some)
        .map_err(|e| e.to_string())
}
