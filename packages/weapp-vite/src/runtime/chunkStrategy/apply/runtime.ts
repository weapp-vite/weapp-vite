import type { OutputAsset, OutputBundle, OutputChunk, PluginContext } from 'rolldown'
import { Buffer } from 'node:buffer'
import { posix as path } from 'pathe'
import { ensureUniqueFileName, updateImporters } from '../bundle'
import { resolveSubPackagePrefix } from '../collector'
import { cloneSourceLike } from '../sourcemap'

const ROLLDOWN_RUNTIME_FILE_NAME = 'rolldown-runtime.js'

export interface RuntimeChunkDuplicateDetail {
  fileName: string
  importers: string[]
}

export interface RuntimeChunkDuplicatePayload {
  runtimeFileName: string
  duplicates: RuntimeChunkDuplicateDetail[]
}

export interface ApplyRuntimeChunkLocalizationOptions {
  subPackageRoots: Iterable<string>
  forceRoots?: Iterable<string>
  runtimeFileName?: string
  onDuplicate?: (payload: RuntimeChunkDuplicatePayload) => void
}

export function applyRuntimeChunkLocalization(
  this: PluginContext | undefined,
  bundle: OutputBundle,
  options: ApplyRuntimeChunkLocalizationOptions,
) {
  if (!this) {
    throw new Error('applyRuntimeChunkLocalization 需要 PluginContext。')
  }

  const runtimeFileName = options.runtimeFileName ?? ROLLDOWN_RUNTIME_FILE_NAME
  const runtimeRecord = resolveRuntimeBundleRecord(bundle, runtimeFileName)
  if (!runtimeRecord) {
    return
  }
  const { output: runtimeOutput, lookupKeys: runtimeLookupKeys } = runtimeRecord

  const runtimeSource = resolveRuntimeSource(runtimeOutput)
  if (!runtimeSource) {
    return
  }

  const subPackageRoots = Array.from(options.subPackageRoots).filter(Boolean)
  if (!subPackageRoots.length) {
    return
  }

  const runtimeLookupSet = new Set(runtimeLookupKeys)
  const rootToImporters = new Map<string, string[]>()
  for (const [fileName, output] of Object.entries(bundle)) {
    if (output?.type !== 'chunk') {
      continue
    }
    const root = resolveSubPackagePrefix(fileName, subPackageRoots)
    if (!root) {
      continue
    }
    if (!chunkReferencesRuntime(output as OutputChunk, runtimeFileName, runtimeLookupSet)) {
      continue
    }

    const existing = rootToImporters.get(root)
    if (existing) {
      existing.push(fileName)
    }
    else {
      rootToImporters.set(root, [fileName])
    }
  }
  const forceRoots = Array.from(options.forceRoots ?? []).filter(Boolean)
  for (const root of forceRoots) {
    if (!subPackageRoots.includes(root)) {
      continue
    }
    if (!rootToImporters.has(root)) {
      rootToImporters.set(root, [])
    }
  }

  if (!rootToImporters.size) {
    return
  }

  const importerToRuntime = new Map<string, string>()
  const duplicates: RuntimeChunkDuplicateDetail[] = []

  for (const [root, importerFiles] of rootToImporters.entries()) {
    const duplicateBaseName = path.basename(runtimeFileName)
    const intendedFileName = path.join(root, duplicateBaseName)
    const uniqueFileName = ensureUniqueFileName(bundle, intendedFileName)

    this.emitFile({
      type: 'asset',
      fileName: uniqueFileName,
      source: cloneSourceLike(runtimeSource),
    })

    for (const importerFile of importerFiles) {
      importerToRuntime.set(importerFile, uniqueFileName)
    }
    duplicates.push({
      fileName: uniqueFileName,
      importers: [...importerFiles],
    })
  }

  for (const target of runtimeLookupKeys) {
    updateImporters(bundle, importerToRuntime, target)
  }
  options.onDuplicate?.({
    runtimeFileName,
    duplicates,
  })
}

export function chunkReferencesRuntime(
  chunk: OutputChunk,
  runtimeFileName: string,
  runtimeLookupSet: Set<string>,
) {
  const hasRuntimeReference = (specifier: string) =>
    runtimeLookupSet.has(specifier) || path.basename(specifier) === runtimeFileName

  if (chunk.imports.some(hasRuntimeReference) || chunk.dynamicImports.some(hasRuntimeReference)) {
    return true
  }

  const metadata = (chunk as any).viteMetadata
  if (metadata) {
    const importedChunks = metadata.importedChunks
    if (hasInCollection(importedChunks, runtimeFileName)) {
      return true
    }
    for (const lookupKey of runtimeLookupSet) {
      if (hasInCollection(importedChunks, lookupKey)) {
        return true
      }
    }

    const importedScripts = metadata.importedScripts ?? metadata.importedScriptsByUrl
    if (hasInCollection(importedScripts, runtimeFileName)) {
      return true
    }
    for (const lookupKey of runtimeLookupSet) {
      if (hasInCollection(importedScripts, lookupKey)) {
        return true
      }
    }
  }

  return (chunk.code ?? '').includes(runtimeFileName)
}

function resolveRuntimeBundleRecord(
  bundle: OutputBundle,
  runtimeFileName: string,
): { output: OutputChunk | OutputAsset, lookupKeys: string[] } | undefined {
  const direct = bundle[runtimeFileName]
  if (isRuntimeBundleOutput(direct)) {
    const directFileName = resolveBundleOutputFileName(direct, runtimeFileName)
    return {
      output: direct,
      lookupKeys: dedupeLookupKeys([runtimeFileName, directFileName]),
    }
  }

  for (const [key, output] of Object.entries(bundle)) {
    if (!isRuntimeBundleOutput(output)) {
      continue
    }
    const fileName = resolveBundleOutputFileName(output, key)
    if (fileName !== runtimeFileName && path.basename(fileName) !== runtimeFileName) {
      continue
    }
    return {
      output,
      lookupKeys: dedupeLookupKeys([runtimeFileName, key, fileName]),
    }
  }

  return undefined
}

function resolveRuntimeSource(output: OutputChunk | OutputAsset) {
  if (output.type === 'chunk') {
    return output.code || undefined
  }
  if (typeof output.source === 'string' || output.source instanceof Uint8Array || Buffer.isBuffer(output.source)) {
    return output.source
  }
  if (output.source == null) {
    return undefined
  }
  return String(output.source)
}

function hasInCollection(collection: unknown, value: string) {
  if (!collection || !value) {
    return false
  }
  if (collection instanceof Set) {
    return collection.has(value)
  }
  if (Array.isArray(collection)) {
    return collection.includes(value)
  }
  if (collection instanceof Map) {
    return collection.has(value)
  }
  return false
}

function resolveBundleOutputFileName(output: OutputChunk | OutputAsset, fallback: string) {
  if (typeof output.fileName === 'string' && output.fileName) {
    return output.fileName
  }
  return fallback
}

function dedupeLookupKeys(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)))
}

function isRuntimeBundleOutput(output: OutputBundle[string] | undefined): output is OutputChunk | OutputAsset {
  return output?.type === 'chunk' || output?.type === 'asset'
}
