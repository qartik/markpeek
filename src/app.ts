import {
  Bold,
  Code,
  Expand,
  Github,
  Heading,
  Image as ImageIcon,
  Italic,
  Link,
  List,
  ListOrdered,
  Quote,
  Search,
  Share2,
  Shrink,
  WandSparkles,
  createElement,
  type IconNode,
} from "lucide";
import { EditorHistory } from "./history";
import { renderMarkdown } from "./markdown";
import { attachPasteHandler } from "./paste";
import { syncScrolling } from "./scroll-sync";
import {
  clearSharedDraftFromUrl,
  createShareUrl,
  loadInitialDraft,
} from "./share";
import { saveDraft } from "./storage";
import {
  cleanWhitespace,
  findNext,
  replaceAll,
  replaceMatch,
  type FindMatch,
} from "./find-replace";
import { LocalTextManipulation, type FormatAction } from "./text-manipulation";
import "./styles.css";
import "highlight.js/styles/github.css";

const DEFAULT_DRAFT = `## Welcome to markpeek

Use the toolbar or type Markdown directly.

- **Bold**, _italic_, and ~~strikethrough~~
- [Links](https://www.discourse.org), inline \`code\`, and images by URL
- Tables and fenced code blocks

> This quote uses the same Markdown marker the Discourse composer inserts.

| Feature | Status |
| --- | --- |
| Split editor | Ready |
| Live preview | Ready |

\`\`\`js
console.log("Rendered with markdown-it");
\`\`\`
`;

const toolbarItems: Array<{
  action: FormatAction;
  label: string;
  icon: IconNode;
  shortcut?: string;
}> = [
  { action: "bold", label: "Bold", icon: Bold, shortcut: "Mod+B" },
  { action: "italic", label: "Italic", icon: Italic, shortcut: "Mod+I" },
  { action: "link", label: "Link", icon: Link, shortcut: "Mod+K" },
  { action: "image", label: "Image by URL", icon: ImageIcon },
  { action: "quote", label: "Quote", icon: Quote, shortcut: "Mod+Shift+9" },
  { action: "code", label: "Code", icon: Code, shortcut: "Mod+E" },
  { action: "bullet-list", label: "Bullet list", icon: List },
  { action: "numbered-list", label: "Numbered list", icon: ListOrdered },
  {
    action: "heading",
    label: "Cycle heading level",
    icon: Heading,
    shortcut: "Shift+Mod+H",
  },
];

type ViewMode = "split" | "editor-zen" | "preview-zen";

