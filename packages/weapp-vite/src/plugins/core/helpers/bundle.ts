import type { OutputBundle, OutputChunk } from 'rolldown'
import type { CompilerContext } from '../../../context'
import type { CorePluginState, RemoveImplicitPagePreloadOptions } from './types'
import { isEmptyObject, isObject } from '@weapp-core/shared'
import MagicString from 'magic-string'
import path from 'pathe'
import { changeFileExtension } from '../../../utils/file'
import { emitJsonAsset } from '../../utils/wxmlEmit'

export function filterPluginBundleOutputs(
  bundle: OutputBundle,
  configService: CompilerContext['configService'],
) {
  const pluginOutputRoot = configService.absolutePluginOutputRoot
  for (const [fileName] of Object.entries(bundle)) {
    const absolute = path.resolve(configService.outDir, fileName)
    const relative = pluginOutputRoot
      ? path.relative(pluginOutputRoot, absolute)
      : ''
    const isPluginFile = pluginOutputRoot
      ? !relative.startsWith('..') && !path.isAbsolute(relative)
      : fileName.startsWith(path.basename(configService.absolutePluginRoot ?? 'plugin'))
    if (!isPluginFile) {
      delete bundle[fileName]
    }
  }
}

export function emitJsonAssets(this: any, state: CorePluginState) {
  const { ctx } = state
  const { jsonService } = ctx

  for (const jsonEmitFile of state.jsonEmitFilesMap.values()) {
    if (
      jsonEmitFile.entry.json
      && isObject(jsonEmitFile.entry.json)
      && !isEmptyObject(jsonEmitFile.entry.json)
    ) {
      const source = jsonService.resolve(jsonEmitFile.entry)
      if (source && jsonEmitFile.fileName) {
        emitJsonAsset(
          {
            emitFile: (asset) => {
              this.emitFile(asset)
            },
          },
          jsonEmitFile.fileName,
          source,
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
  const requireRE = /\b(?:const|let|var)\s+[A-Za-z_$][\w$]*\s*=\s*require\((`[^`]+`|'[^']+'|"[^"]+")\);?/g

  for (const match of code.matchAll(requireRE)) {
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
