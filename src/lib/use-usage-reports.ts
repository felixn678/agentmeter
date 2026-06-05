import { useCallback, useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { ActiveBlock, Granularity, UsageReport } from "./usage-types";

const GRANS: Granularity[] = ["daily", "weekly", "monthly"];

export type Reports = Partial<Record<Granularity, UsageReport>>;

export type UseUsageOptions = {
  intervalMs: number; // <= 0 means manual (no auto-revalidation)
  pauseWhenHidden: boolean;
};

// Preload every granularity once (ccusage can be slow), then silently revalidate on
// the configured interval so the dashboard stays near real-time. View switches read
// from this cache instead of fetching, so they are instant. A failed background
// revalidation keeps the existing data rather than flashing an error over good data.
export function useUsageReports({ intervalMs, pauseWhenHidden }: UseUsageOptions) {
  const [reports, setReports] = useState<Reports>({});
  const [activeBlock, setActiveBlock] = useState<ActiveBlock | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const hasData = useRef(false);
  const cancelled = useRef(false);

  const load = useCallback(() => {
    // Live burn rate — best-effort, keep previous value on failure.
    invoke<ActiveBlock | null>("get_blocks")
      .then((b) => {
        if (!cancelled.current) setActiveBlock(b ?? null);
      })
      .catch(() => {});

    Promise.allSettled(
      GRANS.map((g) =>
        invoke<UsageReport>("get_usage", { granularity: g }).then((r) => [g, r] as const),
      ),
    ).then((results) => {
      if (cancelled.current) return;
      const next: Reports = {};
      let firstError: string | null = null;
      for (const res of results) {
        if (res.status === "fulfilled") next[res.value[0]] = res.value[1];
        else if (!firstError) firstError = String(res.reason);
      }
      if (Object.keys(next).length > 0) {
        hasData.current = true;
        setReports(next);
        setError(null);
      } else if (firstError && !hasData.current) {
        setError(firstError);
      }
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    cancelled.current = false;
    load(); // always fetch once on mount / when cadence changes

    if (intervalMs <= 0) {
      return () => {
        cancelled.current = true;
      };
    }

    const id = setInterval(() => {
      if (pauseWhenHidden && document.hidden) return; // skip while the window is hidden
      load();
    }, intervalMs);

    return () => {
      cancelled.current = true;
      clearInterval(id);
    };
  }, [intervalMs, pauseWhenHidden, load]);

  return { reports, activeBlock, loading, error, refresh: load };
}
