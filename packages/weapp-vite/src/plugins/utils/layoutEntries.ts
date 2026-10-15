import type { Entry, MpPlatform } from '../../types'
import type { ResolvedPageLayout } from '../vue/transform/pageLayout/types'
import { collectNativeLayoutAssets } from '../vue/transform/pageLayout'

export async function registerResolvedPageLayoutEntries(options: {
  layouts: ResolvedPageLayout[]
  entries: string[]
  explicitEntryTypes: Map<string, Entry['type']>
  nativeScriptEntries?: Set<string>
  normalizeEntry: (entry: string, jsonPath: string) => string
  jsonPath: string
  platform?: MpPlatform
  resolveNativeLayoutAssets?: typeof collectNativeLayoutAssets
}) {
  const {
    layouts,
    entries,
    explicitEntryTypes,
    nativeScriptEntries,
    normalizeEntry,
    jsonPath,
    platform,
    resolveNativeLayoutAssets = collectNativeLayoutAssets,
  } = options

  for (const layout of layouts) {
    if (layout.kind === 'native') {
      const nativeAssets = await resolveNativeLayoutAssets(layout.file, platform)
      if (!nativeAssets.script) {
        continue
      }
    }

    entries.push(layout.importPath)
    const normalizedEntry = normalizeEntry(layout.importPath, jsonPath)
    explicitEntryTypes.set(normalizedEntry, 'component')
    if (layout.kind === 'native') {
      nativeScriptEntries?.add(normalizedEntry)
    }
  }
}

export function markComponentEntries(
  entriesMap: Map<string, Entry | undefined>,
  entries: Iterable<string>,
) {
  for (const entry of entries) {
    const mapped = entriesMap.get(entry)
    if (mapped) {
      mapped.type = 'component'
    }
  }
}
