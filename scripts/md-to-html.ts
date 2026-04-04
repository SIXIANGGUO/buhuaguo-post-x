import fs from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import crypto from 'node:crypto';
import path from 'node:path';
import process from 'node:process';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

interface ImageInfo {
  placeholder: string;
  localPath: string;
  originalPath: string;
  blockIndex: number;
}

interface ParsedMarkdown {
  title: string;
  coverImage: string | null;
  contentImages: ImageInfo[];
  html: string;
  totalBlocks: number;
}

type FrontmatterFields = Record<string, string>;

function parseFrontmatter(content: string): { frontmatter: FrontmatterFields; body: string } {
  if (!content.startsWith('---\n')) {
    return { frontmatter: {}, body: content };
  }

  const endIndex = content.indexOf('\n---\n', 4);
  if (endIndex === -1) {
    return { frontmatter: {}, body: content };
  }

  const rawFrontmatter = content.slice(4, endIndex);
  const body = content.slice(endIndex + 5);
  const frontmatter: FrontmatterFields = {};

  for (const line of rawFrontmatter.split('\n')) {
    const match = line.match(/^\s*([A-Za-z0-9_-]+)\s*:\s*(.+?)\s*$/);
    if (!match) continue;
    frontmatter[match[1]!] = stripWrappingQuotes(match[2]!);
  }

  return { frontmatter, body };
}

function stripWrappingQuotes(value: string): string {
  if (!value) return value;
  const doubleQuoted = value.startsWith('"') && value.endsWith('"');
  const singleQuoted = value.startsWith("'") && value.endsWith("'");
  const cjkDoubleQuoted = value.startsWith('\u201c') && value.endsWith('\u201d');
  const cjkSingleQuoted = value.startsWith('\u2018') && value.endsWith('\u2019');
  if (doubleQuoted || singleQuoted || cjkDoubleQuoted || cjkSingleQuoted) {
    return value.slice(1, -1).trim();
  }
  return value.trim();
}

function pickFirstString(frontmatter: FrontmatterFields, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = frontmatter[key];
    if (value) return value;
  }
  return undefined;
}

function findCoverImageNearMarkdown(baseDir: string): string | null {
  const candidateDirs = [baseDir, path.join(baseDir, 'imgs')];
  const coverPattern = /^cover\.(png|jpe?g|webp|gif)$/i;

  for (const dir of candidateDirs) {
    try {
      if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) continue;
      const match = fs.readdirSync(dir).find((entry) => coverPattern.test(entry));
      if (match) return path.join(dir, match);
    } catch {
      continue;
    }
  }

  return null;
}

