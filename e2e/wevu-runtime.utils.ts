import type { TestJsFormat } from './utils/jsFormat'
import { access, readdir, readFile, rm } from 'node:fs/promises'
import path from 'pathe'
import { formatWxml, formatWxss } from './template-e2e.utils'
import { runWeappViteBuildWithLogCapture } from './utils/buildLog'

export const CLI_PATH = path.resolve(import.meta.dirname, '../packages/weapp-vite/bin/weapp-vite.js')
export const APP_ROOT = path.resolve(import.meta.dirname, '../e2e-apps/wevu-runtime-e2e')
export const DIST_ROOT = path.join(APP_ROOT, 'dist')

export type RuntimePlatform = 'weapp' | 'alipay' | 'tt'

const PLATFORM_EXT: Record<RuntimePlatform, { template: string, style: string }> = {
  weapp: { template: 'wxml', style: 'wxss' },
  alipay: { template: 'axml', style: 'acss' },
  tt: { template: 'ttml', style: 'ttss' },
}

const SNAPSHOT_EXCLUDED_PAGES = new Set<string>([
  'pages/composition-api/index',
  'pages/composition-api-vue/index',
  'pages/class-computed/index',
  'pages/function-props-auto/index',
  'pages/function-props-disabled/index',
  'pages/function-props-dynamic/index',
  'pages/non-function-prop-bind/index',
  'pages/root-import-hmr/index',
  'pages/template-compat/index',
  'pages/wevu-inline-object-reactivity-repro/index',
])
const LEADING_SLASH_PATTERN = /^\/+/
const TRAILING_SLASH_PATTERN = /\/+$/
const LUNA_DOM_HIGHLIGHTER_PATTERN = /\s*\.luna-dom-highlighter[\s\S]*$/
const DUPLICATE_ROUTE_DONE_PATTERN = /"onRouteDone",\s*"onRouteDone"/g
const OWNER_ID_PATTERN = /\bwv\d+\b/g
const MAP_COPYRIGHT_PATTERN = /©\d{4}\s+Tencent\s+-\s+GS粤?\(\d{4}\)\d+号地图/g
const MAP_NATIVE_TEXT_PATTERN = /(<map\b[^>]*>\s*)(?:©TENCENT-MAP-LICENSE|地图)(\s*<)/g
const X_SCOPED_HOST_WRAPPER_PATTERN = /<x-scoped\b[^>]*>\s*(<view\s+class="scoped-index--scoped">scoped:\s*wv_OWNER<\/view>)\s*<\/x-scoped>/g
const OPEN_TAG_PATTERN = /<([a-z][\w-]*)(\s[^<>]*)>/gi
const ATTRIBUTE_PATTERN = /([:@\w-]+)(?:\s*=\s*("[^"]*"|'[^']*'|[^\s"'>/]+))?/g

async function pathExists(filePath: string) {
  try {
    await access(filePath)
    return true
  }
  catch {
    return false
  }
}

export async function runBuild(platform: RuntimePlatform, jsFormat?: TestJsFormat) {
  await rm(DIST_ROOT, { recursive: true, force: true })
  await runWeappViteBuildWithLogCapture({
    cliPath: CLI_PATH,
    jsFormat,
    projectRoot: APP_ROOT,
    platform,
    skipNpm: true,
    label: `wevu-runtime:${platform}${jsFormat ? `:${jsFormat}` : ''}`,
  })
}

export async function loadAppConfig() {
  const appJsonPath = path.join(APP_ROOT, 'src', 'app.json')
  const raw = await readFile(appJsonPath, 'utf-8')
  return JSON.parse(raw) as Record<string, any>
}

function normalizeSegment(value: string) {
  return value.replace(LEADING_SLASH_PATTERN, '').replace(TRAILING_SLASH_PATTERN, '')
}

function pushUnique(list: string[], seen: Set<string>, value: string) {
  if (!value || seen.has(value)) {
    return
  }
  seen.add(value)
  list.push(value)
}

function parseAttributes(rawAttrs: string) {
  const trimmedAttrs = rawAttrs.trim()
  const hasTrailingSlash = trimmedAttrs.endsWith('/')
  const attrsBody = hasTrailingSlash ? trimmedAttrs.slice(0, -1).trimEnd() : trimmedAttrs
  const tokens: Array<{ name: string, raw: string }> = []
  let lastIndex = 0

  ATTRIBUTE_PATTERN.lastIndex = 0
  for (const match of attrsBody.matchAll(ATTRIBUTE_PATTERN)) {
    const index = match.index ?? 0
    if (attrsBody.slice(lastIndex, index).trim()) {
      return null
    }
    tokens.push({
      name: match[1],
      raw: match[0],
    })
    lastIndex = index + match[0].length
  }

  if (attrsBody.slice(lastIndex).trim()) {
    return null
  }

  return {
    hasTrailingSlash,
    tokens,
  }
}

function normalizeClassStyleAttributeOrder(wxml: string) {
  return wxml.replace(OPEN_TAG_PATTERN, (fullMatch, tagName: string, rawAttrs: string) => {
    const parsedAttrs = parseAttributes(rawAttrs)
    if (!parsedAttrs) {
      return fullMatch
    }

    const classIndex = parsedAttrs.tokens.findIndex(token => token.name === 'class')
    const styleIndex = parsedAttrs.tokens.findIndex(token => token.name === 'style')
    if (classIndex < 0 || styleIndex < 0 || classIndex === 0) {
      return fullMatch
    }

    const tokens = parsedAttrs.tokens.slice()
    const [classToken] = tokens.splice(classIndex, 1)
    tokens.unshift(classToken)

    const suffix = parsedAttrs.hasTrailingSlash ? ' /' : ''
    return `<${tagName} ${tokens.map(token => token.raw).join(' ')}${suffix}>`
  })
}

export function resolvePages(config: Record<string, any>) {
  const pages: string[] = []
  const seen = new Set<string>()

  if (Array.isArray(config.pages)) {
    for (const page of config.pages) {
      if (typeof page !== 'string') {
        continue
      }
      pushUnique(pages, seen, normalizeSegment(page))
    }
  }

  const subPackages = [
    ...(Array.isArray(config.subPackages) ? config.subPackages : []),
    ...(Array.isArray(config.subpackages) ? config.subpackages : []),
  ]

  for (const subPackage of subPackages) {
    if (!subPackage || typeof subPackage !== 'object') {
      continue
    }
    const root = typeof subPackage.root === 'string' ? normalizeSegment(subPackage.root) : ''
    const subPages = Array.isArray(subPackage.pages) ? subPackage.pages : []
    for (const page of subPages) {
      if (typeof page !== 'string') {
        continue
      }
      const normalizedPage = normalizeSegment(page)
      if (!normalizedPage) {
        continue
      }
      const combined = root ? `${root}/${normalizedPage}` : normalizedPage
      if (root && normalizedPage.startsWith(`${root}/`)) {
        pushUnique(pages, seen, normalizedPage)
      }
      else {
        pushUnique(pages, seen, combined)
      }
    }
  }

  return pages
}

export function filterSnapshotPages(pages: string[]) {
  return pages.filter(page => !SNAPSHOT_EXCLUDED_PAGES.has(page))
}

export function normalizeAutomatorWxml(wxml: string) {
  return normalizeClassStyleAttributeOrder(wxml)
    .replace(LUNA_DOM_HIGHLIGHTER_PATTERN, '')
    .replace(DUPLICATE_ROUTE_DONE_PATTERN, '"onRouteDone"')
    .replace(OWNER_ID_PATTERN, 'wv_OWNER')
    .replace(MAP_COPYRIGHT_PATTERN, '©TENCENT-MAP-LICENSE')
    .replace(MAP_NATIVE_TEXT_PATTERN, '$1©TENCENT-MAP-LICENSE$2')
    .replace(X_SCOPED_HOST_WRAPPER_PATTERN, '$1')
}

async function readFileWithRetry(filePath: string, timeoutMs = 30_000) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    try {
      return await readFile(filePath, 'utf-8')
    }
    catch {
      await new Promise(resolve => setTimeout(resolve, 250))
    }
  }
  return await readFile(filePath, 'utf-8')
}

