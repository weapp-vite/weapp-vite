import type { OutputBundle, OutputChunk } from 'rolldown'
import type { CompilerContext } from '../../../context'
import type { CorePluginState, RemoveImplicitPagePreloadOptions } from './types'
import { isEmptyObject, isObject } from '@weapp-core/shared'
import MagicString from 'magic-string'
import path from 'pathe'
import { changeFileExtension } from '../../../utils/file'
import { normalizeRelativePath } from '../../../utils/path'
import { emitJsonAsset } from '../../utils/wxmlEmit'

const IMPLICIT_REQUIRE_RE = /\b(?:const|let|var)\s+[A-Za-z_$][\w$]*\s*=\s*require\((`[^`]+`|'[^']+'|"[^"]+")\);?/g

export function filterPluginBundleOutputs(
  bundle: OutputBundle,
  configService: CompilerContext['configService'],
) {
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
  for (const [fileName] of Object.entries(bundle)) {
    const isPluginFile = fileName === pluginBundleBase || fileName.startsWith(`${pluginBundleBase}/`)
    if (!isPluginFile) {
      delete bundle[fileName]
    }
  }
}

export function emitJsonAssets(this: any, state: CorePluginState) {
  const { ctx } = state
  const { jsonService, configService } = ctx

  for (const jsonEmitFile of state.jsonEmitFilesMap.values()) {
    if (
      jsonEmitFile.entry.json
      && isObject(jsonEmitFile.entry.json)
      && !isEmptyObject(jsonEmitFile.entry.json)
    ) {
      const source = jsonService.resolve(jsonEmitFile.entry)
      if (source && jsonEmitFile.fileName) {
        const jsonExtension = configService?.outputExtensions?.json ?? 'json'
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
      }
    }
  }
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

interface RemovalRange {
  start: number
  end: number
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

function stripQuotes(value: string) {
  if (!value) {
    return value
  }
  const first = value[0]
  const last = value.at(-1)
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
