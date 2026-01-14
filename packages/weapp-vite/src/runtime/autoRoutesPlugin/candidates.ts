import { removeExtensionDeep } from '@weapp-core/shared'
import { fdir as Fdir } from 'fdir'
import fs from 'fs-extra'
import path from 'pathe'
import { configExtensions, jsExtensions, supportedCssLangs, templateExtensions, vueExtensions } from '../../constants'
import { toPosixPath } from '../../utils/path'

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
const SKIPPED_DIRECTORIES = new Set(['node_modules', 'miniprogram_npm', '.git', '.idea', '.husky', '.turbo', '.cache', '.wevu-config', 'dist'])

export function isConfigFile(filePath: string) {
  return CONFIG_SUFFIXES.some(ext => filePath.endsWith(ext))
}

export function isScriptFile(filePath: string) {
  if (filePath.endsWith('.d.ts')) {
    return false
  }
  if (/\.wxs\.[jt]s$/i.test(filePath) || /\.wxml\.[jt]s$/i.test(filePath)) {
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

export async function collectCandidates(absoluteSrcRoot: string, searchRoots?: Iterable<string>) {
  const candidates = new Map<string, CandidateEntry>()
  const roots = searchRoots ? Array.from(new Set(searchRoots)) : [absoluteSrcRoot]

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
    const targetRoot = path.isAbsolute(root)
      ? root
      : path.resolve(absoluteSrcRoot, root)

    if (!toPosixPath(targetRoot).startsWith(toPosixPath(absoluteSrcRoot))) {
      continue
    }

    if (!(await fs.pathExists(targetRoot))) {
      continue
    }

    let files: string[]
    try {
      files = await crawler.crawl(targetRoot).withPromise()
    }
    catch {
      files = []
    }

    for (const entryPath of files) {
      const normalizedRelative = toPosixPath(path.relative(absoluteSrcRoot, entryPath))
      if (!normalizedRelative || normalizedRelative.startsWith('..')) {
        continue
      }

      const isPagesCandidate = normalizedRelative.startsWith('pages/')
        || normalizedRelative.includes('/pages/')

      if (!isPagesCandidate) {
        continue
      }

      const candidateBase = removeExtensionDeep(entryPath)
      const candidate = ensureCandidate(candidates, candidateBase)
      candidate.files.add(entryPath)

      if (isConfigFile(entryPath)) {
        candidate.jsonPath = entryPath
        continue
      }

      if (isVueFile(entryPath) || isScriptFile(entryPath)) {
        candidate.hasScript = true
      }

      if (isTemplateFile(entryPath)) {
        candidate.hasTemplate = true
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
