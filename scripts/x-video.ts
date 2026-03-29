import process from 'node:process';

import { copyTextToClipboard, prepareMediaList, printMediaSummary } from './clipboard-flow.js';

interface XVideoOptions {
  text?: string;
  videoPath: string;
}

export async function postVideoToX(options: XVideoOptions): Promise<void> {
  const preparedVideos = prepareMediaList([options.videoPath], 'video');
  const video = preparedVideos[0]!;
  const lines: string[] = [];

  if (options.text?.trim()) {
    lines.push(options.text.trim());
    lines.push('');
  }

  lines.push(video.placeholder);

  const clipboardText = lines.join('\n').trim();
  copyTextToClipboard(clipboardText);

  console.log('[x-video] Copied video post draft to clipboard.');
  console.log('');
  console.log('[x-video] Clipboard preview:');
  console.log(clipboardText);
  printMediaSummary(preparedVideos, '[x-video] Local video');
}

function printUsage(): never {
  console.log(`Prepare a video post for X and copy it to the clipboard

Usage:
  npx -y bun x-video.ts [options] --video <path> [text]

Options:
  --video <path>   Local video file path (required)
  --help           Show this help

Examples:
  npx -y bun x-video.ts --video ./clip.mp4 "Check out this video!"
`);
  process.exit(0);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (args.includes('--help') || args.includes('-h')) printUsage();

  let videoPath: string | undefined;
  const textParts: string[] = [];

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]!;
    if (arg === '--video' && args[i + 1]) {
      videoPath = args[++i]!;
    } else if (arg === '--submit') {
      console.warn('[x-video] --submit is no longer supported. The script now only copies to clipboard.');
    } else if (arg === '--profile' && args[i + 1]) {
      i += 1;
      console.warn('[x-video] --profile is ignored. Browser automation has been removed.');
    } else if (!arg.startsWith('-')) {
      textParts.push(arg);
    }
  }

  if (!videoPath) {
    console.error('Error: --video <path> is required.');
    printUsage();
  }

  const text = textParts.join(' ').trim() || undefined;
  await postVideoToX({ text, videoPath });
}

await main().catch((err) => {
  console.error(`Error: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
