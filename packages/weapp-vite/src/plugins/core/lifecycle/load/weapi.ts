import { getMiniProgramRuntimeGlobalKeys, removeExtensionDeep } from '@weapp-core/shared'
import { createMiniProgramTopLevelResolveExpression, getMiniProgramGlobalKeys } from '../../../../utils/miniProgramGlobals'
import { createWeapiHostCandidatesExpression } from '../../../../utils/weapi'
import { rewriteMiniProgramPlatformApiAccess } from '../platformApiRewrite'

export interface InjectWeapiOptions {
  globalName: string
  replaceWx: boolean
}

export function resolveInjectWeapiOptions(configService: {
  weappViteConfig?: {
    injectWeapi?: boolean | {
      enabled?: boolean
      globalName?: string
      replaceWx?: boolean
    }
  }
}) {
  const injectWeapi = configService.weappViteConfig?.injectWeapi
  if (!injectWeapi) {
    return null
  }
  const enabled = typeof injectWeapi === 'object'
    ? injectWeapi.enabled === true
    : injectWeapi === true
  if (!enabled) {
    return null
  }
  const globalName = typeof injectWeapi === 'object' && injectWeapi.globalName
    ? injectWeapi.globalName
    : 'wpi'
  const replaceWx = typeof injectWeapi === 'object'
    ? injectWeapi.replaceWx === true
    : false
  return {
    globalName,
    replaceWx,
  }
}

export function createWeapiInjectionCode(options: {
  globalName: string
  replaceWx: boolean
  platform: string
}) {
  const globalKey = JSON.stringify(options.globalName)
  const platform = JSON.stringify(options.platform)
  const hostCandidatesExpression = createWeapiHostCandidatesExpression()
  const nativeApiResolveExpression = [
    `(${getMiniProgramGlobalKeys().map(globalKey => `__weappResolveRootGlobal(${JSON.stringify(globalKey)})`).join(' ?? ')}`,
    ` ?? ${createMiniProgramTopLevelResolveExpression()})`,
  ].join('')
  const nativeApiFallbackExpression = [
    `(${getMiniProgramGlobalKeys().map(globalKey => `__weappResolveGlobal(${JSON.stringify(globalKey)})`).join(' ?? ')}`,
    ` ?? ${createMiniProgramTopLevelResolveExpression()})`,
  ].join('')
  const replaceLines = options.replaceWx
    ? [
        `    for (const __weappGlobal of __weappGlobals) {`,
        ...getMiniProgramRuntimeGlobalKeys().map(globalKey => `      __weappGlobal.${globalKey} = __weappInstance`),
        `      if (__weappPlatformKey) {`,
        `        __weappGlobal[__weappPlatformKey] = __weappInstance`,
        `      }`,
        `    }`,
      ]
    : []
  return [
    `import { wpi as __weappWpi } from '@wevu/api'`,
    `const __weappRootGlobals = ${hostCandidatesExpression}`,
    `const __weappResolveRootGlobal = key => __weappRootGlobals.map(item => item && item[key]).find(Boolean)`,
    `const __weappNativeApi = ${nativeApiResolveExpression}`,
    `const __weappGlobals = __weappRootGlobals.length ? __weappRootGlobals : [__weappNativeApi].filter(Boolean)`,
    `const __weappGlobal = __weappGlobals[0] || {}`,
    `const __weappResolveGlobal = key => __weappGlobals.map(item => item && item[key]).find(Boolean)`,
    `const __weappPlatformKey = ${platform}`,
    `if (__weappGlobal) {`,
    `  const __weappExistingWpi = __weappResolveGlobal(${globalKey})`,
    `  const __weappInstance = __weappExistingWpi || __weappWpi`,
    `  if (!__weappExistingWpi) {`,
    `    const __weappRawApi = (__weappPlatformKey ? __weappResolveGlobal(__weappPlatformKey) : undefined) ?? ${nativeApiFallbackExpression}`,
    `    if (__weappRawApi && __weappRawApi !== __weappWpi) {`,
    `      __weappWpi.setAdapter(__weappRawApi, __weappPlatformKey)`,
    `    }`,
    `    __weappGlobal[${globalKey}] = __weappWpi`,
    `  }`,
    ...replaceLines,
    `}`,
    '',
  ].join('\n')
}

function replacePlatformApiAccess(
  code: string,
  globalName: string,
  options?: {
    engine?: 'babel' | 'oxc'
    parserLike?: { parse?: (input: string, options?: unknown) => unknown }
  },
) {
  return rewriteMiniProgramPlatformApiAccess(code, globalName, options)
}

export function replacePlatformApiInLoadResult(
  result: any,
  options: InjectWeapiOptions,
  astEngine: 'babel' | 'oxc',
  parserLike?: { parse?: (input: string, options?: unknown) => unknown },
) {
  if (!options.replaceWx) {
    return result
  }
  if (!result || typeof result !== 'object' || !('code' in result) || typeof result.code !== 'string') {
    return result
  }
  const replacedCode = replacePlatformApiAccess(result.code, options.globalName, {
    engine: astEngine,
    parserLike,
  })
  if (replacedCode === result.code) {
    return result
  }
  return {
    ...result,
    code: replacedCode,
  }
}

export function resolveRootEntryBasename(state: {
  ctx: {
    scanService?: {
      pluginJson?: {
        main?: string
      }
    }
    configService: {
      pluginOnly?: boolean
    }
  }
}) {
  if (!state.ctx.configService.pluginOnly) {
    return 'app'
  }
  const pluginMain = typeof state.ctx.scanService?.pluginJson?.main === 'string'
    ? state.ctx.scanService.pluginJson.main.trim()
    : ''
  return pluginMain ? removeExtensionDeep(pluginMain) : 'app'
}
