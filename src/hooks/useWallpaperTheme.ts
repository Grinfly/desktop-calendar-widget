import { useEffect, useState } from "react";
import { sampleWallpaperTheme, wallpaperSourceRevision, type WallpaperTheme } from "../lib/windowTheme";

export function useWallpaperTheme(enabled: boolean) {
  const [theme, setTheme] = useState<WallpaperTheme | null>(null);

  useEffect(() => {
    if (!enabled) {
      setTheme(null);
      return;
    }

    let cancelled = false;
    let syncing = false;
    let lastRevision: number | undefined;
    const sync = async () => {
      if (syncing) return;
      syncing = true;
      try {
        const revision = await wallpaperSourceRevision();
        if (cancelled || revision === lastRevision) return;
        const next = await sampleWallpaperTheme();
        if (cancelled) return;
        lastRevision = revision;
        setTheme(next);
      } finally {
        syncing = false;
      }
    };
    void sync();
    const interval = window.setInterval(sync, 1500);
    const onVisible = () => { if (document.visibilityState === "visible") void sync(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [enabled]);

  return theme;
}
