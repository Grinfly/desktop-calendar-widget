import { useEffect, useState } from "react";
import type { BackdropSample } from "../lib/textContrast";
import { sampleDesktopBackdrop } from "../lib/windowTheme";

export function useDesktopBackdrop(enabled: boolean) {
  const [backdrop, setBackdrop] = useState<readonly BackdropSample[] | null>(null);

  useEffect(() => {
    if (!enabled) {
      setBackdrop(null);
      return;
    }

    let cancelled = false;
    let pending = false;
    const sample = async () => {
      if (pending || document.visibilityState !== "visible") return;
      pending = true;
      const next = await sampleDesktopBackdrop();
      pending = false;
      if (!cancelled) {
        setBackdrop((previous) => next && previous && next.length === previous.length
          && next.every(([x, y, rgb], i) => x === previous[i][0] && y === previous[i][1]
            && rgb.every((value, channel) => value === previous[i][2][channel]))
          ? previous
          : next);
      }
    };

    void sample();
    const interval = window.setInterval(sample, 250);
    document.addEventListener("visibilitychange", sample);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", sample);
    };
  }, [enabled]);

  return enabled ? backdrop : null;
}
