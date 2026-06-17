const STORAGE_KEY = "markpeek:draft";

export function loadStoredDraft(): string | null {
  return window.localStorage.getItem(STORAGE_KEY);
}

export function loadDraft(fallback: string): string {
  return loadStoredDraft() ?? fallback;
}

export function saveDraft(value: string): void {
  window.localStorage.setItem(STORAGE_KEY, value);
}
