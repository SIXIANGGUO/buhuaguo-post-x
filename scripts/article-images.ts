import fs from 'node:fs';
import path from 'node:path';

export interface ArticleImageItem {
  index: number;
  placeholder: string;
  absolutePath: string;
  filename: string;
}

export interface ArticleCoverItem {
  placeholder: string;
  absolutePath: string;
  filename: string;
}

export interface ArticleImageManifest {
  markdownPath: string;
  title: string;
  generatedAt: string;
  cover: ArticleCoverItem | null;
  images: ArticleImageItem[];
}

interface ArticleImageState {
  nextIndex: number;
}

const ARTICLE_HELPER_NAMES = [
  'xa-next',
  'xa-cover',
  'xa-peek',
  'xa-prev',
  'xa-status',
  'xa-open',
  '.x-article-next',
  '.x-article-cover',
  '.x-article-peek',
  '.x-article-prev',
  '.x-article-status',
  '.x-article-open',
] as const;

function getAssetDir(markdownPath: string): string {
  return path.join(path.dirname(path.resolve(markdownPath)), '.buhuaguo-post-x-assets');
}

function getBaseName(markdownPath: string): string {
  return path.basename(markdownPath, path.extname(markdownPath));
}

export function getManifestPath(markdownPath: string): string {
  return path.join(getAssetDir(markdownPath), `${getBaseName(markdownPath)}.article-images.json`);
}

export function getStatePath(markdownPath: string): string {
  return path.join(getAssetDir(markdownPath), `${getBaseName(markdownPath)}.article-images.state.json`);
}

export function getArticleHelperPaths(markdownPath: string): string[] {
  const articleDir = path.dirname(path.resolve(markdownPath));
  return ARTICLE_HELPER_NAMES.map((name) => path.join(articleDir, name));
}

export function writeArticleImageManifest(markdownPath: string, manifest: ArticleImageManifest): void {
  const manifestPath = getManifestPath(markdownPath);
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
}

export function writeArticleImageState(markdownPath: string, nextIndex: number): void {
  const statePath = getStatePath(markdownPath);
  const payload: ArticleImageState = { nextIndex };
  fs.writeFileSync(statePath, JSON.stringify(payload, null, 2));
}

export function readArticleImageManifest(markdownPath: string): ArticleImageManifest {
  const manifestPath = getManifestPath(markdownPath);
  if (!fs.existsSync(manifestPath)) {
    throw new Error(`Image manifest not found. Run x-article.ts first: ${manifestPath}`);
  }
  return JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as ArticleImageManifest;
}

export function readArticleImageState(markdownPath: string): ArticleImageState {
  const statePath = getStatePath(markdownPath);
  if (!fs.existsSync(statePath)) {
    return { nextIndex: 0 };
  }
  return JSON.parse(fs.readFileSync(statePath, 'utf8')) as ArticleImageState;
}

export function removeArticleHelperScripts(markdownPath: string): string[] {
  const removed: string[] = [];
  for (const helperPath of getArticleHelperPaths(markdownPath)) {
    if (!fs.existsSync(helperPath)) {
      continue;
    }
    fs.rmSync(helperPath, { force: true });
    removed.push(helperPath);
  }
  return removed;
}