function extractTitleFromMarkdown(markdown: string): string {
  for (const line of markdown.split('\n')) {
    const match = line.match(/^#\s+(.+?)\s*$/);
    if (match) return stripWrappingQuotes(match[1]!);
  }
  return '';
}

function inferExtensionFromContentType(contentType: string | null): string {
  if (!contentType) return '.img';
  const normalized = contentType.toLowerCase().split(';')[0]!.trim();
  switch (normalized) {
    case 'image/jpeg':
      return '.jpg';
    case 'image/png':
      return '.png';
    case 'image/gif':
      return '.gif';
    case 'image/webp':
      return '.webp';
    case 'image/svg+xml':
      return '.svg';
    case 'image/avif':
      return '.avif';
    default:
      return '.img';
  }
}

function inferFilenameFromUrl(urlString: string, responseContentType: string | null): string {
  let pathname = '';
  try {
    pathname = new URL(urlString).pathname;
  } catch {
    pathname = urlString;
  }

  const baseName = path.basename(pathname) || 'remote-image';
  const cleanBaseName = baseName.replace(/[^A-Za-z0-9._-]/g, '_');
  const ext = path.extname(cleanBaseName);
  const stem = ext ? cleanBaseName.slice(0, -ext.length) : cleanBaseName;
  const hash = crypto.createHash('sha1').update(urlString).digest('hex').slice(0, 10);
  const finalExt = ext || inferExtensionFromContentType(responseContentType);
  return `${stem || 'remote-image'}-${hash}${finalExt}`;
}

async function downloadRemoteImage(urlString: string, assetDir: string): Promise<string> {
  const response = await fetch(urlString, {
    redirect: 'follow',
    headers: {
      'user-agent': 'buhuaguo-post-x/1.0.0',
    },
  });

  if (!response.ok) {
    throw new Error(`[md-to-html] Failed to download remote image: ${urlString} (${response.status} ${response.statusText})`);
  }

  const contentType = response.headers.get('content-type');
  const fileName = inferFilenameFromUrl(urlString, contentType);
  const localPath = path.join(assetDir, fileName);

  if (!fs.existsSync(localPath)) {
    const arrayBuffer = await response.arrayBuffer();
    await writeFile(localPath, Buffer.from(arrayBuffer));
    console.log(`[md-to-html] Downloaded remote image: ${urlString}`);
    console.log(`[md-to-html] Saved to local cache: ${localPath}`);
  }

  return localPath;
}

async function resolveLocalPath(filePath: string, baseDir: string, assetDir: string): Promise<string> {
  if (filePath.startsWith('http://') || filePath.startsWith('https://')) {
    return await downloadRemoteImage(filePath, assetDir);
  }

  const localPath = path.isAbsolute(filePath) ? filePath : path.resolve(baseDir, filePath);

  if (!fs.existsSync(localPath)) {
    throw new Error(`[md-to-html] Local image not found: ${localPath}`);
  }
  if (!fs.statSync(localPath).isFile()) {
    throw new Error(`[md-to-html] Path is not a file: ${localPath}`);
  }

  return localPath;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function applyInlineMarkdown(text: string): string {
  let html = escapeHtml(text);
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_match, label: string, href: string) => {
    return `<a href="${escapeHtml(href)}" rel="noopener noreferrer nofollow">${escapeHtml(label)}</a>`;
  });
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  return html;
}

function renderCompactParagraph(content: string): string {
  return `<div style="line-height:1.72;color:#111827;">${content}</div>`;
}

function renderCompactPlaceholder(content: string): string {
  return `<div style="line-height:1.6;color:#475569;font-family:SFMono-Regular,Menlo,Monaco,Consolas,monospace;font-size:13px;">${escapeHtml(content)}</div>`;
}

function renderCompactHeading(content: string, level = 2): string {
  const fontSize = level <= 2 ? '22px' : level === 3 ? '19px' : '17px';
  const marginTop = level <= 2 ? '16px' : '12px';
  const marginBottom = level <= 2 ? '8px' : '6px';
  return `<div style="font-size:${fontSize};line-height:1.35;font-weight:700;color:#111827;margin-top:${marginTop};margin-bottom:${marginBottom};"><strong>${applyInlineMarkdown(content)}</strong></div>`;
}

function renderCodeBlock(code: string, language?: string): string {
  const escapedCode = escapeHtml(code);
  const languageLabel = language?.trim()
    ? `<div style="font-size:11px;color:#6b7280;margin-bottom:7px;text-transform:lowercase;letter-spacing:0.04em;">${escapeHtml(language.trim())}</div>`
    : '';
  return `<div>${languageLabel}<pre style="margin:0;white-space:pre;font-family:SFMono-Regular,Menlo,Monaco,Consolas,monospace;font-size:12.5px;line-height:1.58;background:#f8fafc;border:1px solid #dbe4ee;border-radius:10px;padding:12px 14px;overflow-x:auto;color:#0f172a;"><code>${escapedCode}</code></pre></div>`;
}

function renderBlockquote(lines: string[]): string {
  const renderedLines = lines
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => `<div>${applyInlineMarkdown(line)}</div>`)
    .join('');

  if (!renderedLines) {
    return '';
  }

  return `<blockquote style="margin:0;padding-left:14px;border-left:4px solid #4b5563;color:#111827;"><div style="display:grid;gap:8px;line-height:1.72;">${renderedLines}</div></blockquote>`;
}

