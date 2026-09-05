import type { AnalyzeSubpackagesResult } from '../../../analyze/subpackages'
import path from 'pathe'

export type DashboardFileKind = 'artifact' | 'source'

export interface DashboardContentRoots {
  artifactRoot?: string
  pluginRoot?: string
  projectRoot?: string
  srcRoot?: string
}

export interface ResolvedDashboardContentPath {
  absolutePath: string
  allowParent: boolean
  relativePath: string
  rootPath: string
}

type DashboardSourceRootKind = 'plugin' | 'project' | 'src'

export interface DashboardContentAllowlist {
  artifactPaths: Set<string>
  sourcePaths: Map<string, Set<DashboardSourceRootKind>>
}

function normalizeDashboardRelativePath(value: string) {
  return value.replaceAll('\\', '/')
}

function stripDashboardFileQuery(value: string) {
  const queryIndex = value.indexOf('?')
  return queryIndex === -1 ? value : value.slice(0, queryIndex)
}

function addDashboardAllowedPath(paths: Set<string>, value: string | undefined) {
  if (!value || value.includes('\0')) {
    return
  }
  const normalizedPath = normalizeDashboardRelativePath(stripDashboardFileQuery(value))
  if (!normalizedPath || path.isAbsolute(normalizedPath)) {
    return
  }
  paths.add(normalizedPath)
}

function addDashboardAllowedSourcePath(
  paths: Map<string, Set<DashboardSourceRootKind>>,
  value: string | undefined,
  rootKind: DashboardSourceRootKind,
) {
  if (!value || value.includes('\0')) {
    return
  }
  const normalizedPath = normalizeDashboardRelativePath(stripDashboardFileQuery(value))
  if (!normalizedPath || path.isAbsolute(normalizedPath)) {
    return
  }
  const rootKinds = paths.get(normalizedPath) ?? new Set<DashboardSourceRootKind>()
  rootKinds.add(rootKind)
  paths.set(normalizedPath, rootKinds)
}

function resolveDashboardSourceRootKind(
  sourceType: AnalyzeSubpackagesResult['packages'][number]['files'][number]['sourceType'],
): DashboardSourceRootKind {
  if (sourceType === 'plugin') {
    return 'plugin'
  }
  if (sourceType === 'workspace' || sourceType === 'node_modules') {
    return 'project'
  }
  return 'src'
}

export function createDashboardContentAllowlist(result: AnalyzeSubpackagesResult): DashboardContentAllowlist {
  const artifactPaths = new Set<string>()
  const sourcePaths = new Map<string, Set<DashboardSourceRootKind>>()

  for (const packageReport of result.packages) {
    for (const file of packageReport.files) {
      addDashboardAllowedPath(artifactPaths, file.file)
      const fileSourceType = file.sourceType
        ?? file.modules?.find(module => module.source === file.source)?.sourceType
      addDashboardAllowedSourcePath(sourcePaths, file.source, resolveDashboardSourceRootKind(fileSourceType))
      for (const module of file.modules ?? []) {
        addDashboardAllowedSourcePath(
          sourcePaths,
          module.source,
          module.sourceType === 'src' ? 'src' : module.sourceType === 'plugin' ? 'plugin' : 'project',
        )
      }
    }
  }

  return { artifactPaths, sourcePaths }
}

function resolveDashboardContentPath(
  root: string | undefined,
  requestPath: string,
  options: { allowParent?: boolean, allowedPaths: Set<string> },
): ResolvedDashboardContentPath | undefined {
  if (!root || !requestPath || requestPath.includes('\0')) {
    return undefined
  }

  const normalizedRequestPath = normalizeDashboardRelativePath(stripDashboardFileQuery(requestPath))
  if (path.isAbsolute(normalizedRequestPath) || !options.allowedPaths.has(normalizedRequestPath)) {
    return undefined
  }

  const rootPath = path.resolve(root)
  const absolutePath = path.resolve(rootPath, normalizedRequestPath)
  const relativePath = path.relative(rootPath, absolutePath)
  const allowParent = options.allowParent === true
  if (!relativePath || (!allowParent && (relativePath.startsWith('..') || path.isAbsolute(relativePath)))) {
    return undefined
  }

  return {
    absolutePath,
    allowParent,
    relativePath: allowParent ? normalizedRequestPath : normalizeDashboardRelativePath(relativePath),
    rootPath,
  }
}

function resolveDashboardSourceContentPaths(
  roots: DashboardContentRoots,
  requestPath: string,
  allowedPaths: Map<string, Set<DashboardSourceRootKind>>,
): ResolvedDashboardContentPath[] {
  const normalizedRequestPath = normalizeDashboardRelativePath(stripDashboardFileQuery(requestPath))
  const rootKinds = allowedPaths.get(normalizedRequestPath)
  if (!rootKinds || rootKinds.size !== 1) {
    return []
  }

  const [rootKind] = rootKinds
  if (rootKind === 'project') {
    const resolved = resolveDashboardContentPath(roots.projectRoot, normalizedRequestPath, {
      allowParent: true,
      allowedPaths: new Set([normalizedRequestPath]),
    })
    return resolved ? [resolved] : []
  }
  if (rootKind === 'plugin') {
    if (!roots.pluginRoot) {
      return []
    }
    const pluginBase = path.basename(roots.pluginRoot)
    if (normalizedRequestPath !== pluginBase && !normalizedRequestPath.startsWith(`${pluginBase}/`)) {
      return []
    }
    const pluginRelativePath = normalizedRequestPath === pluginBase ? '' : normalizedRequestPath.slice(pluginBase.length + 1)
    const resolved = resolveDashboardContentPath(roots.pluginRoot, pluginRelativePath, {
      allowedPaths: new Set([pluginRelativePath]),
    })
    return resolved ? [{ ...resolved, relativePath: normalizedRequestPath }] : []
  }
  if (!roots.srcRoot) {
    return []
  }

  const relativePaths = normalizedRequestPath.startsWith('src/')
    ? [normalizedRequestPath, normalizedRequestPath.slice(4)]
    : [normalizedRequestPath]
  const candidates = relativePaths.flatMap((relativePath) => {
    const resolved = resolveDashboardContentPath(roots.srcRoot, relativePath, {
      allowedPaths: new Set([relativePath]),
    })
    return resolved ? [{ ...resolved, relativePath: normalizedRequestPath }] : []
  })
  return [...new Map(candidates.map(candidate => [candidate.absolutePath, candidate])).values()]
}

export function resolveDashboardContentCandidates(
  kind: DashboardFileKind,
  requestPath: string,
  roots: DashboardContentRoots,
  allowlist: DashboardContentAllowlist,
) {
  if (kind === 'source') {
    return resolveDashboardSourceContentPaths(roots, requestPath, allowlist.sourcePaths)
  }
  const resolved = resolveDashboardContentPath(roots.artifactRoot, requestPath, {
    allowedPaths: allowlist.artifactPaths,
  })
  return resolved ? [resolved] : []
}
