export type FormatAction =
  | "bold"
  | "italic"
  | "link"
  | "quote"
  | "code"
  | "bullet-list"
  | "numbered-list"
  | "heading";

export type EditorSelection = {
  start: number;
  end: number;
  value: string;
  pre: string;
  post: string;
  lineVal: string;
};

type Head = string | ((previous: string) => string);

const EXAMPLES: Record<string, string> = {
  bold_text: "strong text",
  code_title: "code",
  heading_text: "Heading",
  italic_text: "emphasized text",
  link_text: "link text",
  list_item: "list item",
  paste_code_text: "code block",
  blockquote_text: "quoted text",
};

const OP = {
  NONE: 0,
  REMOVED: 1,
  ADDED: 2,
} as const;

function getHead(head: Head, previous = ""): [string, number] {
  const value = typeof head === "string" ? head : head(previous);
  return [value, value.length];
}

function currentLine(value: string, selectionStart: number): string {
  return value.split("\n")[
    value.slice(0, selectionStart).split("\n").length - 1
  ];
}

function lineBounds(value: string, start: number, end: number): [number, number] {
  const lineStart = value.lastIndexOf("\n", start - 1) + 1;
  let lineEnd = value.indexOf("\n", end);

  if (lineEnd === -1) {
    lineEnd = value.length;
  }

  return [lineStart, lineEnd];
}

function dispatchInput(textarea: HTMLTextAreaElement): void {
  textarea.dispatchEvent(new Event("input", { bubbles: true }));
}

export class LocalTextManipulation {
  constructor(private textarea: HTMLTextAreaElement) {}

  get value(): string {
    return this.textarea.value;
  }

  focus(): void {
    this.textarea.focus({ preventScroll: true });
  }

  getSelected(trimLeading = false): EditorSelection {
    const value = this.value;
    let { selectionStart: start, selectionEnd: end } = this.textarea;

    while (end > start && /\s/.test(value.charAt(end - 1))) {
      end--;
    }

    if (trimLeading) {
      while (end > start && /\s/.test(value.charAt(start))) {
        start++;
      }
    }

    return {
      start,
      end,
      value: value.substring(start, end),
      pre: value.slice(0, start),
      post: value.slice(end),
      lineVal: currentLine(value, this.textarea.selectionStart),
    };
  }

  selectText(from: number, length: number): void {
    const oldScrollTop = this.textarea.scrollTop;
    this.textarea.setSelectionRange(from, from + length);
    this.focus();
    this.textarea.scrollTop = oldScrollTop;
    dispatchInput(this.textarea);
  }

  insertText(text: string): void {
    const selected = this.getSelected();
    this.replaceSelection(text, selected);
  }

  replaceSelection(text: string, selection = this.getSelected()): void {
    this.insertAt(selection.start, selection.end, text);
    this.selectText(selection.start + text.length, 0);
  }

  applySurround(
    head: Head,
    tail: string,
    exampleKey: string,
    multiline = false,
  ): void {
    const selection = this.getSelected(true);
    const { pre, post } = selection;
    const tailLength = tail.length;

    if (selection.start === selection.end) {
      if (tailLength === 0) {
        return;
      }

      const [headValue, headLength] = getHead(head);
      const example = EXAMPLES[exampleKey];
      this.insertAt(
        selection.start,
        selection.end,
        `${headValue}${example}${tail}`,
      );
      this.selectText(pre.length + headLength, example.length);
      return;
    }

    if (!multiline) {
      let [headValue, headLength] = getHead(head);

      if (selection.value.split("\n").length > 1) {
        headValue += "\n";
        headLength += 1;
        tail = `\n${tail}`;
      }

      if (
        pre.slice(-headLength) === headValue &&
        post.slice(0, tail.length) === tail
      ) {
        this.insertAt(
          selection.start - headLength,
          selection.end + tail.length,
          selection.value,
        );
        this.selectText(selection.start - headLength, selection.value.length);
      } else {
        this.insertAt(
          selection.start,
          selection.end,
          `${headValue}${selection.value}${tail}`,
        );
        this.selectText(selection.start + headLength, selection.value.length);
      }

      return;
    }

    const lines = selection.value.split("\n");
    let [headValue, headLength] = getHead(head);

    if (
      lines.length === 1 &&
      pre.slice(-tailLength) === tail &&
      post.slice(0, headLength) === headValue
    ) {
      this.insertAt(
        selection.start - headLength,
        selection.end + tailLength,
        selection.value,
      );
      this.selectText(selection.start - headLength, selection.value.length);
      return;
    }

    const contents = this.multilineContents(
      lines,
      head,
      headValue,
      headLength,
      tail,
    );
    this.insertAt(selection.start, selection.end, contents);

    if (lines.length === 1 && tailLength > 0) {
      this.selectText(selection.start + headLength, selection.value.length);
    } else {
      this.selectText(selection.start, contents.length);
    }
  }

