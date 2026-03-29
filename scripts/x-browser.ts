import process from 'node:process';

import { copyTextToClipboard, prepareMediaList, printMediaSummary } from './clipboard-flow.js';

interface XBrowserOptions {
  text?: string;
  images?: string[];
}

export async function postToX(options: XBrowserOptions): Promise<void> {
  const { text, images = [] } = options;

  if (!text && images.length === 0) {
    throw new Error('Provide text or at least one image.');
  }

  if (images.length > 4) {
    throw new Error('X regular posts support at most 4 images.');
  }

  const preparedImages = prepareMediaList(images, 'image');
  const lines: string[] = [];

  if (text?.trim()) {
    lines.push(text.trim());
  }

  if (preparedImages.length > 0) {
    if (lines.length > 0) lines.push('');
    for (const image of preparedImages) {
      lines.push(image.placeholder);
    }
  }

  const clipboardText = lines.join('\n').trim();
  copyTextToClipboard(clipboardText);

  console.log('[x-browser] Copied post draft to clipboard.');
  console.log('');
  console.log('[x-browser] Clipboard preview:');
  console.log(clipboardText);
  printMediaSummary(preparedImages, '[x-browser] Local images');
}

function printUsage(): never {
  console.log(`Prepare an X post and copy it to the clipboard

Usage:
  npx -y bun x-browser.ts [options] [text]

Options:
  --image <path>   Add image placeholder (can be repeated, max 4)
  --help           Show this help

Examples:
  npx -y bun x-browser.ts "Hello from Claude!"
  npx -y bun x-browser.ts "Check this out" --image ./screenshot.png
`);
  process.exit(0);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (args.includes('--help') || args.includes('-h')) printUsage();

  const images: string[] = [];
  const textParts: string[] = [];

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]!;
    if (arg === '--image' && args[i + 1]) {
      images.push(args[++i]!);
    } else if (arg === '--submit') {
      console.warn('[x-browser] --submit is no longer supported. The script now only copies to clipboard.');
    } else if (arg === '--profile' && args[i + 1]) {
      i += 1;
      console.warn('[x-browser] --profile is ignored. Browser automation has been removed.');
    } else if (!arg.startsWith('-')) {
      textParts.push(arg);
    }
  }

  const text = textParts.join(' ').trim() || undefined;
  await postToX({ text, images });
}

await main().catch((err) => {
  console.error(`Error: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
