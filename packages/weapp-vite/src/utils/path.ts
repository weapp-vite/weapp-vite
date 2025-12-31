import { sep } from 'node:path'
import path from 'pathe'

const BACKSLASH_RE = /\\/g
const LEADING_SLASH_RE = /^[\\/]+/
const DUPLICATE_SLASH_RE = /\/{2,}/g
const TRIM_SLASH_RE = /^\/+|\/+$/g

export function toPosixPath(value: string) {
  return value.replace(BACKSLASH_RE, '/')
}

export function fromPosixPath(value: string) {
  return sep === '/' ? value : value.split('/').join(sep)
}

export function stripLeadingSlashes(value: string) {
  return value.replace(LEADING_SLASH_RE, '')
}

export function normalizeRoot(root: string) {
  return toPosixPath(root).replace(DUPLICATE_SLASH_RE, '/').replace(TRIM_SLASH_RE, '')
}

export function isPathInside(parent: string | undefined, target: string) {
  if (!parent) {
    return false
  }
  const relative = path.relative(parent, target)
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative))
}
