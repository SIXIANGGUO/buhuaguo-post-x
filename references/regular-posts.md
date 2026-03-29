# Regular Posts - Manual Workflow

This skill now prepares drafts only. It does not open Chrome or perform any browser automation.

## What Gets Copied

`x-browser.ts` copies:

1. The post text
2. A blank line when needed
3. One placeholder per local image, using the filename

Example clipboard output:

```text
Hello from Claude!

[Image: screenshot.png]
[Image: chart.webp]
```

## Usage

```bash
${BUN_X} {baseDir}/scripts/x-browser.ts "Hello from Claude!" --image ./screenshot.png
```

## Manual Posting Steps

1. Run the script to prepare the draft.
2. Open the X compose dialog yourself.
3. Paste the copied text.
4. Insert the matching local files where the filename placeholders appear.
5. Remove the placeholder lines after the media is inserted if needed.
6. Review and publish manually.

## Constraints

- Images must already be local files.
- Remote URLs are rejected.
- Regular posts support at most 4 images.

## Video Posts

`x-video.ts` behaves the same way but uses a video placeholder:

```text
Check this out!

[Video: demo.mp4]
```

## Quote Tweets

`x-quote.ts` copies only the comment. The target tweet URL is printed to the terminal so you can open the quote-tweet composer manually.
