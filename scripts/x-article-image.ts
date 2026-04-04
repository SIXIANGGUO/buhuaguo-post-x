import process from 'node:process';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

import {
  getManifestPath,
  readArticleImageManifest,
  readArticleImageState,
  removeArticleHelperScripts,
  writeArticleImageState,
} from './article-images.js';
import { copyImageFileToClipboard } from './clipboard-flow.js';

function printUsage(): never {
  console.log(`Copy article images to the clipboard one by one

Usage:
  npx -y bun x-article-image.ts article.md --next
  npx -y bun x-article-image.ts article.md --copy-cover
  npx -y bun x-article-image.ts article.md --peek
  npx -y bun x-article-image.ts article.md --prev
  npx -y bun x-article-image.ts article.md --status
  npx -y bun x-article-image.ts article.md --reset
  npx -y bun x-article-image.ts article.md --index 2
  npx -y bun x-article-image.ts article.md --open-folder

Options:
  --next        Copy the next pending image to the clipboard (default)
  --copy-cover  Copy the cover image to the clipboard
  --peek        Preview which image would be copied next
  --prev        Copy the previous image again without changing forward progress
  --status      Show current progress without copying
  --reset       Reset progress to the first image
  --index <n>   Copy a specific 1-based image index and advance from there
  --open-folder Reveal the next image in Finder/File Explorer
  --help        Show this help

Notes:
  - Run x-article.ts first so the image manifest is generated.
  - Each successful copy advances the pointer to the next image.
`);
  process.exit(0);
}

function printStatus(markdownPath: string): void {
  const manifest = readArticleImageManifest(markdownPath);
  const state = readArticleImageState(markdownPath);
  const total = manifest.images.length;

  console.log(`[x-article-image] Manifest: ${getManifestPath(markdownPath)}`);
  if (manifest.cover) {
    console.log(`[x-article-image] Cover: ${manifest.cover.placeholder} -> ${manifest.cover.absolutePath}`);
  } else {
    console.log('[x-article-image] Cover: none');
  }
  console.log(`[x-article-image] Progress: ${Math.min(state.nextIndex, total)}/${total}`);

  if (state.nextIndex < total) {
    const next = manifest.images[state.nextIndex]!;
    console.log(`[x-article-image] Next: [${state.nextIndex + 1}/${total}] ${next.placeholder} -> ${next.absolutePath}`);
  } else {
    console.log('[x-article-image] All images have been copied at least once.');
  }
}

function copyCover(markdownPath: string): void {
  const manifest = readArticleImageManifest(markdownPath);
  if (!manifest.cover) {
    console.log('[x-article-image] No cover image for this article.');
    return;
  }

  copyImageFileToClipboard(manifest.cover.absolutePath);
  console.log(`[x-article-image] Copied cover ${manifest.cover.placeholder}`);
  console.log(`[x-article-image] File: ${manifest.cover.absolutePath}`);

  if (manifest.images.length === 0) {
    const removedHelpers = removeArticleHelperScripts(markdownPath);
    if (removedHelpers.length > 0) {
      console.log('[x-article-image] Cleaned up helper scripts from the article directory.');
    }
  }
}

function getTotalImages(markdownPath: string): number {
  return readArticleImageManifest(markdownPath).images.length;
}

function getDisplayItem(markdownPath: string, zeroBasedIndex: number) {
  const manifest = readArticleImageManifest(markdownPath);
  if (manifest.images.length === 0) {
    return null;
  }

  if (zeroBasedIndex < 0 || zeroBasedIndex >= manifest.images.length) {
    throw new Error(`Image index out of range. Choose 1-${manifest.images.length}.`);
  }

  return {
    item: manifest.images[zeroBasedIndex]!,
    total: manifest.images.length,
  };
}

function printImagePreview(prefix: string, markdownPath: string, zeroBasedIndex: number): void {
  const result = getDisplayItem(markdownPath, zeroBasedIndex);
  if (!result) {
    console.log('[x-article-image] No content images for this article.');
    return;
  }
  const { item, total } = result;
  console.log(`${prefix}: [${zeroBasedIndex + 1}/${total}] ${item.placeholder}`);
  console.log(`[x-article-image] File: ${item.absolutePath}`);
}

function copyByIndex(markdownPath: string, zeroBasedIndex: number, nextIndexAfterCopy = zeroBasedIndex + 1): void {
  const result = getDisplayItem(markdownPath, zeroBasedIndex);
  if (!result) {
    console.log('[x-article-image] No content images for this article.');
    return;
  }

  const { item, total } = result;
  copyImageFileToClipboard(item.absolutePath);
  writeArticleImageState(markdownPath, nextIndexAfterCopy);

  console.log(`[x-article-image] Copied [${zeroBasedIndex + 1}/${total}] ${item.placeholder}`);
  console.log(`[x-article-image] File: ${item.absolutePath}`);

  if (nextIndexAfterCopy < total) {
    const manifest = readArticleImageManifest(markdownPath);
    const next = manifest.images[nextIndexAfterCopy]!;
    console.log(`[x-article-image] Next up: ${next.placeholder}`);
  } else {
    console.log('[x-article-image] This was the last image.');
    const removedHelpers = removeArticleHelperScripts(markdownPath);
    if (removedHelpers.length > 0) {
      console.log('[x-article-image] Cleaned up helper scripts from the article directory.');
    }
  }
}

