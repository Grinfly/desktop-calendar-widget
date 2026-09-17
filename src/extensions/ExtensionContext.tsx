import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import {
  installExtension,
  loadInstalledModules,
  loadWorkRestDays,
  uninstallExtension,
  withHostBadges,
} from "./loader";
import type { DayBadge, ExtensionManifest } from "./types";

interface ExtensionContextValue {
  loaded: boolean;
  manifests: ExtensionManifest[];
  getDaySubLabel: (date: Date) => string | undefined;
  getDayBadge: (date: Date) => DayBadge | undefined;
  install: () => Promise<void>;
  uninstall: (id: string) => Promise<void>;
  error: string | null;
}

const ExtensionContext = createContext<ExtensionContextValue | null>(null);

function noneSubLabel(_date: Date): string | undefined {
  return undefined;
}

function noneBadge(_date: Date): DayBadge | undefined {
  return undefined;
}

export function ExtensionProvider({ children }: { children: ReactNode }) {
  const [loaded, setLoaded] = useState(false);
  const [manifests, setManifests] = useState<ExtensionManifest[]>([]);
  const [getDaySubLabel, setGetDaySubLabel] = useState<
    (date: Date) => string | undefined
  >(() => noneSubLabel);
  const [getDayBadge, setGetDayBadge] = useState<
    (date: Date) => DayBadge | undefined
  >(() => noneBadge);
  const [error, setError] = useState<string | null>(null);
  const moduleBadgeRef = useRef<(date: Date) => DayBadge | undefined>(noneBadge);

  useEffect(() => {
    let active = true;

    void (async () => {
      try {
        const [result, hostDays] = await Promise.all([
          loadInstalledModules(),
          loadWorkRestDays().catch(() => ({}) as Record<string, string>),
        ]);
        if (!active) return;
        moduleBadgeRef.current = result.getDayBadge;
        setManifests(result.manifests);
        setGetDaySubLabel(() => result.getDaySubLabel);
        setGetDayBadge(() => withHostBadges(hostDays, result.getDayBadge));
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

  useEffect(() => {
    let active = true;
    let timeoutId = 0;

    const schedule = () => {
      const now = new Date();
      const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
      timeoutId = window.setTimeout(() => {
        void (async () => {
          const hostDays = await loadWorkRestDays().catch(
            () => ({}) as Record<string, string>,
          );
          if (!active) return;
          setGetDayBadge(() => withHostBadges(hostDays, moduleBadgeRef.current));
          schedule();
        })();
      }, next.getTime() - now.getTime());
    };

    schedule();
    return () => {
      active = false;
      window.clearTimeout(timeoutId);
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
      getDayBadge,
      install,
      uninstall,
      error,
    }),
    [
      loaded,
      manifests,
      getDaySubLabel,
      getDayBadge,
      install,
      uninstall,
      error,
    ],
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
