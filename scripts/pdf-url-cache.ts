import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { assertUrlNotPrivate } from '../src/utils/config.js';

const DOWNLOAD_MAX_BYTES = 100 * 1024 * 1024;
const DOWNLOAD_MAX_REDIRECTS = 5;

export const DEFAULT_PDF_URL_CACHE_DIR = path.join(
  os.homedir(),
  '.cache',
  'pdf-reader-mcp',
  'corpus'
);

export interface ResolveVerifiedPdfUrlOptions {
  id: string;
  url: string;
  sha256: string;
  allowDownloads: boolean;
  allowPrivateIps: boolean;
  cacheDir: string;
  caseLabel: string;
  downloadHint: string;
}

export interface ResolvedVerifiedPdfUrl {
  path: string;
  downloaded: boolean;
}

export const nonEmptyString = (value: unknown): string | undefined =>
  typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;

export const sha256Hex = (value: unknown): string | undefined => {
  const text = nonEmptyString(value);
  return text && /^[a-f0-9]{64}$/iu.test(text) ? text.toLowerCase() : undefined;
};

const sha256Buffer = (buffer: Buffer): string => createHash('sha256').update(buffer).digest('hex');

const getFileNameFromUrl = (url: string): string => {
  try {
    const parsed = new URL(url);
    const name = path.basename(parsed.pathname);
    return name && name.toLowerCase().endsWith('.pdf') ? name : 'document.pdf';
  } catch {
    return 'document.pdf';
  }
};

const safeCacheName = (sha256: string, url: string): string => {
  const name = getFileNameFromUrl(url)
    .replace(/[^a-z0-9._-]+/giu, '-')
    .replace(/^-+|-+$/gu, '')
    .toLowerCase();
  return `${sha256.slice(0, 16)}-${name || 'document.pdf'}`;
};

const readIfExists = async (filePath: string): Promise<Buffer | undefined> => {
  try {
    return await fs.readFile(filePath);
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
      return undefined;
    }
    throw error;
  }
};

export const validatePdfUrl = (url: string, id: string, caseLabel: string): URL => {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`${caseLabel} ${id} has an invalid URL.`);
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new Error(`${caseLabel} ${id} URL must use http or https.`);
  }
  return parsed;
};

const validatePdfUrlHop = async (
  url: string,
  id: string,
  caseLabel: string,
  allowPrivateIps: boolean
): Promise<URL> => {
  const parsed = validatePdfUrl(url, id, caseLabel);
  if (!allowPrivateIps) {
    try {
      await assertUrlNotPrivate(parsed.hostname);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`${caseLabel} ${id} URL rejected: ${message}`);
    }
  }
  return parsed;
};

const fetchVerifiedPdfUrl = async ({
  id,
  url,
  caseLabel,
  allowPrivateIps,
}: Pick<ResolveVerifiedPdfUrlOptions, 'id' | 'url' | 'caseLabel' | 'allowPrivateIps'>): Promise<Response> => {
  let currentUrl = url;
  for (let redirectCount = 0; redirectCount <= DOWNLOAD_MAX_REDIRECTS; redirectCount += 1) {
    const parsed = await validatePdfUrlHop(currentUrl, id, caseLabel, allowPrivateIps);
    const response = await fetch(parsed.toString(), { redirect: 'manual' });
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location');
      if (!location) {
        throw new Error(`${caseLabel} ${id} redirect response is missing Location.`);
      }
      currentUrl = new URL(location, parsed).toString();
      continue;
    }
    return response;
  }

  throw new Error(
    `${caseLabel} ${id} exceeded redirect limit (${String(DOWNLOAD_MAX_REDIRECTS)}).`
  );
};

export const resolveVerifiedPdfUrl = async ({
  id,
  url,
  sha256,
  allowDownloads,
  allowPrivateIps,
  cacheDir,
  caseLabel,
  downloadHint,
}: ResolveVerifiedPdfUrlOptions): Promise<ResolvedVerifiedPdfUrl> => {
  const cachePath = path.resolve(cacheDir, safeCacheName(sha256, url));
  const cached = await readIfExists(cachePath);
  if (cached && sha256Buffer(cached) === sha256) {
    return { path: cachePath, downloaded: false };
  }

  if (!allowDownloads) {
    throw new Error(`${caseLabel} ${id} requires a cached PDF or explicit downloads. ${downloadHint}`);
  }

  const response = await fetchVerifiedPdfUrl({ id, url, caseLabel, allowPrivateIps });
  if (!response.ok) {
    throw new Error(`${caseLabel} ${id} download failed with HTTP ${String(response.status)}.`);
  }

  const contentLength = Number(response.headers.get('content-length') ?? 0);
  if (Number.isFinite(contentLength) && contentLength > DOWNLOAD_MAX_BYTES) {
    throw new Error(
      `${caseLabel} ${id} exceeds the ${String(DOWNLOAD_MAX_BYTES)} byte download cap.`
    );
  }

  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.byteLength > DOWNLOAD_MAX_BYTES) {
    throw new Error(
      `${caseLabel} ${id} exceeds the ${String(DOWNLOAD_MAX_BYTES)} byte download cap.`
    );
  }

  const observedSha256 = sha256Buffer(bytes);
  if (observedSha256 !== sha256) {
    throw new Error(
      `${caseLabel} ${id} checksum mismatch: expected ${sha256}, observed ${observedSha256}.`
    );
  }

  await fs.mkdir(path.dirname(cachePath), { recursive: true });
  await fs.writeFile(cachePath, bytes);
  return { path: cachePath, downloaded: true };
};
