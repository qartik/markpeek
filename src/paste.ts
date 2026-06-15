import TurndownService from "turndown";
import { gfm } from "turndown-plugin-gfm";
import {
  type EditorSelection,
  LocalTextManipulation,
} from "./text-manipulation";

const turndown = new TurndownService({
  bulletListMarker: "-",
  codeBlockStyle: "fenced",
  emDelimiter: "*",
  headingStyle: "atx",
});

turndown.use(gfm);

turndown.addRule("discourseLikeCodeBlocks", {
  filter(node) {
    return (
      node.nodeName === "PRE" &&
      node.firstChild?.nodeName === "CODE" &&
      Boolean(node.textContent)
    );
  },
  replacement(_content, node) {
    const code = node.firstChild;
    const className =
      code instanceof HTMLElement ? code.getAttribute("class") ?? "" : "";
    const language =
      className.match(/(?:language|lang)-([\w+-]+)/)?.[1] ?? "";
    const text = node.textContent?.replace(/\n$/, "") ?? "";

    return `\n\n\`\`\`${language}\n${text}\n\`\`\`\n\n`;
  },
});

function extractTable(text: string): string | null {
  if (text.endsWith("\n")) {
    text = text.substring(0, text.length - 1);
  }

  const chars = text.split("");
  let inQuotedCell = false;
  chars.forEach((char, index) => {
    if (char === "\n" && inQuotedCell) {
      chars[index] = "\r";
    }

    if (char === '"') {
      chars[index] = "";
      inQuotedCell = !inQuotedCell;
    }
  });

  const rows = chars.join("").replace(/\r/g, "<br>").split("\n");
  if (rows.length <= 1) {
    return null;
  }

  const columns = rows.map((row) => row.split("\t").length);
  const isTable =
    columns.every((count) => count === columns[0] && count > 1) &&
    !/^•$|^\d+\.$/.test(rows[0].split("\t")[0]);

  if (!isTable) {
    return null;
  }

  rows.splice(1, 0, Array.from({ length: columns[0] }, () => "---").join("\t"));
  return `|${rows.map((row) => row.split("\t").join("|")).join("|\n|")}|\n`;
}

function isInside(text: string, regex: RegExp): boolean {
  return Boolean((text.match(regex)?.length ?? 0) % 2);
}

function isAfterStartedCodeFence(beforeText: string): boolean {
  return isInside(beforeText, /(^|\n)```/g);
}

function canPasteHtml(selection: EditorSelection): boolean {
  const isInlinePasting = /[^\n]$/.test(selection.pre);

  if (isAfterStartedCodeFence(selection.pre)) {
    return false;
  }

  if (!isInlinePasting) {
    return true;
  }

  return !(
    selection.lineVal.match(/^```/) ||
    isInside(selection.pre, /`/g) ||
    selection.lineVal.match(/^    /)
  );
}

function normalizedUrl(text: string): string | null {
  const trimmed = text.trim();
  if (!trimmed || /\s/.test(trimmed)) {
    return null;
  }

  try {
    const url = new URL(trimmed);
    if (["http:", "https:", "mailto:"].includes(url.protocol)) {
      return url.href;
    }
  } catch {
    // Fall through to the email shorthand below.
  }

  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
    return `mailto:${trimmed}`;
  }

  return null;
}

function selectedTextCanBecomeLink(text: string): boolean {
  return Boolean(
    text &&
      !normalizedUrl(text) &&
      !text.match(/\[\/?[a-z =]+?\]/gi) &&
      !text.includes("\n"),
  );
}

function markdownFromHtml(html: string): string {
  return turndown.turndown(html).trim();
}

export function attachPasteHandler(
  textarea: HTMLTextAreaElement,
  textManipulation: LocalTextManipulation,
): void {
  textarea.addEventListener("paste", (event) => {
    const clipboard = event.clipboardData;
    if (!clipboard) {
      return;
    }

    const selection = textManipulation.getSelected();
    const plainText = clipboard.getData("text/plain");
    const html = clipboard.getData("text/html");
    const isInlinePasting = /[^\n]$/.test(selection.pre);
    const isCodeBlock = isAfterStartedCodeFence(selection.pre);

    if (plainText && !isInlinePasting && !isCodeBlock) {
      const table = extractTable(plainText.replace(/\r/g, ""));
      if (table) {
        event.preventDefault();
        textManipulation.replaceSelection(table, selection);
        return;
      }
    }

    const url = normalizedUrl(plainText);
    if (
      url &&
      selectedTextCanBecomeLink(selection.value) &&
      selection.end > selection.start
    ) {
      event.preventDefault();
      textManipulation.replaceSelection(`[${selection.value}](${url})`, selection);
      return;
    }

    if (!html || !canPasteHtml(selection)) {
      return;
    }

    const markdown = markdownFromHtml(html);
    if (!markdown) {
      return;
    }

    event.preventDefault();

    let pastedText =
      !plainText || plainText.length < markdown.length ? markdown : plainText;

    if (isInlinePasting) {
      pastedText = pastedText.replace(/^#+/, "").trim();
      if (selection.pre.match(/\S$/)) {
        pastedText = ` ${pastedText}`;
      }
    }

    textManipulation.replaceSelection(pastedText, selection);
  });
}
