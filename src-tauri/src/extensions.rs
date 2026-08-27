use std::fs::{self, File};
use std::io::{self, Read};
use std::path::{Component, Path, PathBuf};

use serde::{Deserialize, Serialize};
use zip::ZipArchive;

use crate::storage;

const ID_MAX_LEN: usize = 64;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct ExtensionManifest {
    pub id: String,
    pub name: String,
    #[serde(default)]
    pub version: String,
    #[serde(default)]
    pub description: String,
    pub entry: String,
}

fn extensions_dir() -> Result<PathBuf, String> {
    let dir = storage::app_data_dir()?.join("extensions");
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir)
}

fn is_valid_id(id: &str) -> bool {
    !id.is_empty()
        && id.len() <= ID_MAX_LEN
        && id
            .chars()
            .all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '-')
}

fn normalize_relative(path: &str) -> Result<PathBuf, String> {
    let trimmed = path.trim();
    if trimmed.is_empty() {
        return Err("入口路径无效".into());
    }

    let mut out = PathBuf::new();
    for component in Path::new(trimmed).components() {
        match component {
            Component::Normal(part) => out.push(part),
            Component::CurDir => {}
            Component::ParentDir | Component::Prefix(_) | Component::RootDir => {
                return Err("扩展包包含非法路径".into());
            }
        }
    }

    if out.as_os_str().is_empty() {
        return Err("入口路径无效".into());
    }
    Ok(out)
}

fn parse_manifest(raw: &str) -> Result<ExtensionManifest, String> {
    let manifest: ExtensionManifest =
        serde_json::from_str(raw).map_err(|e| format!("manifest.json 无效: {e}"))?;
    if !is_valid_id(&manifest.id) {
        return Err("扩展 id 无效".into());
    }
    normalize_relative(&manifest.entry)?;
    if manifest.name.trim().is_empty() {
        return Err("扩展名称无效".into());
    }
    Ok(manifest)
}

fn read_manifest_file(path: &Path) -> Result<ExtensionManifest, String> {
    let raw = fs::read_to_string(path).map_err(|e| e.to_string())?;
    parse_manifest(&raw)
}

fn find_zip_index(archive: &mut ZipArchive<File>, name: &str) -> Result<usize, String> {
    for index in 0..archive.len() {
        let file = archive.by_index(index).map_err(|e| e.to_string())?;
        if file.name() == name {
            return Ok(index);
        }
    }
    Err(format!("扩展包缺少 {name}"))
}

pub fn install_from_zip_path(
    zip_path: &Path,
    extensions_root: &Path,
) -> Result<ExtensionManifest, String> {
    let file = File::open(zip_path).map_err(|e| e.to_string())?;
    let mut archive = ZipArchive::new(file).map_err(|_| "不是有效的扩展包".to_string())?;

    let manifest_index = find_zip_index(&mut archive, "manifest.json")?;
    let manifest = {
        let mut manifest_file = archive
            .by_index(manifest_index)
            .map_err(|e| e.to_string())?;
        let mut raw = String::new();
        manifest_file
            .read_to_string(&mut raw)
            .map_err(|e| e.to_string())?;
        parse_manifest(&raw)?
    };

    let entry = normalize_relative(&manifest.entry)?;
    let entry_name = entry.to_string_lossy().replace('\\', "/");
    find_zip_index(&mut archive, &entry_name)?;

    fs::create_dir_all(extensions_root).map_err(|e| e.to_string())?;

    let dest = extensions_root.join(&manifest.id);
    let tmp = extensions_root.join(format!(".{}.tmp", manifest.id));
    if tmp.exists() {
        fs::remove_dir_all(&tmp).map_err(|e| e.to_string())?;
    }
    fs::create_dir_all(&tmp).map_err(|e| e.to_string())?;

    let extract_result = (|| -> Result<(), String> {
        for index in 0..archive.len() {
            let mut zip_file = archive.by_index(index).map_err(|e| e.to_string())?;
            let Some(enclosed) = zip_file.enclosed_name() else {
                return Err("扩展包包含非法路径".into());
            };
            let rel = normalize_relative(&enclosed.to_string_lossy())?;
            let out_path = tmp.join(rel);

            if zip_file.is_dir() {
                fs::create_dir_all(&out_path).map_err(|e| e.to_string())?;
                continue;
            }

            if let Some(parent) = out_path.parent() {
                fs::create_dir_all(parent).map_err(|e| e.to_string())?;
            }
            let mut out = File::create(&out_path).map_err(|e| e.to_string())?;
            io::copy(&mut zip_file, &mut out).map_err(|e| e.to_string())?;
        }
        Ok(())
    })();

    if let Err(error) = extract_result {
        let _ = fs::remove_dir_all(&tmp);
        return Err(error);
    }

    if dest.exists() {
        fs::remove_dir_all(&dest).map_err(|e| e.to_string())?;
    }
    fs::rename(&tmp, &dest).map_err(|e| e.to_string())?;
    Ok(manifest)
}

