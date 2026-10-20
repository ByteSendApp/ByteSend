"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

type Labels = Record<string, string>;

const BreadcrumbContext = createContext<{
  labels: Labels;
  setLabel: (path: string, label: string | null) => void;
} | null>(null);

export function BreadcrumbProvider({ children }: { children: ReactNode }) {
  const [labels, setLabels] = useState<Labels>({});
  const setLabel = useCallback((path: string, label: string | null) =>
    setLabels((current) => {
      if (label === null) {
        const { [path]: _removed, ...rest } = current;
        return rest;
      }
      return current[path] === label ? current : { ...current, [path]: label };
    }), []);
  const value = useMemo(() => ({ labels, setLabel }), [labels, setLabel]);
  return <BreadcrumbContext.Provider value={value}>{children}</BreadcrumbContext.Provider>;
}

export function useBreadcrumbLabels() {
  return useContext(BreadcrumbContext)?.labels ?? {};
}

/**
 * Names the breadcrumb for `path` (e.g. "/domains/78" → "bytesend.cloud") instead of showing the raw
 * URL segment. Pass undefined while the data loads.
 */
export function useBreadcrumb(path: string, label: string | undefined | null) {
  const context = useContext(BreadcrumbContext);
  const setLabel = context?.setLabel;
  useEffect(() => {
    if (!setLabel || !label) return;
    setLabel(path, label);
    return () => setLabel(path, null);
  }, [setLabel, path, label]);
}
