import { Buffer } from 'node:buffer'
import process from 'node:process'
import { pathToFileURL } from 'node:url'
import axios from 'axios'
import * as cheerio from 'cheerio'
import { execa } from 'execa'
import fs from 'fs-extra'
import path from 'pathe'

export interface GithubIssueComment {
  id: number
  html_url: string
  created_at: string
  body: string
  user?: {
    login?: string
  }
}

export interface ShowcaseAsset {
  kind: 'cover' | 'screenshot' | 'qrcode'
  originalUrl: string
  relativePath: string
}

export interface ShowcaseEntry {
  id: number
  slug: string
  title: string
  description: string
  sourceCommentUrl: string
  createdAt: string
  author: string
  link?: string
  github?: string
  assets: ShowcaseAsset[]
}

interface ExtractedAssetCandidate {
  kind: 'screenshot' | 'qrcode'
  url: string
}

interface DownloadedAssetCandidate extends ExtractedAssetCandidate {
  filePath: string
  originalUrl: string
  relativePath: string
  width: number | null
  height: number | null
}

interface ParsedCommentEntry {
  id: number
  slug: string
  title: string
  description: string
  sourceCommentUrl: string
  createdAt: string
  author: string
  link?: string
  github?: string
  images: ExtractedAssetCandidate[]
}

interface SyncOptions {
  owner: string
  repo: string
  issueNumber: number
  outputDir: string
  markdownPath: string
  dataPath: string
  dryRun: boolean
}

const IMAGE_ROLE_OVERRIDES: Record<number, Record<string, ExtractedAssetCandidate['kind']>> = {
  4109843504: {
    'https://github.com/user-attachments/assets/dbb57d5c-41d7-4d37-ac4a-55e4e4113110': 'qrcode',
  },
}

const DEFAULT_OPTIONS: SyncOptions = {
  owner: 'weapp-vite',
  repo: 'weapp-vite',
  issueNumber: 43,
  outputDir: path.resolve(import.meta.dirname, '../website/public/cases'),
  markdownPath: path.resolve(import.meta.dirname, '../website/community/showcase.md'),
  dataPath: path.resolve(import.meta.dirname, '../website/community/showcase.data.json'),
  dryRun: false,
}

const GITHUB_ACCEPT_HEADER = 'application/vnd.github+json'
const MARKDOWN_LINK_RE = /\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g
const MARKDOWN_LINK_NOT_IMAGE_RE = /(?<!!)\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g
const MARKDOWN_IMAGE_RE = /!\[[^\]]*\]\((https?:\/\/[^)\s]+)\)/g
const HTML_IMAGE_RE = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi
const WINDOWS_NEWLINE_RE = /\r\n/g
const MULTI_SPACE_RE = /[ \t]+/g
const MULTI_NEWLINE_RE = /\n{2,}/g
const SPACE_BEFORE_CJK_PUNCT_RE = /\s+([，。！？；：])/g
const QUOTE_PREFIX_RE = /^\s*>/gm
const INTRO_LINE_RE = /^介绍\s*[:：]/
const INTRO_LINE_PREFIX_RE = /^介绍\s*[:：]\s*/
const GITHUB_LINE_RE = /^github\s*[:：]\s*(https?:\/\/\S+)/i
const LINK_LINE_RE = /^链接\s*[:：]\s*(https?:\/\/\S+)/i
const GITHUB_DOMAIN_RE = /github\.com/i
const QUOTED_TITLE_RE = /《([^》]+)》/
const INTRO_LINKED_TITLE_RE = /介绍\s*[:：]\s*\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/
const LEADING_DESCRIPTOR_RE = /^(一款|一个|一套|免费的?|开源的?)/
const TRAILING_SENTENCE_RE = /[，。！？].*$/
const QRCODE_URL_RE = /qrcode|qr|weappcode|二维码/i
const SCREENSHOT_HEADING_RE = /(?:^|\n)(?:#+\s*截图\b|截图\s*$)/m
const NON_META_LINE_RE = /^(?:个人|公司|组织|链接|github)\s*[:：]/i
const SHOWCASE_ADDED_RE = /已添加到\s+https?:\/\//
const ASCII_NON_WORD_RE = /[^a-z0-9]+/g
const TRIM_DASH_RE = /^-+|-+$/g
const ESCAPE_REGEXP_RE = /[.*+?^${}()|[\]\\]/g

/**
 * @description 解析命令行参数。
 */
export function parseCliArgs(argv: string[]): SyncOptions {
  const options = { ...DEFAULT_OPTIONS }

  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index]
    const next = argv[index + 1]

    if (current === '--dry-run') {
      options.dryRun = true
      continue
    }

    if (current === '--owner' && next) {
      options.owner = next
      index += 1
      continue
    }

    if (current === '--repo' && next) {
      options.repo = next
      index += 1
      continue
    }

    if (current === '--issue' && next) {
      options.issueNumber = Number(next)
      index += 1
      continue
    }
  }

  return options
}

