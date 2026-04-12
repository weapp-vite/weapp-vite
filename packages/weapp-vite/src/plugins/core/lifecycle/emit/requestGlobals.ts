import type { OutputBundle, OutputChunk } from 'rolldown'
import type { WeappInjectRequestGlobalsTarget } from '../../../../types'
import {
  REQUEST_GLOBAL_ACTUALS_KEY,
  REQUEST_GLOBAL_BUNDLE_HOST_REF,
  REQUEST_GLOBAL_BUNDLE_MARKER,
  REQUEST_GLOBAL_CHUNK_HOST_REF,
  REQUEST_GLOBAL_CHUNK_MODULE_REF,
  REQUEST_GLOBAL_INSTALLER_HOST_REF,
  REQUEST_GLOBAL_LOCAL_BINDINGS_MARKER,
  REQUEST_GLOBAL_PASSIVE_BINDINGS_MARKER,
  REQUEST_GLOBAL_PRELUDE_GUARD_KEY,
  REQUEST_GLOBAL_PRELUDE_MARKER,
} from '@weapp-core/constants'
import path from 'pathe'
import {
  createRequestGlobalsPassiveBindingsCode,
  FULL_REQUEST_GLOBAL_TARGETS,
  resolveAutoRequestGlobalsTargets,
  resolveRequestGlobalsBindingTargets,
} from '../../../../runtime/config/internal/injectRequestGlobals'
import { toPosixPath } from '../../../../utils'
import { generate, parseJsLike, traverse } from '../../../../utils/babel'
import {
  AXIOS_MODULE_ID_RE,
  REQUEST_GLOBAL_ENTRY_NAME_RE,
  REQUEST_GLOBAL_EXPORT_RE,
  REQUEST_GLOBAL_INSTALLER_RE,
  REQUEST_GLOBAL_REQUIRE_DECLARATOR_RE,
} from './constants'
import { getStaticStringLiteral, normalizeRelativeChunkImport } from './rewrite'

function resolveChunkRequestGlobalsTargets(
  code: string,
  targets: WeappInjectRequestGlobalsTarget[],
  mode: 'auto' | 'explicit',
) {
  return mode === 'auto'
    ? resolveAutoRequestGlobalsTargets(code, targets)
    : targets
}