export async function mountApp(
  doc: Document = document,
  win: Window = window,
): Promise<void> {
  doc.querySelector<HTMLDivElement>("#app")!.innerHTML = `
    <main class="markdown-previewer" data-view-mode="split" data-chrome-hidden="false">
      <header class="markdown-previewer__header">
        <div class="markdown-previewer__header-copy">
          <h1 class="markdown-previewer__title">
            <span class="markdown-previewer__title-icon" aria-hidden="true" data-header-icon="markdown"></span>
            markpeek
          </h1>
          <p class="markdown-previewer__subtitle">A browser-first Markdown drafting desk with local drafts, live preview, smart paste, and explicit shareable URLs.</p>
        </div>
        <div class="markdown-previewer__header-actions">
          <p class="markdown-previewer__share-status" aria-live="polite" data-share-status></p>
          <nav class="markdown-previewer__header-links" aria-label="Project links">
            <button type="button" class="markdown-previewer__header-action" data-share-button aria-label="Copy shareable URL">
              <span data-header-icon="share"></span>
              <span>Share</span>
            </button>
            <a href="https://github.com/qartik/markpeek" target="_blank" rel="noreferrer" aria-label="GitHub source">
              <span data-header-icon="github"></span>
            </a>
          </nav>
        </div>
      </header>
      <section class="markdown-previewer__workspace">
        <section class="markdown-previewer__pane" data-pane="editor" aria-labelledby="editor-heading">
          <div class="markdown-previewer__pane-header">
            <h2 id="editor-heading" class="markdown-previewer__pane-title">Editor</h2>
            <div class="markdown-previewer__toolbar" role="toolbar" aria-label="Formatting tools">
              <div class="markdown-previewer__toolbar-group" data-toolbar-group="formatting"></div>
              <div class="markdown-previewer__toolbar-group" aria-label="Text cleanup tools">
                <button type="button" class="markdown-previewer__toolbar-button" data-find-replace-open aria-label="Find and replace" title="Find and replace (Mod+Option+F)">
                  <span data-pane-icon="find-replace"></span>
                </button>
                <button type="button" class="markdown-previewer__toolbar-button" data-cleanup-whitespace aria-label="Clean whitespace" title="Clean whitespace (Mod+Option+W)">
                  <span data-pane-icon="cleanup-whitespace"></span>
                </button>
              </div>
              <div class="markdown-previewer__toolbar-group markdown-previewer__toolbar-group--view">
                <button
                  type="button"
                  class="markdown-previewer__toolbar-button markdown-previewer__toolbar-button--text"
                  data-view-toggle="editor-zen"
                  aria-label="Toggle editor zen mode"
                  title="Editor zen mode"
                >
                  <span data-pane-icon="editor-zen-enter"></span>
                  <span>Zen</span>
                </button>
                <button
                  type="button"
                  class="markdown-previewer__toolbar-button markdown-previewer__toolbar-button--text"
                  data-view-toggle="split"
                  data-visible-in="editor-zen"
                  aria-label="Exit editor zen mode"
                  title="Back to split view"
                  hidden
                >
                  <span data-pane-icon="split-exit-editor"></span>
                  <span>Split view</span>
                </button>
              </div>
            </div>
          </div>
          <section class="markdown-previewer__find-replace" data-find-replace hidden aria-label="Find and replace">
            <div class="markdown-previewer__find-replace-fields">
              <label>
                <span>Find</span>
                <input type="text" data-find-input aria-label="Find text" autocomplete="off" />
              </label>
              <label data-replace-controls>
                <span>Replace</span>
                <input type="text" data-replace-input aria-label="Replace with" autocomplete="off" />
              </label>
            </div>
            <div class="markdown-previewer__find-replace-actions">
              <label class="markdown-previewer__find-replace-toggle">
                <input type="checkbox" data-regex-toggle />
                <span>Use regular expression</span>
              </label>
              <p data-find-status class="markdown-previewer__find-status" aria-live="polite"></p>
              <button type="button" class="markdown-previewer__toolbar-button markdown-previewer__toolbar-button--text" data-find-next>Find next</button>
              <button type="button" class="markdown-previewer__toolbar-button markdown-previewer__toolbar-button--text" data-replace-next data-replace-controls>Replace next</button>
              <button type="button" class="markdown-previewer__toolbar-button markdown-previewer__toolbar-button--text" data-replace-all data-replace-controls>Replace all</button>
              <button type="button" class="markdown-previewer__toolbar-button markdown-previewer__toolbar-button--text" data-find-close>Close</button>
            </div>
          </section>
          <textarea
            class="markdown-previewer__editor"
            aria-label="Markdown editor"
            spellcheck="true"
          ></textarea>
        </section>
        <section class="markdown-previewer__pane" data-pane="preview" aria-labelledby="preview-heading">
          <div class="markdown-previewer__pane-header">
            <h2 id="preview-heading" class="markdown-previewer__pane-title">Preview</h2>
            <div class="markdown-previewer__toolbar markdown-previewer__toolbar--pane" role="toolbar" aria-label="Preview display options">
              <div class="markdown-previewer__toolbar-group markdown-previewer__toolbar-group--view">
                <button
                  type="button"
                  class="markdown-previewer__toolbar-button markdown-previewer__toolbar-button--text"
                  data-view-toggle="preview-zen"
                  aria-label="Show preview only"
                  title="Preview only"
                >
                  <span data-pane-icon="preview-zen-enter"></span>
                  <span>Preview only</span>
                </button>
                <button
                  type="button"
                  class="markdown-previewer__toolbar-button markdown-previewer__toolbar-button--text"
                  data-view-toggle="split"
                  data-visible-in="preview-zen"
                  aria-label="Exit preview only mode"
                  title="Back to split view"
                  hidden
                >
                  <span data-pane-icon="split-exit-preview"></span>
                  <span>Split view</span>
                </button>
              </div>
            </div>
          </div>
          <article class="markdown-previewer__preview cooked" aria-live="polite"></article>
        </section>
      </section>
    </main>
  `;

  const toolbar = doc.querySelector<HTMLDivElement>(".markdown-previewer__toolbar")!;
  const app = doc.querySelector<HTMLElement>(".markdown-previewer")!;
  const formattingToolbar = doc.querySelector<HTMLDivElement>(
    '[data-toolbar-group="formatting"]',
  )!;
  const editor = doc.querySelector<HTMLTextAreaElement>(".markdown-previewer__editor")!;
  const preview = doc.querySelector<HTMLElement>(".markdown-previewer__preview")!;
  const findReplacePanel = doc.querySelector<HTMLElement>("[data-find-replace]")!;
  const findInput = doc.querySelector<HTMLInputElement>("[data-find-input]")!;
  const replaceInput = doc.querySelector<HTMLInputElement>("[data-replace-input]")!;
  const regexToggle = doc.querySelector<HTMLInputElement>("[data-regex-toggle]")!;
  const findStatus = doc.querySelector<HTMLElement>("[data-find-status]")!;
  const shareButton = doc.querySelector<HTMLButtonElement>("[data-share-button]")!;
  const shareStatus = doc.querySelector<HTMLElement>("[data-share-status]")!;
  const textManipulation = new LocalTextManipulation(editor);
  const history = new EditorHistory(editor);
  let viewMode: ViewMode = "split";
  let hasUserEdited = false;
  let currentMatch: FindMatch | null = null;

  renderToolbar(formattingToolbar);
  renderHeaderLinks(doc);
  renderViewMode(app, viewMode);

  const initialDraft = await loadInitialDraft(DEFAULT_DRAFT, win.location);
  editor.value = initialDraft.value;
  renderPreview(editor, preview);
  history.record();
  syncScrolling(editor, preview, () => viewMode === "split");
  attachPasteHandler(editor, textManipulation);

  editor.addEventListener("input", () => {
    if (!hasUserEdited) {
      hasUserEdited = true;
    }

    clearSharedDraftFromUrl(win);
    renderPreview(editor, preview);
    saveDraft(editor.value);
    history.record();
    clearShareStatus(shareStatus);
  });

  editor.addEventListener("keydown", (event) => {
    if (findReplaceKeyboardAction(event)) {
      event.preventDefault();
      if (event.code === "KeyW") {
        applyWhitespaceCleanup();
      } else {
        openFindReplace(event.altKey);
      }
      return;
    }

    const action = keyboardAction(event);

    if (!action) {
      return;
    }

    event.preventDefault();
    performAction(action, history, textManipulation);
  });

  toolbar.addEventListener("click", (event) => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>(
      "[data-action]",
    );

    if (!button?.dataset.action) {
      return;
    }

    performAction(button.dataset.action, history, textManipulation);
  });

  doc.addEventListener("click", (event) => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>(
      "[data-view-toggle]",
    );

    const nextMode = button?.dataset.viewToggle as ViewMode | undefined;
    if (!nextMode) {
      return;
    }

    setViewMode(nextMode);
  });

  doc.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") {
      return;
    }

    if (!findReplacePanel.hidden) {
      event.preventDefault();
      closeFindReplace();
      return;
    }

    if (viewMode === "split") {
      return;
    }
    event.preventDefault();
    setViewMode("split");
  });

  shareButton.addEventListener("click", async () => {
    await shareDraft(editor.value, shareStatus, doc, win);
  });

  doc.querySelector<HTMLButtonElement>("[data-find-replace-open]")!.addEventListener("click", () => {
    openFindReplace(true);
  });
  doc.querySelector<HTMLButtonElement>("[data-cleanup-whitespace]")!.addEventListener("click", () => {
    applyWhitespaceCleanup();
  });
  doc.querySelector<HTMLButtonElement>("[data-find-next]")!.addEventListener("click", () => {
    findAndSelect();
  });
  doc.querySelector<HTMLButtonElement>("[data-replace-next]")!.addEventListener("click", () => {
    replaceNextMatch();
  });
  doc.querySelector<HTMLButtonElement>("[data-replace-all]")!.addEventListener("click", () => {
    replaceEveryMatch();
  });
  doc.querySelector<HTMLButtonElement>("[data-find-close]")!.addEventListener("click", closeFindReplace);
  findInput.addEventListener("input", () => {
    currentMatch = null;
    clearFindStatus();
  });
  regexToggle.addEventListener("change", () => {
    currentMatch = null;
    clearFindStatus();
  });

  function openFindReplace(showReplacement: boolean): void {
    const selected = editor.value.slice(editor.selectionStart, editor.selectionEnd);
    if (selected) {
      findInput.value = selected;
    }
    findReplacePanel.hidden = false;
    findReplacePanel.querySelectorAll<HTMLElement>("[data-replace-controls]").forEach((element) => {
      element.hidden = !showReplacement;
    });
    currentMatch = null;
    clearFindStatus();
    findInput.focus();
    findInput.select();
  }

  function closeFindReplace(): void {
    findReplacePanel.hidden = true;
    currentMatch = null;
    editor.focus({ preventScroll: true });
  }

  function findAndSelect(): FindMatch | null {
    const from = currentMatch
      ? currentMatch.end + Number(currentMatch.start === currentMatch.end)
      : editor.selectionEnd;
    const result = findNext(editor.value, findInput.value, regexToggle.checked, from);
    if (!result.ok) {
      setFindStatus(result.error);
      return null;
    }
    if (!result.match) {
      setFindStatus(findInput.value ? "No matches found." : "Enter text to find.");
      currentMatch = null;
      return null;
    }

    currentMatch = result.match;
    editor.setSelectionRange(result.match.start, result.match.end);
    editor.focus({ preventScroll: true });
    setFindStatus(result.match.wrapped ? "Wrapped to the first match." : "Match found.");
    return result.match;
  }

  function replaceNextMatch(): void {
    const match = currentMatch ?? findAndSelect();
    if (!match) return;

    const replacement = replaceMatch(
      editor.value,
      findInput.value,
      replaceInput.value,
      regexToggle.checked,
      match,
    );
    const replacementLength = replacement.length - editor.value.length + match.end - match.start;
    applyEditorValue(replacement, match.start, match.start + replacementLength);
    currentMatch = null;
    setFindStatus("Replaced one match.");
  }

  function replaceEveryMatch(): void {
    const result = replaceAll(
      editor.value,
      findInput.value,
      replaceInput.value,
      regexToggle.checked,
    );
    if (!result.ok) {
      setFindStatus(result.error);
      return;
    }
    if (result.count === 0) {
      setFindStatus(findInput.value ? "No matches found." : "Enter text to find.");
      return;
    }

    applyEditorValue(result.value, editor.selectionStart, editor.selectionEnd);
    currentMatch = null;
    setFindStatus(`Replaced ${result.count} match${result.count === 1 ? "" : "es"}.`);
  }

  function applyWhitespaceCleanup(): void {
    const cleaned = cleanWhitespace(editor.value);
    if (cleaned === editor.value) {
      return;
    }
    applyEditorValue(
      cleaned,
      Math.min(editor.selectionStart, cleaned.length),
      Math.min(editor.selectionEnd, cleaned.length),
    );
  }

  function applyEditorValue(value: string, selectionStart: number, selectionEnd: number): void {
    editor.value = value;
    editor.setSelectionRange(selectionStart, selectionEnd);
    editor.dispatchEvent(new Event("input", { bubbles: true }));
  }

  function setFindStatus(message: string): void {
    findStatus.textContent = message;
  }

  function clearFindStatus(): void {
    findStatus.textContent = "";
  }

  function setViewMode(nextMode: ViewMode): void {
    viewMode = nextMode;
    renderViewMode(app, viewMode);
  }
}