/**
 * @description 将 Markdown 链接替换为其文本内容。
 */
export function stripMarkdownLinks(input: string): string {
  return input.replace(MARKDOWN_LINK_RE, '$1')
}

/**
 * @description 清理 Markdown 与 HTML 片段，只保留文本信息。
 */
export function cleanInlineText(input: string): string {
  const withoutMarkdownLinks = stripMarkdownLinks(input)
  const withoutImages = withoutMarkdownLinks
    .replace(MARKDOWN_IMAGE_RE, '')
    .replace(HTML_IMAGE_RE, '')
  const htmlText = cheerio.load(`<div>${withoutImages}</div>`).text()

  return htmlText
    .replace(WINDOWS_NEWLINE_RE, '\n')
    .replace(MULTI_SPACE_RE, ' ')
    .replace(MULTI_NEWLINE_RE, '\n')
    .replace(SPACE_BEFORE_CJK_PUNCT_RE, '$1')
    .trim()
}

/**
 * @description 去重并提取评论中的图片 URL。
 */
export function extractImageUrls(body: string): string[] {
  const urls = new Set<string>()

  for (const match of body.matchAll(HTML_IMAGE_RE)) {
    const src = match[1]?.trim()
    if (src) {
      urls.add(src)
    }
  }

  for (const match of body.matchAll(MARKDOWN_IMAGE_RE)) {
    const src = match[1]?.trim()
    if (src) {
      urls.add(src)
    }
  }

  return Array.from(urls)
}

/**
 * @description 从文本中提取候选链接。
 */
export function extractLinks(body: string): { github?: string, link?: string } {
  const lines = normalizeBody(body).split('\n')
  let github: string | undefined
  let link: string | undefined

  for (const line of lines) {
    const trimmed = line.trim()
    const githubMatch = trimmed.match(GITHUB_LINE_RE)
    if (githubMatch?.[1]) {
      github = githubMatch[1]
      continue
    }

    const linkMatch = trimmed.match(LINK_LINE_RE)
    if (linkMatch?.[1]) {
      link = linkMatch[1]
    }
  }

  const markdownLinkMatches = Array.from(body.matchAll(MARKDOWN_LINK_NOT_IMAGE_RE))
  if (!github) {
    github = markdownLinkMatches.find(([, , url]) => GITHUB_DOMAIN_RE.test(url))?.[2]
  }
  if (!link) {
    link = markdownLinkMatches.find(([, , url]) => !GITHUB_DOMAIN_RE.test(url))?.[2] ?? github
  }

  return { github, link }
}

/**
 * @description 归一化评论正文，便于逐行解析。
 */
export function normalizeBody(body: string): string {
  return body
    .replace(WINDOWS_NEWLINE_RE, '\n')
    .replace(QUOTE_PREFIX_RE, '')
    .trim()
}

