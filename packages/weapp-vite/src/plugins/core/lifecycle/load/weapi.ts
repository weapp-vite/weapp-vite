import { WEAPP_VITE_INJECTED_API_IDENTIFIER } from '@weapp-core/constants'
import { removeExtensionDeep } from '@weapp-core/shared'
import { mayContainPlatformApiAccess, platformApiIdentifiers } from '../../../../ast'
import { generate, parseJsLike, traverse } from '../../../../utils/babel'
import { createMiniProgramHostOrTopLevelResolveExpression } from '../../../../utils/miniProgramGlobals'
import { createWeapiAccessExpression, createWeapiHostExpression } from '../../../../utils/weapi'

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
  const hostExpression = createWeapiHostExpression()
  const nativeApiFallbackExpression = createMiniProgramHostOrTopLevelResolveExpression({
    hostExpression: '__weappGlobal',
  })
  const replaceLines = options.replaceWx
    ? [
        `  __weappGlobal.wx = __weappInstance`,
        `  __weappGlobal.my = __weappInstance`,
        `  if (__weappPlatformKey) {`,
        `    __weappGlobal[__weappPlatformKey] = __weappInstance`,
        `  }`,
      ]
    : []
  return [
    `import { wpi as __weappWpi } from '@wevu/api'`,
    `const __weappGlobal = ${hostExpression}`,
    `const __weappPlatformKey = ${platform}`,
    `if (__weappGlobal) {`,
    `  const __weappExistingWpi = __weappGlobal[${globalKey}]`,
    `  const __weappInstance = __weappExistingWpi || __weappWpi`,
    `  if (!__weappExistingWpi) {`,
    `    const __weappRawApi = (__weappPlatformKey ? __weappGlobal[__weappPlatformKey] : undefined) ?? ${nativeApiFallbackExpression}`,
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
  const injectedApiIdentifier = WEAPP_VITE_INJECTED_API_IDENTIFIER

  if (!mayContainPlatformApiAccess(code, options)) {
    return code
  }

  try {
    const ast = parseJsLike(code)
    let mutated = false

    const rewritePath = (path: any) => {
      const object = path.node?.object
      if (!object || object.type !== 'Identifier') {
        return
      }
      const identifierName = object.name
      if (!platformApiIdentifiers.has(identifierName)) {
        return
      }
      if (path.scope?.hasBinding?.(identifierName)) {
        return
      }
      path.node.object = {
        type: 'Identifier',
        name: injectedApiIdentifier,
      }
      mutated = true
    }

    traverse(ast as any, {
      MemberExpression: rewritePath,
      OptionalMemberExpression: rewritePath,
    })

    if (!mutated) {
      return code
    }

    const transformedCode = generate(ast as any).code
    const aliasCode = `var ${injectedApiIdentifier} = ${createWeapiAccessExpression(globalName)};`
    return `${aliasCode}\n${transformedCode}`
  }
  catch {
    return code
  }
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
