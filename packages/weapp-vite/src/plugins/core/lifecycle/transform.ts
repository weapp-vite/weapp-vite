import type { Plugin } from 'vite'
import type { AstParserLike } from '../../../ast'
import type { CorePluginState } from '../helpers'
import * as t from '@babel/types'
import { removeExtensionDeep } from '@weapp-core/shared'
import MagicString from 'magic-string'
import { parse as parseSfc } from 'vue/compiler-sfc'
import { mayContainPlatformApiAccess, platformApiIdentifiers, resolveAstEngine } from '../../../ast'
import {
  createInjectRequestGlobalsCode,
  injectRequestGlobalsIntoSfc,
  resolveInjectRequestGlobalsOptions,
  resolveManualRequestGlobalsTargets,
} from '../../../runtime/config/internal/injectRequestGlobals'
import { isCSSRequest } from '../../../utils'
import { generate, parseJsLike, traverse } from '../../../utils/babel'
import { createStaticImportMetaValues } from '../../../utils/importMeta'
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

function isImportMetaNode(node: any) {
  return node?.type === 'MetaProperty'
    && node.meta?.type === 'Identifier'
    && node.meta.name === 'import'
    && node.property?.type === 'Identifier'
    && node.property.name === 'meta'
}

function isImportMetaMemberAccess(node: any, propertyName: string) {
  if (!node || (node.type !== 'MemberExpression' && node.type !== 'OptionalMemberExpression')) {
    return false
  }

  if (!isImportMetaNode(node.object)) {
    return false
  }

  if (!node.computed) {
    return node.property?.type === 'Identifier' && node.property.name === propertyName
  }

  return node.property?.type === 'StringLiteral' && node.property.value === propertyName
}

function getImportMetaEnvPropertyName(node: any) {
  if (!node || (node.type !== 'MemberExpression' && node.type !== 'OptionalMemberExpression')) {
    return undefined
  }
  if (!isImportMetaMemberAccess(node.object, 'env')) {
    return undefined
  }

  if (!node.computed && node.property?.type === 'Identifier') {
    return node.property.name
  }
  if (node.property?.type === 'StringLiteral') {
    return node.property.value
  }
  return undefined
}

function replaceImportMetaAccess(code: string, options: {
  defineImportMetaEnv?: Record<string, any>
  extension: string
  relativePath: string
}) {
  if (!code.includes('import.meta')) {
    return code
  }

  const values = createStaticImportMetaValues(options)
  const ast = parseJsLike(code)
  let mutated = false
  const importMetaObjectNode = t.objectExpression([
    t.objectProperty(t.identifier('url'), t.stringLiteral(values.url)),
    t.objectProperty(t.identifier('dirname'), t.stringLiteral(values.dirname)),
    t.objectProperty(t.identifier('env'), t.valueToNode(values.env)),
  ])

  traverse(ast as any, {
    MemberExpression(path: any) {
      const envPropertyName = getImportMetaEnvPropertyName(path.node)
      if (envPropertyName) {
        const envValue = Object.hasOwn(values.env, envPropertyName)
          ? values.env[envPropertyName]
          : undefined
        path.replaceWith(t.valueToNode(envValue))
        mutated = true
        return
      }

      if (isImportMetaMemberAccess(path.node, 'env')) {
        path.replaceWith(t.valueToNode(values.env))
        mutated = true
        return
      }

      if (isImportMetaMemberAccess(path.node, 'url')) {
        path.replaceWith(t.stringLiteral(values.url))
        mutated = true
        return
      }

      if (isImportMetaMemberAccess(path.node, 'dirname')) {
        path.replaceWith(t.stringLiteral(values.dirname))
        mutated = true
      }
    },
    OptionalMemberExpression(path: any) {
      const envPropertyName = getImportMetaEnvPropertyName(path.node)
      if (envPropertyName) {
        const envValue = Object.hasOwn(values.env, envPropertyName)
          ? values.env[envPropertyName]
          : undefined
        path.replaceWith(t.valueToNode(envValue))
        mutated = true
        return
      }

      if (isImportMetaMemberAccess(path.node, 'env')) {
        path.replaceWith(t.valueToNode(values.env))
        mutated = true
        return
      }

      if (isImportMetaMemberAccess(path.node, 'url')) {
        path.replaceWith(t.stringLiteral(values.url))
        mutated = true
        return
      }

      if (isImportMetaMemberAccess(path.node, 'dirname')) {
        path.replaceWith(t.stringLiteral(values.dirname))
        mutated = true
      }
    },
    MetaProperty(path: any) {
      const parent = path.parent
      if (
        (parent?.type === 'MemberExpression' || parent?.type === 'OptionalMemberExpression')
        && parent.object === path.node
      ) {
        return
      }
      if (!isImportMetaNode(path.node)) {
        return
      }

      path.replaceWith(t.cloneNode(importMetaObjectNode, true))
      mutated = true
    },
  })

  if (!mutated) {
    return code
  }

  return generate(ast as any).code
}

function replaceImportMetaAccessInSfc(source: string, options: {
  defineImportMetaEnv?: Record<string, any>
  extension: string
  relativePath: string
}) {
  if (!source.includes('import.meta')) {
    return source
  }

  const { descriptor, errors } = parseSfc(source, {
    filename: 'import-meta.vue',
    ignoreEmpty: false,
  })

  if (errors.length > 0) {
    return source
  }

  const blocks = [descriptor.script, descriptor.scriptSetup].filter(block => block && !block.src)
  if (blocks.length === 0) {
    return source
  }

  const ms = new MagicString(source)
  let mutated = false
  for (const block of blocks) {
    const nextContent = replaceImportMetaAccess(block.content, options)
    if (nextContent === block.content) {
      continue
    }
    ms.update(block.loc.start.offset, block.loc.end.offset, nextContent)
    mutated = true
  }

  return mutated ? ms.toString() : source
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
