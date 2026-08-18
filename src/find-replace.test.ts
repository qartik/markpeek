import { describe, expect, it } from "vitest";
import { cleanWhitespace, findNext, replaceAll, replaceMatch } from "./find-replace";

describe("find and replace", () => {
  it("finds literal text and wraps after the final match", () => {
    expect(findNext("one two one", "one", false, 4)).toEqual({
      ok: true,
      match: { start: 8, end: 11, wrapped: false },
    });
    expect(findNext("one two one", "one", false, 11)).toEqual({
      ok: true,
      match: { start: 0, end: 3, wrapped: true },
    });
  });

  it("reports invalid patterns without changing text", () => {
    expect(findNext("text", "[", true)).toEqual({
      ok: false,
      error: "Invalid regular expression.",
    });
    expect(replaceAll("text", "[", "x", true)).toEqual({
      ok: false,
      error: "Invalid regular expression.",
    });
  });

  it("replaces regex matches with JavaScript replacement references", () => {
    const match = findNext("first last", "(\\w+) (\\w+)", true);
    if (!match.ok || !match.match) throw new Error("Expected a match");

    expect(replaceMatch("first last", "(\\w+) (\\w+)", "$2, $1", true, match.match)).toBe(
      "last, first",
    );
    expect(replaceAll("a1 b2", "([a-z])(\\d)", "$2$1", true)).toEqual({
      ok: true,
      value: "1a 2b",
      count: 2,
    });
  });
});

describe("cleanWhitespace", () => {
  it("strips line endings, document-edge blank lines, and repeated blank lines", () => {
    expect(cleanWhitespace("\n\nfirst  \n\n\n\nsecond\t\n\n")).toBe("first\n\nsecond");
  });
});
