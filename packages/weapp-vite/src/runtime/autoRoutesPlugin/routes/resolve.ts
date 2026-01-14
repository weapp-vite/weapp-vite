import path from 'pathe'

interface ResolvedRoute {
  entry: string
  pagePath: string
  root?: string
}

export function resolveRoute(normalizedBase: string): ResolvedRoute | undefined {
  if (normalizedBase.startsWith('pages/')) {
    return {
      entry: normalizedBase,
      pagePath: normalizedBase,
    }
  }

  const idx = normalizedBase.indexOf('/pages/')
  if (idx === -1) {
    return undefined
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

export function resolvePagesDirectory(normalizedBase: string, absoluteSrcRoot: string) {
  if (normalizedBase.startsWith('pages/')) {
    return path.join(absoluteSrcRoot, 'pages')
  }

  const idx = normalizedBase.indexOf('/pages/')
  if (idx === -1) {
    return undefined
  }

  const root = normalizedBase.slice(0, idx)
  if (!root) {
    return undefined
  }
  return path.join(absoluteSrcRoot, root, 'pages')
}
