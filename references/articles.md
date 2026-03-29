# X Articles - Manual Workflow

This skill now prepares article drafts for manual paste. It does not open the X Articles editor or automate image insertion.

Important: X Articles do not reliably preserve pasted HTML `<table>` markup. Markdown tables are therefore rendered into local PNG images and inserted through the same image queue as the rest of the article images.

## What Gets Copied

`x-article.ts` copies the article body to the clipboard.

Inline images and rendered table images are replaced with filename placeholders such as:

```text
[Image: architecture.png]
```

The script also prints:

- Resolved article title
- Resolved cover image path
- Every local content-image path with its placeholder
- Every rendered table image path with its placeholder

It also writes an ordered image manifest and generates short helper commands next to the article, so you usually do not need to retype the long script path.

## Usage

```bash
${BUN_X} {baseDir}/scripts/x-article.ts article.md
${BUN_X} {baseDir}/scripts/x-article.ts article.md --cover ./cover.jpg
```

## Requirements

- X Premium is still required if the user plans to publish an Article on X.
- Local image paths are used directly.
- Remote image URLs are downloaded into a local `.buhuaguo-post-x-assets/` cache next to the Markdown file before placeholders are generated.

## Manual Publishing Steps

1. Run `x-article.ts` on the Markdown file.
2. Open the X Articles editor manually.
3. Fill the article title using the title printed in the terminal.
4. In the article directory, run `./xa-cover` to copy the cover image.
5. Paste the copied article body.
6. In the article directory, run `./xa-next` to copy the next pending image.
7. Paste the image into the corresponding placeholder position in X.
8. Repeat until all placeholders are replaced.
9. Review and publish manually.

Helpful image-helper commands:

- `./xa-cover`: copy the cover image
- `./xa-next`: copy the next pending image
- `./xa-peek`: preview which image is next
- `./xa-prev`: recopy the previous image
- `./xa-status`: show progress
- `./xa-open`: reveal the current image in Finder/File Explorer
- `--copy-cover`: copy the cover image
- `--peek`: preview which image is next
- `--prev`: recopy the previous image
- `--status`: show progress
- `--reset`: start the queue over
- `--open-folder`: reveal the current image in Finder/File Explorer

## Markdown Parsing Notes

`md-to-html.ts` still handles:

- Frontmatter title detection
- Frontmatter cover detection
- Markdown to HTML conversion
- Placeholder generation for inline images
- Remote image caching for article media
