import { Buffer } from 'node:buffer'
import { createHash } from 'node:crypto'
import fs from 'node:fs/promises'
import nodePath from 'node:path'
import process from 'node:process'
import { pathToFileURL } from 'node:url'
import * as cheerio from 'cheerio'
import path from 'pathe'
import { renderMarkdown } from './markdown'
import {
  DEFAULT_ENTRY_URL,
  DEFAULT_MIRROR_REPO_URL,
  DEFAULT_OUTPUT_DIR,
  normalizeFrameworkPageUrl,
  toAbsoluteSourceUrl,
  toMirrorRelativePath,
  toRelativeAssetPath,
  toRelativeMarkdownHref,
} from './pathing'

export interface MirrorCliOptions {
  entryUrl: string
  outputDir: string
  maxPages: number
  downloadAssets: boolean
}

interface PageRecord {
  title: string
  sourceUrl: string
  relativePath: string
  internalLinks: string[]
  markdown: string
  assetRelativePaths: string[]
}

interface MirrorManifest {
  fetchedAt: string
  entryUrl: string
  outputDir: string
  pageCount: number
  assetCount: number
  skippedUrls: string[]
  pages: Array<{
    title: string
    sourceUrl: string
    relativePath: string
    internalLinks: string[]
    assetRelativePaths: string[]
  }>
}

const FETCH_TIMEOUT_MS = 30_000
const ASSET_SAFE_NAME_RE = /[^\w-]+/g
const TRIM_DASH_RE = /^-+|-+$/g
const LEADING_HEADING_MARK_RE = /^#\s*/

function isCurrentModuleEntry(entryArg: string | undefined, moduleUrl: string) {
  if (!entryArg) {
    return false
  }

  const resolvedEntryPath = nodePath.isAbsolute(entryArg)
    ? entryArg
    : nodePath.resolve(entryArg)

  try {
    return moduleUrl === pathToFileURL(resolvedEntryPath).href
  }
  catch {
    return false
  }
}

function parseCliArgs(argv: string[]): MirrorCliOptions {
  const options: MirrorCliOptions = {
    entryUrl: DEFAULT_ENTRY_URL,
    outputDir: DEFAULT_OUTPUT_DIR,
    maxPages: Number.POSITIVE_INFINITY,
    downloadAssets: true,
  }

  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index]
    const next = argv[index + 1]

    if (current === '--entry' && next) {
      options.entryUrl = next
      index += 1
      continue
    }

    if (current === '--output' && next) {
      options.outputDir = path.resolve(next)
      index += 1
      continue
    }

    if (current === '--max-pages' && next) {
      options.maxPages = Number(next)
      index += 1
      continue
    }

    if (current === '--no-assets') {
      options.downloadAssets = false
    }
  }

  const normalizedEntryUrl = normalizeFrameworkPageUrl(
    options.entryUrl,
    options.entryUrl,
  )
  if (!normalizedEntryUrl) {
    throw new Error(`Unsupported entry URL: ${options.entryUrl}`)
  }

  options.entryUrl = normalizedEntryUrl

  return options
}

function collectCandidateLinks($: cheerio.CheerioAPI, pageUrl: string) {
  const links = new Set<string>()

  for (const selector of ['.sidebar a[href]', '.content a[href]']) {
    $(selector).each((_, element) => {
      const href = $(element).attr('href')
      const normalized = href ? normalizeFrameworkPageUrl(href, pageUrl) : null
      if (normalized) {
        links.add(normalized)
      }
    })
  }

  return Array.from(links).sort((left, right) => left.localeCompare(right))
}

function collectImageUrls($: cheerio.CheerioAPI, pageUrl: string) {
  const urls = new Set<string>()

  $('.content img[src]').each((_, element) => {
    const src = $(element).attr('src')
    if (!src) {
      return
    }
    urls.add(toAbsoluteSourceUrl(src, pageUrl))
  })

  return Array.from(urls).sort((left, right) => left.localeCompare(right))
}