pub fn list_installed(extensions_root: &Path) -> Result<Vec<ExtensionManifest>, String> {
    if !extensions_root.exists() {
        return Ok(Vec::new());
    }

    let mut manifests = Vec::new();
    let entries = fs::read_dir(extensions_root).map_err(|e| e.to_string())?;
    for entry in entries {
        let entry = entry.map_err(|e| e.to_string())?;
        let path = entry.path();
        if !path.is_dir() {
            continue;
        }
        let Some(folder_name) = path.file_name().and_then(|name| name.to_str()) else {
            continue;
        };
        if folder_name.starts_with('.') {
            continue;
        }
        let manifest_path = path.join("manifest.json");
        match read_manifest_file(&manifest_path) {
            Ok(manifest) if manifest.id == folder_name => manifests.push(manifest),
            Ok(_) => eprintln!("跳过扩展 {folder_name}: 目录名与 id 不一致"),
            Err(error) => eprintln!("跳过扩展 {folder_name}: {error}"),
        }
    }
    manifests.sort_by(|a, b| a.name.cmp(&b.name));
    Ok(manifests)
}

pub fn uninstall_from_dir(extensions_root: &Path, id: &str) -> Result<(), String> {
    if !is_valid_id(id) {
        return Err("扩展 id 无效".into());
    }
    let dest = extensions_root.join(id);
    if dest.exists() {
        fs::remove_dir_all(&dest).map_err(|e| e.to_string())?;
    }
    Ok(())
}

