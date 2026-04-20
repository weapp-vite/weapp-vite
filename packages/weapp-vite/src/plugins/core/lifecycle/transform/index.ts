import type { Plugin } from 'vite'
import type { AstParserLike } from '../../../../ast'
import type { CorePluginState } from '../../helpers'
import { removeExtensionDeep } from '@weapp-core/shared'
import { resolveAstEngine } from '../../../../ast'
import logger from '../../../../logger'
import {
  createInjectRequestGlobalsCode,
  injectRequestGlobalsIntoSfc,
  resolveAutoRequestGlobalsTargets,
  resolveManualRequestGlobalsTargets,
  resolveRequestRuntimeOptions,
} from '../../../../runtime/config/internal/injectRequestGlobals'
import { normalizeFsResolvedId } from '../../../../utils/resolvedId'
import { REQUEST_GLOBAL_PASSIVE_BINDINGS_MARKER } from '../emit/constants'
import { replaceImportMetaAccess, replaceImportMetaAccessInSfc } from './importMeta'
import { replacePlatformApiAccess } from './platform'
import { resolveInjectWeapiOptions, shouldTransformId } from './shared'

export function createTransformHook(state: CorePluginState) {
  const { configService } = state.ctx
  const astEngine = resolveAstEngine(configService.weappViteConfig)
  const injectRequestGlobalsOptions = resolveRequestRuntimeOptions({
    appPrelude: configService.weappViteConfig?.appPrelude,
    webRuntime: configService.weappViteConfig?.injectWebRuntimeGlobals,
    injectRequestGlobals: configService.weappViteConfig?.injectRequestGlobals,
  }, configService.packageJson, message => logger.warn(message))

  function resolveRequestGlobalsTransformCode(id: string, code: string) {
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
    const declaredEntryType = state.entriesMap?.get(relativeBasename)?.type
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

  const transform: NonNullable<Plugin['transform']> = async function transform(code, id) {
    const injectOptions = resolveInjectWeapiOptions(configService)
    if (!shouldTransformId(id, configService.absoluteSrcRoot)) {
      return null
    }

    const sourceId = normalizeFsResolvedId(id)
    const relativeOutputPath = sourceId
      ? (
          configService.relativeOutputPath?.(sourceId)
          ?? configService.relativeAbsoluteSrcRoot?.(sourceId)
        )
      : undefined
    const importMetaTransformOptions = relativeOutputPath
      ? {
          defineImportMetaEnv: configService.defineImportMetaEnv,
          extension: 'js',
          relativePath: relativeOutputPath,
        }
      : undefined
    const importMetaCode = importMetaTransformOptions
      ? (
          sourceId?.endsWith('.vue')
            ? replaceImportMetaAccessInSfc(code, importMetaTransformOptions)
            : replaceImportMetaAccess(code, importMetaTransformOptions)
        )
      : code
    const nextCode = resolveRequestGlobalsTransformCode(id, importMetaCode) ?? importMetaCode

    if (!injectOptions) {
      return nextCode === code
        ? null
        : {
            code: nextCode,
            map: null,
          }
    }

    const replaced = replacePlatformApiAccess(nextCode, injectOptions.globalName, {
      engine: astEngine,
      parserLike: this as unknown as AstParserLike,
    })
    if (replaced === code) {
      return null
    }

    return {
      code: replaced,
      map: null,
    }
  }

  return transform
}
