import type { OutputBundle, OutputChunk, RolldownOutput } from 'rolldown'
import type { BuildTarget, CompilerContext } from '../../context'
import type { Entry, SubPackageMetaValue } from '../../types'
import { isEmptyObject, isObject } from '@weapp-core/shared'
import MagicString from 'magic-string'
import path from 'pathe'
import { changeFileExtension } from '../../utils/file'
import { isSkippableResolvedId, normalizeFsResolvedId } from '../../utils/resolvedId'
import { emitJsonAsset } from '../utils/wxmlEmit'

type LoadEntryApi = ReturnType<typeof import('../hooks/useLoadEntry').useLoadEntry>

export interface IndependentBuildResult {
  meta: SubPackageMetaValue
  rollup: RolldownOutput
}

export interface CorePluginState {
  ctx: CompilerContext
  subPackageMeta?: SubPackageMetaValue
  loadEntry: LoadEntryApi['loadEntry']
  loadedEntrySet: LoadEntryApi['loadedEntrySet']
  markEntryDirty: LoadEntryApi['markEntryDirty']
  emitDirtyEntries: LoadEntryApi['emitDirtyEntries']
  entriesMap: LoadEntryApi['entriesMap']
  jsonEmitFilesMap: LoadEntryApi['jsonEmitFilesMap']
  resolvedEntryMap: LoadEntryApi['resolvedEntryMap']
  requireAsyncEmittedChunks: Set<string>
  pendingIndependentBuilds: Promise<IndependentBuildResult>[]
  watchFilesSnapshot: string[]
  buildTarget: BuildTarget
  moduleImporters: Map<string, Set<string>>
  entryModuleIds: Set<string>
  hmrState: {
    didEmitAllEntries: boolean
    hasBuiltOnce: boolean
  }
  hmrSharedChunksMode: 'full' | 'auto' | 'off'
  hmrSharedChunkImporters: Map<string, Set<string>>
}

export interface RemoveImplicitPagePreloadOptions {
  configService: CompilerContext['configService']
  entriesMap: Map<string, Entry | undefined>
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return '0 B'
  }
  const units = ['B', 'KB', 'MB', 'GB']
  let value = bytes
  let index = 0
  while (value >= 1024 && index < units.length - 1) {
    value /= 1024
    index++
  }
  const precision = value >= 100 ? 0 : value >= 10 ? 1 : 2
  const formatted = value.toFixed(precision).replace(/\.0+$/, '')
  return `${formatted} ${units[index]}`
}

export function collectAffectedEntries(state: CorePluginState, startId: string) {
  const affected = new Set<string>()
  const visited = new Set<string>()
  const queue: string[] = [startId]

  while (queue.length) {
    const current = queue.shift()!
    if (visited.has(current)) {
      continue
    }
    visited.add(current)

    if (state.entryModuleIds.has(current)) {
      affected.add(current)
      continue
    }

    const importers = state.moduleImporters.get(current)
    if (!importers || importers.size === 0) {
      continue
    }

    for (const importer of importers) {
      if (!visited.has(importer)) {
        queue.push(importer)
      }
    }
  }

  return affected
}

export function refreshModuleGraph(
  pluginCtx: { getModuleIds?: () => Iterable<string>, getModuleInfo?: (id: string) => any },
  state: CorePluginState,
) {
  state.moduleImporters.clear()
  state.entryModuleIds.clear()

  if (typeof pluginCtx.getModuleIds !== 'function' || typeof pluginCtx.getModuleInfo !== 'function') {
    return
  }

  for (const rawId of pluginCtx.getModuleIds()) {
    const normalizedId = normalizeFsResolvedId(rawId)
    if (isSkippableResolvedId(normalizedId)) {
      continue
    }

    const info = pluginCtx.getModuleInfo(rawId)
    if (!info) {
      continue
    }

    if (info.isEntry) {
      state.entryModuleIds.add(normalizedId)
    }

    const importers = new Set<string>()
    const importerIds: string[] = []
    if (Array.isArray(info.importers)) {
      importerIds.push(...info.importers)
    }
    if (Array.isArray(info.dynamicImporters)) {
      importerIds.push(...info.dynamicImporters)
    }
    for (const importer of importerIds) {
      const normalizedImporter = normalizeFsResolvedId(importer)
      if (isSkippableResolvedId(normalizedImporter)) {
        continue
      }
      importers.add(normalizedImporter)
    }

    if (importers.size) {
      state.moduleImporters.set(normalizedId, importers)
    }
  }
}

export function refreshSharedChunkImporters(bundle: OutputBundle, state: CorePluginState) {
  state.hmrSharedChunkImporters.clear()

  const isEntryChunk = (chunk: OutputChunk) => {
    if (chunk.isEntry) {
      return true
    }
    if (!chunk.facadeModuleId) {
      return false
    }
    const entryId = normalizeFsResolvedId(chunk.facadeModuleId)
    return state.resolvedEntryMap.has(entryId)
  }

  const entryChunks: Array<{ entryId: string, chunk: OutputChunk }> = []
  for (const output of Object.values(bundle)) {
    if (output?.type !== 'chunk') {
      continue
    }
    const chunk = output as OutputChunk
    if (!chunk.facadeModuleId) {
      continue
    }
    if (!isEntryChunk(chunk)) {
      continue
    }
    const entryId = normalizeFsResolvedId(chunk.facadeModuleId)
    entryChunks.push({ entryId, chunk })
  }

  if (!entryChunks.length) {
    return
  }

  for (const { chunk, entryId } of entryChunks) {
    const imports = new Set<string>()
    if (Array.isArray(chunk.imports)) {
      for (const imported of chunk.imports) {
        imports.add(imported)
      }
    }
    if (Array.isArray(chunk.dynamicImports)) {
      for (const imported of chunk.dynamicImports) {
        imports.add(imported)
      }
    }
    if (!imports.size) {
      continue
    }

    for (const imported of imports) {
      const target = bundle[imported]
      if (!target || target.type !== 'chunk') {
        continue
      }
      const targetChunk = target as OutputChunk
      if (isEntryChunk(targetChunk)) {
        continue
      }
      const current = state.hmrSharedChunkImporters.get(imported)
      if (current) {
        current.add(entryId)
      }
      else {
        state.hmrSharedChunkImporters.set(imported, new Set([entryId]))
      }
    }
  }
}

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

export async function flushIndependentBuilds(
  this: any,
  state: CorePluginState,
) {
  const { subPackageMeta, pendingIndependentBuilds } = state

  if (subPackageMeta || pendingIndependentBuilds.length === 0) {
    return
  }

  const outputs = await Promise.all(pendingIndependentBuilds)

  for (const { rollup } of outputs) {
    const bundleOutputs = Array.isArray(rollup?.output) ? rollup.output : []
    for (const output of bundleOutputs) {
      if (output.type === 'chunk') {
        this.emitFile({
          type: 'asset',
          source: output.code,
          fileName: output.fileName,
          name: output.name,
        })
      }
      else {
        this.emitFile({
          type: 'asset',
          source: output.source,
          fileName: output.fileName,
        })
      }
    }
  }

  state.pendingIndependentBuilds = []
}
