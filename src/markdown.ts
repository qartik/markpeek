import DOMPurify from "dompurify";
import hljs from "highlight.js/lib/common";
import MarkdownIt from "markdown-it";

const TEXT_CODE_CLASSES = new Set(["text", "pre", "plain"]);

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function languageClass(language: string): string {
  if (!language || TEXT_CODE_CLASSES.has(language)) {
    return "lang-plaintext";
  }

  return language === "auto" ? "lang-auto" : `lang-${language}`;
}

const md: MarkdownIt = new MarkdownIt({
  html: false,
  linkify: true,
  typographer: false,
  breaks: true,
  highlight(code: string, language: string): string {
    const cleanLanguage = language.trim().replace(/[^\w+-]/g, "");
    const className = languageClass(cleanLanguage);

    if (cleanLanguage && hljs.getLanguage(cleanLanguage)) {
      const highlighted = hljs.highlight(code, {
        language: cleanLanguage,
        ignoreIllegals: true,
      }).value;

      // Mirrors Discourse's cooked code shape by using lang-* classes on code blocks.
      return `<pre><code class="${className} hljs">${highlighted}</code></pre>`;
    }

    const escaped = escapeHtml(code);
    return `<pre><code class="${className}">${escaped}</code></pre>`;
  },
});

// Discourse wraps Markdown tables in div.md-table so wide tables can scroll.
md.renderer.rules.table_open = () => '<div class="md-table">\n<table>\n';
md.renderer.rules.table_close = () => "</table>\n</div>";

export function renderMarkdown(source: string): string {
  return DOMPurify.sanitize(md.render(source), {
    USE_PROFILES: { html: true },
    ADD_ATTR: ["target", "rel"],
  });
}
