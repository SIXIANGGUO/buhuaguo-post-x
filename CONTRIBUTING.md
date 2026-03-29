# Contributing

Thanks for your interest in improving `buhuaguo-post-x`.

## Scope

This repository is intentionally minimal. Please keep it focused on the `buhuaguo-post-x` skill itself:

- `SKILL.md`
- `references/`
- `scripts/`
- small repo-level docs and assets

Do not add unrelated skills, generic tool bundles, or large dependency trees unless they are directly required by this skill.

## Good Contributions

- Better article formatting for X Article paste
- Safer clipboard behavior across platforms
- Better image insertion helpers
- Clearer documentation in English or Chinese
- Better handling for local/remote media in article workflows

## Before Opening a PR

1. Keep changes focused and easy to review.
2. Update docs when behavior changes.
3. If you change user-facing workflow, mention it in `CHANGELOG.md` and `CHANGELOG.zh.md`.
4. Prefer small assets and simple runtime assumptions.

## Local Checks

Typical manual checks:

```bash
bun scripts/x-browser.ts "hello" --image ./photo.png
bun scripts/x-article.ts ./article.md
```

If you test article workflows:

- verify helper scripts such as `./xa-next` are generated
- verify remote images download correctly
- verify Markdown tables become PNG files in `.buhuaguo-post-x-assets/`

## Documentation Style

- Keep English concise and plain.
- Keep Chinese natural and practical.
- Prefer examples that match the real workflow.

## Release Notes

When shipping user-visible changes, update:

- `CHANGELOG.md`
- `CHANGELOG.zh.md`

## Questions

If you are unsure whether something belongs in this repo, prefer the smaller change.
