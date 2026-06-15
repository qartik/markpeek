import {
  Bold,
  Code,
  Heading,
  Image as ImageIcon,
  Italic,
  Link,
  List,
  ListOrdered,
  Quote,
  createElement,
  type IconNode,
} from "lucide";
import { EditorHistory } from "./history";
import { renderMarkdown } from "./markdown";
import { attachPasteHandler } from "./paste";
import { syncScrolling } from "./scroll-sync";
import { loadDraft, saveDraft } from "./storage";
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

document.querySelector<HTMLDivElement>("#app")!.innerHTML = `
  <main class="markdown-previewer">
    <header class="markdown-previewer__header">
      <div class="markdown-previewer__header-copy">
        <h1 class="markdown-previewer__title">
          <span class="markdown-previewer__title-icon" aria-hidden="true" data-header-icon="markdown"></span>
          markpeek
        </h1>
        <p class="markdown-previewer__subtitle">A private Discourse-inspired Markdown drafting desk with live preview and smart paste.</p>
      </div>
      <nav class="markdown-previewer__header-links" aria-label="Project links">
        <a href="https://github.com/qartik/markpeek" target="_blank" rel="noreferrer" aria-label="GitHub source">
          <span data-header-icon="github"></span>
        </a>
      </nav>
    </header>
    <section class="markdown-previewer__workspace">
      <section class="markdown-previewer__pane" aria-labelledby="editor-heading">
        <div class="markdown-previewer__pane-header">
          <h2 id="editor-heading" class="markdown-previewer__pane-title">Editor</h2>
          <div class="markdown-previewer__toolbar" role="toolbar" aria-label="Formatting tools">
            <div class="markdown-previewer__toolbar-group" data-toolbar-group="formatting"></div>
          </div>
        </div>
        <textarea
          class="markdown-previewer__editor"
          aria-label="Markdown editor"
          spellcheck="true"
        ></textarea>
      </section>
      <section class="markdown-previewer__pane" aria-labelledby="preview-heading">
        <div class="markdown-previewer__pane-header">
          <h2 id="preview-heading" class="markdown-previewer__pane-title">Preview</h2>
        </div>
        <article class="markdown-previewer__preview cooked" aria-live="polite"></article>
      </section>
    </section>
  </main>
`;

const toolbar = document.querySelector<HTMLDivElement>(
  ".markdown-previewer__toolbar",
)!;
const formattingToolbar = document.querySelector<HTMLDivElement>(
  '[data-toolbar-group="formatting"]',
)!;
const editor = document.querySelector<HTMLTextAreaElement>(
  ".markdown-previewer__editor",
)!;
const preview = document.querySelector<HTMLElement>(
  ".markdown-previewer__preview",
)!;
const textManipulation = new LocalTextManipulation(editor);
const history = new EditorHistory(editor);

function renderToolbar(): void {
  toolbarItems.forEach(({ action, label, icon, shortcut }) => {
    formattingToolbar.append(toolbarButton(action, label, icon, shortcut));
  });
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

function renderHeaderLinks(): void {
  document
    .querySelector('[data-header-icon="markdown"]')
    ?.append(markdownLogoElement());
  document
    .querySelector('[data-header-icon="github"]')
    ?.append(githubLogoElement());
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

function githubLogoElement(): SVGSVGElement {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 512 512");
  svg.setAttribute("width", "19");
  svg.setAttribute("height", "19");
  svg.setAttribute("focusable", "false");
  svg.setAttribute("aria-hidden", "true");

  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("fill", "currentColor");
  path.setAttribute(
    "d",
    "M173.9 397.4c0 2-2.3 3.6-5.2 3.6-3.3 .3-5.6-1.3-5.6-3.6 0-2 2.3-3.6 5.2-3.6 3-.3 5.6 1.3 5.6 3.6zm-31.1-4.5c-.7 2 1.3 4.3 4.3 4.9 2.6 1 5.6 0 6.2-2s-1.3-4.3-4.3-5.2c-2.6-.7-5.5 .3-6.2 2.3zm44.2-1.7c-2.9 .7-4.9 2.6-4.6 4.9 .3 2 2.9 3.3 5.9 2.6 2.9-.7 4.9-2.6 4.6-4.6-.3-1.9-3-3.2-5.9-2.9zM252.8 8c-138.7 0-244.8 105.3-244.8 244 0 110.9 69.8 205.8 169.5 239.2 12.8 2.3 17.3-5.6 17.3-12.1 0-6.2-.3-40.4-.3-61.4 0 0-70 15-84.7-29.8 0 0-11.4-29.1-27.8-36.6 0 0-22.9-15.7 1.6-15.4 0 0 24.9 2 38.6 25.8 21.9 38.6 58.6 27.5 72.9 20.9 2.3-16 8.8-27.1 16-33.7-55.9-6.2-112.3-14.3-112.3-110.5 0-27.5 7.6-41.3 23.6-58.9-2.6-6.5-11.1-33.3 2.6-67.9 20.9-6.5 69 27 69 27 20-5.6 41.5-8.5 62.8-8.5s42.8 2.9 62.8 8.5c0 0 48.1-33.6 69-27 13.7 34.7 5.2 61.4 2.6 67.9 16 17.7 25.8 31.5 25.8 58.9 0 96.5-58.9 104.2-114.8 110.5 9.2 7.9 17 22.9 17 46.4 0 33.7-.3 75.4-.3 83.6 0 6.5 4.6 14.4 17.3 12.1 100-33.2 167.8-128.1 167.8-239 0-138.7-112.5-244-251.2-244zM105.2 352.9c-1.3 1-1 3.3 .7 5.2 1.6 1.6 3.9 2.3 5.2 1 1.3-1 1-3.3-.7-5.2-1.6-1.6-3.9-2.3-5.2-1zm-10.8-8.1c-.7 1.3 .3 2.9 2.3 3.9 1.6 1 3.6 .7 4.3-.7 .7-1.3-.3-2.9-2.3-3.9-2-.6-3.6-.3-4.3 .7zm32.4 35.6c-1.6 1.3-1 4.3 1.3 6.2 2.3 2.3 5.2 2.6 6.5 1 1.3-1.3 .7-4.3-1.3-6.2-2.2-2.3-5.2-2.6-6.5-1zm-11.4-14.7c-1.6 1-1.6 3.6 0 5.9s4.3 3.3 5.6 2.3c1.6-1.3 1.6-3.9 0-6.2-1.4-2.3-4-3.3-5.6-2z",
  );
  svg.append(path);

  return svg;
}

function updatePreview(): void {
  const value = editor.value;
  preview.innerHTML = renderMarkdown(value);
  saveDraft(value);
  history.record();
}

renderToolbar();
renderHeaderLinks();
editor.value = loadDraft(DEFAULT_DRAFT);
updatePreview();
syncScrolling(editor, preview);
attachPasteHandler(editor, textManipulation);

editor.addEventListener("input", updatePreview);

editor.addEventListener("keydown", (event) => {
  const action = keyboardAction(event);

  if (!action) {
    return;
  }

  event.preventDefault();
  performAction(action);
});

toolbar.addEventListener("click", (event) => {
  const button = (event.target as HTMLElement).closest<HTMLButtonElement>(
    "[data-action]",
  );

  if (!button?.dataset.action) {
    return;
  }

  performAction(button.dataset.action);
});

function performAction(action: string): void {
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
