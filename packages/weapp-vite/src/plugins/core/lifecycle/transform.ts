import type { CorePluginState } from '../helpers'
import { resolveAstEngine } from '../../../ast'
import { mayContainPlatformApiAccess, platformApiIdentifiers } from '../../../ast/operations/platformApi'
import { generate, parseJsLike, traverse } from '../../../utils/babel'
import { normalizeFsResolvedId } from '../../../utils/resolvedId'
import { createWeapiAccessExpression } from '../../../utils/weapi'

const injectedApiIdentifier = '__weappViteInjectedApi__'

function resolveInjectWeapiOptions(configService: CorePluginState['ctx']['configService']) {
  const injectWeapi = configService.weappViteConfig?.injectWeapi
  if (!injectWeapi) {
    return null
  }

  const enabled = typeof injectWeapi === 'object'
    ? injectWeapi.enabled === true
    : injectWeapi === true

  if (!enabled || typeof injectWeapi !== 'object' || injectWeapi.replaceWx !== true) {
    return null
  }

  return {
    globalName: injectWeapi.globalName?.trim() || 'wpi',
  }
}

function shouldTransformId(id: string, absoluteSrcRoot: string) {
  const sourceId = normalizeFsResolvedId(id)
  if (!sourceId || sourceId.includes('/node_modules/')) {
    return false
  }
  if (sourceId === absoluteSrcRoot) {
    return true
  }
  return sourceId.startsWith(`${absoluteSrcRoot}/`)
}

function replacePlatformApiAccess(
  code: string,
  globalName: string,
  options?: {
    engine?: 'babel' | 'oxc'
    parserLike?: { parse?: (input: string, options?: unknown) => unknown }
  },
) {
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

export function createTransformHook(state: CorePluginState) {
  const { configService } = state.ctx
  const astEngine = resolveAstEngine(configService.weappViteConfig)

  return async function transform(this: { parse?: (input: string, options?: unknown) => unknown }, code: string, id: string) {
    const injectOptions = resolveInjectWeapiOptions(configService)
    if (!injectOptions) {
      return null
    }

    if (!shouldTransformId(id, configService.absoluteSrcRoot)) {
      return null
    }

    const replaced = replacePlatformApiAccess(code, injectOptions.globalName, {
      engine: astEngine,
      parserLike: this,
    })
    if (replaced === code) {
      return null
    }

    return {
      code: replaced,
      map: null,
    }
  }
}
