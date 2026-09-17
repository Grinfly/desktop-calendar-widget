use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;
use std::time::Duration;

use serde::{Deserialize, Serialize};

use crate::storage;

#[derive(Debug, Default, Serialize, Deserialize)]
struct HolidayCache {
    fetched_on: String,
    days: HashMap<String, String>,
}

#[derive(Debug, Deserialize)]
struct YearFile {
    #[serde(default)]
    days: Vec<YearDay>,
}

#[derive(Debug, Deserialize)]
struct YearDay {
    date: String,
    #[serde(rename = "isOffDay")]
    is_off_day: bool,
}

fn cache_path() -> Result<PathBuf, String> {
    Ok(storage::app_data_dir()?.join("holidays.json"))
}

fn read_cache() -> HolidayCache {
    let Ok(path) = cache_path() else {
        return HolidayCache::default();
    };
    let Ok(raw) = fs::read_to_string(path) else {
        return HolidayCache::default();
    };
    serde_json::from_str(&raw).unwrap_or_default()
}

fn write_cache(cache: &HolidayCache) {
    let Ok(path) = cache_path() else {
        return;
    };
    if let Ok(raw) = serde_json::to_string_pretty(cache) {
        let _ = fs::write(path, raw);
    }
}

fn years_around(today: &str) -> Vec<i32> {
    let year = today
        .get(..4)
        .and_then(|value| value.parse::<i32>().ok())
        .unwrap_or(2026);
    vec![year - 1, year, year + 1]
}

fn fetch_year(year: i32) -> Result<Vec<YearDay>, String> {
    let urls = [
        format!("https://cdn.jsdelivr.net/gh/NateScarlet/holiday-cn@master/{year}.json"),
        format!("https://raw.githubusercontent.com/NateScarlet/holiday-cn/master/{year}.json"),
    ];
    let mut last_error = "无法获取节假日数据".to_string();
    for url in urls {
        match ureq::get(&url)
            .set("User-Agent", "CanDo/0.1.1")
            .timeout(Duration::from_secs(8))
            .call()
        {
            Ok(response) => {
                let file: YearFile = response.into_json().map_err(|error| error.to_string())?;
                return Ok(file.days);
            }
            Err(error) => last_error = error.to_string(),
        }
    }
    Err(last_error)
}

fn refresh(today: &str) -> HolidayCache {
    let mut days = HashMap::new();
    for year in years_around(today) {
        if let Ok(items) = fetch_year(year) {
            for item in items {
                days.insert(
                    item.date,
                    if item.is_off_day {
                        "rest".to_string()
                    } else {
                        "work".to_string()
                    },
                );
            }
        }
    }
    if days.is_empty() {
        return read_cache();
    }
    let cache = HolidayCache {
        fetched_on: today.to_string(),
        days,
    };
    write_cache(&cache);
    cache
}

#[tauri::command]
pub fn load_work_rest_days(today: String) -> HashMap<String, String> {
    if today.len() < 10 {
        return HashMap::new();
    }
    let cache = read_cache();
    if cache.fetched_on == today && !cache.days.is_empty() {
        return cache.days;
    }
    refresh(&today).days
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_off_and_work_days() {
        let file: YearFile = serde_json::from_str(
            r#"{"days":[{"name":"国庆节","date":"2026-10-01","isOffDay":true},{"name":"国庆节","date":"2026-09-20","isOffDay":false}]}"#,
        )
        .unwrap();
        assert!(file.days[0].is_off_day);
        assert!(!file.days[1].is_off_day);
    }
}
