import type { PackageJson } from 'pkg-types'
import { TEMPLATE_CATALOG, TEMPLATE_NAMED_CATALOG } from '../generated/catalog'

const DIGIT_RE = /\d/
const templateCatalogMap: Record<string, string> = { ...TEMPLATE_CATALOG }
const templateNamedCatalogMap: Record<string, Record<string, string>> = Object.fromEntries(
  Object.entries(TEMPLATE_NAMED_CATALOG).map(([name, deps]) => [name, { ...deps }]),
)

function resolveCatalogSpec(packageName: string, spec: string): string {
  if (!spec.startsWith('catalog:')) {
    return spec
  }

  const catalogName = spec.slice('catalog:'.length)

  if (!catalogName) {
    return templateCatalogMap[packageName] ?? spec
  }

  const fromNamedCatalog = templateNamedCatalogMap[catalogName]?.[packageName]
  if (fromNamedCatalog) {
    if (fromNamedCatalog === 'latest') {
      return templateCatalogMap[packageName] ?? fromNamedCatalog
    }
    return fromNamedCatalog
  }

  return templateCatalogMap[packageName] ?? spec
}

export function normalizeTemplateDependencySpecs(pkgJson: PackageJson) {
  const fields: Array<keyof PackageJson> = [
    'dependencies',
    'devDependencies',
    'peerDependencies',
    'optionalDependencies',
  ]

  for (const field of fields) {
    const deps = pkgJson[field] as Record<string, unknown> | undefined
    if (!deps) {
      continue
    }

    for (const [name, rawSpec] of Object.entries(deps)) {
      if (typeof rawSpec !== 'string' || !rawSpec) {
        continue
      }
      const spec = rawSpec
      if (spec.startsWith('catalog:')) {
        deps[name] = resolveCatalogSpec(name, spec)
      }
      else if (spec.startsWith('workspace:')) {
        const workspaceSpec = spec.slice('workspace:'.length)
        if (workspaceSpec && DIGIT_RE.test(workspaceSpec)) {
          deps[name] = workspaceSpec
          continue
        }
        const fromCatalog = templateCatalogMap[name]
        if (fromCatalog) {
          deps[name] = fromCatalog
        }
      }
    }
  }
}

export function ensureManagedTypeScriptDevDependencies(pkgJson: PackageJson) {
  pkgJson.devDependencies ??= {}

  if (
    pkgJson.dependencies?.['@types/node']
    || pkgJson.devDependencies['@types/node']
    || pkgJson.peerDependencies?.['@types/node']
    || pkgJson.optionalDependencies?.['@types/node']
  ) {
    return
  }

  pkgJson.devDependencies['@types/node'] = templateCatalogMap['@types/node']
}
