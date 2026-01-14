import type { MutableCompilerContext } from '../../../context'
import type { AutoRoutes, AutoRoutesSubPackage } from '../../../types/routes'
import type { CandidateEntry } from '../candidates'
import path from 'pathe'
import { toPosixPath } from '../../../utils/path'
import { createTypedRouterDefinition } from './format'
import { resolvePagesDirectory, resolveRoute } from './resolve'

export interface ScanResult {
  snapshot: AutoRoutes
  serialized: string
  moduleCode: string
  typedDefinition: string
  watchFiles: Set<string>
  watchDirs: Set<string>
}

function ensureSubPackage(map: Map<string, Set<string>>, root: string) {
  let set = map.get(root)
  if (!set) {
    set = new Set<string>()
    map.set(root, set)
  }
  return set
}

export async function scanRoutes(
  ctx: MutableCompilerContext,
  candidatesMap: ReadonlyMap<string, CandidateEntry>,
): Promise<ScanResult> {
  const configService = ctx.configService
  const jsonService = ctx.jsonService

  if (!configService || !jsonService) {
    throw new Error('configService/jsonService must be initialized before scanning routes')
  }

  const absoluteSrcRoot = configService.absoluteSrcRoot
  const pagesSet = new Set<string>()
  const entriesSet = new Set<string>()
  const subPackages = new Map<string, Set<string>>()
  const watchFiles = new Set<string>()
  const watchDirs = new Set<string>()

  const candidateList = Array.from(candidatesMap.values())
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

  const pagesRootSet = new Set<string>()

  for (const candidate of candidateList) {
    for (const file of candidate.files) {
      watchFiles.add(file)
    }

    const normalizedBase = toPosixPath(path.relative(absoluteSrcRoot, candidate.base))
    if (!normalizedBase || normalizedBase.startsWith('..')) {
      continue
    }

    const route = resolveRoute(normalizedBase)
    if (!route) {
      continue
    }

    const pagesDir = resolvePagesDirectory(normalizedBase, absoluteSrcRoot)
    if (pagesDir) {
      pagesRootSet.add(pagesDir)
    }

    watchDirs.add(path.dirname(candidate.base))

    const json = jsonMap.get(candidate)
    if (candidate.jsonPath && json === undefined) {
      continue
    }
    if (json && typeof json === 'object' && json.component === true) {
      continue
    }

    if (!candidate.hasScript && !candidate.hasTemplate && !candidate.jsonPath) {
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
  }

  for (const dir of pagesRootSet) {
    watchDirs.add(dir)
  }

  const pages = Array.from(pagesSet)
  const entries = Array.from(entriesSet)
  const subPackageList: AutoRoutesSubPackage[] = Array.from(subPackages.entries()).map(([root, value]) => {
    const pagesArray = Array.from(value)
    pagesArray.sort((a, b) => a.localeCompare(b))
    return {
      root,
      pages: pagesArray,
    }
  })

  pages.sort((a, b) => {
    if (a === 'pages/index/index') {
      return -1
    }
    if (b === 'pages/index/index') {
      return 1
    }
    return a.localeCompare(b)
  })

  entries.sort((a, b) => {
    if (a === 'pages/index/index') {
      return -1
    }
    if (b === 'pages/index/index') {
      return 1
    }
    return a.localeCompare(b)
  })

  subPackageList.sort((a, b) => a.root.localeCompare(b.root))

  const snapshot: AutoRoutes = {
    pages,
    entries,
    subPackages: subPackageList,
  }

  const serialized = JSON.stringify(snapshot, null, 2)
  const typedDefinition = createTypedRouterDefinition(snapshot)
  const moduleCode = [
    'const routes = ',
    serialized,
    ';',
    'const pages = routes.pages;',
    'const entries = routes.entries;',
    'const subPackages = routes.subPackages;',
    'export { routes, pages, entries, subPackages };',
    'export default routes;',
  ].join('\n')

  return {
    snapshot,
    serialized,
    moduleCode,
    typedDefinition,
    watchFiles,
    watchDirs,
  }
}