function renderToolbar(formattingToolbar: HTMLDivElement): void {
  toolbarItems.forEach(({ action, label, icon, shortcut }) => {
    formattingToolbar.append(toolbarButton(action, label, icon, shortcut));
  });
}

function renderPreview(
  editor: HTMLTextAreaElement,
  preview: HTMLElement,
): void {
  preview.innerHTML = renderMarkdown(editor.value);
}

function toolbarButton(
  action: string,
  label: string,
  icon: IconNode,
  shortcut?: string,
): HTMLButtonElement {
  const button = document.createElement("button");
  button.className = "markdown-previewer__toolbar-button";
  button.type = "button";
  button.dataset.action = action;
  button.title = shortcut ? `${label} (${shortcut})` : label;
  button.setAttribute("aria-label", label);
  if (shortcut) {
    button.setAttribute("aria-keyshortcuts", shortcut.replaceAll("+", " "));
  }
  button.append(
    createElement(icon, { width: 18, height: 18, "aria-hidden": "true" }),
  );
  return button;
}

function renderHeaderLinks(doc: Document): void {
  doc.querySelector('[data-header-icon="markdown"]')?.append(markdownLogoElement());
  doc.querySelector('[data-header-icon="share"]')?.append(
    createElement(Share2, { width: 16, height: 16, "aria-hidden": "true" }),
  );
  doc.querySelector('[data-header-icon="github"]')?.append(
    createElement(Github, { width: 18, height: 18, "aria-hidden": "true" }),
  );
  doc.querySelector('[data-pane-icon="editor-zen-enter"]')?.append(
    createElement(Expand, { width: 16, height: 16, "aria-hidden": "true" }),
  );
  doc.querySelector('[data-pane-icon="preview-zen-enter"]')?.append(
    createElement(Expand, { width: 16, height: 16, "aria-hidden": "true" }),
  );
  doc.querySelector('[data-pane-icon="split-exit-editor"]')?.append(
    createElement(Shrink, { width: 16, height: 16, "aria-hidden": "true" }),
  );
  doc.querySelector('[data-pane-icon="split-exit-preview"]')?.append(
    createElement(Shrink, { width: 16, height: 16, "aria-hidden": "true" }),
  );
  doc.querySelector('[data-pane-icon="find-replace"]')?.append(
    createElement(Search, { width: 18, height: 18, "aria-hidden": "true" }),
  );
  doc.querySelector('[data-pane-icon="cleanup-whitespace"]')?.append(
    createElement(WandSparkles, { width: 18, height: 18, "aria-hidden": "true" }),
  );
}

