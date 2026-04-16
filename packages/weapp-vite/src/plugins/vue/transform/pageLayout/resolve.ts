import type { ConfigService } from '../../../../runtime/config/types'
import type { DiscoveredLayoutFile, LayoutPropValue, NativeLayoutAssets, PageLayoutConfigService, ResolvedLayoutMeta, ResolvedPageLayout, ResolvedPageLayoutPlan } from './types'
import { fs } from '@weapp-core/shared/fs'
import path from 'pathe'
import picomatch from 'picomatch'
import { findCssEntry, findJsEntry, findJsonEntry, findTemplateEntry } from '../../../../utils'
import { normalizeWatchPath, toPosixPath } from '../../../../utils/path'
import { usingComponentFromResolvedFile } from '../../../../utils/usingComponentFrom'
import { collectSetPageLayoutPropKeys, extractPageLayoutMeta, hasSetPageLayoutUsage } from './meta'
import { normalizeComparablePath, normalizeLayoutName, removeFileExtension, toLayoutTagName } from './shared'

const VUE_LIKE_EXTENSIONS = ['.vue', '.tsx', '.jsx'] as const
const PATH_SEGMENT_RE = /[\\/]/
const TRAILING_INDEX_RE = /\/index$/
const LEADING_SLASHES_RE = /^\/+/
const ROUTE_RULE_GLOB_TOKEN_RE = /[*?[\]{}()!+@]/g
const resolvedLayoutsCache = new Map<string, Promise<ResolvedPageLayout[]>>()
const PAGE_META_HINT = 'definePageMeta'
const SET_PAGE_LAYOUT_HINT = 'setPageLayout'

function normalizePageRouteCandidates(
  filename: string,
  configService: Pick<ConfigService, 'relativeOutputPath'>,
) {
  const relativeBase = toPosixPath(configService.relativeOutputPath(removeFileExtension(filename)))
  const fullPath = `/${relativeBase.replace(LEADING_SLASHES_RE, '')}`
  const shorthand = (() => {
    let next = fullPath
    if (next.startsWith('/pages/')) {
      next = next.slice('/pages'.length)
    }
    else {
      next = next.replace('/pages/', '/')
    }
    next = next.replace(TRAILING_INDEX_RE, '')
    return next === '' ? '/' : next
  })()

  return Array.from(new Set([shorthand, fullPath]))
}

function normalizeRouteRuleLayoutMeta(input: unknown): ResolvedLayoutMeta | undefined {
  if (input === false) {
    return { disabled: true }
  }
  if (typeof input === 'string') {
    return { name: normalizeLayoutName(input) }
  }
  if (!input || typeof input !== 'object') {
    return undefined
  }

  const record = input as Record<string, unknown>
  const name = typeof record.name === 'string' ? normalizeLayoutName(record.name) : undefined
  const props = record.props && typeof record.props === 'object'
    ? record.props as Record<string, LayoutPropValue>
    : undefined

  return {
    name,
    props,
    disabled: record.disabled === true,
  }
}

function compareRuleScore(left: number[], right: number[]) {
  const maxLength = Math.max(left.length, right.length)
  for (let index = 0; index < maxLength; index += 1) {
    const leftValue = left[index] ?? 0
    const rightValue = right[index] ?? 0
    if (leftValue === rightValue) {
      continue
    }
    return leftValue > rightValue ? 1 : -1
  }
  return 0
}

