import type { OutputAsset, OutputChunk, RolldownOutput } from 'rolldown'
import type { CompilerContext } from '../context'
import type { SubPackageMetaValue } from '../types'
import { Buffer } from 'node:buffer'
import { posix as path } from 'pathe'
import { build } from 'vite'
import { SHARED_CHUNK_VIRTUAL_PREFIX } from '../runtime/chunkStrategy'
import { createSharedBuildConfig } from '../runtime/sharedBuildConfig'

type PackageType = 'main' | 'subPackage' | 'independent' | 'virtual'
type ModuleSourceType = 'src' | 'plugin' | 'node_modules' | 'workspace'
type BuildOrigin = 'main' | 'independent'

export interface ModuleInFile {
  id: string
  source: string
  sourceType: ModuleSourceType
  bytes?: number
  originalBytes?: number
}

export interface PackageFileEntry {
  file: string
  type: 'chunk' | 'asset'
  from: BuildOrigin
  size?: number
  isEntry?: boolean
  modules?: ModuleInFile[]
  source?: string
}

export interface PackageReport {
  id: string
  label: string
  type: PackageType
  files: PackageFileEntry[]
}

export interface ModuleUsage {
  id: string
  source: string
  sourceType: ModuleSourceType
  packages: Array<{ packageId: string, files: string[] }>
}

export interface SubPackageDescriptor {
  root: string
  independent: boolean
  name?: string
}

export interface AnalyzeSubpackagesResult {
  packages: PackageReport[]
  modules: ModuleUsage[]
  subPackages: SubPackageDescriptor[]
}

interface PackageAccumulator {
  id: string
  label: string
  type: PackageType
  files: Map<string, PackageFileEntry>
}

interface ModuleAccumulator {
  id: string
  source: string
  sourceType: ModuleSourceType
  packages: Map<string, Set<string>>
}

interface PackageClassifierContext {
  subPackageRoots: Set<string>
  independentRoots: Set<string>
}

interface ClassifiedPackage {
  id: string
  label: string
  type: PackageType
}

const VIRTUAL_MODULE_INDICATOR = '\u0000'
const VIRTUAL_PREFIX = `${SHARED_CHUNK_VIRTUAL_PREFIX}/`

function isPathInside(parent: string | undefined, candidate: string) {
  if (!parent) {
    return false
  }
  const relative = path.relative(parent, candidate)
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative))
}

function ensurePackage(
  packages: Map<string, PackageAccumulator>,
  classification: ClassifiedPackage,
): PackageAccumulator {
  const existing = packages.get(classification.id)
  if (existing) {
    return existing
  }
  const created: PackageAccumulator = {
    ...classification,
    files: new Map<string, PackageFileEntry>(),
  }
  packages.set(classification.id, created)
  return created
}

function ensureModule(
  modules: Map<string, ModuleAccumulator>,
  id: string,
  source: string,
  sourceType: ModuleSourceType,
): ModuleAccumulator {
  const existing = modules.get(id)
  if (existing) {
    return existing
  }
  const created: ModuleAccumulator = {
    id,
    source,
    sourceType,
    packages: new Map<string, Set<string>>(),
  }
  modules.set(id, created)
  return created
}

function registerModuleInPackage(
  modules: Map<string, ModuleAccumulator>,
  moduleId: string,
  source: string,
  sourceType: ModuleSourceType,
  packageId: string,
  fileName: string,
) {
  const moduleEntry = ensureModule(modules, moduleId, source, sourceType)
  const files = moduleEntry.packages.get(packageId) ?? new Set<string>()
  files.add(fileName)
  moduleEntry.packages.set(packageId, files)
}

function classifyPackage(
  fileName: string,
  origin: BuildOrigin,
  context: PackageClassifierContext,
): ClassifiedPackage {
  if (fileName.startsWith(VIRTUAL_PREFIX)) {
    const combination = fileName.slice(VIRTUAL_PREFIX.length).split('/')[0] || 'shared'
    return {
      id: `virtual:${combination}`,
      label: `共享虚拟包 ${combination}`,
      type: 'virtual',
    }
  }

  const segments = fileName.split('/')
  const rootCandidate = segments[0] ?? ''
  if (rootCandidate && context.subPackageRoots.has(rootCandidate)) {
    const isIndependent = context.independentRoots.has(rootCandidate)
    return {
      id: rootCandidate,
      label: `${isIndependent ? '独立分包' : '分包'} ${rootCandidate}`,
      type: isIndependent || origin === 'independent' ? 'independent' : 'subPackage',
    }
  }

  return {
    id: '__main__',
    label: '主包',
    type: 'main',
  }
}