  applyList(
    head: Head,
    exampleKey: string,
    excludeHeadInSelection = false,
  ): void {
    const selection = this.getSelected();

    if (selection.value.includes("\n")) {
      this.applySurround(head, "", exampleKey, true);
      return;
    }

    const [headValue, headLength] = getHead(head);
    if (selection.start === selection.end) {
      selection.value = EXAMPLES[exampleKey];
    }

    let line = "";
    if (headValue.includes("#")) {
      const currentHeadingLevel = selection.value.search(/[^#]/);

      if (
        selection.value.startsWith(headValue) &&
        currentHeadingLevel + 1 === headLength
      ) {
        line = selection.value.slice(headLength);
      } else if (currentHeadingLevel > 0) {
        line = `${headValue}${selection.value.slice(currentHeadingLevel + 1)}`;
      } else {
        line = `${headValue}${selection.value}`;
      }
    } else if (selection.value.startsWith(headValue)) {
      line = selection.value.slice(headLength);
    } else {
      line = `${headValue}${selection.value}`;
    }

    const preNewlines = selection.pre.trim() ? "\n\n" : "";
    const postNewlines = selection.post.trim() ? "\n\n" : "";
    const preChars = selection.pre.length - selection.pre.trimEnd().length;
    const postChars = selection.post.length - selection.post.trimStart().length;
    const inserted = `${preNewlines}${line}${postNewlines}`;

    this.insertAt(
      selection.start - preChars,
      selection.end + postChars,
      inserted,
    );

    const selectionStart = selection.start + preNewlines.length - preChars;
    if (excludeHeadInSelection) {
      this.selectText(
        selectionStart + headValue.length,
        line.length - headValue.length,
      );
    } else {
      this.selectText(selectionStart, line.length);
    }
  }

  applyHeading(): void {
    const selection = this.getSelected();
    const [start, end] = lineBounds(this.value, selection.start, selection.end);
    const selectedLines = this.value.slice(start, end);
    const isEmptyLine = selectedLines.length === 0;
    const replacement = isEmptyLine
      ? "# Heading"
      : selectedLines
          .split("\n")
          .map((line) => this.nextHeadingLine(line))
          .join("\n");

    this.insertAt(start, end, replacement);

    if (isEmptyLine) {
      this.selectText(start + 2, EXAMPLES.heading_text.length);
      return;
    }

    this.selectText(start, replacement.length);
  }

  applyLink(): void {
    const selection = this.getSelected(true);
    const label = selection.value || EXAMPLES.link_text;
    const replacement = `[${label}](https://example.com)`;

    this.insertAt(selection.start, selection.end, replacement);
    if (selection.start === selection.end) {
      this.selectText(selection.start + 1, label.length);
    } else {
      this.selectText(selection.start, replacement.length);
    }
  }

  formatCode(): void {
    const selection = this.getSelected(false);
    const hasNewLine = selection.value.includes("\n");
    const isBlankLine = selection.lineVal.trim().length === 0;

    if (!hasNewLine) {
      if (selection.value.length === 0 && isBlankLine) {
        this.applySurround("```\n", "\n```", "paste_code_text");
      } else {
        this.applySurround("`", "`", "code_title");
      }
      return;
    }

    const preNewline =
      selection.pre.at(-1) !== "\n" && selection.pre !== "" ? "\n" : "";
    const postNewline = selection.post[0] !== "\n" ? "\n" : "";
    const replacement = `${preNewline}\`\`\`\n${selection.value}\n\`\`\`${postNewline}`;
    this.insertAt(selection.start, selection.end, replacement);
    this.selectText(selection.start + replacement.length, 0);
  }

  apply(action: FormatAction): void {
    switch (action) {
      case "bold":
        this.applySurround("**", "**", "bold_text");
        break;
      case "italic":
        this.applySurround("*", "*", "italic_text");
        break;
      case "link":
        this.applyLink();
        break;
      case "quote":
        this.applyList("> ", "blockquote_text");
        break;
      case "code":
        this.formatCode();
        break;
      case "bullet-list":
        this.applyList("* ", "list_item");
        break;
      case "numbered-list":
        this.applyList((previous) => {
          if (!previous) {
            return "1. ";
          }

          return `${Number.parseInt(previous, 10) + 1}. `;
        }, "list_item");
        break;
      case "heading":
        this.applyHeading();
        break;
    }
  }

  private multilineContents(
    lines: string[],
    head: Head,
    headValue: string,
    headLength: number,
    tail: string,
  ): string {
    let operation: (typeof OP)[keyof typeof OP] = OP.NONE;
    const tailLength = tail.length;

    return lines
      .map((line) => {
        if (line.length === 0) {
          return line;
        }

        if (
          operation !== OP.ADDED &&
          line.slice(0, headLength) === headValue &&
          (tailLength === 0 || line.slice(-tailLength) === tail)
        ) {
          operation = OP.REMOVED;
          const result =
            tailLength === 0
              ? line.slice(headLength)
              : line.slice(headLength, -tailLength);
          [headValue, headLength] = getHead(head, headValue);
          return result;
        }

        if (operation === OP.NONE) {
          operation = OP.ADDED;
        } else if (operation === OP.REMOVED) {
          return line;
        }

        const result = `${headValue}${line}${tail}`;
        [headValue, headLength] = getHead(head, headValue);
        return result;
      })
      .join("\n");
  }

  private nextHeadingLine(line: string): string {
    if (line.length === 0) {
      return line;
    }

    const match = /^(#{1,6})\s+(.*)$/.exec(line);
    if (!match) {
      return `# ${line}`;
    }

    const [, hashes, text] = match;
    if (hashes.length === 6) {
      return text;
    }

    return `${"#".repeat(hashes.length + 1)} ${text}`;
  }

  private insertAt(start: number, end: number, text: string): void {
    // Discourse's textarea manipulation writes through the native textarea and
    // then restores selection. `setRangeText` keeps browser edit semantics close.
    this.textarea.setRangeText(text, start, end, "end");
  }
}