function resolveRouteRuleLayoutMeta(
  filename: string,
  configService: Pick<ConfigService, 'relativeOutputPath' | 'weappViteConfig'>,
) {
  const routeRules = configService.weappViteConfig?.routeRules
  if (!routeRules) {
    return undefined
  }

  const routeCandidates = normalizePageRouteCandidates(filename, configService)
  let matched: { meta: ResolvedLayoutMeta | undefined, score: number[] } | undefined
  for (const [pattern, rule] of Object.entries(routeRules)) {
    const isMatched = routeCandidates.some(candidate => picomatch(pattern)(candidate))
    if (!isMatched) {
      continue
    }
    const normalizedMeta = normalizeRouteRuleLayoutMeta(rule?.appLayout)
    const patternSegments = pattern.split('/').filter(Boolean)
    const wildcardMatches = pattern.match(ROUTE_RULE_GLOB_TOKEN_RE) ?? []
    const staticSegments = patternSegments.filter(segment => !ROUTE_RULE_GLOB_TOKEN_RE.test(segment)).length
    const score = [
      staticSegments,
      pattern.replace(ROUTE_RULE_GLOB_TOKEN_RE, '').length,
      -wildcardMatches.length,
      patternSegments.length,
      pattern.length,
    ]

    if (!matched || compareRuleScore(score, matched.score) > 0) {
      matched = {
        meta: normalizedMeta,
        score,
      }
    }
  }

  return matched?.meta
}

async function collectLayoutFiles(root: string): Promise<Map<string, DiscoveredLayoutFile>> {
  const layoutMap = new Map<string, DiscoveredLayoutFile>()
  const comparableRoot = normalizeComparablePath(root)

  async function walk(dir: string) {
    let entries: string[]
    try {
      entries = await fs.readdir(dir)
    }
    catch {
      return
    }

    for (const entry of entries) {
      const full = path.join(dir, entry)
      const stat = await fs.stat(full)
      if (stat.isDirectory()) {
        await walk(full)
        continue
      }
      if (!VUE_LIKE_EXTENSIONS.some(ext => full.endsWith(ext))) {
        const templateEntry = await findTemplateEntry(full)
        if (!templateEntry.path || templateEntry.path !== full) {
          continue
        }

        const base = full.slice(0, -path.extname(full).length)
        const jsonEntry = await findJsonEntry(base)
        if (!jsonEntry.path) {
          continue
        }

        const relativePath = path.relative(comparableRoot, normalizeComparablePath(base))
        const parts = relativePath.split(PATH_SEGMENT_RE).filter(Boolean)
        if (parts.at(-1) === 'index') {
          parts.pop()
        }
        const layoutName = normalizeLayoutName(parts.join('/'))
        if (!layoutName) {
          continue
        }
        const duplicated = layoutMap.get(layoutName)
        if (duplicated && duplicated.file !== base) {
          throw new Error(`layouts 目录中存在重复布局名 "${layoutName}"：${duplicated.file} 与 ${base}`)
        }
        layoutMap.set(layoutName, {
          file: base,
          kind: 'native',
          layoutName,
          tagName: toLayoutTagName(layoutName),
        })
        continue
      }

      const relativePath = path.relative(comparableRoot, normalizeComparablePath(full))
      const ext = path.extname(relativePath)
      const withoutExt = relativePath.slice(0, -ext.length)
      const parts = withoutExt.split(PATH_SEGMENT_RE).filter(Boolean)
      if (parts.at(-1) === 'index') {
        parts.pop()
      }
      const layoutName = normalizeLayoutName(parts.join('/'))
      if (!layoutName) {
        continue
      }
      const duplicated = layoutMap.get(layoutName)
      if (duplicated && duplicated.file !== full) {
        throw new Error(`layouts 目录中存在重复布局名 "${layoutName}"：${duplicated.file} 与 ${full}`)
      }
      layoutMap.set(layoutName, {
        file: full,
        kind: 'vue',
        layoutName,
        tagName: toLayoutTagName(layoutName),
      })
    }
  }

  await walk(root)
  return layoutMap
}

