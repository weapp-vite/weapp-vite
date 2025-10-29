export function capitalize(str: string): string {
  if (!str) {
    return ''
  }
  return str.charAt(0).toUpperCase() + str.slice(1)
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
