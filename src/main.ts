import {
  Bold,
  Code,
  Heading2,
  Italic,
  Link,
  List,
  ListOrdered,
  Quote,
  Redo2,
  Undo2,
  createElement,
  type IconNode,
} from "lucide";
import { EditorHistory } from "./history";
import { renderMarkdown } from "./markdown";
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
  { action: "quote", label: "Quote", icon: Quote },
  { action: "code", label: "Code", icon: Code, shortcut: "Mod+E" },
  { action: "bullet-list", label: "Bullet list", icon: List },
  { action: "numbered-list", label: "Numbered list", icon: ListOrdered },
  { action: "heading", label: "Heading", icon: Heading2 },
];

document.querySelector<HTMLDivElement>("#app")!.innerHTML = `
  <main class="markdown-previewer">
    <header class="markdown-previewer__header">
      <div>
        <h1 class="markdown-previewer__title">markpeek</h1>
        <p class="markdown-previewer__subtitle">Standalone composer-style editing</p>
      </div>
    </header>
    <section class="markdown-previewer__workspace">
      <section class="markdown-previewer__pane" aria-labelledby="editor-heading">
        <div class="markdown-previewer__pane-header">
          <h2 id="editor-heading" class="markdown-previewer__pane-title">Editor</h2>
          <div class="markdown-previewer__toolbar" role="toolbar" aria-label="Formatting tools">
            <div class="markdown-previewer__toolbar-group" data-toolbar-group="history"></div>
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
const historyToolbar = document.querySelector<HTMLDivElement>(
  '[data-toolbar-group="history"]',
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
  [
    { action: "undo", label: "Undo", icon: Undo2, shortcut: "Mod+Z" },
    { action: "redo", label: "Redo", icon: Redo2, shortcut: "Shift+Mod+Z" },
  ].forEach(({ action, label, icon, shortcut }) => {
    historyToolbar.append(toolbarButton(action, label, icon, shortcut));
  });

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

function updatePreview(): void {
  const value = editor.value;
  preview.innerHTML = renderMarkdown(value);
  saveDraft(value);
  history.record();
}

renderToolbar();
editor.value = loadDraft(DEFAULT_DRAFT);
updatePreview();
syncScrolling(editor, preview);

editor.addEventListener("input", updatePreview);

editor.addEventListener("keydown", (event) => {
  const isMod = event.metaKey || event.ctrlKey;

  if (!isMod) {
    return;
  }

  const key = event.key.toLowerCase();
  const action =
    key === "z" && !event.shiftKey
      ? "undo"
      : key === "z" && event.shiftKey
        ? "redo"
        : key === "y"
          ? "redo"
          : key === "b"
            ? "bold"
            : key === "i"
              ? "italic"
              : key === "k"
                ? "link"
                : key === "e"
                  ? "code"
                  : null;

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
