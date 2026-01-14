import type { SubPackage } from '../../types'
import { removeExtensionDeep } from '@weapp-core/shared'
import { collectPluginExportEntries } from '../../plugins/utils/analyze'

export function resolveSubPackageEntries(subPackage: SubPackage): string[] {
  const entries: string[] = []
  const root = subPackage.root ?? ''
  if (Array.isArray(subPackage.pages)) {
    entries.push(...subPackage.pages.map(page => `${root}/${page}`))
  }
  if (subPackage.entry) {
    entries.push(`${root}/${removeExtensionDeep(subPackage.entry)}`)
  }
  entries.push(...collectPluginExportEntries((subPackage as any).plugins, root))
  return entries
}
