import type { CorePluginState } from '../../helpers'
import { removeExtensionDeep } from '@weapp-core/shared'
import { resolveAstEngine } from '../../../../ast'
import logger from '../../../../logger'
import {
  resolveRequestRuntimeOptions,
} from '../../../../runtime/config/internal/injectRequestGlobals'
import { isCSSRequest } from '../../../../utils'
import { getPathExistsTtlMs } from '../../../../utils/cachePolicy'
import { recordHmrProfileDuration } from '../../../../utils/hmrProfile'
import { getMiniProgramPlatformGlobalKey } from '../../../../utils/miniProgramGlobals'
import { normalizeFsResolvedId } from '../../../../utils/resolvedId'
import { pathExists as pathExistsCached, readFile as readFileCached } from '../../../utils/cache'
import { getCssRealPath, parseRequest } from '../../../utils/parse'
import {
  injectRequestGlobalsIntoLoadResult,
  resolvePassiveRequestGlobalsTargets,
  resolveRequestGlobalsTargetsForCode,
} from './requestGlobals'
import {
  createWeapiInjectionCode,
  replacePlatformApiInLoadResult,
  resolveInjectWeapiOptions,
  resolveRootEntryBasename,
} from './weapi'

export { createOptionsHook } from './options'

export function createLoadHook(state: CorePluginState) {
  const { ctx, subPackageMeta, loadEntry, loadedEntrySet, resolvedEntryMap } = state
  const { configService } = ctx
  const astEngine = resolveAstEngine(configService.weappViteConfig)
  const pathExistsTtlMs = getPathExistsTtlMs(configService)
  const weapiResolution = { checked: false, available: false }
  const injectRequestGlobalsOptions = resolveRequestRuntimeOptions({
    appPrelude: configService.weappViteConfig?.appPrelude,
    webRuntime: configService.weappViteConfig?.injectWebRuntimeGlobals,
    injectRequestGlobals: configService.weappViteConfig?.injectRequestGlobals,
  }, configService.packageJson, message => logger.warn(message))

  function recordLoadDuration(key: 'coreLoadMs' | 'entryLoadMs' | 'requestGlobalsMs' | 'weapiResolveMs', startedAt: number) {
    recordHmrProfileDuration(ctx.runtimeState?.build?.hmr?.profile, key, performance.now() - startedAt)
  }

  async function loadProfiledEntry(
    pluginCtx: any,
    sourceId: string,
    type: 'app' | 'page' | 'component',
  ) {
    const startedAt = performance.now()
    try {
      return await loadEntry.call(pluginCtx, sourceId, type)
    }
    finally {
      recordLoadDuration('entryLoadMs', startedAt)
    }
  }

  function resolveRequestGlobalsTargets(result: unknown, sourceId: string) {
    const startedAt = performance.now()
    try {
      return result && typeof result === 'object' && 'code' in result
        ? resolveRequestGlobalsTargetsForCode((result as any).code, sourceId, injectRequestGlobalsOptions)
        : injectRequestGlobalsOptions?.targets ?? []
    }
    finally {
      recordLoadDuration('requestGlobalsMs', startedAt)
    }
  }

  function resolvePassiveTargets(result: unknown, requestGlobalsTargets: unknown[]) {
    const startedAt = performance.now()
    try {
      return result && typeof result === 'object' && 'code' in result
        ? resolvePassiveRequestGlobalsTargets((result as any).code, requestGlobalsTargets as any)
        : []
    }
    finally {
      recordLoadDuration('requestGlobalsMs', startedAt)
    }
  }

  function injectRequestGlobalsProfiled(
    result: unknown,
    sourceId: string,
    requestGlobalsTargets: unknown[],
    options: Parameters<typeof injectRequestGlobalsIntoLoadResult>[3],
  ) {
    const startedAt = performance.now()
    try {
      return injectRequestGlobalsIntoLoadResult(result, sourceId, requestGlobalsTargets as any, options)
    }
    finally {
      recordLoadDuration('requestGlobalsMs', startedAt)
    }
  }

  async function ensureWeapiAvailable(pluginCtx: any, importer: string) {
    if (weapiResolution.checked) {
      return weapiResolution.available
    }
    weapiResolution.checked = true
    if (typeof pluginCtx?.resolve !== 'function') {
      weapiResolution.available = true
      return true
    }
    const startedAt = performance.now()
    const resolved = await pluginCtx.resolve('@wevu/api', importer)
    recordLoadDuration('weapiResolveMs', startedAt)
    if (!resolved) {
      logger.warn('[weapp-vite] 未找到 @wevu/api，已跳过 wpi 全局注入。')
      weapiResolution.available = false
      return false
    }
    weapiResolution.available = true
    return true
  }

  return async function load(this: any, id: string) {
    const loadStartedAt = performance.now()
    try {
      configService.weappViteConfig?.debug?.load?.(id, subPackageMeta)

      if (isCSSRequest(id)) {
        const parsed = parseRequest(id)
        if (parsed.query.wxss) {
          const realPath = getCssRealPath(parsed)
          try {
            const css = await readFileCached(realPath, { checkMtime: configService.isDev })
            return { code: css }
          }
          catch {}
        }
        return null
      }

      const sourceId = normalizeFsResolvedId(id)
      const injectOptions = resolveInjectWeapiOptions(configService)
      const libEntry = configService.weappLibConfig?.enabled
        ? ctx.runtimeState.lib.entries.get(sourceId)
        : undefined
      if (libEntry) {
        // @ts-ignore Rolldown 的 PluginContext 类型不完整
        const result = await loadProfiledEntry(this, sourceId, 'component')
        const requestGlobalsTargets = resolveRequestGlobalsTargets(result, sourceId)
        if (requestGlobalsTargets.length === 0) {
          return result
        }
        return injectRequestGlobalsProfiled(result, sourceId, requestGlobalsTargets, {
          localBindings: true,
          networkDefaults: injectRequestGlobalsOptions?.networkDefaults,
        })
      }
      const relativeBasename = removeExtensionDeep(configService.relativeAbsoluteSrcRoot(sourceId))
      const declaredEntryType = state.entriesMap?.get(relativeBasename)?.type
      const isDeclaredEntry = Boolean(declaredEntryType)

      const shouldCheckDeletedDeclaredEntry = configService.isDev
        && ctx.runtimeState?.build?.hmr?.profile?.event === 'delete'
      if (
        shouldCheckDeletedDeclaredEntry
        && isDeclaredEntry
        && sourceId
        && !sourceId.startsWith('\0')
        && await pathExistsCached(sourceId, { ttlMs: pathExistsTtlMs }) === false
      ) {
        return {
          code: sourceId.endsWith('.vue') ? '<template />' : '',
          map: { mappings: '' },
        }
      }

      if (relativeBasename === resolveRootEntryBasename(state)) {
        // @ts-ignore Rolldown 的 PluginContext 类型不完整
        const result = await loadProfiledEntry(this, sourceId, 'app')
        if (configService.isDev && sourceId && !sourceId.startsWith('\0')) {
          resolvedEntryMap.set(sourceId, { id: sourceId } as any)
        }
        const requestGlobalsTargets = resolveRequestGlobalsTargets(result, sourceId)
        const passiveRequestGlobalsTargets = resolvePassiveTargets(result, requestGlobalsTargets)
        if (requestGlobalsTargets.length === 0 && passiveRequestGlobalsTargets.length > 0) {
          return injectRequestGlobalsProfiled(result, sourceId, passiveRequestGlobalsTargets, {
            networkDefaults: injectRequestGlobalsOptions?.networkDefaults,
            passiveLocalBindings: true,
          })
        }
        if (!injectOptions || configService.weappLibConfig?.enabled) {
          return injectRequestGlobalsProfiled(result, sourceId, requestGlobalsTargets, {
            localBindings: true,
            networkDefaults: injectRequestGlobalsOptions?.networkDefaults,
          })
        }
        const available = await ensureWeapiAvailable(this, sourceId)
        if (!available) {
          return injectRequestGlobalsProfiled(result, sourceId, requestGlobalsTargets, {
            localBindings: true,
            networkDefaults: injectRequestGlobalsOptions?.networkDefaults,
          })
        }
        if (result && typeof result === 'object' && 'code' in result) {
          const requestGlobalsInjectedResult = injectRequestGlobalsProfiled(result, sourceId, requestGlobalsTargets, {
            localBindings: true,
            networkDefaults: injectRequestGlobalsOptions?.networkDefaults,
          })
          const platform = getMiniProgramPlatformGlobalKey(configService.platform) ?? ''
          const injectedCode = createWeapiInjectionCode({
            globalName: injectOptions.globalName,
            replaceWx: injectOptions.replaceWx,
            platform,
          })
          return replacePlatformApiInLoadResult({
            ...(requestGlobalsInjectedResult as any),
            code: `${injectedCode}${(requestGlobalsInjectedResult as any).code}`,
          }, injectOptions, astEngine, this)
        }
        return result
      }

      if (loadedEntrySet.has(sourceId) || isDeclaredEntry || subPackageMeta?.entries.includes(relativeBasename)) {
        const loadType = declaredEntryType === 'page' ? 'page' : 'component'
        // @ts-ignore Rolldown 的 PluginContext 类型不完整
        const result = await loadProfiledEntry(this, sourceId, loadType)
        const requestGlobalsTargets = resolveRequestGlobalsTargets(result, sourceId)
        const passiveRequestGlobalsTargets = resolvePassiveTargets(result, requestGlobalsTargets)
        if (requestGlobalsTargets.length === 0 && passiveRequestGlobalsTargets.length > 0) {
          return injectRequestGlobalsProfiled(result, sourceId, passiveRequestGlobalsTargets, {
            networkDefaults: injectRequestGlobalsOptions?.networkDefaults,
            passiveLocalBindings: true,
          })
        }
        if (!injectOptions || !injectOptions.replaceWx || configService.weappLibConfig?.enabled) {
          return injectRequestGlobalsProfiled(result, sourceId, requestGlobalsTargets, {
            localBindings: true,
            networkDefaults: injectRequestGlobalsOptions?.networkDefaults,
          })
        }
        const available = await ensureWeapiAvailable(this, sourceId)
        if (!available) {
          return injectRequestGlobalsProfiled(result, sourceId, requestGlobalsTargets, {
            localBindings: true,
            networkDefaults: injectRequestGlobalsOptions?.networkDefaults,
          })
        }
        return injectRequestGlobalsProfiled(
          replacePlatformApiInLoadResult(result, injectOptions, astEngine, this),
          sourceId,
          requestGlobalsTargets,
          {
            localBindings: true,
            networkDefaults: injectRequestGlobalsOptions?.networkDefaults,
          },
        )
      }
    }
    finally {
      recordLoadDuration('coreLoadMs', loadStartedAt)
    }
  }
}