function normalizeModuleId(id: string) {
  if (!id || id.includes(VIRTUAL_MODULE_INDICATOR)) {
    return undefined
  }
  if (!path.isAbsolute(id)) {
    return undefined
  }
  return path.normalize(id)
}

function resolveModuleSourceType(
  absoluteId: string,
  ctx: CompilerContext,
): { source: string, sourceType: ModuleSourceType } {
  const { configService } = ctx
  const isNodeModule = absoluteId.includes('/node_modules/')
    || absoluteId.includes('\\node_modules\\')
  const pluginRoot = configService.absolutePluginRoot
  const srcRoot = configService.absoluteSrcRoot
  const inSrc = isPathInside(srcRoot, absoluteId)
  const inPlugin = pluginRoot ? isPathInside(pluginRoot, absoluteId) : false

  let sourceType: ModuleSourceType
  if (isNodeModule) {
    sourceType = 'node_modules'
  }
  else if (inSrc) {
    sourceType = 'src'
  }
  else if (inPlugin) {
    sourceType = 'plugin'
  }
  else {
    sourceType = 'workspace'
  }

  return {
    source: configService.relativeAbsoluteSrcRoot(absoluteId),
    sourceType,
  }
}

function resolveAssetSource(
  fileName: string,
  ctx: CompilerContext,
): { absolute: string, source: string, sourceType: ModuleSourceType } | undefined {
  const { configService } = ctx
  const normalized = path.normalize(fileName)
  const srcCandidate = path.resolve(configService.absoluteSrcRoot, normalized)

  if (isPathInside(configService.absoluteSrcRoot, srcCandidate)) {
    return {
      absolute: srcCandidate,
      source: configService.relativeAbsoluteSrcRoot(srcCandidate),
      sourceType: 'src',
    }
  }

  const pluginRoot = configService.absolutePluginRoot
  if (pluginRoot) {
    const pluginBase = path.basename(pluginRoot)
    if (normalized === pluginBase || normalized.startsWith(`${pluginBase}/`)) {
      const relative = normalized === pluginBase
        ? ''
        : normalized.slice(pluginBase.length + 1)
      const absolute = path.resolve(pluginRoot, relative)
      if (isPathInside(pluginRoot, absolute)) {
        return {
          absolute,
          source: configService.relativeAbsoluteSrcRoot(absolute),
          sourceType: 'plugin',
        }
      }
    }
  }
}

function toArray<T>(value: Iterable<T>) {
  return Array.from(value)
}

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

