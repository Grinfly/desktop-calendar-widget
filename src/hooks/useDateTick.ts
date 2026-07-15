import { useEffect, useState } from "react";

/** Bump state at midnight and when the window becomes visible so isToday() re-evaluates. */
export function useDateTick() {
  const [, setTick] = useState(0);

  useEffect(() => {
    let timeoutId: number;

    const scheduleMidnight = () => {
      const now = new Date();
      const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
      timeoutId = window.setTimeout(() => {
        setTick((t) => t + 1);
        scheduleMidnight();
      }, next.getTime() - now.getTime());
    };

    scheduleMidnight();

    const onVisible = () => {
      if (document.visibilityState === "visible") {
        setTick((t) => t + 1);
      }
    };

    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);
}
