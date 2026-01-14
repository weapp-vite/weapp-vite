import type { AutoRoutes } from '../../../types/routes'

function assignArray(target: string[], source: string[]) {
  target.splice(0, target.length, ...source)
}

export function updateRoutesReference(target: AutoRoutes, next: AutoRoutes) {
  assignArray(target.pages, next.pages)
  assignArray(target.entries, next.entries)

  const existing = new Map(target.subPackages.map(pkg => [pkg.root, pkg]))
  target.subPackages.length = 0
  for (const pkg of next.subPackages) {
    const preserved = existing.get(pkg.root)
    if (preserved) {
      assignArray(preserved.pages, pkg.pages)
      target.subPackages.push(preserved)
    }
    else {
      target.subPackages.push({ root: pkg.root, pages: [...pkg.pages] })
    }
  }
}

export function cloneRoutes(routes: AutoRoutes): AutoRoutes {
  return {
    pages: [...routes.pages],
    entries: [...routes.entries],
    subPackages: routes.subPackages.map((pkg) => {
      return {
        root: pkg.root,
        pages: [...pkg.pages],
      }
    }),
  }
}
