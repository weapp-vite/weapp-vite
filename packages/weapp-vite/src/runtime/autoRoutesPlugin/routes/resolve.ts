interface ResolvedRoute {
  entry: string
  pagePath: string
  root?: string
}

function resolveConfiguredSubPackageRoute(normalizedBase: string, subPackageRoots: Iterable<string>) {
  const roots = [...subPackageRoots].sort((a, b) => b.length - a.length)
  for (const root of roots) {
    if (!root || normalizedBase === root || !normalizedBase.startsWith(`${root}/`)) {
      continue
    }

    const pagePath = normalizedBase.slice(root.length + 1)
    if (!pagePath) {
      continue
    }

    return {
      root,
      pagePath,
      entry: normalizedBase,
    }
  }
}

export function resolveRoute(normalizedBase: string, subPackageRoots: Iterable<string> = []): ResolvedRoute | undefined {
  if (!normalizedBase) {
    return undefined
  }

  const configuredSubPackageRoute = resolveConfiguredSubPackageRoute(normalizedBase, subPackageRoots)
  if (configuredSubPackageRoute) {
    return configuredSubPackageRoute
  }

  if (normalizedBase.startsWith('pages/')) {
    return {
      entry: normalizedBase,
      pagePath: normalizedBase,
    }
  }

  const idx = normalizedBase.indexOf('/pages/')
  if (idx === -1) {
    return {
      entry: normalizedBase,
      pagePath: normalizedBase,
    }
  }

  const root = normalizedBase.slice(0, idx)
  const pagePath = normalizedBase.slice(idx + 1)
  if (!root || !pagePath.startsWith('pages/')) {
    return undefined
  }

  return {
    root,
    pagePath,
    entry: `${root}/${pagePath}`,
  }
}
