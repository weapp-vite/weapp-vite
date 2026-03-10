function normalizePathSegments(path: string): string[] {
  const segments: string[] = []
  for (const segment of path.split('/')) {
    if (!segment || segment === '.') {
      continue
    }
    if (segment === '..') {
      if (segments.length > 0) {
        segments.pop()
      }
      continue
    }
    segments.push(segment)
  }
  return segments
}

export function resolvePath(path: string, currentPath: string): string {
  if (!path) {
    return normalizePathSegments(currentPath).join('/')
  }

  if (path.startsWith('/')) {
    return normalizePathSegments(path).join('/')
  }

  if (path.startsWith('./') || path.startsWith('../')) {
    const baseSegments = normalizePathSegments(currentPath)
    if (baseSegments.length > 0) {
      baseSegments.pop()
    }

    for (const segment of path.split('/')) {
      if (!segment || segment === '.') {
        continue
      }
      if (segment === '..') {
        if (baseSegments.length > 0) {
          baseSegments.pop()
        }
        continue
      }
      baseSegments.push(segment)
    }

    return baseSegments.join('/')
  }

  return normalizePathSegments(path).join('/')
}

export function createAbsoluteRoutePath(path: string): string {
  return path ? `/${path}` : '/'
}

const DYNAMIC_ROUTE_RE = /(?:^|\/):/

export function isDynamicRoutePath(path: string): boolean {
  return DYNAMIC_ROUTE_RE.test(path)
}
