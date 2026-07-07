use std::fs;
use std::path::PathBuf;

fn data_path() -> Result<PathBuf, String> {
    let base = dirs::data_dir().ok_or("无法获取 AppData 目录")?;
    let dir = base.join("desktop-calendar-widget");
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir.join("data.json"))
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
