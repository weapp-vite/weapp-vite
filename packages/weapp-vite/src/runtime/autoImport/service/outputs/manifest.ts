import type { ComponentMetadata } from '../../metadata'
import type { LocalAutoImportMatch } from '../../types'
import fs from 'fs-extra'

export function collectAllComponentNames(options: {
  collectResolverComponents: () => Record<string, string>
  registry: Map<string, LocalAutoImportMatch>
  componentMetadataMap: Map<string, ComponentMetadata>
  manifestCache: Map<string, string>
}) {
  const { collectResolverComponents, registry, componentMetadataMap, manifestCache } = options
  const resolverEntries = collectResolverComponents()
  const names = new Set<string>([...Object.keys(resolverEntries)])
  for (const key of registry.keys()) {
    names.add(key)
  }
  for (const key of componentMetadataMap.keys()) {
    names.add(key)
  }
  for (const key of manifestCache.keys()) {
    names.add(key)
  }
  return Array.from(names).sort((a, b) => a.localeCompare(b))
}

export async function writeManifestFile(options: {
  outputPath: string
  collectResolverComponents: () => Record<string, string>
  registry: Map<string, LocalAutoImportMatch>
  manifestCache: Map<string, string>
  scheduleHtmlCustomDataWrite: (shouldWrite: boolean) => void
}) {
  const {
    outputPath,
    collectResolverComponents,
    registry,
    manifestCache,
    scheduleHtmlCustomDataWrite,
  } = options
  const resolverEntries = Object.entries(collectResolverComponents())
  const localEntries = Array.from(registry.entries())
    .filter((entry): entry is [string, LocalAutoImportMatch] => entry[1].kind === 'local')

  const manifestMap = new Map<string, string>()
  for (const [componentName, from] of resolverEntries) {
    manifestMap.set(componentName, from)
  }
  for (const [componentName, match] of localEntries) {
    manifestMap.set(componentName, match.value.from)
  }

  const manifest = Object.fromEntries(
    Array.from(manifestMap.entries()).sort(([a], [b]) => a.localeCompare(b)),
  )

  manifestCache.clear()
  for (const [componentName, fromPath] of manifestMap.entries()) {
    manifestCache.set(componentName, fromPath)
  }

  await fs.outputJson(outputPath, manifest, { spaces: 2 })
  scheduleHtmlCustomDataWrite(true)
}