function revealImage(markdownPath: string, zeroBasedIndex: number): void {
  const result = getDisplayItem(markdownPath, zeroBasedIndex);
  if (!result) {
    console.log('[x-article-image] No content images for this article.');
    return;
  }

  const imagePath = result.item.absolutePath;
  let command: string;
  let args: string[];

  if (process.platform === 'darwin') {
    command = 'open';
    args = ['-R', imagePath];
  } else if (process.platform === 'win32') {
    command = 'explorer.exe';
    args = ['/select,', imagePath];
  } else {
    command = 'xdg-open';
    args = [path.dirname(imagePath)];
  }

  const openResult = spawnSync(command, args, { stdio: 'inherit' });
  if (openResult.status !== 0) {
    throw new Error(`Failed to open image location with ${command}.`);
  }

  console.log(`[x-article-image] Opened image location for ${result.item.placeholder}`);
  console.log(`[x-article-image] File: ${imagePath}`);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    printUsage();
  }

  let markdownPath: string | undefined;
  let mode: 'next' | 'copy-cover' | 'peek' | 'prev' | 'status' | 'reset' | 'index' | 'open-folder' = 'next';
  let indexArg: number | undefined;

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i]!;
    if (arg === '--next') {
      mode = 'next';
    } else if (arg === '--copy-cover') {
      mode = 'copy-cover';
    } else if (arg === '--peek') {
      mode = 'peek';
    } else if (arg === '--prev') {
      mode = 'prev';
    } else if (arg === '--status') {
      mode = 'status';
    } else if (arg === '--reset') {
      mode = 'reset';
    } else if (arg === '--open-folder') {
      mode = 'open-folder';
    } else if (arg === '--index' && args[i + 1]) {
      indexArg = Number(args[++i]);
    } else if (!arg.startsWith('-')) {
      markdownPath = arg;
    }
  }

  if (!markdownPath) {
    throw new Error('Markdown file path required.');
  }

  if (mode === 'status') {
    printStatus(markdownPath);
    return;
  }

  if (mode === 'copy-cover') {
    copyCover(markdownPath);
    return;
  }

  if (mode === 'peek') {
    const state = readArticleImageState(markdownPath);
    const total = getTotalImages(markdownPath);
    if (total === 0) {
      console.log('[x-article-image] No content images for this article.');
      return;
    }
    if (state.nextIndex >= total) {
      console.log('[x-article-image] All images have already been copied. Use --prev or --reset if needed.');
      return;
    }
    printImagePreview('[x-article-image] Next preview', markdownPath, state.nextIndex);
    return;
  }

  if (mode === 'reset') {
    writeArticleImageState(markdownPath, 0);
    console.log('[x-article-image] Reset image progress to the first image.');
    printStatus(markdownPath);
    return;
  }

  if (indexArg !== undefined && mode !== 'open-folder') {
    if (!Number.isInteger(indexArg) || (indexArg ?? 0) < 1) {
      throw new Error('Provide a valid 1-based index after --index.');
    }
    copyByIndex(markdownPath, (indexArg ?? 1) - 1);
    return;
  }

  if (mode === 'prev') {
    const state = readArticleImageState(markdownPath);
    const total = getTotalImages(markdownPath);
    if (total === 0) {
      console.log('[x-article-image] No content images for this article.');
      return;
    }
    const previousIndex = Math.max(0, Math.min(total - 1, state.nextIndex - 1));
    copyByIndex(markdownPath, previousIndex, state.nextIndex);
    return;
  }

  if (mode === 'open-folder') {
    const total = getTotalImages(markdownPath);
    if (total === 0) {
      console.log('[x-article-image] No content images for this article.');
      return;
    }
    if (Number.isInteger(indexArg) && (indexArg ?? 0) >= 1) {
      revealImage(markdownPath, (indexArg ?? 1) - 1);
      return;
    }
    const state = readArticleImageState(markdownPath);
    const targetIndex = Math.min(state.nextIndex, total - 1);
    revealImage(markdownPath, targetIndex);
    return;
  }

  const state = readArticleImageState(markdownPath);
  const total = getTotalImages(markdownPath);
  if (total === 0) {
    console.log('[x-article-image] No content images for this article.');
    return;
  }
  if (state.nextIndex >= total) {
    console.log('[x-article-image] All images have already been copied. Use --prev to recopy one, or --reset to start over.');
    return;
  }
  copyByIndex(markdownPath, state.nextIndex);
}

await main().catch((err) => {
  console.error(`Error: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
