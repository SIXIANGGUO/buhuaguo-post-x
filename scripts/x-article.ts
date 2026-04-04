import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

import { writeArticleImageManifest, writeArticleImageState } from './article-images.js';
import { parseMarkdown } from './md-to-html.js';
import {
  copyHtmlToClipboard,
  escapeHtml,
  prepareMediaList,
  prepareOptionalCover,
  printMediaSummary,
} from './clipboard-flow.js';

interface ArticleOptions {
  markdownPath: string;
  coverImage?: string;
  title?: string;
}

function writeHelperScript(scriptPath: string, scriptBody: string): void {
  fs.writeFileSync(scriptPath, scriptBody, 'utf8');
  fs.chmodSync(scriptPath, 0o755);
}

function writeArticleHelperScripts(markdownPath: string): string[] {
  const articleDir = path.dirname(path.resolve(markdownPath));
  const imageHelperPath = process.argv[1]
    ? process.argv[1].replace('x-article.ts', 'x-article-image.ts')
    : 'x-article-image.ts';

  const scripts = [
    {
      name: 'xa-next',
      args: '--next',
    },
    {
      name: 'xa-cover',
      args: '--copy-cover',
    },
    {
      name: 'xa-peek',
      args: '--peek',
    },
    {
      name: 'xa-prev',
      args: '--prev',
    },
    {
      name: 'xa-status',
      args: '--status',
    },
    {
      name: 'xa-open',
      args: '--open-folder',
    },
    {
      name: '.x-article-next',
      args: '--next',
    },
    {
      name: '.x-article-cover',
      args: '--copy-cover',
    },
    {
      name: '.x-article-peek',
      args: '--peek',
    },
    {
      name: '.x-article-prev',
      args: '--prev',
    },
    {
      name: '.x-article-status',
      args: '--status',
    },
    {
      name: '.x-article-open',
      args: '--open-folder',
    },
  ];

  const createdPaths: string[] = [];
  for (const item of scripts) {
    const scriptPath = path.join(articleDir, item.name);
    const scriptBody = `#!/bin/zsh
exec bun ${JSON.stringify(imageHelperPath)} ${JSON.stringify(markdownPath)} ${item.args} "$@"
`;
    writeHelperScript(scriptPath, scriptBody);
    createdPaths.push(scriptPath);
  }

  return createdPaths;
}

export async function publishArticle(options: ArticleOptions): Promise<void> {
  const parsed = await parseMarkdown(options.markdownPath, {
    title: options.title,
    coverImage: options.coverImage,
  });

  const preparedImages = prepareMediaList(parsed.contentImages.map((image) => image.localPath), 'image');
  const preparedCover = prepareOptionalCover(parsed.coverImage ?? undefined);

  let htmlForClipboard = parsed.html;
  for (let i = 0; i < parsed.contentImages.length; i++) {
    const source = parsed.contentImages[i]!;
    const prepared = preparedImages[i]!;
    const replacement = `<div>${escapeHtml(prepared.placeholder)}</div>`;
    htmlForClipboard = htmlForClipboard.replace(source.placeholder, replacement);
  }

  copyHtmlToClipboard(htmlForClipboard);

  writeArticleImageManifest(options.markdownPath, {
    markdownPath: options.markdownPath,
    title: parsed.title,
    generatedAt: new Date().toISOString(),
    cover: preparedCover ? {
      placeholder: preparedCover.placeholder,
      absolutePath: preparedCover.absolutePath,
      filename: preparedCover.filename,
    } : null,
    images: preparedImages.map((image, index) => ({
      index,
      placeholder: image.placeholder,
      absolutePath: image.absolutePath,
      filename: image.filename,
    })),
  });
  writeArticleImageState(options.markdownPath, 0);
  const helperScripts = writeArticleHelperScripts(options.markdownPath);

  console.log('[x-article] Copied article body to clipboard.');
  console.log(`[x-article] Title: ${parsed.title}`);
  if (preparedCover) {
    console.log(`[x-article] Cover: ${preparedCover.placeholder} -> ${preparedCover.absolutePath}`);
  } else {
    console.log('[x-article] Cover: none');
  }
  printMediaSummary(preparedImages, '[x-article] Local content images (including rendered tables and code blocks)');
  console.log('[x-article] Short helper scripts generated next to the article:');
  for (const helperPath of helperScripts) {
    console.log(`  - ${helperPath}`);
  }
  console.log('[x-article] Recommended usage from the article directory:');
  console.log('  - ./xa-cover   # copy the cover image');
  console.log('  - ./xa-next    # copy the next body image');
  console.log('  - ./xa-peek    # preview the next body image');
  console.log('  - ./xa-prev    # recopy the previous body image');
  console.log('  - ./xa-status  # show image insertion progress');
  console.log('  - ./xa-open    # reveal the current image in Finder');
  if (preparedCover) {
    console.log(`[x-article] Cover helper: bun ${process.argv[1] ? process.argv[1].replace('x-article.ts', 'x-article-image.ts') : 'x-article-image.ts'} ${JSON.stringify(options.markdownPath)} --copy-cover`);
  }
  if (preparedImages.length > 0) {
    console.log(`[x-article] Next image helper: bun ${process.argv[1] ? process.argv[1].replace('x-article.ts', 'x-article-image.ts') : 'x-article-image.ts'} ${JSON.stringify(options.markdownPath)} --next`);
  }
}

function printUsage(): never {
  console.log(`Prepare an X Article draft and copy the body to the clipboard

Usage:
  npx -y bun x-article.ts article.md
  npx -y bun x-article.ts article.md --cover ./cover.jpg

Options:
  --cover <path>   Override cover image
  --title <text>   Override title
  --help           Show this help

Notes:
  - All images must already be local files.
  - Content images are replaced with filename placeholders in the copied draft.
  - The article title and cover are printed to the terminal for manual filling.
`);
  process.exit(0);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    printUsage();
  }

  let markdownPath: string | undefined;
  let coverImage: string | undefined;
  let title: string | undefined;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]!;
    if (arg === '--cover' && args[i + 1]) {
      coverImage = args[++i];
    } else if (arg === '--title' && args[i + 1]) {
      title = args[++i];
    } else if (arg === '--submit') {
      console.warn('[x-article] --submit is no longer supported. The script now only copies to clipboard.');
    } else if (!arg.startsWith('-')) {
      markdownPath = arg;
    }
  }

  if (!markdownPath) {
    throw new Error('Markdown file path required.');
  }

  await publishArticle({ markdownPath, coverImage, title });
}

await main().catch((err) => {
  console.error(`Error: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