function extractDescriptionLine(lines: string[]): string | undefined {
  for (const line of lines) {
    const trimmed = line.trim()
    if (INTRO_LINE_RE.test(trimmed)) {
      return cleanInlineText(trimmed.replace(INTRO_LINE_PREFIX_RE, ''))
    }
  }

  return undefined
}

function extractTitleFromBody(body: string, description?: string): string | undefined {
  const quotedTitle = body.match(QUOTED_TITLE_RE)
  if (quotedTitle?.[1]) {
    return quotedTitle[1].trim()
  }

  const introLinkedTitle = body.match(INTRO_LINKED_TITLE_RE)
  if (introLinkedTitle?.[1]) {
    return introLinkedTitle[1].trim()
  }

  if (description) {
    const concise = description
      .replace(LEADING_DESCRIPTOR_RE, '')
      .replace(TRAILING_SENTENCE_RE, '')
      .trim()
    if (concise) {
      return concise
    }
  }

  return undefined
}

function isQrcodeUrl(url: string): boolean {
  return QRCODE_URL_RE.test(url)
}

function classifyImages(body: string, urls: string[]): ExtractedAssetCandidate[] {
  const images = urls.map(url => ({
    url,
    kind: isQrcodeUrl(url) ? 'qrcode' as const : 'screenshot' as const,
  }))

  const hasScreenshotHeading = SCREENSHOT_HEADING_RE.test(body)
  if (!hasScreenshotHeading) {
    return promoteCoverImage(images)
  }

  const screenshotSection = body.split(SCREENSHOT_HEADING_RE)[1] ?? ''
  const screenshotUrls = new Set(extractImageUrls(screenshotSection))

  return promoteCoverImage(images.map((image) => {
    if (screenshotUrls.has(image.url)) {
      return { ...image, kind: 'screenshot' as const }
    }
    return image
  }))
}

function applyImageRoleOverrides(commentId: number, images: ExtractedAssetCandidate[]): ExtractedAssetCandidate[] {
  const overrides = IMAGE_ROLE_OVERRIDES[commentId]
  if (!overrides) {
    return images
  }

  return images.map(image => ({
    ...image,
    kind: overrides[image.url] ?? image.kind,
  }))
}

function promoteCoverImage(images: ExtractedAssetCandidate[]): ExtractedAssetCandidate[] {
  const firstScreenshotIndex = images.findIndex(item => item.kind === 'screenshot')
  if (firstScreenshotIndex <= 0) {
    return images
  }

  const cloned = [...images]
  const [firstScreenshot] = cloned.splice(firstScreenshotIndex, 1)
  cloned.unshift(firstScreenshot)
  return cloned
}

function shouldIncludeComment(comment: GithubIssueComment): boolean {
  const body = normalizeBody(comment.body)
  const imageUrls = extractImageUrls(body)

  if (imageUrls.length === 0) {
    return false
  }

  if (SHOWCASE_ADDED_RE.test(body)) {
    return false
  }

  return true
}

function fallbackSlug(title: string, github?: string, author?: string, commentId?: number): string {
  if (github) {
    const repoName = github.split('/').filter(Boolean).at(-1)
    if (repoName) {
      return repoName.toLowerCase()
    }
  }

  const asciiTitle = title
    .toLowerCase()
    .replace(ASCII_NON_WORD_RE, '-')
    .replace(TRIM_DASH_RE, '')

  if (asciiTitle) {
    return asciiTitle
  }

  if (author) {
    return author.toLowerCase()
  }

  return `issue-comment-${commentId ?? Date.now()}`
}

/**
 * @description 将 issue 评论解析为展示条目。
 */