function renderList(listType: 'ul' | 'ol', items: string[]): string {
  const tag = listType;
  const itemsHtml = items
    .map((item) => `<li style="margin:0 0 6px 0;line-height:1.72;">${applyInlineMarkdown(item)}</li>`)
    .join('');
  return `<${tag} style="margin:0;padding-left:1.35em;color:#111827;">${itemsHtml}</${tag}>`;
}

function renderDivider(): string {
  return '<div style="height:1px;background:#d1d5db;margin:12px 0 8px 0;"></div>';
}

function stripH1(line: string): string {
  return line.replace(/^#\s+/, '').trim();
}

function splitTableRow(line: string): string[] {
  let text = line.trim();
  if (text.startsWith('|')) text = text.slice(1);
  if (text.endsWith('|')) text = text.slice(0, -1);

  const cells: string[] = [];
  let current = '';
  let escaped = false;

  for (const char of text) {
    if (escaped) {
      current += char;
      escaped = false;
      continue;
    }
    if (char === '\\') {
      escaped = true;
      continue;
    }
    if (char === '|') {
      cells.push(current.trim());
      current = '';
      continue;
    }
    current += char;
  }

  cells.push(current.trim());
  return cells;
}

function parseTableAlignment(cell: string): 'left' | 'center' | 'right' | null {
  const normalized = cell.replace(/\s+/g, '');
  if (!/^:?-{2,}:?$/.test(normalized)) return null;
  if (normalized.startsWith(':') && normalized.endsWith(':')) return 'center';
  if (normalized.endsWith(':')) return 'right';
  if (normalized.startsWith(':')) return 'left';
  return 'left';
}

function isTableSeparatorLine(line: string): boolean {
  if (!line.includes('|')) return false;
  const cells = splitTableRow(line);
  return cells.length > 0 && cells.every((cell) => parseTableAlignment(cell) !== null);
}

function buildTableHtml(headerLine: string, separatorLine: string, bodyLines: string[]): string {
  const headers = splitTableRow(headerLine);
  const alignments = splitTableRow(separatorLine).map((cell) => parseTableAlignment(cell));
  const headerHtml = headers.map((cell, index) => {
    const alignment = alignments[index] ?? null;
    const style = alignment ? ` style="text-align:${alignment}"` : '';
    return `<th${style}>${applyInlineMarkdown(cell)}</th>`;
  }).join('');

  const rowsHtml = bodyLines.map((line) => {
    const cells = splitTableRow(line);
    const cellsHtml = headers.map((_, index) => {
      const cell = cells[index] ?? '';
      const alignment = alignments[index] ?? null;
      const style = alignment ? ` style="text-align:${alignment}"` : '';
      return `<td${style}>${applyInlineMarkdown(cell)}</td>`;
    }).join('');
    return `<tr>${cellsHtml}</tr>`;
  }).join('');

  return `<table><thead><tr>${headerHtml}</tr></thead><tbody>${rowsHtml}</tbody></table>`;
}

function slugifyFileStem(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || 'article';
}

function stripMarkdownForTableCell(text: string): string {
  return text
    .replace(/!\[[^\]]*\]\([^)]+\)/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/\\\|/g, '|')
    .trim();
}

