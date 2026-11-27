import type { Plugin } from 'vite'
import type { AstParserLike } from '../../../../ast'
import type { CorePluginState } from '../../helpers'
import { removeExtensionDeep } from '@weapp-core/shared'
import { mayContainPlatformApiIdentifierByText, resolveAstEngine } from '../../../../ast'
import logger from '../../../../logger'
import { parseSidecarSourceMetadata } from '../../../../moduleGraph/protocol'
import { getSelectedAutoRouteSource } from '../../../../runtime/autoRoutesPlugin/selection'
import {
  createInjectRequestGlobalsCode,
  injectRequestGlobalsIntoSfc,
  mayContainRequestGlobalsUsageByText,
  resolveAutoRequestGlobalsTargets,
  resolveManualRequestGlobalsTargets,
  resolveNativeGlobalTargets,
  resolveRequestRuntimeOptions,
} from '../../../../runtime/config/internal/injectRequestGlobals'
import {
  createNativeWebRuntimeModuleMatcher,
  createWebRuntimeNativeGlobalImports,
  createWebRuntimeNativeInject,
} from '../../../../runtime/config/internal/injectRequestGlobals/nativeInject'
import { recordHmrProfileDuration } from '../../../../utils/hmrProfile'
import { normalizeFsResolvedId } from '../../../../utils/resolvedId'
import { REQUEST_GLOBAL_PASSIVE_BINDINGS_MARKER } from '../emit/constants'
import { replaceImportMetaAccess, replaceImportMetaAccessInSfc } from './importMeta'
import {
  createNativeDeleteTargets,
  isNativeDeleteGuardModuleId,
  protectNativeInjectedGlobalDeletes,
} from './nativeDelete'
import { replacePlatformApiAccess } from './platform'
import { resolveInjectWeapiOptions, shouldTransformId } from './shared'
import { observeBundlerSourceInput } from './sourceInput'

function mayContainManualRequestGlobalsInstall(code: string) {
  return code.includes('installRequestGlobals')
    && (
      code.includes('@wevu/web-apis')
      || code.includes('weapp-vite/web-apis')
    )
}

