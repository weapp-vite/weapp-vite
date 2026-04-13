import path from 'node:path'

export function collectAppJsonPageRoutes(appJson: Record<string, any>) {
  const routes = new Set<string>()

  const addRoute = (route: unknown) => {
    if (typeof route !== 'string') {
      return
    }

    const normalizedRoute = route.trim().replace(/^\/+|\/+$/g, '')

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
  const normalizedRoute = route.trim().replace(/^\/+|\/+$/g, '')

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
