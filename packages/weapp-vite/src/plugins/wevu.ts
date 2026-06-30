import type { Plugin } from 'vite'
import type { CompilerContext } from '../context'
import path from 'pathe'
import {
  createPageEntryMatcher,
  injectWevuPageFeaturesInJsWithResolver,
} from 'wevu/compiler'
import { resolveAstEngine } from '../ast'
import logger from '../logger'
import { getReadFileCheckMtime } from '../utils/cachePolicy'
import { recordHmrProfileDuration } from '../utils/hmrProfile'
import { normalizeFsResolvedId } from '../utils/resolvedId'
import { toAbsoluteId } from '../utils/toAbsoluteId'
import { collectOnPageScrollPerformanceWarnings } from './performance/onPageScrollDiagnostics'
import { readFile as readFileCached } from './utils/cache'
import { createViteResolverAdapter } from './utils/viteResolverAdapter'

const JS_LIKE_SOURCE_RE = /\.[cm]?[jt]sx?$/
const JS_LIKE_SOURCE_FILTER_RE = /\.[cm]?[jt]sx?(?:\?.*)?$/
const WEVU_RUNTIME_MODULE_HINTS = [
  '\'wevu\'',
  '"wevu"',
  '\'wevu/internal-runtime\'',
  '"wevu/internal-runtime"',
]
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

function mayNeedPageFeatureWork(code: string) {
  return WEVU_RUNTIME_MODULE_HINTS.some(hint => code.includes(hint))
    || PAGE_FEATURE_HOOK_HINTS.some(hint => code.includes(hint))
}

export function createWevuAutoPageFeaturesPlugin(ctx: CompilerContext): Plugin {
  let matcher: ReturnType<typeof createPageEntryMatcher> | null = null
  let scanDirtySynced = false
  const pageFileCache = new Map<string, boolean>()

  return {
    name: 'weapp-vite:wevu:page-features',
    enforce: 'pre',
    transform: {
      filter: {
        id: JS_LIKE_SOURCE_FILTER_RE,
      },
      async handler(code, id) {
        const configService = ctx.configService
        const scanService = ctx.scanService
        if (!configService || !scanService) {
          return null
        }

        const pageMatcher = matcher ?? (matcher = createPageEntryMatcher({
          srcRoot: configService.absoluteSrcRoot,
          loadEntries: async () => {
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
          },
          warn: (message: string) => logger.warn(message),
        }))

        // 注意：app.json 变更会影响 pages 列表，这里直接跟随 scanService 的 dirty 标记。
        if (ctx.runtimeState.scan.isDirty && !scanDirtySynced) {
          pageMatcher.markDirty()
          pageFileCache.clear()
          scanDirtySynced = true
        }
        else if (!ctx.runtimeState.scan.isDirty && scanDirtySynced) {
          scanDirtySynced = false
        }

        const sourceId = normalizeFsResolvedId(id)
        if (!sourceId) {
          return null
        }
        if (sourceId.endsWith('.vue')) {
          return null
        }
        if (!JS_LIKE_SOURCE_RE.test(sourceId)) {
          return null
        }

        const filename = toAbsoluteId(sourceId, configService, undefined, { base: 'cwd' })
        if (!filename || !path.isAbsolute(filename)) {
          return null
        }
        const startedAt = performance.now()

        try {
          let isPageFile = pageFileCache.get(filename)
          if (isPageFile === undefined) {
            isPageFile = await pageMatcher.isPageFile(filename)
            pageFileCache.set(filename, isPageFile)
          }
          if (!isPageFile) {
            return null
          }
          if (!mayNeedPageFeatureWork(code)) {
            return null
          }

          const astEngine = resolveAstEngine(configService.weappViteConfig)
          if (code.includes('onPageScroll')) {
            for (const warning of collectOnPageScrollPerformanceWarnings(code, filename, {
              engine: astEngine,
            })) {
              logger.warn(warning)
            }
          }

          const result = await injectWevuPageFeaturesInJsWithResolver(code, {
            id: filename,
            astEngine,
            resolver: createViteResolverAdapter(
              {
                resolve: async (source, importer) => {
                  return await this.resolve(source, importer) as any
                },
              },
              { readFile: readFileCached },
              { checkMtime: getReadFileCheckMtime(configService) },
            ),
          })
          if (!result.transformed) {
            return null
          }

          return {
            code: result.code,
            map: null,
          }
        }
        finally {
          const durationMs = performance.now() - startedAt
          recordHmrProfileDuration(ctx.runtimeState?.build?.hmr?.profile, 'transformMs', durationMs)
          recordHmrProfileDuration(ctx.runtimeState?.build?.hmr?.profile, 'wevuTransformMs', durationMs)
        }
      },
    },
  }
}

export function wevuPlugin(ctx: CompilerContext): Plugin[] {
  return [createWevuAutoPageFeaturesPlugin(ctx)]
}

export const wevu = wevuPlugin

export {
  collectWevuPageFeatureFlags,
  createPageEntryMatcher,
  injectWevuPageFeatureFlagsIntoOptionsObject,
  injectWevuPageFeaturesInJs,
  injectWevuPageFeaturesInJsWithResolver,
} from 'wevu/compiler'
export type { ModuleResolver, WevuPageFeatureFlag, WevuPageHookName } from 'wevu/compiler'