export async function readPageOutput(platform: RuntimePlatform, pagePath: string) {
  const ext = PLATFORM_EXT[platform]
  const templatePath = path.join(DIST_ROOT, `${pagePath}.${ext.template}`)
  const stylePath = path.join(DIST_ROOT, `${pagePath}.${ext.style}`)
  const template = await readFileWithRetry(templatePath)
  const style = await readFileWithRetry(stylePath)
  return {
    template,
    style,
    templatePath,
    stylePath,
  }
}

export async function formatMarkup(value: string) {
  return await formatWxml(value)
}

export async function formatStyle(value: string) {
  return await formatWxss(value)
}

export async function waitForFile(target: string, timeoutMs = 90_000) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    if (await pathExists(target)) {
      return
    }
    await new Promise(resolve => setTimeout(resolve, 300))
  }
  throw new Error(`Timed out waiting for ${target}`)
}

export async function collectVendorFilesContaining(distRoot: string, marker: string) {
  const vendorRoot = path.join(distRoot, 'weapp-vendors')
  if (!(await pathExists(vendorRoot))) {
    return []
  }

  const files = await readdir(vendorRoot, { recursive: true })
  const matchedFiles: string[] = []

  for (const file of files) {
    if (typeof file !== 'string' || !file.endsWith('.js')) {
      continue
    }

    const filePath = path.join(vendorRoot, file)
    const code = await readFile(filePath, 'utf8')
    if (code.includes(marker)) {
      matchedFiles.push(path.relative(distRoot, filePath).replaceAll('\\', '/'))
    }
  }

  return matchedFiles.sort()
}

export async function waitForVendorFileContains(distRoot: string, marker: string, timeoutMs = 90_000) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    const matchedFiles = await collectVendorFilesContaining(distRoot, marker)
    if (matchedFiles.length) {
      return matchedFiles
    }
    await new Promise(resolve => setTimeout(resolve, 300))
  }
  throw new Error(`Timed out waiting for vendor file containing ${marker}`)
}
