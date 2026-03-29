# Installation Guide / 安装说明

## English

### Requirements

- macOS, Linux, or Windows with a working system clipboard
- `bun` or `npx`
- `playwright` available in your shell

Recommended:

```bash
npm install -g playwright
```

### Install Into Claude

```bash
mkdir -p ~/.claude/skills
cp -R ./buhuaguo-post-x ~/.claude/skills/buhuaguo-post-x
```

### Verify

Regular post:

```bash
bun ~/.claude/skills/buhuaguo-post-x/scripts/x-browser.ts "Hello world" --image ./photo.png
```

Article:

```bash
bun ~/.claude/skills/buhuaguo-post-x/scripts/x-article.ts ./article.md
cd "$(dirname ./article.md)"
./xa-next
```

### Notes

- X Article tables are rendered into local PNG files before insertion.
- Remote article images are downloaded into `.buhuaguo-post-x-assets/`.
- The skill prepares content only; you still paste and publish manually in X.

## 中文

### 环境要求

- macOS、Linux 或 Windows，并且系统剪贴板可用
- `bun` 或 `npx`
- 终端里可以直接使用 `playwright`

推荐先安装：

```bash
npm install -g playwright
```

### 安装到 Claude

```bash
mkdir -p ~/.claude/skills
cp -R ./buhuaguo-post-x ~/.claude/skills/buhuaguo-post-x
```

### 验证安装

普通帖子：

```bash
bun ~/.claude/skills/buhuaguo-post-x/scripts/x-browser.ts "你好，X" --image ./photo.png
```

文章：

```bash
bun ~/.claude/skills/buhuaguo-post-x/scripts/x-article.ts ./article.md
cd "$(dirname ./article.md)"
./xa-next
```

### 说明

- X Article 里的表格会先被渲染成本地 PNG，再按图片插入。
- 远程图片会下载到 `.buhuaguo-post-x-assets/` 目录。
- 这个 skill 只负责准备内容，真正的粘贴和发布仍然是手动完成。