function renderViewMode(app: HTMLElement, viewMode: ViewMode): void {
  app.dataset.viewMode = viewMode;
  app.dataset.chromeHidden = viewMode === "split" ? "false" : "true";

  app.querySelectorAll<HTMLButtonElement>("[data-view-toggle]").forEach((button) => {
    const nextMode = button.dataset.viewToggle as ViewMode | undefined;
    const visibleIn = button.dataset.visibleIn as ViewMode | undefined;
    const shouldShow =
      visibleIn !== undefined ? visibleIn === viewMode : nextMode !== viewMode;

    button.hidden = !shouldShow;
    button.setAttribute("aria-pressed", String(nextMode === viewMode));
  });

  app.querySelectorAll<HTMLElement>("[data-visible-in]").forEach((element) => {
    element.hidden = element.dataset.visibleIn !== viewMode;
  });
}

function markdownLogoElement(): SVGSVGElement {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 640 512");
  svg.setAttribute("width", "24");
  svg.setAttribute("height", "20");
  svg.setAttribute("focusable", "false");
  svg.setAttribute("aria-hidden", "true");

  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("fill", "currentColor");
  path.setAttribute(
    "d",
    "M593.8 59.1l-547.6 0C20.7 59.1 0 79.8 0 105.2L0 406.7c0 25.5 20.7 46.2 46.2 46.2l547.7 0c25.5 0 46.2-20.7 46.1-46.1l0-301.6c0-25.4-20.7-46.1-46.2-46.1zM338.5 360.6l-61.5 0 0-120-61.5 76.9-61.5-76.9 0 120-61.7 0 0-209.2 61.5 0 61.5 76.9 61.5-76.9 61.5 0 0 209.2 .2 0zm135.3 3.1l-92.3-107.7 61.5 0 0-104.6 61.5 0 0 104.6 61.5 0-92.2 107.7z",
  );
  svg.append(path);

  return svg;
}

