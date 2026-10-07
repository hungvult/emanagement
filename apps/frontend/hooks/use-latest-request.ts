"use client";

import { useCallback, useEffect, useRef } from "react";

// All response handlers (including errors/loading) must belong to the newest
// request. Invalidate on unmount so pending requests cannot update a closed page.
export function useLatestRequest() {
  const version = useRef(0);
  const invalidate = useCallback(() => {
    version.current += 1;
  }, []);
  useEffect(() => invalidate, [invalidate]);
  return useCallback(() => {
    const current = ++version.current;
    return () => current === version.current;
  }, []);
}