pub fn read_entry_source(extensions_root: &Path, id: &str) -> Result<String, String> {
    if !is_valid_id(id) {
        return Err("扩展 id 无效".into());
    }
    let dir = extensions_root.join(id);
    let manifest = read_manifest_file(&dir.join("manifest.json"))?;
    if manifest.id != id {
        return Err("扩展 id 不匹配".into());
    }
    let entry = dir.join(normalize_relative(&manifest.entry)?);
    if !entry.starts_with(&dir) {
        return Err("入口路径无效".into());
    }
    fs::read_to_string(&entry).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn list_extensions() -> Result<Vec<ExtensionManifest>, String> {
    list_installed(&extensions_dir()?)
}

#[tauri::command]
pub fn install_extension(window: tauri::WebviewWindow) -> Result<Option<ExtensionManifest>, String> {
    let was_always_on_top = window.is_always_on_top().unwrap_or(false);
    let _ = window.set_always_on_top(false);

    let picked = rfd::FileDialog::new()
        .set_title("安装扩展")
        .add_filter("蚕豆扩展", &["cando-ext", "zip"])
        .pick_file();

    let _ = window.set_always_on_top(was_always_on_top);

    let Some(path) = picked else {
        return Ok(None);
    };

    let manifest = install_from_zip_path(&path, &extensions_dir()?)?;
    Ok(Some(manifest))
}

#[tauri::command]
pub fn uninstall_extension(id: String) -> Result<(), String> {
    uninstall_from_dir(&extensions_dir()?, &id)
}

#[tauri::command]
pub fn read_extension_entry(id: String) -> Result<String, String> {
    read_entry_source(&extensions_dir()?, &id)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;
    use zip::write::SimpleFileOptions;
    use zip::CompressionMethod;
    use zip::ZipWriter;

    fn temp_root(name: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!(
            "cando-ext-{}-{}-{}",
            name,
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();
        dir
    }

    fn write_zip(path: &Path, files: &[(&str, &str)]) {
        let file = File::create(path).unwrap();
        let mut zip = ZipWriter::new(file);
        let options = SimpleFileOptions::default().compression_method(CompressionMethod::Stored);
        for (name, contents) in files {
            zip.start_file(*name, options).unwrap();
            zip.write_all(contents.as_bytes()).unwrap();
        }
        zip.finish().unwrap();
    }

    #[test]
    fn rejects_parent_dir_in_entry() {
        assert!(normalize_relative("../evil.js").is_err());
        assert!(normalize_relative("/abs.js").is_err());
        assert!(normalize_relative("index.js").is_ok());
    }

    #[test]
    fn rejects_invalid_id() {
        assert!(!is_valid_id(""));
        assert!(!is_valid_id("Lunar"));
        assert!(!is_valid_id("lu nar"));
        assert!(is_valid_id("lunar"));
        assert!(is_valid_id("lunar-v2"));
    }

    #[test]
    fn installs_valid_package() {
        let root = temp_root("ok");
        let zip_path = root.join("lunar.cando-ext");
        write_zip(
            &zip_path,
            &[
                (
                    "manifest.json",
                    r#"{"id":"lunar","name":"农历","entry":"index.js"}"#,
                ),
                ("index.js", "export function getDaySubLabel() { return '初一'; }"),
            ],
        );

        let dest = root.join("extensions");
        let manifest = install_from_zip_path(&zip_path, &dest).unwrap();
        assert_eq!(manifest.id, "lunar");
        assert_eq!(
            read_entry_source(&dest, "lunar").unwrap(),
            "export function getDaySubLabel() { return '初一'; }"
        );

        let listed = list_installed(&dest).unwrap();
        assert_eq!(listed.len(), 1);
        uninstall_from_dir(&dest, "lunar").unwrap();
        assert!(list_installed(&dest).unwrap().is_empty());

        let _ = fs::remove_dir_all(&root);
    }

    #[test]
    fn rejects_zip_slip() {
        let root = temp_root("slip");
        let zip_path = root.join("evil.zip");
        write_zip(
            &zip_path,
            &[
                (
                    "manifest.json",
                    r#"{"id":"lunar","name":"农历","entry":"index.js"}"#,
                ),
                ("index.js", "export {}"),
                ("../evil.js", "steal"),
            ],
        );

        let dest = root.join("extensions");
        let result = install_from_zip_path(&zip_path, &dest);
        assert!(result.is_err(), "{result:?}");
        assert!(!dest.join("lunar").exists());
        let _ = fs::remove_dir_all(&root);
    }

    #[test]
    fn rejects_missing_manifest() {
        let root = temp_root("nomanifest");
        let zip_path = root.join("bad.zip");
        write_zip(&zip_path, &[("index.js", "export {}")]);
        let dest = root.join("extensions");
        assert!(install_from_zip_path(&zip_path, &dest).is_err());
        let _ = fs::remove_dir_all(&root);
    }

    #[test]
    fn installs_built_lunar_package() {
        let zip_path = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .join("..")
            .join("dist-extensions")
            .join("lunar.cando-ext");
        if !zip_path.exists() {
            return;
        }

        let root = temp_root("lunar-built");
        let dest = root.join("extensions");
        let manifest = install_from_zip_path(&zip_path, &dest).unwrap();
        assert_eq!(manifest.id, "lunar");
        assert_eq!(manifest.name, "农历");
        let source = read_entry_source(&dest, "lunar").unwrap();
        assert!(source.contains("getDaySubLabel"));
        let _ = fs::remove_dir_all(&root);
    }
}
