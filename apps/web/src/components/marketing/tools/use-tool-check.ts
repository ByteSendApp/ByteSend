"use client";

import { useCallback, useEffect, useState } from "react";

export function useToolCheck<T>(endpoint: string, fields: string[]) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [result, setResult] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const run = useCallback(
    async (input: Record<string, string>) => {
      const params = new URLSearchParams();
      for (const field of fields) {
        const value = input[field]?.trim();
        if (value) params.set(field, value);
      }
      if (!params.get(fields[0]!)) return;

      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`${endpoint}?${params}`);
        const body = await response.json();
        if (!response.ok) {
          setResult(null);
          setError(body.error ?? "Something went wrong. Try again in a moment.");
          return;
        }
        setResult(body as T);
        window.history.replaceState(null, "", `?${params}`);
      } catch {
        setError("Couldn't reach the checker. Check your connection and try again.");
      } finally {
        setLoading(false);
      }
    },
    [endpoint, fields],
  );

  useEffect(() => {
    const search = new URLSearchParams(window.location.search);
    const initial = Object.fromEntries(fields.map((field) => [field, search.get(field) ?? ""]));
    if (initial[fields[0]!]) {
      setValues(initial);
      void run(initial);
    }
  }, [fields, run]);

  const setValue = (field: string, value: string) => setValues((current) => ({ ...current, [field]: value }));

  return { values, setValue, run: () => run(values), result, error, loading };
}
