import { sep } from 'node:path'
import path from 'pathe'

const BACKSLASH_RE = /\\/g
const LEADING_SLASH_RE = /^[\\/]+/
const DUPLICATE_SLASH_RE = /\/{2,}/g
const TRIM_SLASH_RE = /^\/+|\/+$/g
const WINDOWS_DEVICE_RE = /^\\\\\?\\/
const WINDOWS_UNC_PREFIX = /^\\\\\?\\UNC\\/

function stripWindowsDevicePath(value: string) {
  if (WINDOWS_UNC_PREFIX.test(value)) {
    return `\\\\${value.slice('\\\\?\\UNC\\'.length)}`
  }
  if (WINDOWS_DEVICE_RE.test(value)) {
    return value.slice('\\\\?\\'.length)
  }
  return value
}

export function toPosixPath(value: string) {
  return value.replace(BACKSLASH_RE, '/')
}

export function fromPosixPath(value: string) {
  return sep === '/' ? value : value.split('/').join(sep)
}

export function normalizePath(value: string) {
  if (!value) {
    return value
  }
  const cleaned = stripWindowsDevicePath(value)
  return toPosixPath(path.normalize(cleaned))
}

export function normalizeRelativePath(value: string) {
  if (value === '') {
    return value
  }
  return normalizePath(value)
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
