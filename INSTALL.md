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
git clone https://github.com/SIXIANGGUO/buhuaguo-post-x ~/.claude/skills/buhuaguo-post-x
```

If you already have a local copy and want to install from the current directory instead:

```bash
mkdir -p ~/.claude/skills/buhuaguo-post-x
rsync -a --exclude '.git' ./ ~/.claude/skills/buhuaguo-post-x/
```

### Verify

Regular post:

```bash
bun ~/.claude/skills/buhuaguo-post-x/scripts/x-browser.ts "Hello world" --image ./photo.png
```

Expected result:
- The post text is copied to your clipboard
- The terminal shows a preview with `[Image: photo.png]`
- The terminal prints the local image path

Article:

```bash
bun ~/.claude/skills/buhuaguo-post-x/scripts/x-article.ts ./article.md
```

Expected result:
- The article body is copied to your clipboard as rich text
- Remote images are downloaded into `.buhuaguo-post-x-assets/`
- Markdown tables become local PNG files
- Helper commands such as `./xa-next` and `./xa-cover` are generated next to the article

Then move into the article directory and run:

```bash
cd "$(dirname ./article.md)"
./xa-cover
./xa-next
```

Expected result:
- `./xa-cover` copies the cover image to your clipboard
- `./xa-next` copies the next body image or rendered table image
- Run `./xa-next` again for each remaining placeholder

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
git clone https://github.com/SIXIANGGUO/buhuaguo-post-x ~/.claude/skills/buhuaguo-post-x
```

如果你已经有本地仓库，也可以在当前目录直接安装：

```bash
mkdir -p ~/.claude/skills/buhuaguo-post-x
rsync -a --exclude '.git' ./ ~/.claude/skills/buhuaguo-post-x/
```

### 验证安装

普通帖子：

```bash
bun ~/.claude/skills/buhuaguo-post-x/scripts/x-browser.ts "你好，X" --image ./photo.png
```

预期结果：
- 正文会进入剪贴板
- 终端会显示带有 `[Image: photo.png]` 的预览
- 终端会打印图片本地路径

文章：

```bash
bun ~/.claude/skills/buhuaguo-post-x/scripts/x-article.ts ./article.md
```

预期结果：
- 文章正文会以富文本进入剪贴板
- 远程图片会下载到 `.buhuaguo-post-x-assets/`
- Markdown 表格会转成本地 PNG
- 文章同目录会生成 `./xa-next`、`./xa-cover` 等辅助命令

然后进入文章所在目录，执行：

```bash
cd "$(dirname ./article.md)"
./xa-cover
./xa-next
```

预期结果：
- `./xa-cover` 会把封面图放进剪贴板
- `./xa-next` 会把下一张正文图片或表格图片放进剪贴板
- 每遇到一个占位，就再执行一次 `./xa-next`

### 说明

- X Article 里的表格会先被渲染成本地 PNG，再按图片插入。
- 远程图片会下载到 `.buhuaguo-post-x-assets/` 目录。
- 这个 skill 只负责准备内容，真正的粘贴和发布仍然是手动完成。
