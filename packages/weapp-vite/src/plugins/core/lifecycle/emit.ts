import type { OutputBundle, OutputChunk } from 'rolldown'
import type { RuntimeChunkDuplicatePayload, SharedChunkDuplicatePayload } from '../../../runtime/chunkStrategy'
import type { MpPlatform, SubPackageMetaValue, WeappInjectRequestGlobalsTarget } from '../../../types'
import type { WxmlEmitRuntime } from '../../utils/wxmlEmit'
import type { CorePluginState } from '../helpers'
import path from 'pathe'
import { mayContainPlatformApiAccess, mayContainStaticRequireLiteral, resolveAstEngine } from '../../../ast'
import logger from '../../../logger'
import {
  shouldRewriteBundleNpmImports,
} from '../../../platform'
import { applyRuntimeChunkLocalization, applySharedChunkStrategy, DEFAULT_SHARED_CHUNK_STRATEGY } from '../../../runtime/chunkStrategy'
import {
  createRequestGlobalsPassiveBindingsCode,
  FULL_REQUEST_GLOBAL_TARGETS,
  resolveInjectRequestGlobalsOptions,
  resolveRequestGlobalsBindingTargets,
} from '../../../runtime/config/internal/injectRequestGlobals'
import { toPosixPath } from '../../../utils'
import { generate, parseJsLike, traverse } from '../../../utils/babel'
import {
  hasNpmDependencyPrefix,
  normalizeNpmImportLookupPath,
  normalizeNpmImportPathByPlatform,
  resolveNpmDependencyId,
} from '../../../utils/npmImport'
import { normalizeWatchPath } from '../../../utils/path'
import { createWeapiAccessExpression } from '../../../utils/weapi'
import { emitWxmlAssetsWithCache } from '../../utils/wxmlEmit'
import {
  emitJsonAssets,
  filterPluginBundleOutputs,
  flushIndependentBuilds,
  formatBytes,
  refreshModuleGraph,
  refreshPartialSharedChunkImporters,
  refreshSharedChunkImporters,
  removeImplicitPagePreloads,
} from '../helpers'

const platformApiIdentifiers = new Set(['wx', 'my', 'tt', 'swan', 'jd', 'xhs'])
const NPM_PROTOCOL_RE = /^npm:/
const ABSOLUTE_NPM_PREFIX_RE = /^\/(?:miniprogram_npm|node_modules)\//
const PRETTY_NODE_MODULES_RE = /node_modules\/(?:\.pnpm\/[^/]+\/node_modules\/)?(.+)/
const REQUEST_GLOBAL_EXPORT_RE = /Object\.defineProperty\(exports,\s*(?:`([^`]+)`|'([^']+)'|"([^"]+)"),\s*\{[\s\S]*?get:function\(\)\{return ([A-Za-z_$][\w$]*)\}\}\)/g
const REQUEST_GLOBAL_INSTALLER_RE = /function\s+([A-Za-z_$][\w$]*)\([^)]*=\{\}\)\{[\s\S]{0,220}?targets\?\?\[[\s\S]{0,80}?fetch[\s\S]{0,80}?Headers[\s\S]{0,80}?Request[\s\S]{0,80}?Response[\s\S]{0,80}?AbortController[\s\S]{0,80}?AbortSignal[\s\S]{0,80}?XMLHttpRequest[\s\S]{0,80}?WebSocket[\s\S]{0,260}?return [^}]+\}/
const REQUEST_GLOBAL_ENTRY_NAME_RE = /\.[^/.]+$/
const REQUEST_GLOBAL_REQUIRE_DECLARATOR_RE = /([A-Za-z_$][\w$]*)\s*=\s*require\((`([^`]+)`|'([^']+)'|"([^"]+)")\)/g
const DYNAMIC_GLOBAL_RESOLUTION_RE = /Function\(\s*(?:`return this`|'return this'|"return this")\s*\)\(\)/g
const BROWSER_GLOBAL_HOST_TERNARY_RE = /typeof self<[`'"]u[`'"]\?self:typeof window<[`'"]u[`'"]\?window:globalThis/g

function resolveInjectWeapiGlobalName(state: CorePluginState) {
  const injectWeapi = state.ctx.configService.weappViteConfig?.injectWeapi
  if (!injectWeapi) {
    return null
  }
  const enabled = typeof injectWeapi === 'object'
    ? injectWeapi.enabled === true
    : injectWeapi === true
  if (!enabled || typeof injectWeapi !== 'object' || injectWeapi.replaceWx !== true) {
    return null
  }
  return injectWeapi.globalName?.trim() || 'wpi'
}

