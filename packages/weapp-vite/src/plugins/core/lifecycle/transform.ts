import type { Plugin } from 'vite'
import type { AstParserLike } from '../../../ast'
import type { CorePluginState } from '../helpers'
import { removeExtensionDeep } from '@weapp-core/shared'
import { mayContainPlatformApiAccess, platformApiIdentifiers, resolveAstEngine } from '../../../ast'
import {
  createInjectRequestGlobalsCode,
  injectRequestGlobalsIntoSfc,
  resolveInjectRequestGlobalsOptions,
  resolveManualRequestGlobalsTargets,
} from '../../../runtime/config/internal/injectRequestGlobals'
import { isCSSRequest } from '../../../utils'
import { generate, parseJsLike, traverse } from '../../../utils/babel'
import { normalizeFsResolvedId } from '../../../utils/resolvedId'
import { createWeapiAccessExpression } from '../../../utils/weapi'
import { parseRequest } from '../../utils/parse'

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
  if (isCSSRequest(id)) {
    return false
  }

  const parsed = parseRequest(id)
  if (parsed.query.type === 'style') {
    return false
  }

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
    parserLike?: AstParserLike
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
  const injectRequestGlobalsOptions = resolveInjectRequestGlobalsOptions(
    configService.weappViteConfig?.injectRequestGlobals,
    configService.packageJson,
  )

  function resolveRequestGlobalsTransformCode(id: string, code: string) {
    const requestGlobalsTargets = injectRequestGlobalsOptions?.targets?.length
      ? injectRequestGlobalsOptions.targets
      : resolveManualRequestGlobalsTargets(code)
    if (requestGlobalsTargets.length === 0) {
      return null
    }
    const passiveLocalBindings = !injectRequestGlobalsOptions?.targets?.length
    if (
      code.includes('__weappViteInstallRequestGlobals')
      || code.includes('__weappViteRequestGlobalsPassiveBindings__')
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
        passiveLocalBindings,
      })
    }

    return `${createInjectRequestGlobalsCode(requestGlobalsTargets as any, {
      localBindings: !passiveLocalBindings,
      passiveLocalBindings,
    })}${code}`
  }

  const transform: NonNullable<Plugin['transform']> = async function transform(code, id) {
    const injectOptions = resolveInjectWeapiOptions(configService)
    if (!shouldTransformId(id, configService.absoluteSrcRoot)) {
      return null
    }

    const nextCode = resolveRequestGlobalsTransformCode(id, code) ?? code

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