function performAction(
  action: string,
  history: EditorHistory,
  textManipulation: LocalTextManipulation,
): void {
  if (action === "undo") {
    history.undo();
    return;
  }

  if (action === "redo") {
    history.redo();
    return;
  }

  textManipulation.apply(action as FormatAction);
}

function keyboardAction(event: KeyboardEvent): string | null {
  if (!event.metaKey && !event.ctrlKey) {
    return null;
  }

  const key = event.key.toLowerCase();

  if (key === "z" && !event.shiftKey) {
    return "undo";
  }

  if ((key === "z" && event.shiftKey) || key === "y") {
    return "redo";
  }

  if (event.shiftKey && (key === "(" || event.code === "Digit9")) {
    return "quote";
  }

  if (key === "h" && event.shiftKey) {
    return "heading";
  }

  if (event.shiftKey) {
    return null;
  }

  switch (key) {
    case "b":
      return "bold";
    case "i":
      return "italic";
    case "k":
      return "link";
    case "e":
      return "code";
    default:
      return null;
  }
}

function findReplaceKeyboardAction(event: KeyboardEvent): boolean {
  if ((!event.metaKey && !event.ctrlKey) || event.shiftKey) {
    return false;
  }

  return event.code === "KeyF" || (event.altKey && event.code === "KeyW");
}

