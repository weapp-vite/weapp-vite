import type { MutableCompilerContext } from '../../context'
import path from 'pathe'
import { resolveWeappAutoRoutesConfig } from '../../autoRoutesConfig'
import { normalizePath, toPosixPath } from '../../utils/path'

const AUTO_ROUTES_CACHE_FILE = '.weapp-vite/auto-routes.cache.json'
const TYPED_ROUTER_OUTPUT_FILE = '.weapp-vite/typed-router.d.ts'

interface AutoRoutesGeneratedPathOptions {
  cwd: string
  absoluteSrcRoot: string
  managedOutputPaths?: Iterable<string>
}

const GENERATED_DIRECTORY_NAMES = new Set([
  '.cache',
  '.rolldown-require',
  '.rolldown-require-cache',
  '.tmp',
  '.weapp-vite',
  '.wevu-config',
  '__temp__',
  'coverage',
  'dist',
  'miniprogram_npm',
  'node_modules',
])

const GENERATED_FILE_NAMES = new Set([
  path.basename(AUTO_ROUTES_CACHE_FILE),
  path.basename(TYPED_ROUTER_OUTPUT_FILE),
])

function stripQuery(candidate: string) {
  return candidate.split('?')[0]
}

function resolveGeneratedCandidatePath(candidate: string, cwd: string) {
  const pathWithoutQuery = stripQuery(candidate)
  if (!pathWithoutQuery) {
    return undefined
  }

  return normalizePath(
    path.isAbsolute(pathWithoutQuery)
      ? pathWithoutQuery
      : path.resolve(cwd, pathWithoutQuery),
  )
}

export function isAutoRoutesGeneratedDirectoryName(name: string) {
  return GENERATED_DIRECTORY_NAMES.has(name)
}

export function isAutoRoutesGeneratedFileName(fileName: string) {
  return GENERATED_FILE_NAMES.has(fileName)
    || fileName.includes('.auto-routes.')
    || fileName.includes('.auto-routes-')
}

export function isAutoRoutesGeneratedRelativePath(relativePath: string) {
  const normalized = toPosixPath(relativePath)
  const segments = normalized.split('/').filter(Boolean)
  if (segments.some(isAutoRoutesGeneratedDirectoryName)) {
    return true
  }

  const fileName = segments[segments.length - 1]
  return Boolean(fileName && isAutoRoutesGeneratedFileName(fileName))
}

export function resolveAutoRoutesManagedOutputPaths(
  ctx: Pick<MutableCompilerContext, 'configService'>,
) {
  const configService = ctx.configService
  const outputPaths = new Set<string>()
  if (!configService) {
    return outputPaths
  }

  const baseDir = typeof configService.configFilePath === 'string'
    ? path.dirname(configService.configFilePath)
    : configService.cwd

  if (!baseDir) {
    return outputPaths
  }

  outputPaths.add(normalizePath(path.resolve(baseDir, TYPED_ROUTER_OUTPUT_FILE)))
  outputPaths.add(normalizePath(path.resolve(baseDir, AUTO_ROUTES_CACHE_FILE)))

  const autoRoutesConfig = resolveWeappAutoRoutesConfig(configService.weappViteConfig?.autoRoutes)
  if (autoRoutesConfig.persistentCache) {
    outputPaths.add(normalizePath(path.resolve(
      baseDir,
      autoRoutesConfig.persistentCachePath ?? AUTO_ROUTES_CACHE_FILE,
    )))
  }

  return outputPaths
}

export function isAutoRoutesGeneratedPath(
  candidate: string,
  options: AutoRoutesGeneratedPathOptions,
) {
  const absolutePath = resolveGeneratedCandidatePath(candidate, options.cwd)
  if (!absolutePath) {
    return false
  }

  for (const outputPath of options.managedOutputPaths ?? []) {
    if (absolutePath === normalizePath(outputPath)) {
      return true
    }
  }

  const normalizedSrcRoot = normalizePath(options.absoluteSrcRoot)
  const relativePath = toPosixPath(path.relative(normalizedSrcRoot, absolutePath))
  if (!relativePath || relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
    return false
  }

  return isAutoRoutesGeneratedRelativePath(relativePath)
}