async function resolveAllLayouts(
  configService: Pick<ConfigService, 'absoluteSrcRoot' | 'relativeOutputPath'>,
) {
  const cacheKey = normalizeComparablePath(configService.absoluteSrcRoot)
  const cached = resolvedLayoutsCache.get(cacheKey)
  if (cached) {
    return await cached
  }

  const task = (async () => {
    const layoutsRoot = path.join(configService.absoluteSrcRoot, 'layouts')
    const layoutFiles = await collectLayoutFiles(layoutsRoot)
    const resolvedLayouts: ResolvedPageLayout[] = []

    for (const layoutFile of layoutFiles.values()) {
      const importPath = usingComponentFromResolvedFile(layoutFile.file, configService)
      if (!importPath) {
        continue
      }
      resolvedLayouts.push({
        ...layoutFile,
        importPath,
      })
    }

    return resolvedLayouts
  })()

  resolvedLayoutsCache.set(cacheKey, task)

  try {
    return await task
  }
  catch (error) {
    resolvedLayoutsCache.delete(cacheKey)
    throw error
  }
}

export function invalidateResolvedPageLayoutsCache(absoluteSrcRoot?: string) {
  if (!absoluteSrcRoot) {
    resolvedLayoutsCache.clear()
    return
  }

  resolvedLayoutsCache.delete(normalizeComparablePath(absoluteSrcRoot))
}

export async function resolvePageLayoutPlan(
  source: string,
  filename: string,
  configService: PageLayoutConfigService,
): Promise<ResolvedPageLayoutPlan | undefined> {
  const hasPageMetaHint = source.includes(PAGE_META_HINT)
  const hasDynamicLayoutHint = source.includes(SET_PAGE_LAYOUT_HINT)
  const layoutMeta = (hasPageMetaHint ? extractPageLayoutMeta(source, filename) : undefined)
    ?? resolveRouteRuleLayoutMeta(filename, configService)
  const dynamicSwitch = hasDynamicLayoutHint
    ? hasSetPageLayoutUsage(source, filename)
    : false
  if (layoutMeta?.disabled && !dynamicSwitch) {
    return undefined
  }

  const layouts = await resolveAllLayouts(configService)
  const layoutMap = new Map(layouts.map(layout => [layout.layoutName, layout]))
  const defaultLayout = layoutMap.get('default')
  const selectedName = typeof layoutMeta?.name === 'string'
    ? layoutMeta.name
    : defaultLayout?.layoutName

  if (typeof selectedName === 'string' && !layoutMap.has(selectedName)) {
    throw new Error(`${filename} 指定的 layout "${selectedName}" 不存在，请检查 ${path.join(configService.absoluteSrcRoot, 'layouts')} 目录。`)
  }

  const currentLayout = selectedName
    ? {
        ...layoutMap.get(selectedName)!,
        props: layoutMeta?.props,
      }
    : undefined

  if (!currentLayout && !dynamicSwitch) {
    return undefined
  }

  return {
    currentLayout,
    dynamicSwitch,
    layouts,
    dynamicPropKeys: dynamicSwitch
      ? Array.from(new Set([
          ...Object.keys(currentLayout?.props ?? {}),
          ...collectSetPageLayoutPropKeys(source, filename),
        ]))
      : [],
  }
}

export async function resolvePageLayout(
  source: string,
  filename: string,
  configService: PageLayoutConfigService,
): Promise<ResolvedPageLayout | undefined> {
  const plan = await resolvePageLayoutPlan(source, filename, configService)
  return plan?.currentLayout
}

export function isLayoutFile(
  filename: string,
  configService: Pick<ConfigService, 'absoluteSrcRoot'>,
) {
  const layoutsRoot = `${normalizeWatchPath(path.join(configService.absoluteSrcRoot, 'layouts'))}/`
  const normalizedFile = normalizeWatchPath(filename)
  return normalizedFile.startsWith(layoutsRoot)
}

export async function collectNativeLayoutAssets(basePath: string): Promise<NativeLayoutAssets> {
  const [jsonEntry, templateEntry, styleEntry, scriptEntry] = await Promise.all([
    findJsonEntry(basePath),
    findTemplateEntry(basePath),
    findCssEntry(basePath),
    findJsEntry(basePath),
  ])

  return {
    json: jsonEntry.path,
    template: templateEntry.path,
    style: styleEntry.path,
    script: scriptEntry.path,
  }
}
