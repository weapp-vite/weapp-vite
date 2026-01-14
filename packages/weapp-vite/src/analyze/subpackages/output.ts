import type { OutputAsset, OutputChunk, RolldownOutput } from 'rolldown'
import type { CompilerContext } from '../../context'
import type { BuildOrigin, ModuleAccumulator, ModuleInFile, PackageAccumulator, PackageClassifierContext, PackageFileEntry } from './types'
import { Buffer } from 'node:buffer'
import { classifyPackage, normalizeModuleId, resolveAssetSource, resolveModuleSourceType } from './classifier'
import { ensurePackage, registerModuleInPackage } from './registry'

function getAssetSize(asset: OutputAsset) {
  if (typeof asset.source === 'string') {
    return Buffer.byteLength(asset.source, 'utf8')
  }
  if (asset.source instanceof Uint8Array) {
    return asset.source.byteLength
  }
}

function processChunk(
  chunk: OutputChunk,
  origin: BuildOrigin,
  ctx: CompilerContext,
  classifierContext: PackageClassifierContext,
  packages: Map<string, PackageAccumulator>,
  modules: Map<string, ModuleAccumulator>,
) {
  const classification = classifyPackage(chunk.fileName, origin, classifierContext)
  const packageEntry = ensurePackage(packages, classification)

  const chunkEntry: PackageFileEntry = {
    file: chunk.fileName,
    type: 'chunk',
    from: origin,
    size: typeof chunk.code === 'string' ? Buffer.byteLength(chunk.code, 'utf8') : undefined,
    isEntry: chunk.isEntry,
    modules: [],
  }

  const moduleEntries = Object.entries(chunk.modules ?? {})
  for (const [rawModuleId, info] of moduleEntries) {
    const absoluteId = normalizeModuleId(rawModuleId)
    if (!absoluteId) {
      continue
    }

    const { source, sourceType } = resolveModuleSourceType(absoluteId, ctx)
    const moduleEntry: ModuleInFile = {
      id: absoluteId,
      source,
      sourceType,
      bytes: info?.renderedLength,
    }
    if (typeof info?.code === 'string') {
      moduleEntry.originalBytes = Buffer.byteLength(info.code, 'utf8')
    }

    chunkEntry.modules!.push(moduleEntry)

    registerModuleInPackage(
      modules,
      absoluteId,
      source,
      sourceType,
      classification.id,
      chunk.fileName,
    )
  }

  if (chunkEntry.modules) {
    chunkEntry.modules.sort((a, b) => a.source.localeCompare(b.source))
  }

  packageEntry.files.set(chunk.fileName, chunkEntry)
}

function processAsset(
  asset: OutputAsset,
  origin: BuildOrigin,
  ctx: CompilerContext,
  classifierContext: PackageClassifierContext,
  packages: Map<string, PackageAccumulator>,
  modules: Map<string, ModuleAccumulator>,
) {
  const classification = classifyPackage(asset.fileName, origin, classifierContext)
  const packageEntry = ensurePackage(packages, classification)

  const entry: PackageFileEntry = {
    file: asset.fileName,
    type: 'asset',
    from: origin,
    size: getAssetSize(asset),
  }

  const assetSource = resolveAssetSource(asset.fileName, ctx)
  if (assetSource) {
    entry.source = assetSource.source
    registerModuleInPackage(
      modules,
      assetSource.absolute,
      assetSource.source,
      assetSource.sourceType,
      classification.id,
      asset.fileName,
    )
  }

  packageEntry.files.set(asset.fileName, entry)
}

export function processOutput(
  output: RolldownOutput | undefined,
  origin: BuildOrigin,
  ctx: CompilerContext,
  classifierContext: PackageClassifierContext,
  packages: Map<string, PackageAccumulator>,
  modules: Map<string, ModuleAccumulator>,
) {
  if (!output) {
    return
  }

  for (const item of output.output ?? []) {
    if (item.type === 'chunk') {
      processChunk(item, origin, ctx, classifierContext, packages, modules)
    }
    else if (item.type === 'asset') {
      processAsset(item, origin, ctx, classifierContext, packages, modules)
    }
  }
}
