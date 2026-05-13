// ── Shared helper for the medicare_clinical_data store ────────────────────────
// Avoids duplication of getClinicalStore / saveClinicalStore between hooks and
// components that need direct (non-React-Query) access.

const CLINICAL_STORAGE_KEY = "medicare_clinical_data";

export function getClinicalStore(): Record<string, unknown[]> {
  try {
    const raw = localStorage.getItem(CLINICAL_STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, unknown[]>;
  } catch {
    return {};
  }
}

export function saveClinicalStore(store: Record<string, unknown[]>): void {
  try {
    localStorage.setItem(CLINICAL_STORAGE_KEY, JSON.stringify(store));
  } catch {}
}
