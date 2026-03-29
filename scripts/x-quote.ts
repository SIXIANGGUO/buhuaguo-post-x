import process from 'node:process';

import { copyTextToClipboard } from './clipboard-flow.js';

function extractTweetUrl(urlOrId: string): string | null {
  if (urlOrId.match(/(?:x\.com|twitter\.com)\/\w+\/status\/\d+/)) {
    return urlOrId.replace(/twitter\.com/, 'x.com').split('?')[0];
  }
  return null;
}

interface QuoteOptions {
  tweetUrl: string;
  comment?: string;
}

export async function quotePost(options: QuoteOptions): Promise<void> {
  const comment = options.comment?.trim() ?? '';
  copyTextToClipboard(comment);

  console.log('[x-quote] Copied quote comment to clipboard.');
  console.log(`[x-quote] Target tweet: ${options.tweetUrl}`);
  if (comment) {
    console.log('');
    console.log('[x-quote] Clipboard preview:');
    console.log(comment);
  } else {
    console.log('[x-quote] Clipboard is empty because no comment was provided.');
  }
}

function printUsage(): never {
  console.log(`Prepare a quote-tweet comment and copy it to the clipboard

Usage:
  npx -y bun x-quote.ts <tweet-url> [comment]

Options:
  --help           Show this help

Examples:
  npx -y bun x-quote.ts https://x.com/user/status/123456789 "Great insight!"
`);
  process.exit(0);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (args.includes('--help') || args.includes('-h')) printUsage();

  let tweetUrl: string | undefined;
  const commentParts: string[] = [];

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]!;
    if (arg === '--submit') {
      console.warn('[x-quote] --submit is no longer supported. The script now only copies to clipboard.');
    } else if (arg === '--profile' && args[i + 1]) {
      i += 1;
      console.warn('[x-quote] --profile is ignored. Browser automation has been removed.');
    } else if (!arg.startsWith('-')) {
      if (!tweetUrl && arg.match(/(?:x\.com|twitter\.com)\/\w+\/status\/\d+/)) {
        tweetUrl = extractTweetUrl(arg) ?? undefined;
      } else {
        commentParts.push(arg);
      }
    }
  }

  if (!tweetUrl) {
    console.error('Error: Please provide a tweet URL.');
    printUsage();
  }

  const comment = commentParts.join(' ').trim() || undefined;
  await quotePost({ tweetUrl, comment });
}

await main().catch((err) => {
  console.error(`Error: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
