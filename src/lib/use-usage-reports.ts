import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { Granularity, UsageReport } from "./usage-types";

const GRANS: Granularity[] = ["daily", "weekly", "monthly"];
const REVALIDATE_MS = 30_000;

export type Reports = Partial<Record<Granularity, UsageReport>>;

// Preload every granularity once (ccusage via npx is slow), then silently revalidate
// every 30s so the dashboard stays near real-time. View switches read from this cache
// instead of fetching, so they are instant. A failed background revalidation keeps the
// existing data rather than flashing an error over good data.
export function useUsageReports() {
  const [reports, setReports] = useState<Reports>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const hasData = useRef(false);

  useEffect(() => {
    let cancelled = false;

    const load = () => {
      Promise.allSettled(
        GRANS.map((g) =>
          invoke<UsageReport>("get_usage", { granularity: g }).then((r) => [g, r] as const),
        ),
      ).then((results) => {
        if (cancelled) return;
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
    };

    load();
    const id = setInterval(load, REVALIDATE_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  return { reports, loading, error };
}
