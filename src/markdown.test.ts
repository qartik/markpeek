// @vitest-environment jsdom

import { describe, expect, it } from "vitest";
import { renderMarkdown } from "./markdown";

describe("renderMarkdown", () => {
  it("preserves literal trademark-style text", () => {
    const rendered = renderMarkdown("Brand (R) and service (TM)");

    expect(rendered).toContain("<p>Brand (R) and service (TM)</p>");
    expect(rendered).not.toContain("®");
    expect(rendered).not.toContain("™");
  });
});