async function copyText(
  text: string,
  doc: Document,
  navigatorLike: Navigator,
): Promise<boolean> {
  if (navigatorLike.clipboard?.writeText) {
    try {
      await Promise.race([
        navigatorLike.clipboard.writeText(text),
        new Promise((_, reject) => {
          window.setTimeout(() => {
            reject(new Error("Clipboard timeout"));
          }, 750);
        }),
      ]);
      return true;
    } catch {
      // Fall through to the legacy copy path when the async clipboard API is
      // unavailable, rejected, or stalls in the current browser context.
    }
  }

  const textarea = doc.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "true");
  textarea.className = "markdown-previewer__clipboard-proxy";
  doc.body.append(textarea);
  textarea.select();

  try {
    return doc.execCommand("copy");
  } catch {
    return false;
  } finally {
    textarea.remove();
  }
}

export async function shareDraft(
  markdown: string,
  shareStatus: HTMLElement,
  doc: Document = document,
  win: Window = window,
): Promise<void> {
  const result = await createShareUrl(markdown, win.location);
  if (!result.ok) {
    setShareStatus(
      shareStatus,
      result.reason === "too-large"
        ? "Draft is too large to share by URL."
        : "Could not create a shareable URL.",
      "error",
    );
    return;
  }

  win.history.replaceState(null, "", result.url);
  const copied = await copyText(result.url, doc, win.navigator);
  setShareStatus(
    shareStatus,
    copied
      ? "Shareable URL copied."
      : "Shareable URL ready in the address bar.",
    copied ? "success" : "error",
  );
}

function setShareStatus(
  element: HTMLElement,
  message: string,
  tone: "success" | "error",
): void {
  element.textContent = message;
  element.dataset.tone = tone;
}

function clearShareStatus(element: HTMLElement): void {
  element.textContent = "";
  delete element.dataset.tone;
}
