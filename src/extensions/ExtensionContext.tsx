import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import {
  installExtension,
  loadInstalledModules,
  uninstallExtension,
} from "./loader";
import type { ExtensionManifest } from "./types";

interface ExtensionContextValue {
  loaded: boolean;
  manifests: ExtensionManifest[];
  getDaySubLabel: (date: Date) => string | undefined;
  install: () => Promise<void>;
  uninstall: (id: string) => Promise<void>;
  error: string | null;
}

const ExtensionContext = createContext<ExtensionContextValue | null>(null);

function noneSubLabel(_date: Date): string | undefined {
  return undefined;
}

export function ExtensionProvider({ children }: { children: ReactNode }) {
  const [loaded, setLoaded] = useState(false);
  const [manifests, setManifests] = useState<ExtensionManifest[]>([]);
  const [getDaySubLabel, setGetDaySubLabel] = useState<
    (date: Date) => string | undefined
  >(() => noneSubLabel);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    void (async () => {
      try {
        const result = await loadInstalledModules();
        if (!active) return;
        setManifests(result.manifests);
        setGetDaySubLabel(() => result.getDaySubLabel);
      } catch (cause) {
        if (!active) return;
        setError(cause instanceof Error ? cause.message : String(cause));
      } finally {
        if (active) setLoaded(true);
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  const install = useCallback(async () => {
    setError(null);
    try {
      const installed = await installExtension();
      if (installed) {
        window.location.reload();
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  }, []);

  const uninstall = useCallback(async (id: string) => {
    setError(null);
    try {
      await uninstallExtension(id);
      window.location.reload();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  }, []);

  const value = useMemo(
    () => ({
      loaded,
      manifests,
      getDaySubLabel,
      install,
      uninstall,
      error,
    }),
    [loaded, manifests, getDaySubLabel, install, uninstall, error],
  );

  return (
    <ExtensionContext.Provider value={value}>
      {children}
    </ExtensionContext.Provider>
  );
}

export function useExtensions(): ExtensionContextValue {
  const value = useContext(ExtensionContext);
  if (!value) {
    throw new Error("useExtensions must be used within ExtensionProvider");
  }
  return value;
}
