export type FindMatch = {
  start: number;
  end: number;
  wrapped: boolean;
};

export type FindResult =
  | { ok: true; match: FindMatch | null }
  | { ok: false; error: string };

function regexFor(query: string): RegExp {
  return new RegExp(query, "g");
}

export function findNext(
  value: string,
  query: string,
  regex: boolean,
  from = 0,
): FindResult {
  if (!query) {
    return { ok: true, match: null };
  }

  const startAt = Math.min(Math.max(from, 0), value.length);

  if (!regex) {
    const start = value.indexOf(query, startAt);
    if (start !== -1) {
      return { ok: true, match: { start, end: start + query.length, wrapped: false } };
    }

    const wrappedStart = value.indexOf(query, 0);
    return {
      ok: true,
      match:
        wrappedStart === -1
          ? null
          : { start: wrappedStart, end: wrappedStart + query.length, wrapped: true },
    };
  }

  let matcher: RegExp;
  try {
    matcher = regexFor(query);
  } catch {
    return { ok: false, error: "Invalid regular expression." };
  }

  matcher.lastIndex = startAt;
  let match = matcher.exec(value);
  if (match) {
    return {
      ok: true,
      match: { start: match.index, end: match.index + match[0].length, wrapped: false },
    };
  }

  matcher.lastIndex = 0;
  match = matcher.exec(value);
  return {
    ok: true,
    match:
      match && match.index < startAt
        ? { start: match.index, end: match.index + match[0].length, wrapped: true }
        : null,
  };
}

export function replaceAll(
  value: string,
  query: string,
  replacement: string,
  regex: boolean,
): { ok: true; value: string; count: number } | { ok: false; error: string } {
  if (!query) {
    return { ok: true, value, count: 0 };
  }

  if (!regex) {
    const count = value.split(query).length - 1;
    return { ok: true, value: value.replaceAll(query, replacement), count };
  }

  let matcher: RegExp;
  try {
    matcher = regexFor(query);
  } catch {
    return { ok: false, error: "Invalid regular expression." };
  }

  const count = [...value.matchAll(matcher)].length;
  matcher.lastIndex = 0;
  return { ok: true, value: value.replace(matcher, replacement), count };
}

export function replaceMatch(
  value: string,
  query: string,
  replacement: string,
  regex: boolean,
  match: FindMatch,
): string {
  if (!regex) {
    return `${value.slice(0, match.start)}${replacement}${value.slice(match.end)}`;
  }

  const matcher = new RegExp(query, "y");
  matcher.lastIndex = match.start;
  return value.replace(matcher, replacement);
}

export function cleanWhitespace(value: string): string {
  const withoutLineEndingWhitespace = value
    .split("\n")
    .map((line) => line.replace(/[ \t]+$/g, ""))
    .join("\n");

  return withoutLineEndingWhitespace
    .replace(/^\n+|\n+$/g, "")
    .replace(/\n{3,}/g, "\n\n");
}