export function parseShowcaseComment(comment: GithubIssueComment): ParsedCommentEntry | null {
  if (!shouldIncludeComment(comment)) {
    return null
  }

  const body = normalizeBody(comment.body)
  const lines = body
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)

  const { github, link } = extractLinks(body)
  const rawDescription = extractDescriptionLine(lines)
    ?? cleanInlineText(lines.find(line => !NON_META_LINE_RE.test(line)) ?? '')
  const title = extractTitleFromBody(body, rawDescription) ?? fallbackSlug('', github, comment.user?.login, comment.id)
  const description = rawDescription
    .replace(new RegExp(`^《${escapeRegExp(title)}》\\s*[:：]\\s*`), '')
    .trim()
  const images = applyImageRoleOverrides(comment.id, classifyImages(body, extractImageUrls(body)))

  if (!description || images.length === 0) {
    return null
  }

  return {
    id: comment.id,
    slug: fallbackSlug(title, github, comment.user?.login, comment.id),
    title,
    description,
    sourceCommentUrl: comment.html_url,
    createdAt: comment.created_at,
    author: comment.user?.login ?? 'unknown',
    link,
    github,
    images,
  }
}

function escapeRegExp(input: string): string {
  return input.replace(ESCAPE_REGEXP_RE, '\\$&')
}

function resolveFileExtension(url: string, contentType?: string): string {
  const normalizedType = contentType?.split(';')[0]?.trim().toLowerCase()
  if (normalizedType === 'image/png') {
    return '.png'
  }
  if (normalizedType === 'image/webp') {
    return '.webp'
  }
  if (normalizedType === 'image/gif') {
    return '.gif'
  }
  if (normalizedType === 'image/svg+xml') {
    return '.svg'
  }
  if (normalizedType === 'image/jpeg' || normalizedType === 'image/jpg') {
    return '.jpeg'
  }

  const pathname = new URL(url).pathname
  const rawExt = path.extname(pathname).toLowerCase()
  if (rawExt) {
    return rawExt
  }

  return '.png'
}

function readPngDimensions(buffer: Buffer): { width: number, height: number } | null {
  if (buffer.length < 24 || buffer.toString('hex', 0, 8) !== '89504e470d0a1a0a') {
    return null
  }

  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
  }
}

function readJpegDimensions(buffer: Buffer): { width: number, height: number } | null {
  if (buffer.length < 4 || buffer[0] !== 0xFF || buffer[1] !== 0xD8) {
    return null
  }

  let offset = 2
  while (offset + 9 < buffer.length) {
    if (buffer[offset] !== 0xFF) {
      offset += 1
      continue
    }

    const marker = buffer[offset + 1]
    if (!marker || marker === 0xD9 || marker === 0xDA) {
      break
    }

    const segmentLength = buffer.readUInt16BE(offset + 2)
    const isSofMarker = marker >= 0xC0
      && marker <= 0xCF
      && marker !== 0xC4
      && marker !== 0xC8
      && marker !== 0xCC

    if (isSofMarker) {
      return {
        height: buffer.readUInt16BE(offset + 5),
        width: buffer.readUInt16BE(offset + 7),
      }
    }

    offset += 2 + segmentLength
  }

  return null
}

export function getImageDimensions(buffer: Buffer): { width: number, height: number } | null {
  return readPngDimensions(buffer) ?? readJpegDimensions(buffer)
}

export async function detectCodeFromFile(filePath: string): Promise<boolean> {
  try {
    const result = await execa('python3', [
      path.resolve(import.meta.dirname, './scan-wechat-qrcode.py'),
      filePath,
      '--json',
    ], {
      reject: false,
    })
    if (result.exitCode !== 0 || !result.stdout.trim()) {
      return false
    }
    const payload = JSON.parse(result.stdout) as { detected?: boolean }
    return Boolean(payload.detected)
  }
  catch {
    return false
  }
}

/**
 * @description 下载图片并返回相对路径。
 */
