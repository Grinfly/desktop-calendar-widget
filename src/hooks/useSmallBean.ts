import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";

interface SmallBeanState {
  available: boolean;
  enabled: boolean;
  collapsed: boolean;
}

const initialState: SmallBeanState = { available: false, enabled: false, collapsed: false };

export function useSmallBean(browserDemo: boolean, flush: () => Promise<void>) {
  const [state, setState] = useState(initialState);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const changing = useRef(false);

  useEffect(() => {
    if (browserDemo) return;
    let current = true;
    void invoke<SmallBeanState>("get_small_bean_state").then((next) => {
      if (current) setState(next);
    }).catch((cause) => console.error("读取小蚕豆状态失败", cause));
    return () => { current = false; };
  }, [browserDemo]);

  const change = async (command: string, values: Record<string, boolean>) => {
    if (changing.current) return false;
    changing.current = true;
    setBusy(true);
    setError(null);
    try {
      if (values.enabled || values.collapsed) await flush();
      setState(await invoke<SmallBeanState>(command, values));
      return true;
    } catch (cause) {
      console.error("切换小蚕豆失败", cause);
      setError("无法切换小蚕豆模式，请重试。");
      return false;
    } finally {
      changing.current = false;
      setBusy(false);
    }
  };

  return {
    ...state, busy, error,
    setEnabled: (enabled: boolean) => change("set_small_bean_mode", { enabled }),
    setCollapsed: (collapsed: boolean) => change("set_small_bean_collapsed", { collapsed }),
  };
}
