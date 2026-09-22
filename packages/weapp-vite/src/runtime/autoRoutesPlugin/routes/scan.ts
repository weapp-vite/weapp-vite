import type { ResolveSfcBlockSrcOptions } from 'wevu/compiler'
import type { MutableCompilerContext } from '../../../context'
import type { AutoRoutes, AutoRoutesSubPackage } from '../../../types/routes'
import type { CandidateEntry } from '../candidates'
import type { NamedAutoRoute } from '../types'
import { isDeepStrictEqual } from 'node:util'
import { fs } from '@weapp-core/shared/fs'
import path from 'pathe'
import { extractPageDeclarationWithDependencies } from 'wevu/compiler'
import { scriptExtensions, vueExtensions } from '../../../constants'
import { resolveImportee } from '../../../utils/json'
import { toPosixPath } from '../../../utils/path'
import { applyBuildScopeToAutoRoutes, resolveBuildScope } from '../../buildScope'
import { normalizeAliasOptions } from '../../config/internal/alias'
import { createAutoRoutesArtifacts, createAutoRoutesSourceFingerprint } from '../service/shared'
import { resolveAutoRoutesMatcherContext } from '../shared'
import { resolveRoute } from './resolve'

const PAGE_SOURCE_EXTENSIONS = [...scriptExtensions, ...vueExtensions]

export interface ScanResult {
  snapshot: AutoRoutes
  serialized: string
  moduleCode: string
  typedDefinition: string
  namedRoutes: NamedAutoRoute[]
  namedModuleCode: string
  signature: string
  topologyKey: string
  pageSourceFiles: Set<string>
  namedRouteSourceFiles: Set<string>
  pageDeclarationDependencies: Map<string, Set<string>>
  pageDeclarationFingerprints: Map<string, string>
  usesOpaquePageDeclarationResolver: boolean
  watchFiles: Set<string>
  watchDirs: Set<string>
}

export interface ScanRoutesOptions {
  resolvePageDeclarationSource?: ResolveSfcBlockSrcOptions['resolveId']
}

export function sortAutoRoutesEntries(values: string[]) {
  values.sort((a, b) => {
    if (a === 'pages/index/index') {
      return -1
    }
    if (b === 'pages/index/index') {
      return 1
    }
    return a.localeCompare(b)
  })
}

export function sortAutoRoutesSubPackages(subPackages: AutoRoutesSubPackage[]) {
  subPackages.sort((a, b) => a.root.localeCompare(b.root))
}

function ensureSubPackage(map: Map<string, Set<string>>, root: string) {
  let set = map.get(root)
  if (!set) {
    set = new Set<string>()
    map.set(root, set)
  }
  return set
}

export function shouldIncludeScanCandidate(
  candidate: Pick<CandidateEntry, 'files' | 'hasScript' | 'hasTemplate' | 'jsonPath'>,
  json: Record<string, any> | undefined,
  route?: { pagePath: string, root?: string },
) {
  if (candidate.jsonPath && json === undefined) {
    return false
  }
  if (json && typeof json === 'object' && json.component === true) {
    return false
  }

  if (
    route
    && candidate.hasScript
    && !candidate.hasTemplate
    && !candidate.jsonPath
  ) {
    const hasVueEntry = [...candidate.files].some(file => file.endsWith('.vue'))
    const isIndexEntry = path.basename(route.pagePath) === 'index'
    const isNestedPagesEntry = route.root
      ? !route.pagePath.startsWith('pages/')
      : route.pagePath.startsWith('pages/') && route.pagePath.slice('pages/'.length).includes('/')
    if (isNestedPagesEntry && !hasVueEntry && !isIndexEntry) {
      return false
    }
  }

  return candidate.hasScript || candidate.hasTemplate || Boolean(candidate.jsonPath)
}

function resolvePageDeclarationAliases(ctx: MutableCompilerContext) {
  const configService = ctx.configService
  if (!configService) {
    return []
  }
  return [
    ...normalizeAliasOptions(configService.inlineConfig?.resolve?.alias),
    ...(configService.aliasEntries ?? []),
  ]
}

function resolveCandidatePageSources(ctx: MutableCompilerContext, candidate: CandidateEntry) {
  const sourceFiles = PAGE_SOURCE_EXTENSIONS
    .map(extension => `${candidate.base}.${extension}`)
    .filter(sourceFile => candidate.files.has(sourceFile))
  const nativeSource = sourceFiles[0]
  if (!nativeSource) {
    return []
  }
  if (ctx.configService?.weappWebConfig?.enabled !== true) {
    return [nativeSource]
  }
  return [nativeSource, ...sourceFiles.filter(sourceFile => sourceFile !== nativeSource)]
}