export async function downloadImage(url: string, destinationWithoutExt: string, dryRun = false): Promise<{ filePath: string, dimensions: { width: number, height: number } | null }> {
  if (dryRun) {
    return {
      filePath: `${destinationWithoutExt}.png`,
      dimensions: null,
    }
  }

  const response = await axios.get<ArrayBuffer>(url, {
    responseType: 'arraybuffer',
    headers: {
      'Accept': 'image/*,*/*;q=0.8',
      'User-Agent': 'weapp-vite-showcase-sync',
    },
    maxRedirects: 5,
  })
  const ext = resolveFileExtension(url, response.headers['content-type'])
  const filePath = `${destinationWithoutExt}${ext}`
  const buffer = Buffer.from(response.data)
  await fs.outputFile(filePath, buffer)
  return {
    filePath,
    dimensions: getImageDimensions(buffer),
  }
}

async function fetchGithubJson<T>(url: string): Promise<T> {
  const headers: Record<string, string> = {
    'Accept': GITHUB_ACCEPT_HEADER,
    'User-Agent': 'weapp-vite-showcase-sync',
  }

  if (process.env.GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`
  }

  const { data } = await axios.get<T>(url, {
    headers,
  })
  return data
}

/**
 * @description 拉取指定 issue 的全部评论。
 */
export async function fetchIssueComments(owner: string, repo: string, issueNumber: number): Promise<GithubIssueComment[]> {
  const url = `https://api.github.com/repos/${owner}/${repo}/issues/${issueNumber}/comments?per_page=100`
  return fetchGithubJson<GithubIssueComment[]>(url)
}

/**
 * @description 探测 gh 是否可用，仅作提示，不依赖其执行。
 */
export async function detectGhCli(): Promise<boolean> {
  try {
    await execa('gh', ['--version'])
    return true
  }
  catch {
    return false
  }
}

function buildMarkdown(entries: ShowcaseEntry[]): string {
  const showcaseCount = entries.length
  const sections = entries
    .map(entry => `## ${entry.title}

<CommunityShowcase entry-slug="${entry.slug}" />
`)
    .join('\n')

  return `---
title: 优秀案例展示
description: 优秀案例展示，聚焦 community / showcase 相关场景，覆盖 Weapp-vite 与 Wevu 的能力、配置和实践要点。
aside: true
keywords:
  - 微信小程序
  - community
  - showcase
  - 优秀案例展示
  - 聚焦
  - /
  - 相关场景
  - 覆盖
---

# 优秀案例展示

> 当前共收录 ${showcaseCount} 个案例。案例数据与素材由 \`scripts/sync-community-showcase.ts\` 根据 GitHub issue 自动同步，展示交互由 \`CommunityShowcase.vue\` 统一渲染。

<CommunityShowcase />

${sections}`
}

function isSquareLike(width: number | null, height: number | null): boolean {
  if (!width || !height) {
    return false
  }

  const ratio = width / height
  return ratio >= 0.88 && ratio <= 1.12
}

function isPortraitLike(width: number | null, height: number | null): boolean {
  if (!width || !height) {
    return false
  }

  return width / height <= 0.82
}

export function refineImageRoles(images: DownloadedAssetCandidate[]): DownloadedAssetCandidate[] {
  if (images.some(image => image.kind === 'qrcode')) {
    return images
  }

  const squareCandidates = images.filter(image => isSquareLike(image.width, image.height))
  const portraitCandidates = images.filter(image => isPortraitLike(image.width, image.height))

  if (squareCandidates.length === 1 && portraitCandidates.length >= 1) {
    return images.map((image) => {
      if (image.relativePath === squareCandidates[0].relativePath) {
        return {
          ...image,
          kind: 'qrcode',
        }
      }
      return image
    })
  }

  return images
}

async function refineImageRolesWithScanner(images: DownloadedAssetCandidate[], dryRun: boolean): Promise<DownloadedAssetCandidate[]> {
  if (dryRun) {
    return refineImageRoles(images)
  }

  for (const image of images) {
    if (await detectCodeFromFile(image.filePath)) {
      return images.map((candidate) => {
        if (candidate.filePath === image.filePath) {
          return {
            ...candidate,
            kind: 'qrcode',
          }
        }
        return candidate
      })
    }
  }

  return refineImageRoles(images)
}

/**
 * @description 根据解析后的评论下载资源并生成最终条目。
 */
export async function materializeShowcaseEntries(parsedEntries: ParsedCommentEntry[], outputDir: string, dryRun = false): Promise<ShowcaseEntry[]> {
  const entries: ShowcaseEntry[] = []

  for (const parsedEntry of parsedEntries) {
    const entryDir = path.join(outputDir, parsedEntry.slug)
    if (!dryRun) {
      await fs.emptyDir(entryDir)
    }

    const downloadedAssets: DownloadedAssetCandidate[] = []
    let screenshotCount = 0
    let qrcodeCount = 0

    for (const image of parsedEntry.images) {
      let baseName = 'asset'
      if (image.kind === 'qrcode') {
        qrcodeCount += 1
        baseName = `qrcode-${qrcodeCount}`
      }
      else {
        screenshotCount += 1
        baseName = screenshotCount === 1 ? 'cover' : `screenshot-${screenshotCount - 1}`
      }
      const fileWithoutExt = path.join(entryDir, baseName)
      const downloadResult = await downloadImage(image.url, fileWithoutExt, dryRun)
      const relativePath = path.relative(path.resolve(outputDir, '..'), downloadResult.filePath)

      downloadedAssets.push({
        kind: image.kind === 'screenshot' && screenshotCount === 1 ? 'cover' : image.kind,
        url: image.url,
        filePath: downloadResult.filePath,
        originalUrl: image.url,
        relativePath,
        width: downloadResult.dimensions?.width ?? null,
        height: downloadResult.dimensions?.height ?? null,
      })
    }

    const assets: ShowcaseAsset[] = (await refineImageRolesWithScanner(downloadedAssets, dryRun)).map(asset => ({
      kind: asset.kind === 'cover' ? 'cover' : asset.kind,
      originalUrl: asset.originalUrl,
      relativePath: asset.relativePath,
    }))

    entries.push({
      id: parsedEntry.id,
      slug: parsedEntry.slug,
      title: parsedEntry.title,
      description: parsedEntry.description,
      sourceCommentUrl: parsedEntry.sourceCommentUrl,
      createdAt: parsedEntry.createdAt,
      author: parsedEntry.author,
      link: parsedEntry.link,
      github: parsedEntry.github,
      assets,
    })
  }

  return entries
}

/**
 * @description 同步优秀案例页面与素材。
 */
export async function syncCommunityShowcase(options: SyncOptions): Promise<ShowcaseEntry[]> {
  const comments = await fetchIssueComments(options.owner, options.repo, options.issueNumber)
  const parsedEntries = comments
    .map(parseShowcaseComment)
    .filter((entry): entry is ParsedCommentEntry => Boolean(entry))
    .sort((left, right) => new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime())
  const entries = await materializeShowcaseEntries(parsedEntries, options.outputDir, options.dryRun)
  const markdown = buildMarkdown(entries)

  if (!options.dryRun) {
    await fs.outputJson(options.dataPath, entries, { spaces: 2 })
    await fs.outputFile(options.markdownPath, markdown)
  }

  return entries
}

async function main() {
  const options = parseCliArgs(process.argv.slice(2))
  const hasGhCli = await detectGhCli()

  if (!hasGhCli) {
    console.warn('[sync-community-showcase] gh CLI 未安装，已回退到 GitHub REST API 模式。')
  }

  const entries = await syncCommunityShowcase(options)
  console.log(`[sync-community-showcase] synced ${entries.length} showcase entries from issue #${options.issueNumber}`)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error('[sync-community-showcase] failed:', error)
    process.exitCode = 1
  })
}
