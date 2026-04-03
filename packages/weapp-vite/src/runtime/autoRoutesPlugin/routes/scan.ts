import type { MutableCompilerContext } from '../../../context'
import type { AutoRoutes, AutoRoutesSubPackage } from '../../../types/routes'
import type { CandidateEntry } from '../candidates'
import path from 'pathe'
import { toPosixPath } from '../../../utils/path'
import { createAutoRoutesArtifacts } from '../service/shared'
import { resolveAutoRoutesMatcherContext } from '../shared'
import { resolveRoute } from './resolve'

export interface ScanResult {
  snapshot: AutoRoutes
  serialized: string
  moduleCode: string
  typedDefinition: string
  watchFiles: Set<string>
  watchDirs: Set<string>
}

function sortAutoRoutesEntries(values: string[]) {
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

function sortAutoRoutesSubPackages(subPackages: AutoRoutesSubPackage[]) {
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

function shouldIncludeScanCandidate(
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
    route?.root
    && !route.pagePath.startsWith('pages/')
    && candidate.hasScript
    && !candidate.hasTemplate
    && !candidate.jsonPath
  ) {
    const hasVueEntry = [...candidate.files].some(file => file.endsWith('.vue'))
    const isIndexEntry = path.basename(route.pagePath) === 'index'
    if (!hasVueEntry && !isIndexEntry) {
      return false
    }
  }

  return candidate.hasScript || candidate.hasTemplate || Boolean(candidate.jsonPath)
}

export async function scanRoutes(
  ctx: MutableCompilerContext,
  candidatesMap: ReadonlyMap<string, CandidateEntry>,
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

  const candidateList = [...candidatesMap.values()]
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

  const snapshot: AutoRoutes = {
    pages,
    entries,
    subPackages: subPackageList,
  }

  const { serialized, moduleCode, typedDefinition } = createAutoRoutesArtifacts(snapshot)

  return {
    snapshot,
    serialized,
    moduleCode,
    typedDefinition,
    watchFiles,
    watchDirs,
  }
}

export {
  shouldIncludeScanCandidate,
  sortAutoRoutesEntries,
  sortAutoRoutesSubPackages,
}
