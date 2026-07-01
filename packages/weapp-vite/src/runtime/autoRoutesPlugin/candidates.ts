import { removeExtensionDeep } from '@weapp-core/shared'
import { fs } from '@weapp-core/shared/fs'
import { fdir as Fdir } from 'fdir'
import path from 'pathe'
import { configExtensions, jsExtensions, supportedCssLangs, templateExtensions, vueExtensions } from '../../constants'
import { toPosixPath } from '../../utils/path'
import { isAutoRoutesGeneratedDirectoryName, isAutoRoutesGeneratedRelativePath } from './generatedPaths'
import { createAutoRoutesMatcher } from './matcher'
import { resolveDefaultSearchRoots } from './pageRoots'

export interface CandidateEntry {
  base: string
  files: Set<string>
  hasScript: boolean
  hasTemplate: boolean
  jsonPath?: string
}

const SCRIPT_EXTENSIONS = new Set(jsExtensions.map(ext => `.${ext}`))
const TEMPLATE_EXTENSIONS = new Set(templateExtensions.map(ext => `.${ext}`))
const VUE_EXTENSIONS = new Set(vueExtensions.map(ext => `.${ext}`))
const STYLE_EXTENSIONS = new Set(supportedCssLangs.map(ext => `.${ext}`))
const CONFIG_SUFFIXES = configExtensions.map(ext => `.${ext}`)
const SKIPPED_DIRECTORIES = new Set(['.git', '.husky', '.idea', '.turbo'])
const SCRIPT_SIDECAR_PATTERN = /\.(?:wxs|sjs)\.[jt]s$/i
const TEMPLATE_SIDECAR_PATTERN = /\.wxml\.[jt]s$/i

export function isConfigFile(filePath: string) {
  return CONFIG_SUFFIXES.some(ext => filePath.endsWith(ext))
}

export function isScriptFile(filePath: string) {
  if (filePath.endsWith('.d.ts')) {
    return false
  }
  if (SCRIPT_SIDECAR_PATTERN.test(filePath) || TEMPLATE_SIDECAR_PATTERN.test(filePath)) {
    return false
  }
  const ext = path.extname(filePath)
  return SCRIPT_EXTENSIONS.has(ext)
}

export function isVueFile(filePath: string) {
  const ext = path.extname(filePath)
  return VUE_EXTENSIONS.has(ext)
}

export function isTemplateFile(filePath: string) {
  const ext = path.extname(filePath)
  return TEMPLATE_EXTENSIONS.has(ext)
}

export function isStyleFile(filePath: string) {
  const ext = path.extname(filePath)
  return STYLE_EXTENSIONS.has(ext)
}

function ensureCandidate(map: Map<string, CandidateEntry>, base: string) {
  let candidate = map.get(base)
  if (!candidate) {
    candidate = {
      base,
      files: new Set<string>(),
      hasScript: false,
      hasTemplate: false,
    }
    map.set(base, candidate)
  }
  return candidate
}

function resolveCandidateSearchRoots(
  absoluteSrcRoot: string,
  matcher: ReturnType<typeof createAutoRoutesMatcher>,
  searchRoots?: Iterable<string>,
) {
  if (searchRoots) {
    return [...new Set(searchRoots)]
  }

  return matcher.isDefault
    ? undefined
    : matcher.getSearchRoots(absoluteSrcRoot)
}

function resolveCollectTargetRoot(
  absoluteSrcRoot: string,
  root: string,
) {
  const targetRoot = path.isAbsolute(root)
    ? root
    : path.resolve(absoluteSrcRoot, root)

  return toPosixPath(targetRoot).startsWith(toPosixPath(absoluteSrcRoot))
    ? targetRoot
    : undefined
}

async function shouldCollectTargetRoot(targetRoot: string) {
  return fs.pathExists(targetRoot)
}

async function safeCrawlCandidateFiles(
  crawler: ReturnType<InstanceType<typeof Fdir>['withFullPaths']>,
  targetRoot: string,
): Promise<string[]> {
  try {
    return await crawler.crawl(targetRoot).withPromise() as string[]
  }
  catch {
    return []
  }
}

function resolveCandidateEntryPath(
  absoluteSrcRoot: string,
  entryPath: string,
) {
  const normalizedRelative = toPosixPath(path.relative(absoluteSrcRoot, entryPath))
  if (!normalizedRelative || normalizedRelative.startsWith('..')) {
    return undefined
  }

  if (isAutoRoutesGeneratedRelativePath(normalizedRelative)) {
    return undefined
  }

  return {
    normalizedRelative,
    relativeBase: removeExtensionDeep(normalizedRelative),
    candidateBase: removeExtensionDeep(entryPath),
  }
}

