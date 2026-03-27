import fsNative from 'node:fs'
import path from 'pathe'
import { toPosixPath } from '../../../../utils/path'

const CAMEL_TO_KEBAB_RE = /([a-z0-9])([A-Z])/g
const LAYOUT_NAME_SEPARATORS_RE = /[_\s]+/g
const DUPLICATE_DASH_RE = /-+/g
const EDGE_DASH_RE = /^-|-$/g
const PATH_SEGMENT_RE = /[\\/]/
const DEFAULT_LAYOUT_DIRECTIVE_PREFIX = 'wx'

export function normalizeComparablePath(input: string) {
  const resolved = path.resolve(input)
  try {
    return toPosixPath(fsNative.realpathSync.native(resolved))
  }
  catch {
    const suffixParts: string[] = []
    let cursor = resolved
    let parent = path.dirname(cursor)

    while (parent !== cursor && !fsNative.existsSync(cursor)) {
      suffixParts.unshift(path.basename(cursor))
      cursor = parent
      parent = path.dirname(cursor)
    }

    try {
      const normalizedBase = toPosixPath(fsNative.realpathSync.native(cursor))
      return suffixParts.length > 0 ? toPosixPath(path.join(normalizedBase, ...suffixParts)) : normalizedBase
    }
    catch {
      return toPosixPath(resolved)
    }
  }
}

export function toKebabCase(input: string) {
  return input
    .replace(CAMEL_TO_KEBAB_RE, '$1-$2')
    .replace(LAYOUT_NAME_SEPARATORS_RE, '-')
    .replace(DUPLICATE_DASH_RE, '-')
    .replace(EDGE_DASH_RE, '')
    .toLowerCase()
}

export function normalizeLayoutName(input: string) {
  return input
    .split(PATH_SEGMENT_RE)
    .filter(Boolean)
    .map(segment => toKebabCase(segment))
    .filter(Boolean)
    .join('-')
}

export function toLayoutTagName(layoutName: string) {
  return `weapp-layout-${layoutName}`
}

export function ensureRelativeImportPath(fromFile: string, targetFile: string) {
  const relativePath = path.relative(path.dirname(fromFile), targetFile)
  const normalized = toPosixPath(relativePath)
  if (normalized.startsWith('.')) {
    return normalized
  }
  return `./${normalized}`
}

export function escapeDoubleQuotedAttr(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
}

export function removeFileExtension(filename: string) {
  const ext = path.extname(filename)
  return ext ? filename.slice(0, -ext.length) : filename
}

export function getLayoutConditionalDirective(index: number, directivePrefix = DEFAULT_LAYOUT_DIRECTIVE_PREFIX) {
  return `${directivePrefix}:${index === 0 ? 'if' : 'elif'}`
}

export function getLayoutElseDirective(directivePrefix = DEFAULT_LAYOUT_DIRECTIVE_PREFIX) {
  return `${directivePrefix}:else`
}