async function collectNamedRoutes(
  ctx: MutableCompilerContext,
  candidates: Array<{ candidate: CandidateEntry, entry: string }>,
  scopedEntries: ReadonlySet<string>,
  options: ScanRoutesOptions,
) {
  const pageDeclarationAliases = resolvePageDeclarationAliases(ctx)
  const configService = ctx.configService!
  const scopedCandidates = candidates
    .filter(candidate => scopedEntries.has(candidate.entry))
    .sort((a, b) => a.entry.localeCompare(b.entry))
  const sourceCache = new Map<string, Promise<string>>()
  const readSource = (sourceFile: string) => {
    let pending = sourceCache.get(sourceFile)
    if (!pending) {
      pending = fs.readFile(sourceFile, 'utf8')
      sourceCache.set(sourceFile, pending)
    }
    return pending
  }
  const resolveSource = async (source: string, importer?: string) => {
    const resolved = await options.resolvePageDeclarationSource?.(source, importer)
    if (resolved) {
      return resolved
    }
    if (!importer) {
      return undefined
    }
    const aliased = resolveImportee(source, importer, pageDeclarationAliases)
    return aliased === source ? undefined : aliased
  }
  const declarations = await Promise.all(scopedCandidates.map(async ({ candidate, entry }) => {
    const sourceFiles = resolveCandidatePageSources(ctx, candidate)
    const sources = await Promise.all(sourceFiles.map(async (sourceFile) => {
      const source = await readSource(sourceFile)
      const extracted = await extractPageDeclarationWithDependencies(source, sourceFile, {
        readFile: readSource,
        resolveId: resolveSource,
      })
      return { ...extracted, sourceFile }
    }))
    const primary = sources[0]
    for (const alternate of sources.slice(1)) {
      if (!isDeepStrictEqual(primary?.declaration, alternate.declaration)) {
        const first = toPosixPath(path.relative(configService.cwd, primary!.sourceFile))
        const second = toPosixPath(path.relative(configService.cwd, alternate.sourceFile))
        throw new Error(`[auto-routes] 页面 ${entry} 的候选源文件页面声明不一致：${first} 与 ${second}`)
      }
    }
    return { entry, primary, sources }
  }))

  const namedRoutes: NamedAutoRoute[] = []
  const pageSourceFiles = new Set<string>()
  const namedRouteSourceFiles = new Set<string>()
  const pageDeclarationDependencies = new Map<string, Set<string>>()
  const sourceByName = new Map<string, string>()
  for (const { entry, primary, sources } of declarations) {
    for (const source of sources) {
      pageSourceFiles.add(source.sourceFile)
      for (const dependency of source.dependencies) {
        let owners = pageDeclarationDependencies.get(dependency)
        if (!owners) {
          owners = new Set<string>()
          pageDeclarationDependencies.set(dependency, owners)
        }
        owners.add(source.sourceFile)
      }
    }
    const declaration = primary?.declaration
    if (!declaration || !primary) {
      continue
    }
    const routeSourceFile = primary.declarationSourceFile ?? primary.sourceFile
    const duplicateSource = sourceByName.get(declaration.name)
    if (duplicateSource) {
      const first = toPosixPath(path.relative(configService.cwd, duplicateSource))
      const second = toPosixPath(path.relative(configService.cwd, routeSourceFile))
      throw new Error(`[auto-routes] 页面路由名称 ${JSON.stringify(declaration.name)} 重复：${first} 与 ${second}`)
    }
    sourceByName.set(declaration.name, routeSourceFile)
    for (const source of sources) {
      namedRouteSourceFiles.add(source.sourceFile)
    }
    namedRoutes.push({
      name: declaration.name,
      path: `/${entry}`,
      meta: declaration.meta ?? {},
    })
  }
  const pageDeclarationFingerprints = new Map<string, string>()
  await Promise.all([...sourceCache].map(async ([sourceFile, pendingSource]) => {
    pageDeclarationFingerprints.set(
      sourceFile,
      createAutoRoutesSourceFingerprint(await pendingSource),
    )
  }))
  return {
    namedRoutes,
    namedRouteSourceFiles,
    pageDeclarationDependencies,
    pageDeclarationFingerprints,
    pageSourceFiles,
  }
}

export function createAutoRoutesTopologyKey(
  ctx: MutableCompilerContext,
  candidatesMap: ReadonlyMap<string, CandidateEntry>,
) {
  const configService = ctx.configService
  if (!configService) {
    return ''
  }
  const candidates = [...candidatesMap.values()]
    .map(candidate => ({
      base: toPosixPath(path.relative(configService.absoluteSrcRoot, candidate.base)),
      files: [...candidate.files]
        .map(filePath => toPosixPath(path.relative(configService.absoluteSrcRoot, filePath)))
        .sort((a, b) => a.localeCompare(b)),
    }))
    .sort((a, b) => a.base.localeCompare(b.base))
  const { subPackageRoots } = resolveAutoRoutesMatcherContext(ctx)
  const pageDeclarationAliases = resolvePageDeclarationAliases(ctx).map(alias => ({
    find: typeof alias.find === 'string'
      ? { kind: 'string', value: alias.find }
      : { flags: alias.find.flags, kind: 'regexp', value: alias.find.source },
    replacement: alias.replacement,
  }))
  return JSON.stringify({
    buildScope: resolveBuildScope(configService.weappViteConfig.buildScope),
    webSiblingValidation: configService.weappWebConfig?.enabled === true,
    pageDeclarationAliases,
    candidates,
    subPackageRoots: [...subPackageRoots].sort((a, b) => a.localeCompare(b)),
  })
}

