import path from 'node:path'

function normalizeRoute(route: string) {
  return route.trim().replace(/^\/+|\/+$/g, '')
}

export function collectAppJsonPageRoutes(appJson: Record<string, any>) {
  const routes = new Set<string>()

  const addRoute = (route: unknown) => {
    if (typeof route !== 'string') {
      return
    }

    const normalizedRoute = normalizeRoute(route)

    if (normalizedRoute) {
      routes.add(normalizedRoute)
    }
  }

  const addPrefixedRoute = (root: unknown, page: unknown) => {
    if (typeof page !== 'string') {
      return
    }

    const segments = []

    if (typeof root === 'string' && root.trim()) {
      segments.push(root.trim().replace(/^\/+|\/+$/g, ''))
    }

    segments.push(page.trim().replace(/^\/+|\/+$/g, ''))
    addRoute(segments.filter(Boolean).join('/'))
  }

  if (Array.isArray(appJson?.pages)) {
    for (const page of appJson.pages) {
      addRoute(page)
    }
  }

  const subPackages = [
    ...(Array.isArray(appJson?.subPackages) ? appJson.subPackages : []),
    ...(Array.isArray(appJson?.subpackages) ? appJson.subpackages : []),
  ]

  for (const subPackage of subPackages) {
    if (!subPackage || typeof subPackage !== 'object') {
      continue
    }

    const pages = Array.isArray(subPackage.pages) ? subPackage.pages : []

    for (const page of pages) {
      addPrefixedRoute(subPackage.root, page)
    }
  }

  return [...routes]
}

export function getPageFileCandidatePaths(route: string) {
  const normalizedRoute = normalizeRoute(route)

  if (!normalizedRoute) {
    return []
  }

  return [
    `${normalizedRoute}.vue`,
    `${normalizedRoute}.ts`,
    `${normalizedRoute}.js`,
    `${normalizedRoute}.wxml`,
  ].map(candidate => path.normalize(candidate))
}

export function getPreferredPageFilePath(route: string) {
  const normalizedRoute = normalizeRoute(route)

  if (!normalizedRoute) {
    return null
  }

  return path.normalize(`${normalizedRoute}.vue`)
}

export async function collectMissingPageRoutes(
  appJson: Record<string, any>,
  hasPageFile: (route: string) => Promise<boolean>,
) {
  const missingRoutes = []

  for (const route of collectAppJsonPageRoutes(appJson)) {
    if (!await hasPageFile(route)) {
      missingRoutes.push(route)
    }
  }

  return missingRoutes
}

export function getRouteFromPageFilePath(filePath: string) {
  const normalizedPath = filePath.trim()

  if (!normalizedPath) {
    return null
  }

  const extension = path.extname(normalizedPath)

  if (!['.vue', '.ts', '.js', '.wxml'].includes(extension)) {
    return null
  }

  return normalizeRoute(normalizedPath.slice(0, -extension.length).split(path.sep).join('/'))
}

export function findRouteTextRange(appJsonText: string, route: string) {
  const target = `"${normalizeRoute(route)}"`
  const start = appJsonText.indexOf(target)

  if (start < 0) {
    return null
  }

  return {
    start,
    end: start + target.length,
  }
}

export function getQuotedRouteValueAtLine(lineText: string, character: number) {
  if (character < 0) {
    return null
  }

  const quotedValuePattern = /"([^"]+)"/gu

  for (const match of lineText.matchAll(quotedValuePattern)) {
    const fullMatch = match[0]
    const value = match[1]
    const start = match.index ?? -1
    const end = start + fullMatch.length

    if (start < 0) {
      continue
    }

    if (character >= start && character <= end) {
      return value
    }
  }

  return null
}

export function getQuotedRouteRangesAtLine(lineText: string) {
  const quotedValuePattern = /"([^"]+)"/gu
  const ranges = []

  for (const match of lineText.matchAll(quotedValuePattern)) {
    const fullMatch = match[0]
    const value = match[1]
    const start = match.index ?? -1

    if (start < 0) {
      continue
    }

    ranges.push({
      value,
      start: start + 1,
      end: start + fullMatch.length - 1,
    })
  }

  return ranges
}