function shouldCollectCandidateEntry(
  matcher: ReturnType<typeof createAutoRoutesMatcher>,
  resolvedEntryPath: { relativeBase: string } | undefined,
) {
  return Boolean(resolvedEntryPath && matcher.matches(resolvedEntryPath.relativeBase))
}

function applyCandidateEntryFile(
  candidate: CandidateEntry,
  entryPath: string,
) {
  candidate.files.add(entryPath)

  if (isConfigFile(entryPath)) {
    candidate.jsonPath = entryPath
    return
  }

  if (isVueFile(entryPath) || isScriptFile(entryPath)) {
    candidate.hasScript = true
  }

  if (isTemplateFile(entryPath)) {
    candidate.hasTemplate = true
  }
}

function applyCandidateEntryToMap(
  candidates: Map<string, CandidateEntry>,
  entryPath: string,
  resolvedEntryPath: { candidateBase: string },
) {
  const candidate = ensureCandidate(candidates, resolvedEntryPath.candidateBase)
  applyCandidateEntryFile(candidate, entryPath)
}

async function collectCandidateFilesFromRoots(
  absoluteSrcRoot: string,
  matcher: ReturnType<typeof createAutoRoutesMatcher>,
  roots: string[],
  options: {
    shouldCollectTargetRoot: (targetRoot: string) => Promise<boolean>
    safeCrawlCandidateFiles: (
      crawler: ReturnType<InstanceType<typeof Fdir>['withFullPaths']>,
      targetRoot: string,
    ) => Promise<string[]>
    createCrawler: () => ReturnType<InstanceType<typeof Fdir>['withFullPaths']>
  },
) {
  const rootFiles = await Promise.all(roots.map(async (root) => {
    const targetRoot = resolveCollectTargetRoot(absoluteSrcRoot, root)
    if (!targetRoot) {
      return []
    }

    if (!(await options.shouldCollectTargetRoot(targetRoot))) {
      return []
    }

    const crawler = options.createCrawler()
    return await options.safeCrawlCandidateFiles(crawler, targetRoot)
  }))
  const candidates = new Map<string, CandidateEntry>()

  for (const files of rootFiles) {
    for (const entryPath of files) {
      const resolvedEntryPath = resolveCandidateEntryPath(absoluteSrcRoot, entryPath)
      if (!shouldCollectCandidateEntry(matcher, resolvedEntryPath)) {
        continue
      }

      if (resolvedEntryPath) {
        applyCandidateEntryToMap(candidates, entryPath, resolvedEntryPath)
      }
    }
  }

  return candidates
}

export async function collectCandidates(
  absoluteSrcRoot: string,
  include?: string | RegExp | Array<string | RegExp>,
  subPackageRoots?: Iterable<string>,
  searchRoots?: Iterable<string>,
) {
  const matcher = createAutoRoutesMatcher(include, subPackageRoots)
  const roots = resolveCandidateSearchRoots(absoluteSrcRoot, matcher, searchRoots) ?? []

  if (!searchRoots) {
    if (matcher.isDefault) {
      roots.push(...await resolveDefaultSearchRoots(absoluteSrcRoot, subPackageRoots))
    }
    else {
      roots.push(...matcher.getSearchRoots(absoluteSrcRoot))
    }
  }

  const createCrawler = () => new Fdir({
    includeDirs: false,
    pathSeparator: '/',
    excludeSymlinks: true,
    suppressErrors: true,
    exclude(dirName) {
      return SKIPPED_DIRECTORIES.has(dirName) || isAutoRoutesGeneratedDirectoryName(dirName)
    },
  }).withFullPaths()

  return await collectCandidateFilesFromRoots(absoluteSrcRoot, matcher, roots, {
    shouldCollectTargetRoot,
    safeCrawlCandidateFiles,
    createCrawler,
  })
}

export function cloneCandidate(candidate: CandidateEntry): CandidateEntry {
  return {
    base: candidate.base,
    files: new Set(candidate.files),
    hasScript: candidate.hasScript,
    hasTemplate: candidate.hasTemplate,
    jsonPath: candidate.jsonPath,
  }
}

export function areSetsEqual(a: Set<string>, b: Set<string>) {
  if (a.size !== b.size) {
    return false
  }
  for (const value of a) {
    if (!b.has(value)) {
      return false
    }
  }
  return true
}

export {
  applyCandidateEntryFile,
  applyCandidateEntryToMap,
  collectCandidateFilesFromRoots,
  resolveCandidateEntryPath,
  resolveCandidateSearchRoots,
  resolveCollectTargetRoot,
  safeCrawlCandidateFiles,
  shouldCollectCandidateEntry,
  shouldCollectTargetRoot,
}
