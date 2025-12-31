import type { CompilerContext } from '../../../context'
import type { SubPackageStyleEntry } from '../../../types'
import path from 'pathe'
import picomatch from 'picomatch'
import { normalizeRoot, toPosixPath } from '../../../utils/path'

export { toPosixPath }

interface StyleMatcher {
  include: (test: string) => boolean
  exclude?: (test: string) => boolean
}

const styleMatcherCache = new WeakMap<SubPackageStyleEntry, StyleMatcher>()

export function collectSharedStyleEntries(
  ctx: CompilerContext,
  configService: CompilerContext['configService'],
) {
  const map = new Map<string, SubPackageStyleEntry[]>()
  const registry = ctx.scanService?.subPackageMap
  if (!registry?.size) {
    return map
  }
  const currentRoot = configService.currentSubPackageRoot
  for (const [root, meta] of registry.entries()) {
    if (!meta.styleEntries?.length) {
      continue
    }
    if (currentRoot && root !== currentRoot) {
      continue
    }
    map.set(root, meta.styleEntries)
  }
  return map
}

function sanitizeRelativePath(value: string) {
  const normalized = toPosixPath(value)
  if (normalized.startsWith('./')) {
    return normalized.slice(2)
  }
  return normalized
}

function isWithinRoot(pathname: string, root: string) {
  if (!root) {
    return true
  }
  return pathname === root || pathname.startsWith(`${root}/`)
}

function relativeToRoot(pathname: string, root: string) {
  if (!pathname) {
    return pathname
  }
  if (!root) {
    return pathname
  }
  if (pathname === root) {
    return ''
  }
  if (pathname.startsWith(`${root}/`)) {
    return pathname.slice(root.length + 1)
  }
}

function getStyleMatcher(entry: SubPackageStyleEntry): StyleMatcher {
  const cached = styleMatcherCache.get(entry)
  if (cached) {
    return cached
  }

  const includePatterns = entry.include?.length ? entry.include : ['**/*']
  const excludePatterns = entry.exclude?.length ? entry.exclude : undefined

  const matcher: StyleMatcher = {
    include: picomatch(includePatterns, { dot: true }),
  }

  if (excludePatterns?.length) {
    matcher.exclude = picomatch(excludePatterns, { dot: true })
  }

  styleMatcherCache.set(entry, matcher)
  return matcher
}

function matchesStyleEntry(
  entry: SubPackageStyleEntry,
  relativeModule: string | undefined,
  relativeFile: string | undefined,
) {
  const matcher = getStyleMatcher(entry)
  const candidates: string[] = []
  if (typeof relativeFile === 'string' && relativeFile.length > 0) {
    candidates.push(relativeFile)
  }
  if (typeof relativeModule === 'string' && relativeModule.length > 0) {
    candidates.push(relativeModule)
  }
  if (!candidates.length) {
    return false
  }

  const included = candidates.some(candidate => matcher.include(candidate))
  if (!included) {
    return false
  }

  if (matcher.exclude && candidates.some(candidate => matcher.exclude!(candidate))) {
    return false
  }

  return true
}

function findSharedStylesForModule(
  modulePath: string,
  fileName: string,
  sharedStyles: Map<string, SubPackageStyleEntry[]>,
) {
  const sanitizedModule = sanitizeRelativePath(modulePath)
  const sanitizedFile = sanitizeRelativePath(fileName)
  const matched: SubPackageStyleEntry[] = []
  for (const [root, entries] of sharedStyles.entries()) {
    const normalizedRoot = normalizeRoot(root)
    if (!normalizedRoot) {
      continue
    }
    if (!isWithinRoot(sanitizedFile, normalizedRoot)) {
      continue
    }
    const relativeModule = relativeToRoot(sanitizedModule, normalizedRoot)
    const relativeFile = relativeToRoot(sanitizedFile, normalizedRoot)
    for (const entry of entries) {
      if (matchesStyleEntry(entry, relativeModule, relativeFile)) {
        matched.push(entry)
      }
    }
  }
  return matched
}

function resolveImportSpecifiers(
  fileName: string,
  entries: SubPackageStyleEntry[],
) {
  const posixFileName = toPosixPath(fileName)
  const dir = path.posix.dirname(posixFileName)
  const seen = new Set<string>()
  const specifiers: string[] = []

  for (const entry of entries) {
    const target = toPosixPath(entry.outputRelativePath)
    if (target === posixFileName) {
      continue
    }
    const relative = path.posix.relative(dir, target)
    let specifier = relative || path.posix.basename(target)
    if (!specifier || specifier === '.') {
      continue
    }
    if (!specifier.startsWith('.')) {
      specifier = `./${specifier}`
    }
    specifier = specifier.replace(/\/+/g, '/')
    if (specifier === './') {
      continue
    }
    if (seen.has(specifier)) {
      continue
    }
    seen.add(specifier)
    specifiers.push(specifier)
  }

  return specifiers
}

function prependImports(css: string, statements: string[]) {
  if (!statements.length) {
    return css
  }

  const importBlock = statements.join('\n')
  const charsetMatch = css.match(/^(@charset\s+['"][^'"]+';\s*)+/)
  if (charsetMatch) {
    const prefix = charsetMatch[0]
    const suffix = css.slice(prefix.length)
    return `${prefix}${importBlock}\n${suffix}`
  }

  return `${importBlock}\n${css}`
}

export function injectSharedStyleImports(
  css: string,
  modulePath: string,
  fileName: string,
  sharedStyles: Map<string, SubPackageStyleEntry[]>,
  configService: CompilerContext['configService'],
) {
  const relativeModulePath = configService.relativeAbsoluteSrcRoot(modulePath)
  if (!relativeModulePath) {
    return css
  }

  const normalizedModule = toPosixPath(relativeModulePath)
  if (normalizedModule.startsWith('..')) {
    return css
  }

  const normalizedFileName = toPosixPath(fileName)
  const entries = findSharedStylesForModule(normalizedModule, normalizedFileName, sharedStyles)
  if (!entries?.length) {
    return css
  }

  const specifiers = resolveImportSpecifiers(fileName, entries)
  if (!specifiers.length) {
    return css
  }

  const statements: string[] = []
  const emitted = new Set<string>()
  for (const specifier of specifiers) {
    const statement = `@import '${specifier}';`
    if (emitted.has(statement)) {
      continue
    }
    if (css.includes(statement)) {
      continue
    }
    emitted.add(statement)
    statements.push(statement)
  }

  if (!statements.length) {
    return css
  }

  return prependImports(css, statements)
}