function processOutput(
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

function summarizePackages(packages: Map<string, PackageAccumulator>): PackageReport[] {
  const order: Record<PackageType, number> = {
    main: 0,
    subPackage: 1,
    independent: 2,
    virtual: 3,
  }

  const reports = toArray(packages.values()).map((pkg) => {
    const files = toArray(pkg.files.values())
    files.sort((a, b) => a.file.localeCompare(b.file))
    return {
      id: pkg.id,
      label: pkg.label,
      type: pkg.type,
      files,
    }
  })

  reports.sort((a, b) => {
    const delta = order[a.type] - order[b.type]
    if (delta !== 0) {
      return delta
    }
    if (a.id === '__main__') {
      return -1
    }
    if (b.id === '__main__') {
      return 1
    }
    return a.id.localeCompare(b.id)
  })

  return reports
}

function summarizeModules(
  modules: Map<string, ModuleAccumulator>,
): ModuleUsage[] {
  const usage = toArray(modules.values()).map((module) => {
    const packages = toArray(module.packages.entries()).map(([packageId, files]) => {
      const sortedFiles = toArray(files).sort((a, b) => a.localeCompare(b))
      return {
        packageId,
        files: sortedFiles,
      }
    }).sort((a, b) => {
      if (a.packageId === b.packageId) {
        return 0
      }
      if (a.packageId === '__main__') {
        return -1
      }
      if (b.packageId === '__main__') {
        return 1
      }
      return a.packageId.localeCompare(b.packageId)
    })

    return {
      id: module.id,
      source: module.source,
      sourceType: module.sourceType,
      packages,
    }
  })

  usage.sort((a, b) => a.source.localeCompare(b.source))
  return usage
}

function expandVirtualModulePlacements(
  modules: Map<string, ModuleAccumulator>,
  packages: Map<string, PackageAccumulator>,
  context: PackageClassifierContext,
) {
  for (const moduleEntry of modules.values()) {
    const virtualEntries = Array.from(moduleEntry.packages.entries())
      .filter(([packageId]) => packageId.startsWith('virtual:'))

    if (!virtualEntries.length) {
      continue
    }

    const virtualFileBases = new Map<string, string[]>()

    for (const [virtualPackageId, files] of virtualEntries) {
      const combination = virtualPackageId.slice('virtual:'.length)
      if (!combination) {
        continue
      }

      const segments = combination.split(/[_+]/).map(segment => segment.trim()).filter(Boolean)
      if (!segments.length) {
        continue
      }

      let matchingBases = virtualFileBases.get(virtualPackageId)
      if (!matchingBases) {
        matchingBases = Array.from(files).map(file => path.basename(file))
        virtualFileBases.set(virtualPackageId, matchingBases)
      }

      for (const root of segments) {
        if (!context.subPackageRoots.has(root)) {
          continue
        }

        const targetPackage = packages.get(root)
        if (!targetPackage) {
          continue
        }

        const moduleFiles = moduleEntry.packages.get(root) ?? new Set<string>()
        const targetFiles = Array.from(targetPackage.files.values())
          .filter((fileEntry) => {
            if (!matchingBases?.length) {
              return true
            }
            const base = path.basename(fileEntry.file)
            return matchingBases.includes(base)
          })
          .map(fileEntry => fileEntry.file)

        if (targetFiles.length === 0) {
          const fallback = targetPackage.files.values().next().value as PackageFileEntry | undefined
          if (fallback) {
            moduleFiles.add(fallback.file)
          }
        }
        else {
          for (const fileName of targetFiles) {
            moduleFiles.add(fileName)
          }
        }

        if (moduleFiles.size > 0) {
          moduleEntry.packages.set(root, moduleFiles)
        }
      }
    }
  }
}

function summarizeSubPackages(metas: SubPackageMetaValue[]): SubPackageDescriptor[] {
  const descriptors = metas
    .map((meta) => {
      const root = meta.subPackage.root ?? ''
      return {
        root,
        independent: Boolean(meta.subPackage.independent),
        name: meta.subPackage.name,
      }
    })
    .filter(descriptor => descriptor.root)

  descriptors.sort((a, b) => a.root.localeCompare(b.root))
  return descriptors
}

export async function analyzeSubpackages(ctx: CompilerContext): Promise<AnalyzeSubpackagesResult> {
  const { configService, scanService, buildService } = ctx

  if (!configService || !scanService || !buildService) {
    throw new Error('analyzeSubpackages requires configService, scanService and buildService to be initialized')
  }

  await scanService.loadAppEntry()
  const subPackageMetas = scanService.loadSubPackages()

  const subPackageRoots = new Set<string>()
  const independentRoots = new Set<string>()

  for (const meta of subPackageMetas) {
    const root = meta.subPackage.root
    if (root) {
      subPackageRoots.add(root)
      if (meta.subPackage.independent) {
        independentRoots.add(root)
      }
    }
  }

  const classifierContext: PackageClassifierContext = {
    subPackageRoots,
    independentRoots,
  }

  const analysisConfig = configService.merge(
    undefined,
    createSharedBuildConfig(configService, scanService),
    {
      build: {
        write: false,
        watch: null,
      },
    },
  )

  const mainResult = await build(analysisConfig)
  const mainOutputs = Array.isArray(mainResult) ? mainResult : [mainResult]

  const packages = new Map<string, PackageAccumulator>()
  const modules = new Map<string, ModuleAccumulator>()

  for (const output of mainOutputs) {
    processOutput(output as RolldownOutput, 'main', ctx, classifierContext, packages, modules)
  }

  for (const root of independentRoots) {
    const output = buildService.getIndependentOutput(root)
    processOutput(output, 'independent', ctx, classifierContext, packages, modules)
  }

  expandVirtualModulePlacements(modules, packages, classifierContext)

  return {
    packages: summarizePackages(packages),
    modules: summarizeModules(modules),
    subPackages: summarizeSubPackages(subPackageMetas),
  }
}