function replacePlatformApiAccess(
  code: string,
  globalName: string,
  options?: {
    astEngine?: 'babel' | 'oxc'
  },
) {
  const injectedApiIdentifier = '__weappViteInjectedApi__'

  if (!mayContainPlatformApiAccess(code, { engine: options?.astEngine })) {
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

function normalizeNpmImportByPlatform(
  platform: MpPlatform | undefined,
  importee: string,
  dependencies: Record<string, string> | undefined,
  mode?: string,
) {
  return normalizeNpmImportPathByPlatform(importee, {
    platform,
    dependencies,
    alipayNpmMode: mode,
  })
}

function rewriteChunkNpmImportsByPlatform(
  platform: MpPlatform | undefined,
  code: string,
  dependencies: Record<string, string> | undefined,
  mode?: string,
  options?: {
    astEngine?: 'babel' | 'oxc'
  },
) {
  if (!mayContainStaticRequireLiteral(code, { engine: options?.astEngine })) {
    return code
  }

  try {
    const ast = parseJsLike(code)
    let mutated = false

    traverse(ast as any, {
      CallExpression(path: any) {
        const callee = path.node?.callee
        if (!callee || callee.type !== 'Identifier' || callee.name !== 'require') {
          return
        }
        if (path.scope?.hasBinding?.('require')) {
          return
        }

        const args = path.node.arguments
        if (!Array.isArray(args) || args.length === 0) {
          return
        }

        const firstArg = args[0]
        if (!firstArg) {
          return
        }

        const isStringLiteral = firstArg.type === 'StringLiteral' || firstArg.type === 'Literal'
        const isStaticTemplateLiteral = firstArg.type === 'TemplateLiteral'
          && Array.isArray(firstArg.expressions)
          && firstArg.expressions.length === 0
          && Array.isArray(firstArg.quasis)
          && firstArg.quasis.length === 1

        if (!isStringLiteral && !isStaticTemplateLiteral) {
          return
        }

        const currentValue = isStringLiteral
          ? firstArg.value
          : firstArg.quasis[0]?.value?.cooked ?? firstArg.quasis[0]?.value?.raw

        if (typeof currentValue !== 'string') {
          return
        }

        const nextValue = normalizeNpmImportByPlatform(platform, currentValue, dependencies, mode)
        if (nextValue === currentValue) {
          return
        }

        if (isStringLiteral) {
          firstArg.value = nextValue
        }
        else {
          firstArg.quasis[0].value.cooked = nextValue
          firstArg.quasis[0].value.raw = nextValue
        }

        mutated = true
      },
    })

    if (!mutated) {
      return code
    }

    return generate(ast as any).code
  }
  catch {
    return code
  }
}

function rewriteBundleNpmImportsByPlatform(
  platform: MpPlatform | undefined,
  bundle: OutputBundle,
  dependencies: Record<string, string> | undefined,
  mode?: string,
  options?: {
    astEngine?: 'babel' | 'oxc'
  },
) {
  for (const output of Object.values(bundle)) {
    if (output?.type !== 'chunk') {
      continue
    }

    const chunk = output as OutputChunk
    const nextCode = rewriteChunkNpmImportsByPlatform(platform, chunk.code, dependencies, mode, options)
    if (nextCode === chunk.code) {
      continue
    }
    chunk.code = nextCode
  }
}

function rewriteBundlePlatformApi(
  bundle: OutputBundle,
  globalName: string,
  options?: {
    astEngine?: 'babel' | 'oxc'
  },
) {
  for (const output of Object.values(bundle)) {
    if (output?.type !== 'chunk') {
      continue
    }

    const chunk = output as OutputChunk
    const nextCode = replacePlatformApiAccess(chunk.code, globalName, options)
    if (nextCode === chunk.code) {
      continue
    }
    chunk.code = nextCode
  }
}

function rewriteBundleDynamicGlobalResolution(bundle: OutputBundle) {
  for (const output of Object.values(bundle)) {
    if (output?.type !== 'chunk') {
      continue
    }

    const chunk = output as OutputChunk
    const hasDynamicGlobalResolution = DYNAMIC_GLOBAL_RESOLUTION_RE.test(chunk.code)
    DYNAMIC_GLOBAL_RESOLUTION_RE.lastIndex = 0
    const hasBrowserGlobalHostTernary = BROWSER_GLOBAL_HOST_TERNARY_RE.test(chunk.code)
    BROWSER_GLOBAL_HOST_TERNARY_RE.lastIndex = 0

    if (!hasDynamicGlobalResolution && !hasBrowserGlobalHostTernary) {
      continue
    }

    chunk.code = chunk.code
      .replaceAll(DYNAMIC_GLOBAL_RESOLUTION_RE, 'globalThis')
      .replaceAll(BROWSER_GLOBAL_HOST_TERNARY_RE, 'globalThis')
  }
}

function matchesSubPackageDependency(dependencies: (string | RegExp)[] | undefined, importee: string, fallbackDependencies?: Record<string, string>) {
  const normalized = normalizeNpmImportLookupPath(importee)
  if (Array.isArray(dependencies) && dependencies.length > 0) {
    const dependencyId = resolveNpmDependencyId(normalized)
    return dependencies.some((pattern) => {
      if (typeof pattern === 'string') {
        return dependencyId === pattern || normalized === pattern || normalized.startsWith(`${pattern}/`)
      }

      pattern.lastIndex = 0
      if (pattern.test(dependencyId)) {
        return true
      }

      pattern.lastIndex = 0
      return pattern.test(normalized)
    })
  }

  return hasNpmDependencyPrefix(fallbackDependencies, normalized)
}

function normalizeWeappLocalNpmImport(importee: string) {
  const normalized = importee.replace(NPM_PROTOCOL_RE, '').replace(ABSOLUTE_NPM_PREFIX_RE, '')
  const segments = normalized.split('/').filter(Boolean)
  if (segments.length === 1 || (segments.length === 2 && normalized.startsWith('@'))) {
    return `${normalized}/index`
  }
  return normalized
}

function getRequireImportLiteral(node: any) {
  if (!node) {
    return null
  }

  if (node.type === 'StringLiteral' || node.type === 'Literal') {
    return typeof node.value === 'string' ? node.value : null
  }

  if (node.type === 'TemplateLiteral' && node.expressions?.length === 0 && node.quasis?.length === 1) {
    return node.quasis[0]?.value?.cooked ?? null
  }

  return null
}

function getStaticStringLiteral(node: any) {
  return getRequireImportLiteral(node)
}

function setRequireImportLiteral(node: any, nextValue: string) {
  if (!node) {
    return
  }

  if (node.type === 'StringLiteral' || node.type === 'Literal') {
    node.value = nextValue
    return
  }

  if (node.type === 'TemplateLiteral' && node.expressions?.length === 0 && node.quasis?.length === 1) {
    node.quasis[0].value.raw = nextValue
    node.quasis[0].value.cooked = nextValue
  }
}

function resolveRequestGlobalsInstallerName(code: string) {
  const installerMatch = code.match(REQUEST_GLOBAL_INSTALLER_RE)
  if (installerMatch?.[1]) {
    return installerMatch[1]
  }

  try {
    const ast = parseJsLike(code)
    let installerName: string | null = null

    const isInstallerFunctionNode = (node: any) => {
      if (!node) {
        return false
      }
      const functionCode = generate(node).code
      return FULL_REQUEST_GLOBAL_TARGETS.every((target) => {
        return functionCode.includes(target)
      })
    }

    traverse(ast as any, {
      FunctionDeclaration(path: any) {
        if (installerName || !path.node?.id?.name) {
          return
        }
        if (isInstallerFunctionNode(path.node.body)) {
          installerName = path.node.id.name
        }
      },
      VariableDeclarator(path: any) {
        if (installerName || path.node?.id?.type !== 'Identifier') {
          return
        }
        const init = path.node.init
        if (!init || (init.type !== 'FunctionExpression' && init.type !== 'ArrowFunctionExpression')) {
          return
        }
        if (isInstallerFunctionNode(init.body)) {
          installerName = path.node.id.name
        }
      },
    })

    return installerName
  }
  catch {
    return null
  }
}

function resolveRequestGlobalsExportName(code: string) {
  const installerName = resolveRequestGlobalsInstallerName(code)
  if (!installerName) {
    return null
  }

  for (const match of code.matchAll(REQUEST_GLOBAL_EXPORT_RE)) {
    const candidateExportName = match[1] ?? match[2] ?? match[3]
    const returnedIdentifier = match[4]
    if (candidateExportName && returnedIdentifier === installerName) {
      return candidateExportName
    }
  }

  try {
    const ast = parseJsLike(code)
    let exportName: string | null = null

    traverse(ast as any, {
      CallExpression(path: any) {
        if (exportName) {
          return
        }

        const callee = path.node?.callee
        if (
          !callee
          || callee.type !== 'MemberExpression'
          || callee.object?.type !== 'Identifier'
          || callee.object.name !== 'Object'
          || callee.property?.type !== 'Identifier'
          || callee.property.name !== 'defineProperty'
        ) {
          return
        }

        const args = path.node.arguments
        if (!Array.isArray(args) || args.length < 3) {
          return
        }

        if (args[0]?.type !== 'Identifier' || args[0].name !== 'exports') {
          return
        }

        const candidateExportName = getStaticStringLiteral(args[1])
        if (!candidateExportName || args[2]?.type !== 'ObjectExpression') {
          return
        }

        const getterProperty = args[2].properties.find((property: any) => {
          return (
            (
              property?.type === 'ObjectProperty'
              && property.key?.type === 'Identifier'
              && property.key.name === 'get'
            )
            || (
              property?.type === 'ObjectMethod'
              && property.key?.type === 'Identifier'
              && property.key.name === 'get'
            )
          )
        })

        const getterValue = getterProperty?.type === 'ObjectMethod' ? getterProperty : getterProperty?.value
        if (!getterValue) {
          return
        }

        const getterBody = getterValue.body
        const returnIdentifier = getterBody?.type === 'BlockStatement'
          ? getterBody.body.find((statement: any) => statement?.type === 'ReturnStatement')?.argument
          : getterBody

        if (returnIdentifier?.type === 'Identifier' && returnIdentifier.name === installerName) {
          exportName = candidateExportName
        }
      },
    })

    return exportName
  }
  catch {
    return null
  }
}

function normalizeRelativeChunkImport(fileName: string, importee: string) {
  return toPosixPath(path.normalize(path.join(path.dirname(fileName), importee)))
}

function injectRequestGlobalsBundleRuntime(
  bundle: OutputBundle,
  targets: WeappInjectRequestGlobalsTarget[],
) {
  const installerChunks = new Map<string, string>()
  if (targets.length === 0) {
    return installerChunks
  }

  const bindingTargets = resolveRequestGlobalsBindingTargets(targets)
  for (const output of Object.values(bundle)) {
    if (output?.type !== 'chunk') {
      continue
    }

    const chunk = output as OutputChunk
    if (chunk.code.includes('__weappViteRequestGlobalsBundleInstalled__')) {
      continue
    }

    const installerName = resolveRequestGlobalsInstallerName(chunk.code)
    const exportName = resolveRequestGlobalsExportName(chunk.code)
    if (!installerName || !exportName) {
      continue
    }

    installerChunks.set(toPosixPath(chunk.fileName), exportName)
    const passiveBindingsCode = createRequestGlobalsPassiveBindingsCode(targets)
    const runtimeBindingCode = [
      `const __weappViteRequestGlobalsBundleHost__ = ${installerName}({ targets: ${JSON.stringify(targets)} }) || globalThis`,
      ...bindingTargets.map(target => `__weappViteRequestGlobalsActuals__[${JSON.stringify(target)}] = __weappViteRequestGlobalsBundleHost__.${target}`),
      ...bindingTargets.map(target => `${target} = __weappViteRequestGlobalsBundleHost__.${target}`),
    ].join(';')
    const bundlePrelude = `/* __weappViteRequestGlobalsBundleInstalled__ */ ${passiveBindingsCode}\n`
    const firstRequireMatch = chunk.code.match(REQUEST_GLOBAL_REQUIRE_DECLARATOR_RE)
    if (firstRequireMatch?.[0]) {
      chunk.code = `${bundlePrelude}${chunk.code.replace(firstRequireMatch[0], match => `${match};${runtimeBindingCode}`)}\n`
      continue
    }

    chunk.code = `${bundlePrelude}${chunk.code}\n;${runtimeBindingCode};\n`
  }

  return installerChunks
}

function injectRequestGlobalsPassiveBindings(
  bundle: OutputBundle,
  installerChunks: Map<string, string>,
  targets: WeappInjectRequestGlobalsTarget[],
  entriesMap: Map<string, { type?: string } | undefined> | undefined,
) {
  if (installerChunks.size === 0 || targets.length === 0) {
    return
  }

  const bindingTargets = resolveRequestGlobalsBindingTargets(targets)
  if (bindingTargets.length === 0) {
    return
  }

  const passiveBindingsCode = createRequestGlobalsPassiveBindingsCode(targets)
  for (const output of Object.values(bundle)) {
    if (output?.type !== 'chunk') {
      continue
    }

    const chunk = output as OutputChunk
    if (installerChunks.has(toPosixPath(chunk.fileName))) {
      continue
    }
    if (
      chunk.code.includes('__weappViteRequestGlobalsPassiveBindings__')
      || chunk.code.includes('__weappViteRequestGlobalsLocalBindings__')
      || chunk.code.includes('__weappViteRequestGlobalsBundleInstalled__')
    ) {
      continue
    }

    const entryName = chunk.fileName.replace(REQUEST_GLOBAL_ENTRY_NAME_RE, '')
    const entryType = entriesMap?.get(entryName)?.type
    if (entryType === 'page' || entryType === 'component' || entryType === 'app') {
      continue
    }

    chunk.code = `/* __weappViteRequestGlobalsPassiveBindings__ */ ${passiveBindingsCode}\n${chunk.code}`
  }
}

function injectRequestGlobalsLocalBindings(
  bundle: OutputBundle,
  installerChunks: Map<string, string>,
  targets: WeappInjectRequestGlobalsTarget[],
  entriesMap: Map<string, { type?: string } | undefined> | undefined,
) {
  if (installerChunks.size === 0 || targets.length === 0) {
    return
  }

  const bindingTargets = resolveRequestGlobalsBindingTargets(targets)
  if (bindingTargets.length === 0) {
    return
  }

  for (const output of Object.values(bundle)) {
    if (output?.type !== 'chunk') {
      continue
    }

    const chunk = output as OutputChunk
    const entryName = chunk.fileName.replace(REQUEST_GLOBAL_ENTRY_NAME_RE, '')
    const entryType = entriesMap?.get(entryName)?.type
    if (entryType !== 'page' && entryType !== 'component' && entryType !== 'app') {
      continue
    }

    if (chunk.code.includes('__weappViteRequestGlobalsLocalBindings__')) {
      continue
    }
    let requireImportLiteral: string | null = null
    let exportName: string | undefined

    for (const requireMatch of chunk.code.matchAll(REQUEST_GLOBAL_REQUIRE_DECLARATOR_RE)) {
      const importee = requireMatch[3] ?? requireMatch[4] ?? requireMatch[5]
      if (!importee) {
        continue
      }

      const installerChunkFileName = normalizeRelativeChunkImport(chunk.fileName, importee)
      exportName = installerChunks.get(installerChunkFileName)
      if (!exportName) {
        continue
      }

      requireImportLiteral = requireMatch[2] ?? null
      break
    }

    if (!requireImportLiteral || !exportName) {
      continue
    }

    const injectionCode = [
      `const __weappViteChunkRequestGlobalsModule__ = require(${requireImportLiteral})`,
      `const __weappViteChunkRequestGlobalsHost__ = __weappViteChunkRequestGlobalsModule__[${JSON.stringify(exportName)}]({ targets: ${JSON.stringify(targets)} }) || globalThis`,
      'const __weappViteRequestGlobalsActuals__ = globalThis.__weappViteRequestGlobalsActuals__ || (globalThis.__weappViteRequestGlobalsActuals__ = Object.create(null))',
      ...bindingTargets.map(target => `__weappViteRequestGlobalsActuals__[${JSON.stringify(target)}] = __weappViteChunkRequestGlobalsHost__.${target}`),
      ...bindingTargets.map(target => `var ${target} = __weappViteChunkRequestGlobalsHost__.${target}`),
    ].join(';')
    chunk.code = `/* __weappViteRequestGlobalsLocalBindings__ */ ${injectionCode};\n${chunk.code}`
  }
}

function toRelativeRuntimeNpmImport(fileName: string, root: string, importee: string) {
  const normalized = normalizeWeappLocalNpmImport(importee)
  const target = root
    ? `${root}/miniprogram_npm/${normalized}`
    : `miniprogram_npm/${normalized}`
  const relative = toPosixPath(path.relative(path.dirname(fileName), target))
  return relative.startsWith('.') ? relative : `./${relative}`
}

function rewriteChunkNpmImportsToLocalRoot(
  chunk: OutputChunk,
  root: string,
  dependencyPatterns: (string | RegExp)[] | undefined,
  dependencies: Record<string, string> | undefined,
  options?: {
    astEngine?: 'babel' | 'oxc'
  },
) {
  if (!mayContainStaticRequireLiteral(chunk.code, { engine: options?.astEngine })) {
    return
  }

  try {
    const ast = parseJsLike(chunk.code)
    let mutated = false

    traverse(ast as any, {
      CallExpression(path: any) {
        const callee = path.node?.callee
        if (!callee || callee.type !== 'Identifier' || callee.name !== 'require') {
          return
        }
        if (path.scope?.hasBinding?.('require')) {
          return
        }

        const args = path.node.arguments
        if (!Array.isArray(args) || args.length === 0) {
          return
        }

        const firstArg = args[0]
        const currentValue = getRequireImportLiteral(firstArg)
        if (typeof currentValue !== 'string' || !matchesSubPackageDependency(dependencyPatterns, currentValue, dependencies)) {
          return
        }

        const nextValue = toRelativeRuntimeNpmImport(chunk.fileName, root, currentValue)
        if (nextValue === currentValue) {
          return
        }

        setRequireImportLiteral(firstArg, nextValue)
        mutated = true
      },
    })

    if (mutated) {
      chunk.code = generate(ast as any).code
    }
  }
  catch {
  }
}

function rewriteJsonNpmImportsToLocalRoot(
  bundle: OutputBundle,
  root: string,
  dependencyPatterns: (string | RegExp)[] | undefined,
  dependencies: Record<string, string> | undefined,
) {
  for (const output of Object.values(bundle)) {
    if (output?.type !== 'asset' || typeof output.fileName !== 'string' || !output.fileName.endsWith('.json')) {
      continue
    }
    if (root && (output.fileName === `${root}.json` || !output.fileName.startsWith(`${root}/`))) {
      continue
    }

    const source = typeof output.source === 'string' ? output.source : output.source?.toString()
    if (!source) {
      continue
    }

    try {
      const parsed = JSON.parse(source)
      if (!parsed || typeof parsed !== 'object' || !parsed.usingComponents || typeof parsed.usingComponents !== 'object' || Array.isArray(parsed.usingComponents)) {
        continue
      }

      let mutated = false
      for (const [componentName, importee] of Object.entries(parsed.usingComponents as Record<string, string>)) {
        if (typeof importee !== 'string' || !matchesSubPackageDependency(dependencyPatterns, importee, dependencies)) {
          continue
        }
        parsed.usingComponents[componentName] = toRelativeRuntimeNpmImport(output.fileName, root, importee)
        mutated = true
      }

      if (mutated) {
        output.source = `${JSON.stringify(parsed, null, 2)}\n`
      }
    }
    catch {
    }
  }
}

export function createRenderStartHook(state: CorePluginState) {
  const { ctx, subPackageMeta, buildTarget } = state

  return function renderStart(this: any) {
    emitJsonAssets.call(this, state)
    const runtime: WxmlEmitRuntime = {
      addWatchFile: typeof this.addWatchFile === 'function'
        ? (id: string) => { this.addWatchFile(normalizeWatchPath(id)) }
        : undefined,
      emitFile: (asset) => {
        this.emitFile(asset)
      },
    }
    state.watchFilesSnapshot = emitWxmlAssetsWithCache({
      runtime,
      compiler: ctx,
      subPackageMeta,
      emittedCodeCache: ctx.runtimeState.wxml.emittedCode,
      buildTarget,
    })
  }
}

export function createGenerateBundleHook(state: CorePluginState, isPluginBuild: boolean) {
  const { ctx, subPackageMeta } = state
  const { scanService, configService } = ctx
  const astEngine = resolveAstEngine(configService.weappViteConfig)
  const injectRequestGlobalsOptions = resolveInjectRequestGlobalsOptions(
    configService.weappViteConfig?.injectRequestGlobals,
    configService.packageJson,
  )

  return async function generateBundle(this: any, _options: any, bundle: any) {
    const rolldownBundle = bundle as unknown as OutputBundle
    await flushIndependentBuilds.call(this, state)

    if (isPluginBuild) {
      filterPluginBundleOutputs(rolldownBundle, configService)
      if (!shouldRewriteBundleNpmImports(configService.platform)) {
        for (const output of Object.values(rolldownBundle)) {
          if (output?.type !== 'chunk') {
            continue
          }

          rewriteChunkNpmImportsToLocalRoot(output as OutputChunk, '', undefined, configService.packageJson.dependencies, {
            astEngine,
          })
        }

        rewriteJsonNpmImportsToLocalRoot(rolldownBundle, '', undefined, configService.packageJson.dependencies)
      }
      return
    }

    if (!subPackageMeta) {
      const sharedStrategy = configService.weappViteConfig?.chunks?.sharedStrategy ?? DEFAULT_SHARED_CHUNK_STRATEGY
      const shouldLogChunks = configService.weappViteConfig?.chunks?.logOptimization ?? true
      const subPackageRoots = [...scanService.subPackageMap.keys()].filter(Boolean)
      const duplicateWarningBytes = Number(configService.weappViteConfig?.chunks?.duplicateWarningBytes ?? 0)
      const shouldWarnOnDuplicate = Number.isFinite(duplicateWarningBytes) && duplicateWarningBytes > 0
      let redundantBytesTotal = 0

      if (configService.isDev && state.hmrSharedChunksMode === 'auto') {
        if (state.hmrState.didEmitAllEntries || !state.hmrState.hasBuiltOnce) {
          refreshSharedChunkImporters(rolldownBundle, state)
        }
        else if (state.hmrState.lastEmittedEntryIds?.size) {
          refreshPartialSharedChunkImporters(rolldownBundle, state, state.hmrState.lastEmittedEntryIds)
        }
        state.hmrState.hasBuiltOnce = true
      }

      function matchSubPackage(filePath: string) {
        return subPackageRoots.find(root => filePath === root || filePath.startsWith(`${root}/`))
      }

      const resolveSharedChunkLabel = (sharedFileName: string, finalFileName: string) => {
        const prettifyModuleLabel = (label: string) => {
          const normalized = toPosixPath(label)
          const match = normalized.match(PRETTY_NODE_MODULES_RE)
          return match?.[1] || label
        }

        const candidates: OutputChunk[] = []
        const collect = (output?: OutputBundle[string]) => {
          if (output?.type === 'chunk') {
            candidates.push(output as OutputChunk)
          }
        }

        collect(rolldownBundle[sharedFileName])
        if (finalFileName !== sharedFileName) {
          collect(rolldownBundle[finalFileName])
        }

        if (!candidates.length) {
          const matched = Object.values(rolldownBundle).find(
            (output): output is OutputChunk => output?.type === 'chunk'
              && (((output as OutputChunk).fileName ?? '') === finalFileName || ((output as OutputChunk).fileName ?? '') === sharedFileName),
          )
          if (matched) {
            candidates.push(matched)
          }
        }

        const chunk = candidates[0]
        if (!chunk) {
          return finalFileName
        }

        const moduleLabels = [...new Set(
          Object.keys(chunk.modules ?? {})
            .filter(id => id && !id.startsWith('\0'))
            .map(id => configService.relativeAbsoluteSrcRoot(id))
            .filter(Boolean),
        )]

        if (!moduleLabels.length) {
          return chunk.fileName || finalFileName
        }

        const preview = moduleLabels
          .map(prettifyModuleLabel)
          .slice(0, 3)
        const remaining = moduleLabels.length - preview.length
        const suffix = remaining > 0 ? ` 等 ${moduleLabels.length} 个模块` : ''
        return `${preview.join('、')}${suffix}`
      }

      const runtimeLocalizationRoots = new Set<string>()
      const handleDuplicate = ({
        duplicates,
        ignoredMainImporters,
        chunkBytes,
        redundantBytes,
        retainedInMain,
        sharedFileName,
        requiresRuntimeLocalization,
      }: SharedChunkDuplicatePayload) => {
        if (shouldWarnOnDuplicate) {
          const duplicateCount = duplicates.length
          const computedRedundant = typeof redundantBytes === 'number'
            ? redundantBytes
            : typeof chunkBytes === 'number'
              ? chunkBytes * Math.max(duplicateCount - 1, 0)
              : 0
          redundantBytesTotal += computedRedundant
        }
        if (requiresRuntimeLocalization) {
          for (const { fileName } of duplicates) {
            const match = matchSubPackage(fileName)
            if (match) {
              runtimeLocalizationRoots.add(match)
            }
          }
        }
        if (!shouldLogChunks) {
          return
        }

        const subPackageSet = new Set<string>()
        let totalReferences = 0
        for (const { fileName, importers } of duplicates) {
          totalReferences += importers.length
          const match = matchSubPackage(fileName)
          if (match) {
            subPackageSet.add(match)
          }
        }
        const subPackageList = [...subPackageSet].join('、') || '相关分包'
        const ignoredHint = ignoredMainImporters?.length
          ? `，忽略主包引用：${ignoredMainImporters.join('、')}`
          : ''
        logger.info(`[分包] 分包 ${subPackageList} 共享模块已复制到各自 weapp-shared/common.js（${totalReferences} 处引用${ignoredHint}）`)

        if (retainedInMain) {
          logger.warn(`[分包] 模块 ${sharedFileName} 同时被主包引用，因此仍保留在主包 common.js，并复制到 ${subPackageList}，请确认是否需要将源代码移动到主包或公共目录。`)
        }
      }

      applySharedChunkStrategy.call(this, rolldownBundle, {
        strategy: sharedStrategy,
        subPackageRoots,
        onDuplicate: handleDuplicate,
        onFallback: shouldLogChunks
          ? ({ reason, importers, sharedFileName, finalFileName }) => {
              const involvedSubs = new Set<string>()
              let hasMainReference = false
              for (const importer of importers) {
                const match = matchSubPackage(importer)
                if (match) {
                  involvedSubs.add(match)
                }
                else {
                  hasMainReference = true
                }
              }

              const segments: string[] = []
              if (involvedSubs.size) {
                segments.push(`分包 ${[...involvedSubs].join('、')}`)
              }
              if (hasMainReference) {
                segments.push('主包')
              }
              const scope = segments.join('、') || '主包'
              const sharedChunkLabel = resolveSharedChunkLabel(sharedFileName, finalFileName)

              if (reason === 'main-package') {
                logger.info(`[分包] ${scope} 共享模块 ${sharedChunkLabel}（${importers.length} 处引用）已提升到主包 common.js`)
              }
              else {
                logger.info(`[分包] 仅主包使用共享模块 ${sharedChunkLabel}（${importers.length} 处引用），保留在主包 common.js`)
              }
            }
          : undefined,
      })

      applyRuntimeChunkLocalization.call(this, rolldownBundle, {
        subPackageRoots,
        forceRoots: runtimeLocalizationRoots,
        onDuplicate: shouldLogChunks
          ? ({ duplicates, runtimeFileName }: RuntimeChunkDuplicatePayload) => {
              const subPackageSet = new Set<string>()
              for (const { fileName } of duplicates) {
                const match = matchSubPackage(fileName)
                if (match) {
                  subPackageSet.add(match)
                }
              }
              const subPackageList = [...subPackageSet].join('、') || '相关分包'
              logger.info(`[分包] 分包 ${subPackageList} 已本地化 ${runtimeFileName} 依赖，避免跨包 runtime 引用。`)
            }
          : undefined,
      })

      if (shouldWarnOnDuplicate && redundantBytesTotal > duplicateWarningBytes) {
        logger.warn(`[分包] 分包复制共享模块产生冗余体积 ${formatBytes(redundantBytesTotal)}，已超过阈值 ${formatBytes(duplicateWarningBytes)}，建议调整分包划分或运行 weapp-vite analyze 定位问题。`)
      }
    }

    removeImplicitPagePreloads(rolldownBundle, {
      configService,
      entriesMap: state.entriesMap,
    })

    if (shouldRewriteBundleNpmImports(configService.platform)) {
      rewriteBundleNpmImportsByPlatform(
        configService.platform,
        rolldownBundle,
        configService.packageJson.dependencies,
        configService.weappViteConfig?.npm?.alipayNpmMode,
        { astEngine },
      )
    }
    else {
      const subPackageMap = scanService.subPackageMap ?? new Map<string, SubPackageMetaValue>()
      const localSubPackageMetas = [...subPackageMap.values()]
        .filter(meta => Array.isArray(meta?.subPackage?.dependencies) && meta.subPackage.dependencies.length > 0)

      for (const meta of localSubPackageMetas) {
        for (const output of Object.values(rolldownBundle)) {
          if (output?.type !== 'chunk') {
            continue
          }

          const chunk = output as OutputChunk
          if (chunk.fileName === meta.subPackage.root || !chunk.fileName.startsWith(`${meta.subPackage.root}/`)) {
            continue
          }
          rewriteChunkNpmImportsToLocalRoot(chunk, meta.subPackage.root, meta.subPackage.dependencies, configService.packageJson.dependencies, {
            astEngine,
          })
        }

        rewriteJsonNpmImportsToLocalRoot(rolldownBundle, meta.subPackage.root, meta.subPackage.dependencies, configService.packageJson.dependencies)
      }
    }

    const injectWeapiGlobalName = resolveInjectWeapiGlobalName(state)
    if (injectWeapiGlobalName) {
      rewriteBundlePlatformApi(rolldownBundle, injectWeapiGlobalName, {
        astEngine,
      })
    }

    rewriteBundleDynamicGlobalResolution(rolldownBundle)

    if (injectRequestGlobalsOptions?.targets?.length) {
      const installerChunks = injectRequestGlobalsBundleRuntime(rolldownBundle, injectRequestGlobalsOptions.targets)
      injectRequestGlobalsPassiveBindings(rolldownBundle, installerChunks, injectRequestGlobalsOptions.targets, state.entriesMap)
      injectRequestGlobalsLocalBindings(rolldownBundle, installerChunks, injectRequestGlobalsOptions.targets, state.entriesMap)
    }

    refreshModuleGraph(this, state)

    if (configService.weappViteConfig?.debug?.watchFiles) {
      const watcherService = ctx.watcherService
      const watcherRoot = subPackageMeta?.subPackage.root ?? '/'
      const watcher = watcherService?.getRollupWatcher(watcherRoot)
      let watchFiles: string[] | undefined
      if (watcher && typeof (watcher as any).getWatchFiles === 'function') {
        watchFiles = await (watcher as any).getWatchFiles()
      }
      else if (state.watchFilesSnapshot.length) {
        watchFiles = state.watchFilesSnapshot
      }
      if (watchFiles && watchFiles.length) {
        configService.weappViteConfig.debug.watchFiles(watchFiles, subPackageMeta)
      }
      state.watchFilesSnapshot = []
    }
  }
}
