import type { SubPackage } from '../../types'
import { removeExtensionDeep } from '@weapp-core/shared'
import { collectPluginExportEntries } from '../../plugins/utils/analyze'

export function resolveSubPackageEntries(subPackage: SubPackage): string[] {
  const entries = new Set<string>()
  const root = subPackage.root ?? ''
  if (Array.isArray(subPackage.pages)) {
    for (const page of subPackage.pages) {
      entries.add(`${root}/${page}`)
    }
  }
  if (subPackage.entry) {
    entries.add(`${root}/${removeExtensionDeep(subPackage.entry)}`)
  }
  for (const entry of collectPluginExportEntries((subPackage as any).plugins, root)) {
    entries.add(entry)
  }
  return [...entries]
}
