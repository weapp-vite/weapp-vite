import type { CorePluginState } from '../../helpers'
import { removeExtensionDeep } from '@weapp-core/shared'
import { resolveAstEngine } from '../../../../ast'
import logger from '../../../../logger'
import {
  resolveRequestRuntimeOptions,
} from '../../../../runtime/config/internal/injectRequestGlobals'
import { isCSSRequest } from '../../../../utils'
import { getMiniProgramPlatformGlobalKey } from '../../../../utils/miniProgramGlobals'
import { normalizeWatchPath } from '../../../../utils/path'
import { normalizeFsResolvedId } from '../../../../utils/resolvedId'
import { readFile as readFileCached } from '../../../utils/cache'
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
  const { ctx, subPackageMeta, loadEntry, loadedEntrySet } = state
  const { configService } = ctx
  const astEngine = resolveAstEngine(configService.weappViteConfig)
  const weapiResolution = { checked: false, available: false }
  const injectRequestGlobalsOptions = resolveRequestRuntimeOptions({
    appPrelude: configService.weappViteConfig?.appPrelude,
    injectRequestGlobals: configService.weappViteConfig?.injectRequestGlobals,
  }, configService.packageJson, message => logger.warn(message))

  async function ensureWeapiAvailable(pluginCtx: any, importer: string) {
    if (weapiResolution.checked) {
      return weapiResolution.available
    }
    weapiResolution.checked = true
    if (typeof pluginCtx?.resolve !== 'function') {
      weapiResolution.available = true
      return true
    }
    const resolved = await pluginCtx.resolve('@wevu/api', importer)
    if (!resolved) {
      logger.warn('[weapp-vite] 未找到 @wevu/api，已跳过 wpi 全局注入。')
      weapiResolution.available = false
      return false
    }
    weapiResolution.available = true
    return true
  }

  return async function load(this: any, id: string) {
    configService.weappViteConfig?.debug?.load?.(id, subPackageMeta)

    if (isCSSRequest(id)) {
      const parsed = parseRequest(id)
      if (parsed.query.wxss) {
        const realPath = getCssRealPath(parsed)
        this.addWatchFile(normalizeWatchPath(realPath))
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
      const result = await loadEntry.call(this, sourceId, 'component')
      const requestGlobalsTargets = result && typeof result === 'object' && 'code' in result
        ? resolveRequestGlobalsTargetsForCode((result as any).code, sourceId, injectRequestGlobalsOptions)
        : injectRequestGlobalsOptions?.targets ?? []
      if (requestGlobalsTargets.length === 0) {
        return result
      }
      return injectRequestGlobalsIntoLoadResult(result, sourceId, requestGlobalsTargets, {
        localBindings: true,
      })
    }
    const relativeBasename = removeExtensionDeep(configService.relativeAbsoluteSrcRoot(sourceId))

    if (relativeBasename === resolveRootEntryBasename(state)) {
      // @ts-ignore Rolldown 的 PluginContext 类型不完整
      const result = await loadEntry.call(this, sourceId, 'app')
      const requestGlobalsTargets = result && typeof result === 'object' && 'code' in result
        ? resolveRequestGlobalsTargetsForCode((result as any).code, sourceId, injectRequestGlobalsOptions)
        : injectRequestGlobalsOptions?.targets ?? []
      const passiveRequestGlobalsTargets = result && typeof result === 'object' && 'code' in result
        ? resolvePassiveRequestGlobalsTargets((result as any).code, requestGlobalsTargets)
        : []
      if (requestGlobalsTargets.length === 0 && passiveRequestGlobalsTargets.length > 0) {
        return injectRequestGlobalsIntoLoadResult(result, sourceId, passiveRequestGlobalsTargets, {
          passiveLocalBindings: true,
        })
      }
      if (!injectOptions || configService.weappLibConfig?.enabled) {
        return injectRequestGlobalsIntoLoadResult(result, sourceId, requestGlobalsTargets, {
          localBindings: true,
        })
      }
      const available = await ensureWeapiAvailable(this, sourceId)
      if (!available) {
        return injectRequestGlobalsIntoLoadResult(result, sourceId, requestGlobalsTargets, {
          localBindings: true,
        })
      }
      if (result && typeof result === 'object' && 'code' in result) {
        const requestGlobalsInjectedResult = injectRequestGlobalsIntoLoadResult(result, sourceId, requestGlobalsTargets, {
          localBindings: true,
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

    const declaredEntryType = state.entriesMap?.get(relativeBasename)?.type
    const isDeclaredEntry = Boolean(declaredEntryType)

    if (loadedEntrySet.has(sourceId) || isDeclaredEntry || subPackageMeta?.entries.includes(relativeBasename)) {
      const loadType = declaredEntryType === 'page' ? 'page' : 'component'
      // @ts-ignore Rolldown 的 PluginContext 类型不完整
      const result = await loadEntry.call(this, sourceId, loadType)
      const requestGlobalsTargets = result && typeof result === 'object' && 'code' in result
        ? resolveRequestGlobalsTargetsForCode((result as any).code, sourceId, injectRequestGlobalsOptions)
        : injectRequestGlobalsOptions?.targets ?? []
      const passiveRequestGlobalsTargets = result && typeof result === 'object' && 'code' in result
        ? resolvePassiveRequestGlobalsTargets((result as any).code, requestGlobalsTargets)
        : []
      if (requestGlobalsTargets.length === 0 && passiveRequestGlobalsTargets.length > 0) {
        return injectRequestGlobalsIntoLoadResult(result, sourceId, passiveRequestGlobalsTargets, {
          passiveLocalBindings: true,
        })
      }
      if (!injectOptions || !injectOptions.replaceWx || configService.weappLibConfig?.enabled) {
        return injectRequestGlobalsIntoLoadResult(result, sourceId, requestGlobalsTargets, {
          localBindings: true,
        })
      }
      const available = await ensureWeapiAvailable(this, sourceId)
      if (!available) {
        return injectRequestGlobalsIntoLoadResult(result, sourceId, requestGlobalsTargets, {
          localBindings: true,
        })
      }
      return injectRequestGlobalsIntoLoadResult(
        replacePlatformApiInLoadResult(result, injectOptions, astEngine, this),
        sourceId,
        requestGlobalsTargets,
        {
          localBindings: true,
        },
      )
    }
  }
}
