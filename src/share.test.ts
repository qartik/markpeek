import { describe, expect, it } from "vitest";
import { createShareUrl, readSharedDraftFromHash } from "./share";

describe("share URLs", () => {
  it("round-trips plain markdown", async () => {
    const markdown = "# Hello\n\nA short draft.";
    const url = await createShareUrl(
      markdown,
      new URL("https://qartik.github.io/markpeek/") as unknown as Location,
    );

    expect(url.ok).toBe(true);
    if (!url.ok) {
      return;
    }

    expect(await readSharedDraftFromHash(new URL(url.url).hash)).toBe(markdown);
  });

  it("round-trips markdown with tables, links, and code", async () => {
    const markdown = `| Name | Link |
| --- | --- |
| markpeek | [site](https://qartik.github.io/markpeek/) |

\`\`\`ts
console.log("share me");
\`\`\`
`;
    const url = await createShareUrl(
      markdown,
      new URL("https://qartik.github.io/markpeek/") as unknown as Location,
    );

    expect(url.ok).toBe(true);
    if (!url.ok) {
      return;
    }

    expect(await readSharedDraftFromHash(new URL(url.url).hash)).toBe(markdown);
  });

  it("ignores malformed payloads", async () => {
    expect(await readSharedDraftFromHash("#/m/raw/not-base64%%%")).toBeNull();
    expect(await readSharedDraftFromHash("#/m/gz/not-base64%%%")).toBeNull();
    expect(await readSharedDraftFromHash("#/m/unknown/payload")).toBeNull();
  });
});
