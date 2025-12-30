import { sep } from 'node:path'
import path from 'pathe'

const BACKSLASH_RE = /\\/g

export function toPosixPath(value: string) {
  return value.replace(BACKSLASH_RE, '/')
}

export function fromPosixPath(value: string) {
  return sep === '/' ? value : value.split('/').join(sep)
}

export function isPathInside(parent: string | undefined, target: string) {
  if (!parent) {
    return false
  }
  const relative = path.relative(parent, target)
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative))
}
