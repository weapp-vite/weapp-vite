import type { FsDirent } from '@weapp-core/shared'
import { fs, removeExtensionDeep } from '@weapp-core/shared'
import { fdir as Fdir } from 'fdir'
import path from 'pathe'
import { configExtensions, jsExtensions, supportedCssLangs, templateExtensions, vueExtensions } from '../../constants'
import { toPosixPath } from '../../utils/path'
import { createAutoRoutesMatcher } from './matcher'

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
const SKIPPED_DIRECTORIES = new Set(['node_modules', 'miniprogram_npm', '.git', '.idea', '.husky', '.turbo', '.cache', '.weapp-vite', 'dist'])
const SCRIPT_SIDECAR_PATTERN = /\.(?:wxs|sjs)\.[jt]s$/i
const TEMPLATE_SIDECAR_PATTERN = /\.wxml\.[jt]s$/i

interface DirentLike {
  name: string
  isDirectory: () => boolean
}

function hasNestedPagesRoot(
  root: string,
  discoveredPagesRoots: Iterable<string>,
) {
  const normalizedRoot = toPosixPath(root)
  return [...discoveredPagesRoots].some((pagesRoot) => {
    const normalizedPagesRoot = toPosixPath(pagesRoot)
    return normalizedPagesRoot === `${normalizedRoot}/pages`
      || normalizedPagesRoot.startsWith(`${normalizedRoot}/pages/`)
  })
}

function classifyPagesRootEntry(
  current: string,
  entry: DirentLike,
) {
  if (!entry.isDirectory()) {
    return undefined
  }

  if (SKIPPED_DIRECTORIES.has(entry.name)) {
    return undefined
  }

  const nextPath = path.join(current, entry.name)
  return entry.name === 'pages'
    ? { pageRoot: nextPath }
    : { nextPath }
}

async function discoverPagesRoots(root: string) {
  const queue = [root]
  const pagesRoots = new Set<string>()

  while (queue.length > 0) {
    const current = queue.shift()
    if (!current) {
      continue
    }

    let entries: FsDirent[]
    try {
      entries = await fs.readdir(current, { withFileTypes: true })
    }
    catch {
      continue
    }

    for (const entry of entries) {
      const classified = classifyPagesRootEntry(current, entry)
      if (!classified) {
        continue
      }

      if ('pageRoot' in classified) {
        if (classified.pageRoot) {
          pagesRoots.add(classified.pageRoot)
        }
        continue
      }

      queue.push(classified.nextPath)
    }
  }

  return pagesRoots
}

function buildDefaultSearchRoots(
  absoluteSrcRoot: string,
  discoveredPagesRoots: Iterable<string>,
  subPackageRoots?: Iterable<string>,
) {
  const roots: string[] = []
  const discoveredRoots = [...discoveredPagesRoots]

  if (discoveredRoots.length > 0) {
    roots.push(...discoveredRoots)
  }
  else {
    roots.push(absoluteSrcRoot)
  }

  for (const root of subPackageRoots ?? []) {
    if (!root) {
      continue
    }

    const absoluteRoot = path.resolve(absoluteSrcRoot, root)

    if (!hasNestedPagesRoot(absoluteRoot, discoveredRoots)) {
      roots.push(absoluteRoot)
    }
  }

  return roots
}

async function resolveDefaultSearchRoots(
  absoluteSrcRoot: string,
  subPackageRoots?: Iterable<string>,
) {
  const discoveredPagesRoots = await discoverPagesRoots(absoluteSrcRoot)

  return buildDefaultSearchRoots(absoluteSrcRoot, discoveredPagesRoots, subPackageRoots)
}

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

export async function collectCandidates(
  absoluteSrcRoot: string,
  include?: string | RegExp | Array<string | RegExp>,
  subPackageRoots?: Iterable<string>,
  searchRoots?: Iterable<string>,
) {
  const candidates = new Map<string, CandidateEntry>()
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

  const crawler = new Fdir({
    includeDirs: false,
    pathSeparator: '/',
    excludeSymlinks: true,
    suppressErrors: true,
    exclude(dirName) {
      return SKIPPED_DIRECTORIES.has(dirName)
    },
  }).withFullPaths()

  for (const root of roots) {
    const targetRoot = resolveCollectTargetRoot(absoluteSrcRoot, root)
    if (!targetRoot) {
      continue
    }

    if (!(await shouldCollectTargetRoot(targetRoot))) {
      continue
    }

    const files = await safeCrawlCandidateFiles(crawler, targetRoot)

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
  buildDefaultSearchRoots,
  classifyPagesRootEntry,
  hasNestedPagesRoot,
  resolveCandidateEntryPath,
  resolveCandidateSearchRoots,
  resolveCollectTargetRoot,
  safeCrawlCandidateFiles,
  shouldCollectCandidateEntry,
  shouldCollectTargetRoot,
}
