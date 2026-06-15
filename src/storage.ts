const STORAGE_KEY = "markpeek:draft";

export function loadDraft(fallback: string): string {
  return window.localStorage.getItem(STORAGE_KEY) ?? fallback;
}

export function saveDraft(value: string): void {
  window.localStorage.setItem(STORAGE_KEY, value);
}