export async function scanRoutes(
  ctx: MutableCompilerContext,
  candidatesMap: ReadonlyMap<string, CandidateEntry>,
  options: ScanRoutesOptions = {},
): Promise<ScanResult> {
  const configService = ctx.configService
  const jsonService = ctx.jsonService

  if (!configService || !jsonService) {
    throw new Error('扫描路由前必须初始化 configService/jsonService。')
  }

  const absoluteSrcRoot = configService.absoluteSrcRoot
  const { matcher, subPackageRoots } = resolveAutoRoutesMatcherContext(ctx)
  const pagesSet = new Set<string>()
  const entriesSet = new Set<string>()
  const subPackages = new Map<string, Set<string>>()
  const watchFiles = new Set<string>()
  const watchDirs = new Set<string>()
  const includedCandidates: Array<{ candidate: CandidateEntry, entry: string }> = []

  const candidatesSnapshot = new Map(
    [...candidatesMap].map(([base, candidate]) => [base, {
      ...candidate,
      files: new Set(candidate.files),
    }]),
  )
  const candidateList = [...candidatesSnapshot.values()]
  const jsonEntries = await Promise.all(candidateList.map(async (candidate) => {
    if (!candidate.jsonPath) {
      return { candidate, json: undefined as Record<string, any> | undefined }
    }

    const json = await jsonService.read(candidate.jsonPath)
    return { candidate, json: json as Record<string, any> | undefined }
  }))

  const jsonMap = new Map<CandidateEntry, Record<string, any> | undefined>()
  for (const { candidate, json } of jsonEntries) {
    jsonMap.set(candidate, json)
  }

  for (const candidate of candidateList) {
    for (const file of candidate.files) {
      watchFiles.add(file)
    }

    const normalizedBase = toPosixPath(path.relative(absoluteSrcRoot, candidate.base))
    if (!normalizedBase || normalizedBase.startsWith('..')) {
      continue
    }

    const route = resolveRoute(normalizedBase, subPackageRoots)
    if (!route) {
      continue
    }

    watchDirs.add(path.dirname(candidate.base))

    const json = jsonMap.get(candidate)
    if (!shouldIncludeScanCandidate(candidate, json, route)) {
      continue
    }

    entriesSet.add(route.entry)

    if (route.root) {
      const pagesForRoot = ensureSubPackage(subPackages, route.root)
      pagesForRoot.add(route.pagePath)
    }
    else {
      pagesSet.add(route.pagePath)
    }
    includedCandidates.push({ candidate, entry: route.entry })
  }

  for (const dir of matcher.getWatchRoots(absoluteSrcRoot)) {
    watchDirs.add(dir)
  }

  const pages = [...pagesSet]
  const entries = [...entriesSet]
  const subPackageList: AutoRoutesSubPackage[] = Array.from(subPackages.entries(), ([root, value]) => {
    const pagesArray = [...value]
    pagesArray.sort((a, b) => a.localeCompare(b))
    return {
      root,
      pages: pagesArray,
    }
  })

  sortAutoRoutesEntries(pages)
  sortAutoRoutesEntries(entries)
  sortAutoRoutesSubPackages(subPackageList)

  const snapshot: AutoRoutes = applyBuildScopeToAutoRoutes({
    pages,
    entries,
    subPackages: subPackageList,
  }, resolveBuildScope(configService.weappViteConfig.buildScope))

  const {
    namedRoutes,
    namedRouteSourceFiles,
    pageDeclarationDependencies,
    pageDeclarationFingerprints,
    pageSourceFiles,
  } = await collectNamedRoutes(ctx, includedCandidates, new Set(snapshot.entries), options)
  for (const dependency of pageDeclarationDependencies.keys()) {
    watchFiles.add(dependency)
    watchDirs.add(path.dirname(dependency))
  }
  const {
    serialized,
    moduleCode,
    namedModuleCode,
    signature: routeSignature,
    typedDefinition,
  } = createAutoRoutesArtifacts(snapshot, namedRoutes)
  const topologyKey = createAutoRoutesTopologyKey(ctx, candidatesSnapshot)
  const signature = `${routeSignature}\n${topologyKey}`

  return {
    snapshot,
    namedRoutes,
    serialized,
    moduleCode,
    namedModuleCode,
    signature,
    typedDefinition,
    topologyKey,
    namedRouteSourceFiles,
    pageDeclarationDependencies,
    pageDeclarationFingerprints,
    usesOpaquePageDeclarationResolver: Boolean(
      options.resolvePageDeclarationSource && pageDeclarationDependencies.size > 0,
    ),
    pageSourceFiles,
    watchFiles,
    watchDirs,
  }
}
