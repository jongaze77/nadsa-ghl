// src/lib/useLocalStorageMembershipTypeFilter.ts

import { useState, useEffect } from "react";
import type { MembershipType } from "@/components/MembershipTypeFilterPanel";

const MEMBERSHIP_TYPE_FILTER_KEY = "membershipTypeFilters";

/**
 * Provides a [value, setValue] for membership type filter, persisted to localStorage.
 * Safe for SSR/Next.js apps.
 */
export function useLocalStorageMembershipTypeFilter(): [
  MembershipType[],
  (val: MembershipType[]) => void
] {
  const [selected, setSelected] = useState<MembershipType[]>(() => {
    if (typeof window !== "undefined") {
      try {
        const raw = localStorage.getItem(MEMBERSHIP_TYPE_FILTER_KEY);
        if (raw) {
          const arr = JSON.parse(raw);
          if (Array.isArray(arr)) {
            return arr.filter((v) =>
              ["Full", "Associate", "Newsletter Only"].includes(v)
            );
          }
        }
      } catch {}
    }
    return [];
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem(MEMBERSHIP_TYPE_FILTER_KEY, JSON.stringify(selected));
  }, [selected]);

  return [selected, setSelected];
}