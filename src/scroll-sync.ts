function scrollRatio(element: HTMLElement): number {
  const scrollable = element.scrollHeight - element.clientHeight;
  return scrollable <= 0 ? 0 : element.scrollTop / scrollable;
}

function applyScrollRatio(element: HTMLElement, ratio: number): void {
  const scrollable = element.scrollHeight - element.clientHeight;
  element.scrollTop = scrollable <= 0 ? 0 : ratio * scrollable;
}

export function syncScrolling(
  editor: HTMLTextAreaElement,
  preview: HTMLElement,
): void {
  let syncing = false;

  function sync(source: HTMLElement, target: HTMLElement): void {
    if (syncing) {
      return;
    }

    syncing = true;
    window.requestAnimationFrame(() => {
      applyScrollRatio(target, scrollRatio(source));
      syncing = false;
    });
  }

  editor.addEventListener("scroll", () => sync(editor, preview), {
    passive: true,
  });
  preview.addEventListener("scroll", () => sync(preview, editor), {
    passive: true,
  });
}
