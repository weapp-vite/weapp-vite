import { removeExtensionDeep } from '@weapp-core/shared'
import path from 'pathe'
import { normalizePath, toPosixPath } from '../../utils/path'
import { normalizeFsResolvedId } from '../../utils/resolvedId'
import { createAutoRoutesMatcher } from './matcher'

interface AutoRoutesPathOptions {
  cwd: string
  absoluteSrcRoot: string
}

interface AutoRoutesPagesPathOptions extends AutoRoutesPathOptions {
  include?: Parameters<typeof createAutoRoutesMatcher>[0]
  subPackageRoots?: Parameters<typeof createAutoRoutesMatcher>[1]
}

export interface ResolvedAutoRoutesPath {
  absolutePath: string
  relativePath: string
}

/**
 * 统一解析 auto-routes 相关文件路径，屏蔽查询串和平台路径分隔符差异。
 */
export function resolveAutoRoutesPath(
  candidate: string,
  options: AutoRoutesPathOptions,
): ResolvedAutoRoutesPath | undefined {
  const [pathWithoutQuery] = candidate.split('?')
  if (!pathWithoutQuery) {
    return undefined
  }

  const normalizedSrcRoot = normalizePath(options.absoluteSrcRoot)
  const normalizedCandidate = normalizePath(
    path.isAbsolute(pathWithoutQuery)
      ? pathWithoutQuery
      : path.resolve(options.cwd, pathWithoutQuery),
  )
  const relativePath = toPosixPath(path.relative(normalizedSrcRoot, normalizedCandidate))
  if (!relativePath || relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
    return undefined
  }

  return {
    absolutePath: normalizedCandidate,
    relativePath,
  }
}

/**
 * 解析 auto-routes 别名可能指向的编译产物与源码入口。
 */
export function resolveAutoRoutesAliasTargets(packageRoot?: string) {
  const targets = new Set<string>()
  if (!packageRoot) {
    return targets
  }

  const candidates = [
    path.resolve(packageRoot, 'src/auto-routes.ts'),
    path.resolve(packageRoot, 'auto-routes.ts'),
    path.resolve(packageRoot, 'dist/auto-routes.mjs'),
    path.resolve(packageRoot, 'dist/auto-routes.js'),
  ]
  for (const candidate of candidates) {
    targets.add(path.normalize(candidate))
  }
  return targets
}

/**
 * 判断当前 id 是否命中 auto-routes 别名候选目标。
 */
export function isAliasedAutoRoutesId(id: string, aliasTargets: ReadonlySet<string>) {
  return aliasTargets.has(path.normalize(normalizeFsResolvedId(id)))
}

/**
 * 判断文件是否属于 auto-routes 的 pages 关注范围，包括显式 include 和 watch root。
 */
export function isAutoRoutesPagesRelatedPath(
  candidate: string,
  options: AutoRoutesPagesPathOptions,
) {
  const resolvedPath = resolveAutoRoutesPath(candidate, options)
  if (!resolvedPath) {
    return false
  }

  const matcher = createAutoRoutesMatcher(options.include, options.subPackageRoots)
  if (matcher.matches(removeExtensionDeep(resolvedPath.relativePath))) {
    return true
  }

  return matcher.getWatchRoots(options.absoluteSrcRoot).some((root) => {
    const normalizedRoot = normalizePath(root)
    return resolvedPath.absolutePath === normalizedRoot
      || resolvedPath.absolutePath.startsWith(`${normalizedRoot}/`)
  })
}