function buildTableScreenshotHtml(
  headers: string[],
  alignments: Array<'left' | 'center' | 'right' | null>,
  rows: string[][],
): string {
  const styleText = `
    :root {
      color-scheme: light;
      --border: #d0d7de;
      --header-bg: #f6f8fa;
      --text: #111827;
      --cell-bg: #ffffff;
    }
    html, body {
      margin: 0;
      padding: 0;
      background: transparent;
      width: fit-content;
      height: fit-content;
      overflow: hidden;
    }
    body {
      display: inline-block;
      width: fit-content;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      color: var(--text);
    }
    #table-shot {
      display: inline-block;
      background: #ffffff;
      border: 1px solid var(--border);
      border-radius: 12px;
      overflow: hidden;
    }
    table {
      border-collapse: collapse;
      font-size: 14px;
      line-height: 1.55;
      width: max-content;
      min-width: 560px;
      max-width: none;
      table-layout: auto;
    }
    thead th {
      background: var(--header-bg);
      font-weight: 700;
    }
    th, td {
      padding: 10px 14px;
      border-right: 1px solid var(--border);
      border-bottom: 1px solid var(--border);
      vertical-align: top;
      background: var(--cell-bg);
      white-space: pre-wrap;
      word-break: normal;
      overflow-wrap: anywhere;
      min-width: 160px;
      max-width: 340px;
    }
    tr:last-child td {
      border-bottom: 0;
    }
    th:last-child, td:last-child {
      border-right: 0;
    }
    p, ul, ol, blockquote, code {
      margin: 0;
    }
    code {
      font-family: "SFMono-Regular", "Menlo", monospace;
      font-size: 0.92em;
      background: rgba(148, 163, 184, 0.14);
      padding: 0.12em 0.35em;
      border-radius: 6px;
    }
    a {
      color: #0f766e;
      text-decoration: none;
    }
    strong {
      font-weight: 700;
    }
    em {
      font-style: italic;
    }
  `;

  const headerHtml = headers.map((cell, index) => {
    const alignment = alignments[index] ?? 'left';
    return `<th style="text-align:${alignment}">${applyInlineMarkdown(cell)}</th>`;
  }).join('');

  const rowsHtml = rows.map((row) => {
    const cellsHtml = headers.map((_, index) => {
      const alignment = alignments[index] ?? 'left';
      return `<td style="text-align:${alignment}">${applyInlineMarkdown(row[index] ?? '')}</td>`;
    }).join('');
    return `<tr>${cellsHtml}</tr>`;
  }).join('');

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8">
    <style>${styleText}</style>
  </head>
  <body>
    <div id="table-shot">
      <table>
        <thead><tr>${headerHtml}</tr></thead>
        <tbody>${rowsHtml}</tbody>
      </table>
    </div>
  </body>
</html>`;
}

function renderMarkdownTableToImage(
  markdownPath: string,
  assetDir: string,
  tableIndex: number,
  headerLine: string,
  separatorLine: string,
  bodyLines: string[],
): string {
  const headers = splitTableRow(headerLine);
  const alignments = splitTableRow(separatorLine).map((cell) => parseTableAlignment(cell));
  const rows = bodyLines.map((line) => splitTableRow(line));
  const articleStem = slugifyFileStem(path.basename(markdownPath, path.extname(markdownPath)));
  const imagePath = path.join(assetDir, `${articleStem}-table-${String(tableIndex).padStart(2, '0')}.png`);

  const plainHeaders = headers.map((cell) => stripMarkdownForTableCell(cell));
  const plainRows = rows.map((row) => row.map((cell) => stripMarkdownForTableCell(cell)));
  const html = buildTableScreenshotHtml(plainHeaders, alignments, plainRows);
  const tempRoot = fs.mkdtempSync(path.join(process.env.TMPDIR || '/tmp', 'buhuaguo-table-'));
  const htmlPath = path.join(tempRoot, 'table.html');
  const rawImagePath = path.join(tempRoot, 'table-raw.png');
  fs.writeFileSync(htmlPath, html, 'utf8');

  const browsers: Array<'chromium' | 'webkit'> = ['chromium', 'webkit'];
  let lastError = '';

  try {
    for (const browser of browsers) {
      const result = spawnSync('playwright', [
        'screenshot',
        '--browser',
        browser,
        '--wait-for-selector',
        '#table-shot',
        '--full-page',
        '--viewport-size',
        '1600,1200',
        pathToFileURL(htmlPath).href,
        rawImagePath,
      ], {
        encoding: 'utf8',
      });

      if (result.status === 0 && fs.existsSync(rawImagePath)) {
        const trimResult = spawnSync('python3', ['-c', `
from PIL import Image, ImageChops
import sys

source_path = sys.argv[1]
target_path = sys.argv[2]

image = Image.open(source_path).convert("RGB")
background = Image.new("RGB", image.size, (255, 255, 255))
difference = ImageChops.difference(image, background)
bbox = difference.getbbox()

if bbox is None:
    cropped = image
else:
    left, top, right, bottom = bbox
    padding = 10
    left = max(0, left - padding)
    top = max(0, top - padding)
    right = min(image.size[0], right + padding)
    bottom = min(image.size[1], bottom + padding)
    cropped = image.crop((left, top, right, bottom))

cropped.save(target_path)
`, rawImagePath, imagePath], {
          encoding: 'utf8',
        });

        if (trimResult.status !== 0) {
          lastError = (trimResult.stderr || trimResult.stdout || `trim exit ${trimResult.status ?? 'unknown'}`).trim();
          continue;
        }

        console.log(`[md-to-html] Rendered Markdown table to image: ${imagePath}`);
        return imagePath;
      }

      lastError = (result.stderr || result.stdout || `exit ${result.status ?? 'unknown'}`).trim();
    }
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }

  throw new Error(
    `[md-to-html] Failed to render Markdown table to image. X Articles do not preserve pasted HTML tables, so table rendering is required. ${lastError}`,
  );
}

async function convertMarkdownToHtml(
  markdown: string,
  markdownPath: string,
  baseDir: string,
  assetDir: string,
): Promise<{ html: string; totalBlocks: number; contentImages: ImageInfo[] }> {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  const htmlBlocks: string[] = [];
  const paragraphBuffer: string[] = [];
  const contentImages: ImageInfo[] = [];
  let placeholderIndex = 0;
  let tableImageIndex = 0;
  let inCodeBlock = false;
  const codeBuffer: string[] = [];
  let codeFenceLanguage: string | undefined;
  let blockquoteBuffer: string[] = [];
  let listType: 'ul' | 'ol' | null = null;
  let listItems: string[] = [];

  const flushParagraph = (): void => {
    if (paragraphBuffer.length === 0) return;
    const paragraphText = paragraphBuffer.join(' ').trim();
    if (paragraphText) {
      htmlBlocks.push(renderCompactParagraph(applyInlineMarkdown(paragraphText)));
    }
    paragraphBuffer.length = 0;
  };

  const flushList = (): void => {
    if (!listType || listItems.length === 0) {
      listType = null;
      listItems = [];
      return;
    }
    htmlBlocks.push(renderList(listType, listItems));
    listType = null;
    listItems = [];
  };

  const flushBlockquote = (): void => {
    if (blockquoteBuffer.length === 0) return;
    const html = renderBlockquote(blockquoteBuffer);
    if (html) {
      htmlBlocks.push(html);
    }
    blockquoteBuffer = [];
  };

  const pushResolvedImagePlaceholder = (localPath: string, originalPath: string): string => {
    const placeholder = `XIMGPH_${++placeholderIndex}`;
    contentImages.push({
      placeholder,
      localPath,
      originalPath,
      blockIndex: htmlBlocks.length,
    });
    return placeholder;
  };

  const pushImagePlaceholder = async (src: string): Promise<string> => {
    const localPath = await resolveLocalPath(src, baseDir, assetDir);
    return pushResolvedImagePlaceholder(localPath, src);
  };

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    const rawLine = lines[lineIndex]!;
    const line = rawLine.trimEnd();
    const trimmed = line.trim();

    if (trimmed.startsWith('```')) {
      flushList();
      flushBlockquote();
      if (inCodeBlock) {
        htmlBlocks.push(renderCodeBlock(codeBuffer.join('\n'), codeFenceLanguage));
        codeBuffer.length = 0;
        inCodeBlock = false;
        codeFenceLanguage = undefined;
      } else {
        flushParagraph();
        inCodeBlock = true;
        codeFenceLanguage = trimmed.slice(3).trim() || undefined;
      }
      continue;
    }

    if (inCodeBlock) {
      codeBuffer.push(line);
      continue;
    }

    if (!trimmed) {
      flushParagraph();
      flushList();
      flushBlockquote();
      continue;
    }

    if (/^\s*>\s?/.test(rawLine)) {
      flushParagraph();
      flushList();
      blockquoteBuffer.push(rawLine.replace(/^\s*>\s?/, '').trimEnd());
      continue;
    }

    const nextLine = lines[lineIndex + 1]?.trim() ?? '';
    if (trimmed.includes('|') && isTableSeparatorLine(nextLine)) {
      flushParagraph();
      flushList();
      flushBlockquote();

      const bodyLines: string[] = [];
      let tableIndex = lineIndex + 2;
      while (tableIndex < lines.length) {
        const candidate = lines[tableIndex]!.trim();
        if (!candidate || !candidate.includes('|')) break;
        bodyLines.push(candidate);
        tableIndex += 1;
      }

      const renderedTablePath = renderMarkdownTableToImage(
        markdownPath,
        assetDir,
        ++tableImageIndex,
        trimmed,
        nextLine,
        bodyLines,
      );
      htmlBlocks.push(renderCompactPlaceholder(pushResolvedImagePlaceholder(renderedTablePath, `table:${tableImageIndex}`)));
      lineIndex = tableIndex - 1;
      continue;
    }

    if (/^#\s+/.test(trimmed)) {
      flushParagraph();
      flushList();
      flushBlockquote();
      if (stripH1(trimmed)) {
        continue;
      }
    }

    if (/^#{2,6}\s+/.test(trimmed)) {
      flushParagraph();
      flushList();
      flushBlockquote();
      const level = Math.min(6, (trimmed.match(/^#+/)?.[0]?.length ?? 2));
      const headingText = trimmed.replace(/^#{2,6}\s+/, '');
      htmlBlocks.push(renderCompactHeading(headingText, level));
      continue;
    }

    const unorderedMatch = trimmed.match(/^[-*]\s+(.+)$/);
    if (unorderedMatch) {
      flushParagraph();
      flushBlockquote();
      if (listType && listType !== 'ul') flushList();
      listType = 'ul';
      listItems.push(unorderedMatch[1]!);
      continue;
    }

    const orderedMatch = trimmed.match(/^\d+\.\s+(.+)$/);
    if (orderedMatch) {
      flushParagraph();
      flushBlockquote();
      if (listType && listType !== 'ol') flushList();
      listType = 'ol';
      listItems.push(orderedMatch[1]!);
      continue;
    }

    if (/^---+$/.test(trimmed) || /^___+$/.test(trimmed) || /^\*\*\*+$/.test(trimmed)) {
      flushParagraph();
      flushList();
      flushBlockquote();
      htmlBlocks.push(renderDivider());
      continue;
    }

    const imageOnlyMatch = trimmed.match(/^!\[[^\]]*\]\(([^)]+)\)$/);
    if (imageOnlyMatch) {
      flushParagraph();
      flushList();
      flushBlockquote();
      htmlBlocks.push(renderCompactPlaceholder(await pushImagePlaceholder(imageOnlyMatch[1]!)));
      continue;
    }

    flushList();
    flushBlockquote();
    const imageMatches = [...line.matchAll(/!\[[^\]]*\]\(([^)]+)\)/g)];
    let withPlaceholders = line;
    for (const match of imageMatches) {
      const original = match[0];
      const src = match[1];
      if (!original || !src) continue;
      const placeholder = await pushImagePlaceholder(src);
      withPlaceholders = withPlaceholders.replace(original, placeholder);
    }
    paragraphBuffer.push(withPlaceholders.trim());
  }

  flushParagraph();
  flushList();
  flushBlockquote();

  if (inCodeBlock && codeBuffer.length > 0) {
    htmlBlocks.push(renderCodeBlock(codeBuffer.join('\n'), codeFenceLanguage));
  }

  return {
    html: htmlBlocks.join('\n').trim(),
    totalBlocks: htmlBlocks.length,
    contentImages,
  };
}