async function fetchHtml(url: string) {
  const response = await fetch(url, {
    headers: {
      'user-agent': 'weapp-vite/wechat-docs-mirror',
      'accept': 'text/html,application/xhtml+xml',
    },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  })

  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status}`)
  }

  return response.text()
}

async function fetchAsset(url: string) {
  const response = await fetch(url, {
    headers: {
      'user-agent': 'weapp-vite/wechat-docs-mirror',
      'accept': 'image/*,*/*;q=0.8',
    },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  })

  if (!response.ok) {
    throw new Error(`Failed to fetch asset ${url}: ${response.status}`)
  }

  const arrayBuffer = await response.arrayBuffer()

  return {
    buffer: Buffer.from(arrayBuffer),
    contentType: response.headers.get('content-type') || '',
  }
}

function resolveAssetExtension(url: string, contentType?: string) {
  const pathname = new URL(url).pathname
  const fileExtension = path.extname(pathname)
  if (fileExtension) {
    return fileExtension
  }

  if (contentType?.includes('png')) {
    return '.png'
  }

  if (contentType?.includes('jpeg')) {
    return '.jpg'
  }

  if (contentType?.includes('webp')) {
    return '.webp'
  }

  if (contentType?.includes('svg')) {
    return '.svg'
  }

  return '.bin'
}

function createAssetRelativePath(url: string, contentType?: string) {
  const urlObject = new URL(url)
  const basename
    = path.basename(urlObject.pathname, path.extname(urlObject.pathname))
      || 'asset'
  const sanitizedBasename
    = basename.replace(ASSET_SAFE_NAME_RE, '-').replace(TRIM_DASH_RE, '')
      || 'asset'
  const hash = createHash('sha1').update(url).digest('hex').slice(0, 12)
  return path.join(
    '_assets',
    `${sanitizedBasename}-${hash}${resolveAssetExtension(url, contentType)}`,
  )
}

async function mirrorAssets(params: {
  imageUrls: string[]
  outputDir: string
}) {
  const { imageUrls, outputDir } = params
  const assetMap = new Map<string, string>()

  for (const imageUrl of imageUrls) {
    try {
      const asset = await fetchAsset(imageUrl)
      const contentType = asset.contentType
      const assetRelativePath = createAssetRelativePath(imageUrl, contentType)
      const assetAbsolutePath = path.join(outputDir, assetRelativePath)
      await fs.mkdir(path.dirname(assetAbsolutePath), { recursive: true })
      await fs.writeFile(assetAbsolutePath, asset.buffer)
      assetMap.set(imageUrl, assetRelativePath)
    }
    catch (error) {
      console.warn(`[wechat-docs-mirror] skipped asset ${imageUrl}`)
      console.warn(error)
    }
  }

  return assetMap
}

function buildPageMarkdown(params: {
  $: cheerio.CheerioAPI
  pageUrl: string
  assetPathMap: Map<string, string>
}) {
  const { $, pageUrl, assetPathMap } = params
  const root = $('.content').first()

  if (!root.length) {
    throw new Error(`Failed to locate content root for ${pageUrl}`)
  }

  root.find('.header-anchor, script, style, noscript').remove()

  return renderMarkdown(root.get(0), {
    $,
    rewriteHref(href) {
      return toRelativeMarkdownHref({
        currentPageUrl: pageUrl,
        targetHref: href,
      })
    },
    rewriteImageSrc(src) {
      const absoluteUrl = toAbsoluteSourceUrl(src, pageUrl)
      const assetRelativePath = assetPathMap.get(absoluteUrl)
      if (!assetRelativePath) {
        return absoluteUrl
      }
      return toRelativeAssetPath({
        currentPageUrl: pageUrl,
        assetRelativePath,
      })
    },
  })
}

async function extractPageRecord(params: {
  pageUrl: string
  outputDir: string
  downloadAssets: boolean
}) {
  const { pageUrl, outputDir, downloadAssets } = params
  const html = await fetchHtml(pageUrl)
  const $ = cheerio.load(html)
  const title
    = $('h1').first().text().replace(LEADING_HEADING_MARK_RE, '').trim()
      || $('title').text().trim()
  const internalLinks = collectCandidateLinks($, pageUrl)
  const imageUrls = collectImageUrls($, pageUrl)
  const assetPathMap = downloadAssets
    ? await mirrorAssets({ imageUrls, outputDir })
    : new Map<string, string>()
  const markdown = buildPageMarkdown({
    $,
    pageUrl,
    assetPathMap,
  })

  return {
    title,
    sourceUrl: pageUrl,
    relativePath: toMirrorRelativePath(pageUrl),
    internalLinks,
    markdown,
    assetRelativePaths: Array.from(assetPathMap.values()).sort((left, right) =>
      left.localeCompare(right),
    ),
  } satisfies PageRecord
}

async function writePageFiles(params: {
  outputDir: string
  pages: PageRecord[]
}) {
  const { outputDir, pages } = params

  for (const page of pages) {
    const absolutePath = path.join(outputDir, page.relativePath)
    const document = [
      `<!-- 来源: ${page.sourceUrl} -->`,
      '',
      page.markdown,
      '',
    ].join('\n')

    await fs.mkdir(path.dirname(absolutePath), { recursive: true })
    await fs.writeFile(absolutePath, document)
  }
}

function createCatalogMarkdown(params: {
  fetchedAt: string
  entryUrl: string
  pages: PageRecord[]
}) {
  const { fetchedAt, entryUrl, pages } = params
  const lines = [
    '# 微信小程序 framework 文档镜像',
    '',
    `- 入口: ${entryUrl}`,
    `- 抓取时间: ${fetchedAt}`,
    `- 页面数: ${pages.length}`,
    '',
    '## 页面目录',
    '',
  ]

  for (const page of pages) {
    lines.push(`- [${page.title}](${page.relativePath})`)
  }

  lines.push('')
  return lines.join('\n')
}

async function writeManifest(params: {
  outputDir: string
  entryUrl: string
  pages: PageRecord[]
  skippedUrls: string[]
}) {
  const { outputDir, entryUrl, pages, skippedUrls } = params
  const fetchedAt = new Date().toISOString()
  const manifest: MirrorManifest = {
    fetchedAt,
    entryUrl,
    outputDir: '.',
    pageCount: pages.length,
    assetCount: pages.reduce(
      (count, page) => count + page.assetRelativePaths.length,
      0,
    ),
    skippedUrls,
    pages: pages.map(page => ({
      title: page.title,
      sourceUrl: page.sourceUrl,
      relativePath: page.relativePath,
      internalLinks: page.internalLinks,
      assetRelativePaths: page.assetRelativePaths,
    })),
  }

  await fs.writeFile(
    path.join(outputDir, 'manifest.json'),
    `${JSON.stringify(manifest, null, 2)}\n`,
  )
  await fs.writeFile(
    path.join(outputDir, 'CATALOG.md'),
    createCatalogMarkdown({
      fetchedAt,
      entryUrl,
      pages,
    }),
  )
}

export async function mirrorWechatFrameworkDocs(options: MirrorCliOptions) {
  await fs.rm(options.outputDir, { recursive: true, force: true })
  await fs.mkdir(options.outputDir, { recursive: true })

  const queue = [options.entryUrl]
  const visited = new Set<string>()
  const skippedUrls = new Set<string>()
  const pages: PageRecord[] = []

  while (queue.length > 0 && visited.size < options.maxPages) {
    const currentPageUrl = queue.shift()

    if (!currentPageUrl || visited.has(currentPageUrl)) {
      continue
    }

    visited.add(currentPageUrl)
    console.log(`[wechat-docs-mirror] crawling ${currentPageUrl}`)
    try {
      const page = await extractPageRecord({
        pageUrl: currentPageUrl,
        outputDir: options.outputDir,
        downloadAssets: options.downloadAssets,
      })
      pages.push(page)

      for (const link of page.internalLinks) {
        if (!visited.has(link)) {
          queue.push(link)
        }
      }
    }
    catch (error) {
      skippedUrls.add(currentPageUrl)
      console.warn(`[wechat-docs-mirror] skipped page ${currentPageUrl}`)
      console.warn(error)
    }
  }

  pages.sort((left, right) =>
    left.relativePath.localeCompare(right.relativePath),
  )
  await writePageFiles({
    outputDir: options.outputDir,
    pages,
  })
  await writeManifest({
    outputDir: options.outputDir,
    entryUrl: options.entryUrl,
    pages,
    skippedUrls: Array.from(skippedUrls).sort((left, right) =>
      left.localeCompare(right),
    ),
  })

  return pages
}

async function main() {
  const options = parseCliArgs(process.argv.slice(2))
  const pages = await mirrorWechatFrameworkDocs(options)
  console.log(
    `[wechat-docs-mirror] mirrored ${pages.length} pages into ${options.outputDir}`,
  )
  console.log(
    `[wechat-docs-mirror] public mirror repository: ${DEFAULT_MIRROR_REPO_URL}`,
  )
}

const isMainModule = isCurrentModuleEntry(process.argv[1], import.meta.url)

if (isMainModule) {
  main().catch((error) => {
    console.error('[wechat-docs-mirror] mirror failed')
    console.error(error)
    process.exitCode = 1
  })
}
