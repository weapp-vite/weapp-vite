import type { OutputBundle, OutputChunk } from 'rolldown'
import type { WeappInjectRequestGlobalsTarget } from '../../../../types'
import path from 'pathe'
import {
  createRequestGlobalsPassiveBindingsCode,
  FULL_REQUEST_GLOBAL_TARGETS,
  resolveRequestGlobalsBindingTargets,
} from '../../../../runtime/config/internal/injectRequestGlobals'
import { toPosixPath } from '../../../../utils'
import { generate, parseJsLike, traverse } from '../../../../utils/babel'
import {
  AXIOS_MODULE_ID_RE,
  REQUEST_GLOBAL_ENTRY_NAME_RE,
  REQUEST_GLOBAL_EXPORT_RE,
  REQUEST_GLOBAL_INSTALLER_RE,
  REQUEST_GLOBAL_PRELUDE_GUARD_KEY,
  REQUEST_GLOBAL_PRELUDE_MARKER,
  REQUEST_GLOBAL_REQUIRE_DECLARATOR_RE,
} from './constants'
import { getStaticStringLiteral, normalizeRelativeChunkImport } from './rewrite'

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

export function injectRequestGlobalsBundleRuntime(bundle: OutputBundle, targets: WeappInjectRequestGlobalsTarget[]) {
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

export function injectRequestGlobalsPassiveBindings(
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

export function injectRequestGlobalsLocalBindings(
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
) {
  if (targets.length === 0 || chunk.code.includes(REQUEST_GLOBAL_PRELUDE_MARKER)) {
    return undefined
  }
  const bindingTargets = resolveRequestGlobalsBindingTargets(targets)
  if (bindingTargets.length === 0) {
    return undefined
  }

  const installerName = resolveRequestGlobalsInstallerName(chunk.code)
  const exportName = resolveRequestGlobalsExportName(chunk.code)
  let installerHostCode: string | undefined

  if (installerName && exportName) {
    installerHostCode = `${installerName}({ targets: ${JSON.stringify(targets)} }) || globalThis`
  }
  else {
    const installerImport = resolveRequestGlobalsInstallerImport(chunk, installerChunks)
    if (!installerImport?.requireImportLiteral || !installerImport.exportName) {
      return undefined
    }
    installerHostCode = `require(${installerImport.requireImportLiteral})[${JSON.stringify(installerImport.exportName)}]({ targets: ${JSON.stringify(targets)} }) || globalThis`
  }

  return [
    `/* ${REQUEST_GLOBAL_PRELUDE_MARKER} */`,
    `(() => {`,
    `  if (globalThis[${JSON.stringify(REQUEST_GLOBAL_PRELUDE_GUARD_KEY)}]) {`,
    `    return`,
    `  }`,
    `  globalThis[${JSON.stringify(REQUEST_GLOBAL_PRELUDE_GUARD_KEY)}] = true`,
    `  const __weappVitePreludeRequestGlobalsHost__ = ${installerHostCode}`,
    `  const __weappViteRequestGlobalsActuals__ = globalThis.__weappViteRequestGlobalsActuals__ || (globalThis.__weappViteRequestGlobalsActuals__ = Object.create(null))`,
    ...bindingTargets.map(target => `  __weappViteRequestGlobalsActuals__[${JSON.stringify(target)}] = __weappVitePreludeRequestGlobalsHost__.${target}`),
    `})();`,
  ].join('\n')
}

export function createRequestGlobalsPreludeAssetCode(
  preludeFileName: string,
  chunk: OutputChunk,
  installerChunks: Map<string, string>,
  targets: WeappInjectRequestGlobalsTarget[],
) {
  if (targets.length === 0) {
    return undefined
  }
  const bindingTargets = resolveRequestGlobalsBindingTargets(targets)
  if (bindingTargets.length === 0) {
    return undefined
  }

  const installerImport = resolveRequestGlobalsInstallerImport(chunk, installerChunks)
  if (!installerImport?.installerChunkFileName || !installerImport.exportName) {
    return undefined
  }

  const installerHostCode = `require(${JSON.stringify(toRequireRequestPath(preludeFileName, installerImport.installerChunkFileName))})[${JSON.stringify(installerImport.exportName)}]({ targets: ${JSON.stringify(targets)} }) || globalThis`

  return [
    `/* ${REQUEST_GLOBAL_PRELUDE_MARKER} */`,
    `(() => {`,
    `  if (globalThis[${JSON.stringify(REQUEST_GLOBAL_PRELUDE_GUARD_KEY)}]) {`,
    `    return`,
    `  }`,
    `  globalThis[${JSON.stringify(REQUEST_GLOBAL_PRELUDE_GUARD_KEY)}] = true`,
    `  const __weappVitePreludeRequestGlobalsHost__ = ${installerHostCode}`,
    `  const __weappViteRequestGlobalsActuals__ = globalThis.__weappViteRequestGlobalsActuals__ || (globalThis.__weappViteRequestGlobalsActuals__ = Object.create(null))`,
    ...bindingTargets.map(target => `  __weappViteRequestGlobalsActuals__[${JSON.stringify(target)}] = __weappVitePreludeRequestGlobalsHost__.${target}`),
    `})();`,
  ].join('\n')
}

export function injectAxiosFetchAdapterEnv(bundle: OutputBundle) {
  const axiosEnvPatchCode = [
    '/* __weappViteAxiosFetchAdapterEnv__ */',
    'let __weappViteAxiosExport__ = null',
    'for (const __weappViteAxiosKey__ in exports) {',
    '  const __weappViteAxiosCandidate__ = exports[__weappViteAxiosKey__]',
    '  if (__weappViteAxiosCandidate__ && typeof __weappViteAxiosCandidate__ === "function" && __weappViteAxiosCandidate__.Axios && __weappViteAxiosCandidate__.defaults) {',
    '    __weappViteAxiosExport__ = __weappViteAxiosCandidate__',
    '    break',
    '  }',
    '}',
    'if (__weappViteAxiosExport__) {',
    '  __weappViteAxiosExport__.defaults.env = {',
    '    ...(__weappViteAxiosExport__.defaults.env ?? {}),',
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
    if (chunk.code.includes('__weappViteAxiosFetchAdapterEnv__')) {
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
