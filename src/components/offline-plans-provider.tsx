"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

import type { SavedOfflinePlans } from "@/lib/offline/plan-types";
import { readOfflinePlans } from "@/lib/offline/plan-storage";
import { downloadOfflinePlans, identifyPlanAccount, subscribeOfflinePlans } from "@/lib/offline/plans";

type OfflinePlansContextValue = {
  catalog: SavedOfflinePlans | null;
  loading: boolean;
  refreshing: boolean;
  offlineReady: boolean;
  error: string | null;
  refresh: () => Promise<void>;
};
const OfflinePlansContext = createContext<OfflinePlansContextValue | null>(null);
const publicPaths = new Set(["/login", "/privacidad", "/terminos", "/novedades"]);

export function OfflinePlansProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [catalog, setCatalog] = useState<SavedOfflinePlans | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [offlineReady, setOfflineReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requests = useRef(0);
  const reads = useRef(0);
  const invalidate = useCallback(() => {
    ++requests.current;
    ++reads.current;
  }, []);

  useEffect(() => {
    if (!("serviceWorker" in navigator) || !("caches" in window)) return;
    let alive = true;
    const check = async () => {
      try {
        const pages = await Promise.all(["/abrir", "/planes-guardados", "/entreno", "/offline"].map((path) => caches.match(path, { ignoreSearch: true })));
        if (alive) setOfflineReady(pages.every(Boolean));
      } catch { if (alive) setOfflineReady(false); }
    };
    void navigator.serviceWorker.ready.then(check);
    navigator.serviceWorker.addEventListener("controllerchange", check);
    return () => { alive = false; navigator.serviceWorker.removeEventListener("controllerchange", check); };
  }, []);

  const reload = useCallback(async () => {
    const read = ++reads.current;
    try {
      const saved = await readOfflinePlans();
      if (read === reads.current) setCatalog(saved);
    } catch {
      if (read === reads.current) {
        setCatalog(null);
        setError("No se puede acceder a los planes guardados en este navegador. Vuelve a intentarlo.");
      }
    } finally {
      if (read === reads.current) setLoading(false);
    }
  }, []);

  const refresh = useCallback(async () => {
    const request = ++requests.current;
    setRefreshing(true);
    try {
      await downloadOfflinePlans();
      if (request === requests.current) setError(null);
    } catch (cause) {
      if (request === requests.current) setError(cause instanceof Error ? cause.message : "No se pudieron actualizar los planes.");
    } finally {
      await reload();
      if (request === requests.current) setRefreshing(false);
    }
  }, [reload]);

  useEffect(() => {
    let alive = true;
    let lastAttempt = 0;
    const update = () => {
      if (!alive || publicPaths.has(pathname) || !navigator.onLine || document.visibilityState === "hidden") return;
      // focus y visibilitychange suelen llegar juntos al volver al móvil.
      if (Date.now() - lastAttempt < 1000) return;
      lastAttempt = Date.now();
      void refresh();
    };
    const unsubscribe = subscribeOfflinePlans(() => { if (alive) void reload(); });
    void (async () => {
      if (pathname === "/login") {
        try { await identifyPlanAccount(null); } catch { /* reload mostrará el error de almacenamiento. */ }
      }
      if (!alive) return;
      await reload();
      if (!alive) return;
      setRefreshing(false);
      update();
    })();
    window.addEventListener("online", update);
    window.addEventListener("focus", update);
    document.addEventListener("visibilitychange", update);
    return () => {
      alive = false;
      invalidate();
      unsubscribe();
      window.removeEventListener("online", update);
      window.removeEventListener("focus", update);
      document.removeEventListener("visibilitychange", update);
    };
  }, [pathname, refresh, reload, invalidate]);

  return <OfflinePlansContext.Provider value={{ catalog, loading, refreshing, offlineReady, error, refresh }}>
    {children}
  </OfflinePlansContext.Provider>;
}

export function useOfflinePlans() {
  const value = useContext(OfflinePlansContext);
  if (!value) throw new Error("Falta OfflinePlansProvider.");
  return value;
}

/** Solo la API confirma la cuenta: un header cacheado no debe reactivar otra. */
export function OfflinePlansIdentity({ userId }: { userId: string }) {
  const { refresh } = useOfflinePlans();
  useEffect(() => {
    if (navigator.onLine) void refresh();
  }, [userId, refresh]);
  return null;
}