export function createTransformHook(
  state: CorePluginState,
  isNativeWebRuntimeInjectModuleId = createNativeWebRuntimeModuleMatcher(),
) {
  const { configService } = state.ctx
  const astEngine = resolveAstEngine(configService.weappViteConfig)
  const injectOptions = resolveInjectWeapiOptions(configService)
  const injectRequestGlobalsOptions = resolveRequestRuntimeOptions({
    appPrelude: configService.weappViteConfig?.appPrelude,
    webRuntime: configService.weappViteConfig?.injectWebRuntimeGlobals,
    injectRequestGlobals: configService.weappViteConfig?.injectRequestGlobals,
  }, configService.packageJson, message => logger.warn(message))
  const nativeWebRuntimeInject = injectRequestGlobalsOptions?.native === true
    ? createWebRuntimeNativeInject(
        injectRequestGlobalsOptions.targets,
        injectRequestGlobalsOptions.networkDefaults,
      )
    : null
  const usesNativeWebRuntimeInject = () => state.nativeWebRuntimeInjectEnabled === true && Boolean(nativeWebRuntimeInject)

  function resolveRequestGlobalsTransformCode(id: string, code: string) {
    if (usesNativeWebRuntimeInject()) {
      return null
    }

    const requestGlobalsTargets = injectRequestGlobalsOptions?.targets?.length
      ? injectRequestGlobalsOptions.mode === 'auto'
        ? resolveAutoRequestGlobalsTargets(code, injectRequestGlobalsOptions.targets)
        : injectRequestGlobalsOptions.targets
      : resolveManualRequestGlobalsTargets(code)
    if (requestGlobalsTargets.length === 0) {
      return null
    }
    const passiveLocalBindings = !injectRequestGlobalsOptions?.targets?.length
    if (
      code.includes('__weappViteInstallRequestGlobals')
      || code.includes(REQUEST_GLOBAL_PASSIVE_BINDINGS_MARKER)
    ) {
      return null
    }

    const sourceId = normalizeFsResolvedId(id)
    if (!sourceId) {
      return null
    }

    const relativeBasename = removeExtensionDeep(configService.relativeAbsoluteSrcRoot(sourceId))
    const selectedPageSource = getSelectedAutoRouteSource(state.ctx, sourceId)
    const declaredEntryType = !selectedPageSource || selectedPageSource === sourceId
      ? state.entriesMap?.get(relativeBasename)?.type
      : undefined
    const isLoadedEntry = state.loadedEntrySet?.has(sourceId) === true
    const isRootEntry = relativeBasename === 'app'
    if (!isLoadedEntry && declaredEntryType !== 'page' && declaredEntryType !== 'component') {
      return null
    }
    if (isLoadedEntry && isRootEntry) {
      return null
    }

    if (sourceId.endsWith('.vue') && code.includes('<')) {
      return injectRequestGlobalsIntoSfc(code, requestGlobalsTargets as any, {
        localBindings: !passiveLocalBindings,
        networkDefaults: injectRequestGlobalsOptions?.networkDefaults,
        passiveLocalBindings,
      })
    }

    return `${createInjectRequestGlobalsCode(requestGlobalsTargets as any, {
      localBindings: !passiveLocalBindings,
      networkDefaults: injectRequestGlobalsOptions?.networkDefaults,
      passiveLocalBindings,
    })}${code}`
  }

  function resolveNativeGlobalBridgeImports(id: string, code: string) {
    if (!usesNativeWebRuntimeInject() || isNativeWebRuntimeInjectModuleId(id)) {
      return ''
    }
    const plan = state.nativeWebRuntimeInjectPlan
    if (!plan) {
      return ''
    }
    const overrideModuleIds = new Set(Object.values(plan.userInject ?? {}).flatMap((mapping) => {
      return [typeof mapping === 'string' ? mapping : mapping[0]]
    }))
    if (overrideModuleIds.has(id)) {
      return ''
    }
    const targets = resolveNativeGlobalTargets(code, plan.bindingTargets)
    return targets.length > 0 ? `${createWebRuntimeNativeGlobalImports(targets)}\n` : ''
  }

  function mayNeedTransformWork(code: string, nativeGlobalImports = '') {
    const mayNeedRequestGlobals = injectRequestGlobalsOptions
      ? usesNativeWebRuntimeInject()
        // native 不走旧安装路径，只有真实需要全局桥接时才有额外工作。
        ? nativeGlobalImports !== ''
        : injectRequestGlobalsOptions.mode === 'auto'
          ? mayContainRequestGlobalsUsageByText(code, injectRequestGlobalsOptions.targets as any)
          : true
      : false

    return code.includes('import.meta')
      || mayNeedRequestGlobals
      || mayContainManualRequestGlobalsInstall(code)
      || Boolean(injectOptions && mayContainPlatformApiIdentifierByText(code))
  }

  const transform: NonNullable<Plugin['transform']> = async function transform(code, id, options) {
    if (parseSidecarSourceMetadata(id)) {
      return null
    }
    observeBundlerSourceInput(state, code, id)
    const nativePlan = state.nativeWebRuntimeInjectPlan
    const nativeDeleteRewrite = usesNativeWebRuntimeInject()
      && nativePlan
      && isNativeDeleteGuardModuleId(id)
      ? protectNativeInjectedGlobalDeletes(
          code,
          id,
          createNativeDeleteTargets(nativePlan),
          this as unknown as AstParserLike,
          options?.moduleType,
        )
      : null
    const transformInputCode = nativeDeleteRewrite?.code ?? code
    const nativeGlobalImports = resolveNativeGlobalBridgeImports(id, transformInputCode)
    if (!shouldTransformId(id, {
      absoluteSrcRoot: configService.absoluteSrcRoot,
      isEntry: sourceId => state.loadedEntrySet?.has(sourceId) === true
        || state.resolvedEntryMap?.has(sourceId) === true,
    })) {
      if (nativeGlobalImports) {
        return { code: `${nativeGlobalImports}${transformInputCode}`, map: nativeDeleteRewrite?.map ?? null }
      }
      return nativeDeleteRewrite
    }
    if (!mayNeedTransformWork(transformInputCode, nativeGlobalImports)) {
      return nativeDeleteRewrite
    }
    const startedAt = performance.now()

    try {
      const sourceId = normalizeFsResolvedId(id)
      const relativeOutputPath = sourceId
        ? (
            configService.relativeOutputPath?.(sourceId)
            ?? configService.relativeAbsoluteSrcRoot?.(sourceId)
          )
        : undefined
      const importMetaTransformOptions = relativeOutputPath
        ? {
            importMetaDefineRegistry: configService.importMetaDefineRegistry,
            extension: 'js',
            relativePath: relativeOutputPath,
          }
        : undefined
      const importMetaCode = importMetaTransformOptions
        ? (
            sourceId?.endsWith('.vue')
              ? replaceImportMetaAccessInSfc(transformInputCode, importMetaTransformOptions)
              : replaceImportMetaAccess(transformInputCode, importMetaTransformOptions)
          )
        : transformInputCode
      const nextCode = `${nativeGlobalImports}${resolveRequestGlobalsTransformCode(id, importMetaCode) ?? importMetaCode}`

      if (!injectOptions) {
        return nextCode === transformInputCode
          ? nativeDeleteRewrite
          : {
              code: nextCode,
              map: nativeDeleteRewrite?.map ?? null,
            }
      }

      const replaced = replacePlatformApiAccess(nextCode, injectOptions.globalName, {
        engine: astEngine,
        parserLike: this as unknown as AstParserLike,
      })
      if (replaced === transformInputCode) {
        return nativeDeleteRewrite
      }

      return {
        code: replaced,
        map: null,
      }
    }
    finally {
      const durationMs = performance.now() - startedAt
      recordHmrProfileDuration(state.ctx.runtimeState?.build?.hmr?.profile, 'transformMs', durationMs)
      recordHmrProfileDuration(state.ctx.runtimeState?.build?.hmr?.profile, 'coreTransformMs', durationMs)
    }
  }

  return transform
}