export async function parseMarkdown(
  markdownPath: string,
  options?: { coverImage?: string; title?: string },
): Promise<ParsedMarkdown> {
  const content = fs.readFileSync(markdownPath, 'utf-8');
  const baseDir = path.dirname(markdownPath);
  const assetDir = path.join(baseDir, '.buhuaguo-post-x-assets');
  const { frontmatter, body } = parseFrontmatter(content);

  await mkdir(assetDir, { recursive: true });

  let title = stripWrappingQuotes(options?.title ?? '') || pickFirstString(frontmatter, ['title']) || '';
  if (!title) {
    title = extractTitleFromMarkdown(body);
  }
  if (!title) {
    title = path.basename(markdownPath, path.extname(markdownPath));
  }

  let coverImagePath = stripWrappingQuotes(options?.coverImage ?? '') || pickFirstString(frontmatter, [
    'cover_image',
    'coverImage',
    'cover',
    'image',
    'featureImage',
    'feature_image',
  ]) || null;

  if (!coverImagePath) {
    coverImagePath = findCoverImageNearMarkdown(baseDir);
  }

  const converted = await convertMarkdownToHtml(body, markdownPath, baseDir, assetDir);
  const resolvedCoverImage = coverImagePath ? await resolveLocalPath(coverImagePath, baseDir, assetDir) : null;

  return {
    title,
    coverImage: resolvedCoverImage,
    contentImages: converted.contentImages,
    html: converted.html,
    totalBlocks: converted.totalBlocks,
  };
}

