// @vitest-environment jsdom
// @vitest-environment-options {"url":"https://qartik.github.io/markpeek/"}

import { beforeEach, describe, expect, it, vi } from "vitest";
import { mountApp, shareDraft } from "./app";
import * as share from "./share";

describe("mountApp", () => {
  let writeText: ReturnType<typeof vi.fn>;
  let storage: Storage;

  beforeEach(() => {
    document.body.innerHTML = '<div id="app"></div>';
    window.location.hash = "";
    writeText = vi.fn().mockResolvedValue(undefined);
    const values = new Map<string, string>();
    storage = {
      getItem: vi.fn((key: string) => values.get(key) ?? null),
      setItem: vi.fn((key: string, value: string) => {
        values.set(key, value);
      }),
      removeItem: vi.fn((key: string) => {
        values.delete(key);
      }),
      clear: vi.fn(() => {
        values.clear();
      }),
      key: vi.fn((index: number) => Array.from(values.keys())[index] ?? null),
      get length() {
        return values.size;
      },
    };
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      value: storage,
    });
    Object.defineProperty(Object.getPrototypeOf(window.navigator), "clipboard", {
      configurable: true,
      get: () => ({
        writeText,
      }),
    });
  });

  it("loads a shared URL into editor and preview", async () => {
    window.location.hash =
      "#/m/raw/IyBTaGFyZWQKCkhlbGxvIGZyb20gdGhlIGxpbmsu";

    await mountApp(document, window);

    const editor = document.querySelector<HTMLTextAreaElement>(
      ".markdown-previewer__editor",
    );
    const preview = document.querySelector<HTMLElement>(
      ".markdown-previewer__preview",
    );

    expect(editor?.value).toBe("# Shared\n\nHello from the link.");
    expect(preview?.textContent).toContain("Hello from the link.");
  });

  it("falls back to localStorage when there is no shared URL", async () => {
    storage.setItem("markpeek:draft", "Stored draft");

    await mountApp(document, window);

    const editor = document.querySelector<HTMLTextAreaElement>(
      ".markdown-previewer__editor",
    );

    expect(editor?.value).toBe("Stored draft");
  });

  it("copies a share URL for the current draft", async () => {
    vi.spyOn(share, "createShareUrl").mockResolvedValue({
      ok: true,
      url: "https://qartik.github.io/markpeek/#/m/raw/test-payload",
    });
    const status = document.createElement("p");
    const fakeWindow = {
      history: {
        replaceState: vi.fn(),
      },
      location: window.location,
      navigator: {
        clipboard: {
          writeText,
        },
      },
    } as unknown as Window;
    await shareDraft("# Shared by button", status, document, fakeWindow);

    expect(writeText).toHaveBeenCalledTimes(1);
    const copiedUrl = writeText.mock.calls[0][0] as string;
    expect(copiedUrl).toContain("#/m/");
    expect(decodeURIComponent(copiedUrl)).toContain("/markpeek/");
    expect(status.textContent).toBe("Shareable URL copied.");
  });

  it("clears share status after the draft changes", async () => {
    await mountApp(document, window);

    const status = document.querySelector<HTMLElement>("[data-share-status]")!;
    status.textContent = "Shareable URL copied.";
    status.dataset.tone = "success";

    const editor = document.querySelector<HTMLTextAreaElement>(
      ".markdown-previewer__editor",
    )!;
    editor.value = `${editor.value}\nupdated`;
    editor.dispatchEvent(new Event("input", { bubbles: true }));

    expect(status.textContent).toBe("");
    expect(status.dataset.tone).toBeUndefined();
  });

  it("clears the shared URL fragment after editing a shared draft", async () => {
    window.location.hash =
      "#/m/raw/IyBTaGFyZWQKCkhlbGxvIGZyb20gdGhlIGxpbmsu";

    await mountApp(document, window);

    const editor = document.querySelector<HTMLTextAreaElement>(
      ".markdown-previewer__editor",
    )!;
    editor.value = `${editor.value}\nchanged`;
    editor.dispatchEvent(new Event("input", { bubbles: true }));

    expect(window.location.hash).toBe("");
  });

  it("falls back safely when the shared payload is invalid", async () => {
    window.location.hash = "#/m/gz/definitely-not-valid";
    storage.setItem("markpeek:draft", "Stored draft");

    await mountApp(document, window);

    const editor = document.querySelector<HTMLTextAreaElement>(
      ".markdown-previewer__editor",
    );

    expect(editor?.value).toBe("Stored draft");
  });
});
