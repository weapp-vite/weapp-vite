import type { OutputBundle, OutputChunk } from 'rolldown'
import type { CompilerContext } from '../../../context'
import type { CorePluginState, RemoveImplicitPagePreloadOptions } from './types'
import { isEmptyObject, isObject } from '@weapp-core/shared'
import MagicString from 'magic-string'
import path from 'pathe'
import { changeFileExtension } from '../../../utils/file'
import { resolveCompilerOutputExtensions } from '../../../utils/outputExtensions'
import { isPathInside, normalizeRelativePath } from '../../../utils/path'
import { emitJsonAsset } from '../../utils/wxmlEmit'

const IMPLICIT_REQUIRE_RE = /\b(?:const|let|var)\s+[A-Za-z_$][\w$]*\s*=\s*require\((`[^`]+`|'[^']+'|"[^"]+")\);?/g
const REQUIRE_CALL_RE = /\brequire\((`[^`]+`|'[^']+'|"[^"]+")\)/g
const WEVU_SRC_CHUNK_RE = /(?:^|\/)wevu-src\.js$/
const WEVU_EXPORT_ALIASES = [
  ['defineComponent', '__wevuDefineComponent'],
  ['createWevuComponent', '__wevuCreateWevuComponent'],
] as const
const JS_IDENTIFIER_RE = /^[A-Z_$][\w$]*$/i

export function filterPluginBundleOutputs(
  bundle: OutputBundle,
  configService: CompilerContext['configService'],
) {
  if (configService.pluginOnly) {
    return
  }

  const pluginOutputRoot = configService.absolutePluginOutputRoot
  const pluginRoot = configService.absolutePluginRoot
  const pluginBase = pluginRoot ? path.basename(pluginRoot) : 'plugin'
  const relativeToOutDir = pluginOutputRoot
    ? path.relative(configService.outDir, pluginOutputRoot)
    : ''
  const isPluginOutputInsideOutDir = pluginOutputRoot
    ? relativeToOutDir === '' || (!relativeToOutDir.startsWith('..') && !path.isAbsolute(relativeToOutDir))
    : false
  const pluginBundleBase = pluginOutputRoot && isPluginOutputInsideOutDir
    ? normalizeRelativePath(relativeToOutDir) || pluginBase
    : pluginBase
  for (const [fileName, output] of Object.entries(bundle)) {
    const matchesPluginFileName = fileName === pluginBundleBase || fileName.startsWith(`${pluginBundleBase}/`)
    const matchesPluginSource = output.type === 'chunk'
      ? isPathInside(pluginRoot, output.facadeModuleId ?? '')
      : (output.originalFileNames ?? []).some(originalFile => isPathInside(pluginRoot, originalFile))
    const isPluginFile = matchesPluginFileName || matchesPluginSource
    if (!isPluginFile) {
      delete bundle[fileName]
    }
  }
}

export function emitJsonAssets(this: any, state: CorePluginState) {
  const { ctx } = state
  const { jsonService, configService } = ctx
  const emittedSourceCache = ctx.runtimeState.json.emittedSource

  for (const jsonEmitFile of state.jsonEmitFilesMap.values()) {
    if (
      jsonEmitFile.entry.json
      && isObject(jsonEmitFile.entry.json)
      && !isEmptyObject(jsonEmitFile.entry.json)
    ) {
      const source = jsonService.resolve(jsonEmitFile.entry)
      if (source && jsonEmitFile.fileName) {
        const normalizedFileName = changeFileExtension(
          jsonEmitFile.fileName,
          resolveCompilerOutputExtensions(configService?.outputExtensions).jsonExtension,
        )
        if (emittedSourceCache.get(normalizedFileName) === source) {
          continue
        }

        const { jsonExtension } = resolveCompilerOutputExtensions(configService?.outputExtensions)
        emitJsonAsset(
          {
            emitFile: (asset) => {
              this.emitFile(asset)
            },
          },
          jsonEmitFile.fileName,
          source,
          jsonExtension,
        )
        emittedSourceCache.set(normalizedFileName, source)
      }
    }
  }
}

interface RemovalRange {
  start: number
  end: number
}

function stripQuotes(value: string) {
  if (!value) {
    return value
  }
  const first = value[0]
  const last = value[value.length - 1]
  if ((first === last && (first === '"' || first === '\'')) || (first === '`' && last === '`')) {
    return value.slice(1, -1)
  }
  return value
}

function resolveRelativeImport(fromFile: string, specifier: string) {
  if (!specifier) {
    return ''
  }
  const dir = path.posix.dirname(fromFile)
  const absolute = path.posix.resolve('/', dir, specifier)
  return absolute.startsWith('/') ? absolute.slice(1) : absolute
}

function findImplicitRequireRemovalRanges(
  chunk: OutputChunk,
  targetFileNames: Set<string>,
): RemovalRange[] {
  const code = chunk.code
  const ranges: RemovalRange[] = []

  for (const match of code.matchAll(IMPLICIT_REQUIRE_RE)) {
    const specifier = stripQuotes(match[1])
    const resolved = resolveRelativeImport(chunk.fileName, specifier)

    if (!resolved || !targetFileNames.has(resolved)) {
      continue
    }

    const start = match.index
    const end = start + match[0].length
    ranges.push({ start, end })
  }

  return ranges
}

export function removeImplicitPagePreloads(
  bundle: OutputBundle,
  options: RemoveImplicitPagePreloadOptions,
) {
  const { configService, entriesMap } = options
  if (!entriesMap || entriesMap.size === 0) {
    return
  }

  const pageChunkFileNames = new Set<string>()
  for (const entry of entriesMap.values()) {
    if (!entry || entry.type !== 'page') {
      continue
    }
    const relative = configService.relativeAbsoluteSrcRoot(entry.path)
    const outputFile = changeFileExtension(relative, '.js')
    pageChunkFileNames.add(outputFile)
  }

  if (pageChunkFileNames.size === 0) {
    return
  }

  for (const chunk of Object.values(bundle)) {
    if (!chunk || chunk.type !== 'chunk' || typeof chunk.code !== 'string') {
      continue
    }

    const targetSet = new Set<string>()

    if (Array.isArray(chunk.imports)) {
      for (const imported of chunk.imports) {
        if (pageChunkFileNames.has(imported)) {
          targetSet.add(imported)
        }
      }
    }

    const rawImplicit = (chunk as any).implicitlyLoadedBefore
    const implicitlyLoaded = Array.isArray(rawImplicit) ? rawImplicit : undefined

    if (implicitlyLoaded) {
      for (const eager of implicitlyLoaded) {
        if (pageChunkFileNames.has(eager)) {
          targetSet.add(eager)
        }
      }
    }

    if (targetSet.size === 0) {
      continue
    }

    const ranges = findImplicitRequireRemovalRanges(chunk, targetSet)
    if (!ranges.length) {
      continue
    }

    const ms = new MagicString(chunk.code)
    for (const { start, end } of ranges) {
      ms.remove(start, end)
    }
    chunk.code = ms.toString()

    if (Array.isArray(chunk.imports) && chunk.imports.length) {
      chunk.imports = chunk.imports.filter(name => !targetSet.has(name))
    }
    if (implicitlyLoaded && implicitlyLoaded.length) {
      (chunk as any).implicitlyLoadedBefore = implicitlyLoaded.filter(name => !targetSet.has(name))
    }
  }
}

export function syncChunkImportsFromRequireCalls(bundle: OutputBundle) {
  const chunkFileNames = new Set(
    Object.values(bundle)
      .filter((output): output is OutputChunk => output?.type === 'chunk')
      .map(chunk => chunk.fileName),
  )

  for (const output of Object.values(bundle)) {
    if (!output || output.type !== 'chunk' || typeof output.code !== 'string') {
      continue
    }

    const chunk = output as OutputChunk
    const nextImports = new Set(Array.isArray(chunk.imports) ? chunk.imports : [])

    for (const match of chunk.code.matchAll(REQUIRE_CALL_RE)) {
      const specifier = stripQuotes(match[1])
      if (!specifier.startsWith('.')) {
        continue
      }

      const resolved = resolveRelativeImport(chunk.fileName, specifier)
      if (!resolved || resolved === chunk.fileName || !chunkFileNames.has(resolved)) {
        continue
      }

      nextImports.add(resolved)
    }

    chunk.imports = [...nextImports]
  }
}

function resolveRequireTarget(fromFile: string, specifier: string) {
  if (!specifier.startsWith('.')) {
    return ''
  }
  return resolveRelativeImport(fromFile, specifier)
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function collectLocalRuntimeIdentifiers(code: string) {
  const identifiers = new Set<string>()
  for (const match of code.matchAll(/\b(?:function|class)\s+([A-Za-z_$][\w$]*)\b/g)) {
    identifiers.add(match[1])
  }
  for (const match of code.matchAll(/\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=/g)) {
    identifiers.add(match[1])
  }
  return identifiers
}

function resolveWevuExportAliasMap(wevuChunk: OutputChunk) {
  const aliases = new Map<string, string>()
  const code = wevuChunk.code
  const localIdentifiers = collectLocalRuntimeIdentifiers(code)

  for (const [exportName] of WEVU_EXPORT_ALIASES) {
    const exportRe = new RegExp(`\\b([A-Za-z_$][\\w$]*)\\s+as\\s+${exportName}\\b`)
    const exportMatch = exportRe.exec(code)
    if (exportMatch?.[1]) {
      aliases.set(exportName, exportMatch[1])
    }
  }

  const propertyExports = Array.from(
    code.matchAll(/Object\.defineProperty\(exports,\s*["']([^"']+)["'][\s\S]*?return\s+([A-Za-z_$][\w$]*)\s*(?:;\s*)?\}/g),
  )
  for (const [exportName] of WEVU_EXPORT_ALIASES) {
    if (aliases.has(exportName)) {
      continue
    }
    const semanticExport = propertyExports.find(match => match[1] === exportName)
    if (semanticExport?.[2]) {
      aliases.set(exportName, semanticExport[2])
      continue
    }
    const stableExport = propertyExports.find(match => match[1] === `__wevu${exportName[0].toUpperCase()}${exportName.slice(1)}`)
    if (stableExport?.[2]) {
      aliases.set(exportName, stableExport[2])
      continue
    }
  }

  if (!aliases.has('defineComponent') && localIdentifiers.has('eo')) {
    aliases.set('defineComponent', 'eo')
  }
  if (!aliases.has('createWevuComponent') && localIdentifiers.has('to')) {
    aliases.set('createWevuComponent', 'to')
  }

  if (!aliases.has('defineComponent')) {
    const createWevuComponentExport = propertyExports.find(match => match[1] === 'createWevuComponent')
      ?? propertyExports.find(match => match[1] === '__wevuCreateWevuComponent')
    const createWevuComponentLocal = createWevuComponentExport?.[2]
    if (createWevuComponentLocal) {
      const functionRe = new RegExp(`function\\s+${createWevuComponentLocal}\\s*\\([^)]*\\)\\s*\\{[\\s\\S]{0,500}?\\b([A-Za-z_$][\\w$]*)\\s*\\(`)
      const functionMatch = functionRe.exec(code)
      if (functionMatch?.[1]) {
        aliases.set('defineComponent', functionMatch[1])
      }
    }
  }

  return aliases
}

function collectExistingExportNames(code: string) {
  return new Set(
    Array.from(
      code.matchAll(/Object\.defineProperty\(exports,\s*["']([^"']+)["']/g),
      match => match[1],
    ),
  )
}

function collectImportedWevuRuntimeMembers(
  bundle: OutputBundle,
  wevuChunkFileName: string,
) {
  const members = new Set<string>()

  for (const output of Object.values(bundle)) {
    if (!output || output.type !== 'chunk' || typeof output.code !== 'string' || output.fileName === wevuChunkFileName) {
      continue
    }

    const chunk = output as OutputChunk
    const runtimeRefs = new Set<string>()
    const localRequireRe = /\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*require\((`[^`]+`|'[^']+'|"[^"]+")\);?/g
    for (const match of chunk.code.matchAll(localRequireRe)) {
      const resolved = resolveRequireTarget(chunk.fileName, stripQuotes(match[2]))
      if (resolved === wevuChunkFileName) {
        runtimeRefs.add(match[1])
      }
    }

    for (const ref of runtimeRefs) {
      const memberRe = new RegExp(`\\b${escapeRegExp(ref)}\\.([A-Za-z_$][\\w$]*)\\b`, 'g')
      for (const match of chunk.code.matchAll(memberRe)) {
        members.add(match[1])
      }
    }

    const inlineRequireRe = /require\((`[^`]+`|'[^']+'|"[^"]+")\)\.([A-Za-z_$][\w$]*)\b/g
    for (const match of chunk.code.matchAll(inlineRequireRe)) {
      const resolved = resolveRequireTarget(chunk.fileName, stripQuotes(match[1]))
      if (resolved === wevuChunkFileName) {
        members.add(match[2])
      }
    }
  }

  return members
}

function appendWevuRuntimeExports(
  chunk: OutputChunk,
  aliases: Map<string, string>,
  importedMembers: Set<string>,
) {
  const lines: string[] = []
  const existingExports = collectExistingExportNames(chunk.code)
  const localIdentifiers = collectLocalRuntimeIdentifiers(chunk.code)

  for (const [exportName, stableName] of WEVU_EXPORT_ALIASES) {
    const localName = aliases.get(exportName)
    if (!localName || existingExports.has(stableName)) {
      continue
    }
    lines.push(`Object.defineProperty(exports, ${JSON.stringify(stableName)}, { enumerable: false, get: function() { return ${localName}; } });`)
    existingExports.add(stableName)
  }

  for (const member of importedMembers) {
    if (!JS_IDENTIFIER_RE.test(member) || existingExports.has(member) || !localIdentifiers.has(member)) {
      continue
    }
    lines.push(`Object.defineProperty(exports, ${JSON.stringify(member)}, { enumerable: true, get: function() { return ${member}; } });`)
    existingExports.add(member)
  }

  if (lines.length) {
    chunk.code = `${chunk.code}\n${lines.join('\n')}`
  }
}

function rewriteStableWevuRuntimeAccess(chunk: OutputChunk, wevuChunkFileName: string, aliases: Map<string, string>) {
  if (!aliases.size) {
    return
  }

  let nextCode = chunk.code
  for (const [exportName, stableName] of WEVU_EXPORT_ALIASES) {
    const localName = aliases.get(exportName)
    if (!localName) {
      continue
    }
    const inlineRequireRe = /require\((`[^`]+`|'[^']+'|"[^"]+")\)\.([A-Za-z_$][\w$]*)\s*\(/g
    nextCode = nextCode.replace(inlineRequireRe, (full, rawSpecifier: string, property: string) => {
      if (property !== localName && property !== stableName) {
        return full
      }
      const resolved = resolveRequireTarget(chunk.fileName, stripQuotes(rawSpecifier))
      if (resolved !== wevuChunkFileName) {
        return full
      }
      return `(require(${rawSpecifier}).${stableName} || require(${rawSpecifier}).${property})(`
    })

    const localRequireRe = /\b((?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*require\((`[^`]+`|'[^']+'|"[^"]+")\);?)/g
    const runtimeRefs = new Set<string>()
    for (const match of nextCode.matchAll(localRequireRe)) {
      const resolved = resolveRequireTarget(chunk.fileName, stripQuotes(match[3]))
      if (resolved === wevuChunkFileName) {
        runtimeRefs.add(match[2])
      }
    }

    for (const ref of runtimeRefs) {
      const memberRe = new RegExp(`\\b${escapeRegExp(ref)}\\.(?:${stableName}|${localName})\\s*\\(`, 'g')
      nextCode = nextCode.replace(memberRe, (full) => {
        const property = full.includes(`.${stableName}`) ? stableName : localName
        return `(${ref}.${stableName} || ${ref}.${property})(`
      })
    }
  }

  chunk.code = nextCode
}

export function stabilizeWevuRuntimeChunkAccess(bundle: OutputBundle) {
  const wevuChunk = Object.values(bundle).find((output): output is OutputChunk => {
    return output?.type === 'chunk' && WEVU_SRC_CHUNK_RE.test(output.fileName)
  })
  if (!wevuChunk) {
    return
  }

  const aliases = resolveWevuExportAliasMap(wevuChunk)
  const importedMembers = collectImportedWevuRuntimeMembers(bundle, wevuChunk.fileName)

  appendWevuRuntimeExports(wevuChunk, aliases, importedMembers)
  for (const output of Object.values(bundle)) {
    if (!output || output.type !== 'chunk' || typeof output.code !== 'string' || output.fileName === wevuChunk.fileName) {
      continue
    }
    rewriteStableWevuRuntimeAccess(output as OutputChunk, wevuChunk.fileName, aliases)
  }
}
