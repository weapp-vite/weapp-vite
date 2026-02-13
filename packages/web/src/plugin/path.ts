import fs from 'fs-extra'
import { dirname, extname, normalize, posix, relative, resolve } from 'pathe'

import { TEMPLATE_EXTS, WXS_RESOLVE_EXTS } from './constants'

export function cleanUrl(url: string) {
  const queryIndex = url.indexOf('?')
  if (queryIndex >= 0) {
    return url.slice(0, queryIndex)
  }
  return url
}

export function normalizePath(p: string) {
  return posix.normalize(p.split('\\').join('/'))
}

export function isInsideDir(filePath: string, dir: string) {
  const rel = relative(dir, filePath)
  return rel === '' || (!rel.startsWith('..') && !posix.isAbsolute(rel))
}

export function isHtmlEntry(filePath: string, root: string) {
  if (!filePath.toLowerCase().endsWith('.html')) {
    return false
  }
  return normalizePath(filePath) === normalizePath(resolve(root, 'index.html'))
}

export function toPosixId(id: string) {
  return normalize(id).split('\\').join('/')
}

export function toRelativeImport(from: string, target: string) {
  const fromDir = dirname(from)
  const rel = relative(fromDir, target)
  if (!rel || rel.startsWith('.')) {
    return normalizePath(rel || `./${posix.basename(target)}`)
  }
  return `./${normalizePath(rel)}`
}

export function appendInlineQuery(id: string) {
  if (id.includes('?')) {
    if (id.includes('?inline') || id.includes('&inline')) {
      return id
    }
    return `${id}&inline`
  }
  return `${id}?inline`
}

export function relativeModuleId(root: string, absPath: string) {
  const rel = relative(root, absPath)
  return `/${normalizePath(rel)}`
}

export function resolveImportBase(raw: string, importer: string, srcRoot: string) {
  if (!raw) {
    return undefined
  }
  if (raw.startsWith('.')) {
    return resolve(dirname(importer), raw)
  }
  if (raw.startsWith('/')) {
    return resolve(srcRoot, raw.slice(1))
  }
  return resolve(srcRoot, raw)
}

export function resolveFileWithExtensionsSync(basePath: string, extensions: string[]) {
  if (extname(basePath) && fs.pathExistsSync(basePath)) {
    return basePath
  }
  for (const ext of extensions) {
    const candidate = `${basePath}${ext}`
    if (fs.pathExistsSync(candidate)) {
      return candidate
    }
  }
  return undefined
}

export function resolveTemplatePathSync(raw: string, importer: string, srcRoot: string) {
  const base = resolveImportBase(raw, importer, srcRoot)
  if (!base) {
    return undefined
  }
  return resolveFileWithExtensionsSync(base, TEMPLATE_EXTS)
}

export function resolveWxsPathSync(raw: string, importer: string, srcRoot: string) {
  if (!raw) {
    return undefined
  }
  let base: string | undefined
  if (raw.startsWith('.')) {
    base = resolve(dirname(importer), raw)
  }
  else if (raw.startsWith('/')) {
    base = resolve(srcRoot, raw.slice(1))
  }
  else {
    return undefined
  }
  return resolveFileWithExtensionsSync(base, WXS_RESOLVE_EXTS)
}
