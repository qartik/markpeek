# Notice

markpeek is a standalone Markdown previewer inspired by the Discourse composer
and editor experience.

The app does not include the Discourse runtime, backend, forum APIs, uploads,
auth, mentions, oneboxes, drafts, or other forum-specific features.

Parts of the editor behavior intentionally mirror decisions from
[Discourse](https://github.com/discourse/discourse), including:

- Markdown rendering patterns from `discourse-markdown-it`, implemented here
  with standalone `markdown-it`.
- Composer-style Markdown toolbar behavior.
- Textarea-first text manipulation: inline surrounds, line-prefix formatting,
  selection preservation, and scroll-preserving focus behavior.
- Cooked-preview conventions such as `div.md-table` table wrapping and `lang-*`
  code classes.

No project license has been selected yet.
