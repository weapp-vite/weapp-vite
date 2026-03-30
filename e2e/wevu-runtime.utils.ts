import { access, readFile, rm } from 'node:fs/promises'
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
  'pages/template-compat/index',
  'pages/wevu-inline-object-reactivity-repro/index',
])
const LEADING_SLASH_PATTERN = /^\/+/
const TRAILING_SLASH_PATTERN = /\/+$/
const LUNA_DOM_HIGHLIGHTER_PATTERN = /\s*\.luna-dom-highlighter[\s\S]*$/
const DUPLICATE_ROUTE_DONE_PATTERN = /"onRouteDone",\s*"onRouteDone"/g
const OWNER_ID_PATTERN = /\bwv\d+\b/g

async function pathExists(filePath: string) {
  try {
    await access(filePath)
    return true
  }
  catch {
    return false
  }
}

export async function runBuild(platform: RuntimePlatform) {
  await rm(DIST_ROOT, { recursive: true, force: true })
  await runWeappViteBuildWithLogCapture({
    cliPath: CLI_PATH,
    projectRoot: APP_ROOT,
    platform,
    skipNpm: true,
    label: `wevu-runtime:${platform}`,
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
  return wxml
    .replace(LUNA_DOM_HIGHLIGHTER_PATTERN, '')
    .replace(DUPLICATE_ROUTE_DONE_PATTERN, '"onRouteDone"')
    .replace(OWNER_ID_PATTERN, 'wv_OWNER')
}

export async function readPageOutput(platform: RuntimePlatform, pagePath: string) {
  const ext = PLATFORM_EXT[platform]
  const templatePath = path.join(DIST_ROOT, `${pagePath}.${ext.template}`)
  const stylePath = path.join(DIST_ROOT, `${pagePath}.${ext.style}`)
  const template = await readFile(templatePath, 'utf-8')
  const style = await readFile(stylePath, 'utf-8')
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
