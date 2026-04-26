import { toPosixPath } from '../../utils/path'

export const DEFAULT_LAYOUT_SOURCE_ROOT = 'layouts'

const LEADING_SLASHES_RE = /^\/+/
const TRAILING_SLASHES_RE = /\/+$/

function normalizeRelativePath(value: string) {
  return toPosixPath(value).replace(LEADING_SLASHES_RE, '').replace(TRAILING_SLASHES_RE, '')
}

export function isLayoutSourcePath(
  relativeSrc: string,
  layoutSourceRoot = DEFAULT_LAYOUT_SOURCE_ROOT,
) {
  const normalizedRoot = normalizeRelativePath(layoutSourceRoot)
  const normalizedSrc = normalizeRelativePath(relativeSrc)
  return normalizedSrc === normalizedRoot || normalizedSrc.startsWith(`${normalizedRoot}/`)
}
