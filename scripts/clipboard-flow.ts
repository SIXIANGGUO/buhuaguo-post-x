import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export type MediaKind = 'image' | 'video' | 'cover';

export interface LocalMedia {
  kind: MediaKind;
  absolutePath: string;
  filename: string;
  placeholder: string;
}

function getScriptDir(): string {
  return path.dirname(fileURLToPath(import.meta.url));
}

function runClipboardHelper(mode: 'text' | 'html', input: string): void {
  if (process.env.BAOYU_POST_TO_X_SKIP_CLIPBOARD === '1') {
    return;
  }

  const copyScript = path.join(getScriptDir(), 'copy-to-clipboard.ts');
  const result = spawnSync(process.execPath, [copyScript, mode], {
    input,
    stdio: ['pipe', 'inherit', 'inherit'],
  });

  if (result.status !== 0) {
    throw new Error(`Clipboard copy failed with exit code ${result.status ?? 'unknown'}`);
  }
}

function runClipboardHelperWithArgs(args: string[]): void {
  if (process.env.BAOYU_POST_TO_X_SKIP_CLIPBOARD === '1') {
    return;
  }

  const copyScript = path.join(getScriptDir(), 'copy-to-clipboard.ts');
  const result = spawnSync(process.execPath, [copyScript, ...args], {
    stdio: ['inherit', 'inherit', 'inherit'],
  });

  if (result.status !== 0) {
    throw new Error(`Clipboard copy failed with exit code ${result.status ?? 'unknown'}`);
  }
}

export function copyTextToClipboard(text: string): void {
  runClipboardHelper('text', text);
}

export function copyHtmlToClipboard(html: string): void {
  runClipboardHelper('html', html);
}

export function copyImageFileToClipboard(imagePath: string): void {
  const absolutePath = ensureLocalFile(imagePath, 'Image');
  runClipboardHelperWithArgs(['image', absolutePath]);
}

export function ensureLocalFile(filePath: string, label: string): string {
  if (/^[a-z]+:\/\//i.test(filePath)) {
    throw new Error(`${label} must be a local file, not a URL: ${filePath}`);
  }

  const absolutePath = path.isAbsolute(filePath) ? filePath : path.resolve(process.cwd(), filePath);

  if (!fs.existsSync(absolutePath)) {
    throw new Error(`${label} not found: ${absolutePath}`);
  }

  const stat = fs.statSync(absolutePath);
  if (!stat.isFile()) {
    throw new Error(`${label} is not a file: ${absolutePath}`);
  }

  return absolutePath;
}

function disambiguateFilename(filename: string, counts: Map<string, number>): string {
  const nextCount = (counts.get(filename) ?? 0) + 1;
  counts.set(filename, nextCount);
  if (nextCount === 1) return filename;

  const ext = path.extname(filename);
  const base = path.basename(filename, ext);
  return `${base} (${nextCount})${ext}`;
}

export function createMediaPlaceholder(kind: MediaKind, displayName: string): string {
  switch (kind) {
    case 'image':
      return `[Image: ${displayName}]`;
    case 'video':
      return `[Video: ${displayName}]`;
    case 'cover':
      return `[Cover: ${displayName}]`;
    default:
      return `[File: ${displayName}]`;
  }
}

export function prepareMediaList(filePaths: string[], kind: Exclude<MediaKind, 'cover'>): LocalMedia[] {
  const counts = new Map<string, number>();

  return filePaths.map((filePath) => {
    const absolutePath = ensureLocalFile(filePath, kind === 'image' ? 'Image' : 'Video');
    const filename = path.basename(absolutePath);
    const displayName = disambiguateFilename(filename, counts);
    return {
      kind,
      absolutePath,
      filename,
      placeholder: createMediaPlaceholder(kind, displayName),
    };
  });
}

export function prepareOptionalCover(filePath?: string): LocalMedia | null {
  if (!filePath) return null;

  const absolutePath = ensureLocalFile(filePath, 'Cover image');
  const filename = path.basename(absolutePath);
  return {
    kind: 'cover',
    absolutePath,
    filename,
    placeholder: createMediaPlaceholder('cover', filename),
  };
}

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function printMediaSummary(media: LocalMedia[], label: string): void {
  if (media.length === 0) return;

  console.log(`${label}:`);
  for (const item of media) {
    console.log(`  - ${item.placeholder} -> ${item.absolutePath}`);
  }
}
