export function capitalize(str: string): string {
  if (!str) {
    return ''
  }
  return str.charAt(0).toUpperCase() + str.slice(1)
}

const HYPHENATE_RE = /\B([A-Z])/g

export function hyphenate(str: string): string {
  if (!str) {
    return str
  }
  return str.replace(HYPHENATE_RE, '-$1').toLowerCase()
}

export function toPathSegments(path: string): string[] {
  if (!path) {
    return []
  }
  return path
    .split('.')
    .map(segment => segment.trim())
    .filter(Boolean)
}

export function hasOwn(source: object, key: PropertyKey) {
  return Object.prototype.hasOwnProperty.call(source, key)
}
