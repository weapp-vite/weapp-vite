import type { SFCStyleBlock } from 'vue/compiler-sfc'
import type { VueTransformResult } from 'wevu/compiler'
import type { CompilerContext } from '../../../../../context'
import type { MpPlatform } from '../../../../../types'
import { escapeStringRegexp } from '@weapp-core/shared'
import { fs } from '@weapp-core/shared/fs'
import path from 'pathe'
import { getWxmlDirectivePrefix } from '../../../../../platform'
import { toAbsoluteId } from '../../../../../utils/toAbsoluteId'
import { isVueLikeFile } from '../../shared'

const APP_ENTRY_RE = /[\\/]app\.(?:vue|jsx|tsx)$/
const TEMPLATE_MUSTACHE_HINT = '{{'
const TEMPLATE_EVENT_HINT_RE = /\b(?:bind|catch)[A-Za-z:_-]+=/
const PAGE_FEATURE_HOOK_HINTS = [
  'onPageScroll',
  'onPullDownRefresh',
  'onReachBottom',
  'onRouteDone',
  'onTabItemTap',
  'onResize',
  'onShareAppMessage',
  'onShareTimeline',
  'onAddToFavorites',
  'onSaveExitState',
]
const PAGE_SCROLL_HOOK_HINT = 'onPageScroll'

export function resolveScriptlessVueEntryStub(isPage: boolean) {
  return isPage ? 'Page({})' : 'Component({})'
}

export function isAppEntry(filename: string) {
  return APP_ENTRY_RE.test(filename)
}

export function isVueLikeId(id: string) {
  return isVueLikeFile(id)
}

export function mayNeedTransformSetDataPick(
  template: string,
  options?: {
    platform?: MpPlatform
  },
) {
  if (template.includes(TEMPLATE_MUSTACHE_HINT)) {
    return true
  }

  const directivePrefix = getWxmlDirectivePrefix(options?.platform)
  if (new RegExp(`${escapeStringRegexp(directivePrefix)}:`).test(template)) {
    return true
  }

  return TEMPLATE_EVENT_HINT_RE.test(template)
}

export function mayNeedTransformPageFeatureInjection(script: string) {
  return PAGE_FEATURE_HOOK_HINTS.some(hint => script.includes(hint))
}

export function mayNeedTransformPageScrollDiagnostics(script: string) {
  return script.includes(PAGE_SCROLL_HOOK_HINT)
}

export function resolveTransformFilename(options: {
  id: string
  configService: NonNullable<CompilerContext['configService']>
  pluginCtx: any
  getSourceFromVirtualId: (id: string) => string
  addWatchFile: (pluginCtx: any, file: string) => void
}) {
  const { id, configService, pluginCtx, getSourceFromVirtualId, addWatchFile } = options
  const sourceId = getSourceFromVirtualId(id)
  const filename = toAbsoluteId(sourceId, configService, undefined, { base: 'cwd' })
  if (!filename || !path.isAbsolute(filename)) {
    return null
  }

  if (typeof pluginCtx.addWatchFile === 'function') {
    addWatchFile(pluginCtx, filename)
  }

  return filename
}

export async function loadTransformPageEntries(scanService: CompilerContext['scanService']) {
  if (!scanService) {
    return { pages: [], subPackages: [], pluginPages: [] }
  }

  const appEntry = await scanService.loadAppEntry()
  const subPackages = scanService.loadSubPackages().map(meta => ({
    root: meta.subPackage.root,
    pages: meta.subPackage.pages,
  }))
  const pluginPages = scanService.pluginJson
    ? Object.values((scanService.pluginJson as { pages?: Record<string, string> }).pages ?? {}).map(page => String(page))
    : []

  return {
    pages: appEntry.json?.pages ?? [],
    subPackages,
    pluginPages,
  }
}

export function invalidatePageLayoutCaches(
  configService: NonNullable<CompilerContext['configService']> | undefined,
  compilationCache: Map<string, { result: VueTransformResult, source?: string, isPage: boolean }>,
  styleBlocksCache: Map<string, SFCStyleBlock[]>,
) {
  if (!configService) {
    return
  }

  for (const [cachedId, cached] of compilationCache.entries()) {
    if (cached.isPage) {
      cached.source = undefined
    }
    styleBlocksCache.delete(cachedId)
  }
}

export function invalidateVueFileCaches(
  file: string,
  compilationCache: Map<string, { result: VueTransformResult, source?: string, isPage: boolean }>,
  styleBlocksCache: Map<string, SFCStyleBlock[]>,
  options: {
    existsSync: (filePath: string) => boolean
  },
) {
  if (!options.existsSync(file)) {
    compilationCache.delete(file)
  }
  else {
    const cached = compilationCache.get(file)
    if (cached) {
      cached.source = undefined
    }
  }
  styleBlocksCache.delete(file)
}

export function handleTransformLayoutInvalidation(
  file: string,
  options: {
    configService: NonNullable<CompilerContext['configService']> | undefined
    compilationCache: Map<string, { result: VueTransformResult, source?: string, isPage: boolean }>
    styleBlocksCache: Map<string, SFCStyleBlock[]>
    isLayoutFile: (file: string, configService: NonNullable<CompilerContext['configService']>) => boolean
    invalidateResolvedPageLayoutsCache: (srcRoot: string) => void
  },
) {
  const { configService, compilationCache, styleBlocksCache, isLayoutFile, invalidateResolvedPageLayoutsCache } = options
  if (!configService || !isLayoutFile(file, configService)) {
    return false
  }

  invalidateResolvedPageLayoutsCache(configService.absoluteSrcRoot)
  invalidatePageLayoutCaches(configService, compilationCache, styleBlocksCache)
  return true
}

export function handleTransformVueFileInvalidation(
  file: string,
  options: {
    compilationCache: Map<string, { result: VueTransformResult, source?: string, isPage: boolean }>
    styleBlocksCache: Map<string, SFCStyleBlock[]>
    existsSync: (filePath: string) => boolean
  },
) {
  if (!isVueLikeId(file)) {
    return false
  }

  invalidateVueFileCaches(file, options.compilationCache, options.styleBlocksCache, {
    existsSync: options.existsSync,
  })
  return true
}

export async function ensureSfcStyleBlocks(
  filename: string,
  styleBlocksCache: Map<string, SFCStyleBlock[]>,
  options: {
    load: (filename: string) => Promise<SFCStyleBlock[]>
  },
) {
  const cached = styleBlocksCache.get(filename)
  if (cached) {
    return cached
  }

  const styles = await options.load(filename)
  styleBlocksCache.set(filename, styles)
  return styles
}

export async function loadTransformSource(options: {
  code: string
  filename: string
  isDev: boolean
  readFileCached: (filename: string, options: { checkMtime: boolean, encoding: 'utf8' }) => Promise<string>
}) {
  const { code, filename, isDev, readFileCached } = options
  if (typeof code === 'string') {
    return code
  }

  return isDev
    ? await readFileCached(filename, { checkMtime: true, encoding: 'utf8' })
    : await fs.readFile(filename, 'utf-8')
}

export async function preloadTransformSfcStyleBlocks(options: {
  filename: string
  source: string
  styleBlocksCache: Map<string, SFCStyleBlock[]>
  load: (filename: string, source: string) => Promise<SFCStyleBlock[]>
}) {
  const { filename, source, styleBlocksCache, load } = options
  if (!filename.endsWith('.vue') || !source.includes('<style')) {
    return undefined
  }

  try {
    return await ensureSfcStyleBlocks(filename, styleBlocksCache, {
      load: async target => await load(target, source),
    })
  }
  catch {
    return undefined
  }
}
