---
name: buhuaguo-post-x
description: Prepares content for X (Twitter) and copies it to the clipboard. Supports regular posts, quote comments, video posts, and X Articles. Uses local filenames as media placeholders so the user can paste text first and insert files manually.
version: 1.58.0
metadata:
  openclaw:
    homepage: https://github.com/SIXIANGGUO/buhuaguo-post-x
    requires:
      anyBins:
        - bun
        - npx
        - playwright
---

# Buhuaguo Post X

Prepare post drafts for X and copy them to the clipboard. This skill no longer automates X itself; any local Playwright usage is limited to rendering Markdown tables into local PNG files.

Use it when the user wants help drafting something for X and then plans to paste the text manually.

## Core Rules

1. Only prepare the draft and copy it to the clipboard.
2. Do not open browsers or attempt any UI automation.
3. Images and videos should end up as local files before the user inserts them into X.
4. When media is referenced, use the filename as a placeholder in the copied draft so the user can insert the corresponding local file manually.

## Script Directory

All scripts are in the `scripts/` subdirectory of this skill.

Resolve the runtime as `${BUN_X}`:
- If `bun` exists, use `bun`
- Otherwise, if `npx` exists, use `npx -y bun`
- Otherwise, tell the user to install bun

Table rendering requirement:
- For Markdown tables in X Articles, the skill uses a local `playwright screenshot` command to render tables into PNG files before insertion.

## Script Reference

| Script | Purpose |
|--------|---------|
| `scripts/x-browser.ts` | Regular post draft: text plus image placeholders |
| `scripts/x-video.ts` | Video post draft: text plus a video placeholder |
| `scripts/x-quote.ts` | Quote-tweet comment copied to clipboard |
| `scripts/x-article.ts` | X Article body copied to the clipboard with filename placeholders |
| `scripts/x-article-image.ts` | Copy the next article image to the clipboard in insertion order |
| `scripts/md-to-html.ts` | Parse Markdown article and cache remote images locally when needed |
| `scripts/copy-to-clipboard.ts` | Clipboard helper for text, HTML, and images |

## Post Type Selection

Unless the user says otherwise:
- Plain text content: use **Regular Post**
- Markdown file: use **X Article**
- Explicit tweet URL + comment: use **Quote Tweet**
- Explicit video file: use **Video Post**

## Regular Posts

```bash
${BUN_X} {baseDir}/scripts/x-browser.ts "Hello!" --image ./photo.png
```

Behavior:
- Copies the post text to the clipboard
- Appends image placeholders like `[Image: photo.png]`
- Prints the absolute local image paths in the terminal output

Parameters:
- `<text>`: post content
- `--image <path>`: local image file, repeatable, max 4

## Video Posts

```bash
${BUN_X} {baseDir}/scripts/x-video.ts --video ./clip.mp4 "Check this out!"
```

Behavior:
- Copies the post text to the clipboard
- Appends a video placeholder like `[Video: clip.mp4]`
- Prints the absolute local video path in the terminal output

Parameters:
- `<text>`: post content
- `--video <path>`: required local video file

## Quote Tweets

```bash
${BUN_X} {baseDir}/scripts/x-quote.ts https://x.com/user/status/123 "Great insight!"
```

Behavior:
- Copies only the quote comment to the clipboard
- Prints the target tweet URL in the terminal output for manual quote-tweet flow

Parameters:
- `<tweet-url>`: target tweet URL
- `<comment>`: optional quote comment

## X Articles

```bash
${BUN_X} {baseDir}/scripts/x-article.ts article.md
${BUN_X} {baseDir}/scripts/x-article.ts article.md --cover ./cover.jpg
```

Behavior:
- Parses the Markdown article
- Downloads remote article images into a local cache when needed
- Copies the article body to the clipboard
- Replaces inline images with filename placeholders like `[Image: chart.png]`
- Renders Markdown tables into local PNG images because X Articles do not preserve pasted HTML tables
- Writes an ordered image manifest so `x-article-image.ts` can copy the next image for insertion
- Generates short helper commands next to the article, such as `./xa-next` and `./xa-cover`
- Prints the resolved article title, cover image, and local content-image paths in the terminal output

Image helper:

```bash
${BUN_X} {baseDir}/scripts/x-article-image.ts article.md --next
${BUN_X} {baseDir}/scripts/x-article-image.ts article.md --copy-cover
cd /path/to/article-dir && ./xa-next
cd /path/to/article-dir && ./xa-cover
```

Behavior:
- Copies the cover image to the clipboard with `--copy-cover`
- Copies the next pending article image to the clipboard
- Advances the pointer automatically
- Supports `--peek`, `--prev`, `--status`, `--reset`, `--index <n>`, and `--open-folder`

Parameters:
- `<markdown>`: Markdown file
- `--cover <path>`: override cover image with a local file
- `--title <text>`: override title

Frontmatter supported:
- `title`
- `cover_image`
- `cover`
- `image`

## Local Media Requirement

- Regular posts and video posts still expect explicit local files.
- X Articles may contain remote image URLs; the script will download them into a local `.buhuaguo-post-x-assets/` cache next to the Markdown file before generating placeholders.
- Missing local files should still fail fast.

## Notes

- The clipboard draft is the primary output
- The user is responsible for opening X, pasting the draft, and inserting the actual media files
- Deprecated flags like `--submit` and `--profile` may still appear in old habits; scripts should ignore them with a warning instead of automating anything

## References

- See `references/regular-posts.md` for the manual posting workflow
- See `references/articles.md` for the Markdown article workflow
