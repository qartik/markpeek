import { loadStoredDraft } from "./storage";

const SHARE_PREFIX = "#/m/";
const GZIP_PREFIX = `${SHARE_PREFIX}gz/`;
const RAW_PREFIX = `${SHARE_PREFIX}raw/`;
const MAX_SHARE_URL_LENGTH = 16_000;

export type InitialDraftSource = "share" | "local" | "default";

export type InitialDraft = {
  value: string;
  source: InitialDraftSource;
};

export type ShareResult =
  | { ok: true; url: string }
  | { ok: false; reason: "too-large" | "encode-failed" };

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

export async function loadInitialDraft(
  fallback: string,
  location: Location = window.location,
): Promise<InitialDraft> {
  const sharedDraft = await readSharedDraftFromHash(location.hash);
  if (sharedDraft !== null) {
    return { value: sharedDraft, source: "share" };
  }

  const storedDraft = loadStoredDraft();
  if (storedDraft !== null) {
    return { value: storedDraft, source: "local" };
  }

  return { value: fallback, source: "default" };
}

export function hasSharedDraftInUrl(location: Location = window.location): boolean {
  return location.hash.startsWith(SHARE_PREFIX);
}

export function clearSharedDraftFromUrl(win: Window = window): void {
  if (!hasSharedDraftInUrl(win.location)) {
    return;
  }

  const url = new URL(win.location.href);
  url.hash = "";
  win.history.replaceState(null, "", url.toString());
}

export async function createShareUrl(
  markdown: string,
  location: Location = window.location,
): Promise<ShareResult> {
  try {
    const rawBytes = textEncoder.encode(markdown);
    const compressedBytes = await compress(rawBytes);
    const useCompressed = compressedBytes.length < rawBytes.length;
    const prefix = useCompressed ? GZIP_PREFIX : RAW_PREFIX;
    const payload = bytesToBase64Url(useCompressed ? compressedBytes : rawBytes);
    const url = new URL(location.href);

    url.hash = `${prefix}${payload}`;
    if (url.toString().length > MAX_SHARE_URL_LENGTH) {
      return { ok: false, reason: "too-large" };
    }

    return { ok: true, url: url.toString() };
  } catch {
    return { ok: false, reason: "encode-failed" };
  }
}

export async function readSharedDraftFromHash(hash: string): Promise<string | null> {
  if (!hash.startsWith(SHARE_PREFIX)) {
    return null;
  }

  const rawPayload = hash.startsWith(RAW_PREFIX)
    ? hash.slice(RAW_PREFIX.length)
    : null;
  const gzipPayload = hash.startsWith(GZIP_PREFIX)
    ? hash.slice(GZIP_PREFIX.length)
    : null;
  const payload = rawPayload ?? gzipPayload;

  if (!payload) {
    return null;
  }

  try {
    const bytes = base64UrlToBytes(payload);
    const output = gzipPayload ? await decompress(bytes) : bytes;
    return textDecoder.decode(output);
  } catch {
    return null;
  }
}

async function compress(bytes: Uint8Array): Promise<Uint8Array> {
  if (typeof CompressionStream === "undefined") {
    return bytes;
  }

  return transformStream(bytes, new CompressionStream("gzip"));
}

async function decompress(bytes: Uint8Array): Promise<Uint8Array> {
  if (typeof DecompressionStream === "undefined") {
    throw new Error("Missing decompression support");
  }

  return transformStream(bytes, new DecompressionStream("gzip"));
}

async function transformStream(
  bytes: Uint8Array,
  stream: CompressionStream | DecompressionStream,
): Promise<Uint8Array> {
  const source = new Blob([new Uint8Array(bytes)]);
  const arrayBuffer = await new Response(
    source.stream().pipeThrough(stream),
  ).arrayBuffer();
  return new Uint8Array(arrayBuffer);
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let output = "";
  bytes.forEach((byte) => {
    output += String.fromCharCode(byte);
  });

  return btoa(output).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function base64UrlToBytes(value: string): Uint8Array {
  const normalized = value.replaceAll("-", "+").replaceAll("_", "/");
  const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), "=");
  const decoded = atob(padded);
  return Uint8Array.from(decoded, (char) => char.charCodeAt(0));
}