function printUsage(): never {
  console.log(`Convert Markdown to lightweight HTML for X Article drafting

Usage:
  npx -y bun md-to-html.ts <markdown_file> [options]

Options:
  --title <title>       Override title from frontmatter
  --cover <image>       Override cover image from frontmatter
  --output <json|html>  Output format (default: json)
  --html-only           Output only the HTML content
  --save-html <path>    Save HTML to file
`);
  process.exit(0);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    printUsage();
  }

  let markdownPath: string | undefined;
  let title: string | undefined;
  let coverImage: string | undefined;
  let outputFormat: 'json' | 'html' = 'json';
  let htmlOnly = false;
  let saveHtmlPath: string | undefined;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]!;
    if (arg === '--title' && args[i + 1]) {
      title = args[++i];
    } else if (arg === '--cover' && args[i + 1]) {
      coverImage = args[++i];
    } else if (arg === '--output' && args[i + 1]) {
      outputFormat = args[++i] as 'json' | 'html';
    } else if (arg === '--html-only') {
      htmlOnly = true;
    } else if (arg === '--save-html' && args[i + 1]) {
      saveHtmlPath = args[++i];
    } else if (!arg.startsWith('-')) {
      markdownPath = arg;
    }
  }

  if (!markdownPath) {
    throw new Error('Markdown file path required');
  }

  if (!fs.existsSync(markdownPath)) {
    throw new Error(`File not found: ${markdownPath}`);
  }

  const result = await parseMarkdown(markdownPath, { title, coverImage });

  if (saveHtmlPath) {
    await writeFile(saveHtmlPath, result.html, 'utf-8');
    console.error(`[md-to-html] HTML saved to: ${saveHtmlPath}`);
  }

  if (htmlOnly || outputFormat === 'html') {
    console.log(result.html);
    return;
  }

  console.log(JSON.stringify(result, null, 2));
}

if (import.meta.main) {
  await main().catch((err) => {
    console.error(`Error: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  });
}