export function resolveRequestGlobalsInstallerName(code: string) {
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
      return FULL_REQUEST_GLOBAL_TARGETS.every(target => functionCode.includes(target))
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

export function resolveRequestGlobalsExportName(code: string) {
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
            (property?.type === 'ObjectProperty' && property.key?.type === 'Identifier' && property.key.name === 'get')
            || (property?.type === 'ObjectMethod' && property.key?.type === 'Identifier' && property.key.name === 'get')
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

export function injectRequestGlobalsBundleRuntime(
  bundle: OutputBundle,
  targets: WeappInjectRequestGlobalsTarget[],
  mode: 'auto' | 'explicit',
) {
  const installerChunks = new Map<string, string>()
  if (targets.length === 0) {
    return installerChunks
  }
  for (const output of Object.values(bundle)) {
    if (output?.type !== 'chunk') {
      continue
    }
    const chunk = output as OutputChunk
    if (chunk.code.includes(REQUEST_GLOBAL_BUNDLE_MARKER)) {
      continue
    }
    const installerName = resolveRequestGlobalsInstallerName(chunk.code)
    const exportName = resolveRequestGlobalsExportName(chunk.code)
    if (!installerName || !exportName) {
      continue
    }

    installerChunks.set(toPosixPath(chunk.fileName), exportName)
    const chunkTargets = resolveChunkRequestGlobalsTargets(chunk.code, targets, mode)
    if (chunkTargets.length === 0) {
      continue
    }

    const bindingTargets = resolveRequestGlobalsBindingTargets(chunkTargets)
    if (bindingTargets.length === 0) {
      continue
    }
    const passiveBindingsCode = createRequestGlobalsPassiveBindingsCode(chunkTargets)
    const runtimeBindingCode = [
      `const ${REQUEST_GLOBAL_BUNDLE_HOST_REF} = ${installerName}({ targets: ${JSON.stringify(chunkTargets)} }) || globalThis`,
      ...bindingTargets.map(target => `${REQUEST_GLOBAL_ACTUALS_KEY}[${JSON.stringify(target)}] = ${REQUEST_GLOBAL_BUNDLE_HOST_REF}.${target}`),
      ...bindingTargets.map(target => `${target} = ${REQUEST_GLOBAL_BUNDLE_HOST_REF}.${target}`),
    ].join(';')
    const bundlePrelude = `/* ${REQUEST_GLOBAL_BUNDLE_MARKER} */ ${passiveBindingsCode}\n`
    const firstRequireMatch = chunk.code.match(REQUEST_GLOBAL_REQUIRE_DECLARATOR_RE)
    if (firstRequireMatch?.[0]) {
      chunk.code = `${bundlePrelude}${chunk.code.replace(firstRequireMatch[0], match => `${match};${runtimeBindingCode}`)}\n`
      continue
    }

    chunk.code = `${bundlePrelude}${chunk.code}\n;${runtimeBindingCode};\n`
  }

  return installerChunks
}

export function injectRequestGlobalsPassiveBindings(
  bundle: OutputBundle,
  installerChunks: Map<string, string>,
  targets: WeappInjectRequestGlobalsTarget[],
  mode: 'auto' | 'explicit',
  entriesMap: Map<string, { type?: string } | undefined> | undefined,
) {
  if (targets.length === 0) {
    return
  }
  for (const output of Object.values(bundle)) {
    if (output?.type !== 'chunk') {
      continue
    }
    const chunk = output as OutputChunk
    if (installerChunks.has(toPosixPath(chunk.fileName))) {
      continue
    }
    if (
      chunk.code.includes(REQUEST_GLOBAL_PASSIVE_BINDINGS_MARKER)
      || chunk.code.includes(REQUEST_GLOBAL_LOCAL_BINDINGS_MARKER)
      || chunk.code.includes(REQUEST_GLOBAL_BUNDLE_MARKER)
    ) {
      continue
    }
    const entryName = chunk.fileName.replace(REQUEST_GLOBAL_ENTRY_NAME_RE, '')
    const entryType = entriesMap?.get(entryName)?.type
    if (entryType === 'page' || entryType === 'component' || entryType === 'app') {
      continue
    }
    const chunkTargets = resolveChunkRequestGlobalsTargets(chunk.code, targets, mode)
    if (chunkTargets.length === 0) {
      continue
    }
    const passiveBindingsCode = createRequestGlobalsPassiveBindingsCode(chunkTargets)
    if (!passiveBindingsCode) {
      continue
    }
    chunk.code = `/* ${REQUEST_GLOBAL_PASSIVE_BINDINGS_MARKER} */ ${passiveBindingsCode}\n${chunk.code}`
  }
}

export function injectRequestGlobalsLocalBindings(
  bundle: OutputBundle,
  installerChunks: Map<string, string>,
  targets: WeappInjectRequestGlobalsTarget[],
  mode: 'auto' | 'explicit',
  entriesMap: Map<string, { type?: string } | undefined> | undefined,
) {
  if (targets.length === 0) {
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
    if (chunk.code.includes(REQUEST_GLOBAL_LOCAL_BINDINGS_MARKER)) {
      continue
    }
    const chunkTargets = resolveChunkRequestGlobalsTargets(chunk.code, targets, mode)
    if (chunkTargets.length === 0) {
      continue
    }
    const bindingTargets = resolveRequestGlobalsBindingTargets(chunkTargets)
    if (bindingTargets.length === 0) {
      continue
    }
    const inlineInstallerName = resolveRequestGlobalsInstallerName(chunk.code)
    const firstRequireMatch = chunk.code.match(REQUEST_GLOBAL_REQUIRE_DECLARATOR_RE)
    let requireImportLiteral: string | null = null
    let exportName: string | undefined
    for (const requireMatch of chunk.code.matchAll(REQUEST_GLOBAL_REQUIRE_DECLARATOR_RE)) {
      const importee = requireMatch[3] ?? requireMatch[4] ?? requireMatch[5]
      if (!importee) {
        continue
      }
      const installerChunkFileName = normalizeRelativeChunkImport(chunk.fileName, importee)
      requireImportLiteral = requireMatch[2] ?? null
      exportName = installerChunks.get(installerChunkFileName)
      break
    }
    const runtimeInstallerResolverExpression = requireImportLiteral
      && `(() => { const installer = Object.values(${REQUEST_GLOBAL_CHUNK_MODULE_REF}).find(value => typeof value === "function" && ${JSON.stringify(FULL_REQUEST_GLOBAL_TARGETS)}.every(target => String(value).includes(target))); return typeof installer === "function" ? installer({ targets: ${JSON.stringify(chunkTargets)} }) || globalThis : globalThis })()`
    const installerHostExpression = inlineInstallerName
      ? `${inlineInstallerName}({ targets: ${JSON.stringify(chunkTargets)} }) || globalThis`
      : requireImportLiteral && exportName
        ? `${REQUEST_GLOBAL_CHUNK_MODULE_REF}[${JSON.stringify(exportName)}]({ targets: ${JSON.stringify(chunkTargets)} }) || globalThis`
        : runtimeInstallerResolverExpression
          ?? null
    if (!installerHostExpression) {
      continue
    }
    const injectionCode = [
      ...(!inlineInstallerName && requireImportLiteral
        ? [`const ${REQUEST_GLOBAL_CHUNK_MODULE_REF} = require(${requireImportLiteral})`]
        : []),
      `const ${REQUEST_GLOBAL_CHUNK_HOST_REF} = ${installerHostExpression}`,
      `const ${REQUEST_GLOBAL_ACTUALS_KEY} = globalThis[${JSON.stringify(REQUEST_GLOBAL_ACTUALS_KEY)}] || (globalThis[${JSON.stringify(REQUEST_GLOBAL_ACTUALS_KEY)}] = Object.create(null))`,
      ...bindingTargets.map(target => `${REQUEST_GLOBAL_ACTUALS_KEY}[${JSON.stringify(target)}] = ${REQUEST_GLOBAL_CHUNK_HOST_REF}.${target}`),
      ...bindingTargets.map(target => `var ${target} = ${REQUEST_GLOBAL_CHUNK_HOST_REF}.${target}`),
    ].join(';')
    if (inlineInstallerName && firstRequireMatch?.[0]) {
      chunk.code = `/* ${REQUEST_GLOBAL_LOCAL_BINDINGS_MARKER} */ ${chunk.code.replace(firstRequireMatch[0], match => `${match};${injectionCode}`)}\n`
      continue
    }
    chunk.code = `/* ${REQUEST_GLOBAL_LOCAL_BINDINGS_MARKER} */ ${injectionCode};\n${chunk.code}`
  }
}

export function resolveRequestGlobalsInstallerImport(chunk: OutputChunk, installerChunks: Map<string, string>) {
  for (const requireMatch of chunk.code.matchAll(REQUEST_GLOBAL_REQUIRE_DECLARATOR_RE)) {
    const importee = requireMatch[3] ?? requireMatch[4] ?? requireMatch[5]
    if (!importee) {
      continue
    }
    const installerChunkFileName = normalizeRelativeChunkImport(chunk.fileName, importee)
    const exportName = installerChunks.get(installerChunkFileName)
    if (!exportName) {
      continue
    }

    return {
      exportName,
      installerChunkFileName,
      requireImportLiteral: requireMatch[2] ?? null,
    }
  }

  return null
}

function toRequireRequestPath(fromFileName: string, toFileName: string) {
  const relativePath = toPosixPath(path.relative(path.dirname(fromFileName), toFileName))
  return relativePath.startsWith('.') ? relativePath : `./${relativePath}`
}

export function createRequestGlobalsPreludeCode(
  chunk: OutputChunk,
  installerChunks: Map<string, string>,
  targets: WeappInjectRequestGlobalsTarget[],
  mode: 'auto' | 'explicit',
) {
  const chunkTargets = resolveChunkRequestGlobalsTargets(chunk.code, targets, mode)
  if (chunkTargets.length === 0 || chunk.code.includes(REQUEST_GLOBAL_PRELUDE_MARKER)) {
    return undefined
  }
  const bindingTargets = resolveRequestGlobalsBindingTargets(chunkTargets)
  if (bindingTargets.length === 0) {
    return undefined
  }

  const installerName = resolveRequestGlobalsInstallerName(chunk.code)
  const exportName = resolveRequestGlobalsExportName(chunk.code)
  let installerHostCode: string | undefined

  if (installerName && exportName) {
    installerHostCode = `${installerName}({ targets: ${JSON.stringify(chunkTargets)} }) || globalThis`
  }
  else {
    const installerImport = resolveRequestGlobalsInstallerImport(chunk, installerChunks)
    if (!installerImport?.requireImportLiteral || !installerImport.exportName) {
      return undefined
    }
    installerHostCode = `require(${installerImport.requireImportLiteral})[${JSON.stringify(installerImport.exportName)}]({ targets: ${JSON.stringify(chunkTargets)} }) || globalThis`
  }

  return [
    `/* ${REQUEST_GLOBAL_PRELUDE_MARKER} */`,
    `(() => {`,
    `  if (globalThis[${JSON.stringify(REQUEST_GLOBAL_PRELUDE_GUARD_KEY)}]) {`,
    `    return`,
    `  }`,
    `  globalThis[${JSON.stringify(REQUEST_GLOBAL_PRELUDE_GUARD_KEY)}] = true`,
    `  const ${REQUEST_GLOBAL_INSTALLER_HOST_REF} = ${installerHostCode}`,
    `  const ${REQUEST_GLOBAL_ACTUALS_KEY} = globalThis[${JSON.stringify(REQUEST_GLOBAL_ACTUALS_KEY)}] || (globalThis[${JSON.stringify(REQUEST_GLOBAL_ACTUALS_KEY)}] = Object.create(null))`,
    ...bindingTargets.map(target => `  ${REQUEST_GLOBAL_ACTUALS_KEY}[${JSON.stringify(target)}] = ${REQUEST_GLOBAL_INSTALLER_HOST_REF}.${target}`),
    `})();`,
  ].join('\n')
}

export function createRequestGlobalsPreludeAssetCode(
  preludeFileName: string,
  chunk: OutputChunk,
  installerChunks: Map<string, string>,
  targets: WeappInjectRequestGlobalsTarget[],
  mode: 'auto' | 'explicit',
) {
  const chunkTargets = resolveChunkRequestGlobalsTargets(chunk.code, targets, mode)
  if (chunkTargets.length === 0) {
    return undefined
  }
  const bindingTargets = resolveRequestGlobalsBindingTargets(chunkTargets)
  if (bindingTargets.length === 0) {
    return undefined
  }

  const installerImport = resolveRequestGlobalsInstallerImport(chunk, installerChunks)
  if (!installerImport?.installerChunkFileName || !installerImport.exportName) {
    return undefined
  }

  const installerHostCode = `require(${JSON.stringify(toRequireRequestPath(preludeFileName, installerImport.installerChunkFileName))})[${JSON.stringify(installerImport.exportName)}]({ targets: ${JSON.stringify(chunkTargets)} }) || globalThis`

  return [
    `/* ${REQUEST_GLOBAL_PRELUDE_MARKER} */`,
    `(() => {`,
    `  if (globalThis[${JSON.stringify(REQUEST_GLOBAL_PRELUDE_GUARD_KEY)}]) {`,
    `    return`,
    `  }`,
    `  globalThis[${JSON.stringify(REQUEST_GLOBAL_PRELUDE_GUARD_KEY)}] = true`,
    `  const ${REQUEST_GLOBAL_INSTALLER_HOST_REF} = ${installerHostCode}`,
    `  const ${REQUEST_GLOBAL_ACTUALS_KEY} = globalThis[${JSON.stringify(REQUEST_GLOBAL_ACTUALS_KEY)}] || (globalThis[${JSON.stringify(REQUEST_GLOBAL_ACTUALS_KEY)}] = Object.create(null))`,
    ...bindingTargets.map(target => `  ${REQUEST_GLOBAL_ACTUALS_KEY}[${JSON.stringify(target)}] = ${REQUEST_GLOBAL_INSTALLER_HOST_REF}.${target}`),
    `})();`,
  ].join('\n')
}

export function injectAxiosFetchAdapterEnv(bundle: OutputBundle) {
  const axiosEnvPatchCode = [
    '/* __wvAXFE__ */',
    'let __wvAX__ = null',
    'for (const __wvAXK__ in exports) {',
    '  const __wvAXC__ = exports[__wvAXK__]',
    '  if (__wvAXC__ && typeof __wvAXC__ === "function" && __wvAXC__.Axios && __wvAXC__.defaults) {',
    '    __wvAX__ = __wvAXC__',
    '    break',
    '  }',
    '}',
    'if (__wvAX__) {',
    '  __wvAX__.defaults.env = {',
    '    ...(__wvAX__.defaults.env ?? {}),',
    '    Request,',
    '    Response,',
    '    fetch,',
    '  }',
    '}',
    '',
  ].join('\n')

  for (const output of Object.values(bundle)) {
    if (output?.type !== 'chunk') {
      continue
    }
    const chunk = output as OutputChunk
    if (chunk.code.includes('__wvAXFE__')) {
      continue
    }
    const moduleIds = Array.isArray(chunk.moduleIds) ? chunk.moduleIds : []
    const normalizedFileName = toPosixPath(chunk.fileName)
    const isAxiosChunk = moduleIds.some(id => AXIOS_MODULE_ID_RE.test(id))
      || normalizedFileName === 'axios.js'
      || normalizedFileName.endsWith('/axios.js')
    if (!isAxiosChunk) {
      continue
    }
    chunk.code = `${chunk.code}\n${axiosEnvPatchCode}`
  }
}
