import { removeExtensionDeep } from '@weapp-core/shared'
import path from 'pathe'
import { stripLeadingSlashes } from '../../../utils/path'
import { resolveWarnHandler } from '../../../utils/warn'

export interface PageEntryMatcherSource {
  srcRoot: string
  loadEntries: () => Promise<{
    pages?: string[]
    subPackages?: Array<{ root?: string, pages?: string[] }>
    pluginPages?: string[]
  }>
  warn?: (message: string) => void
}

export function createPageEntryMatcher(source: PageEntryMatcherSource) {
  let cached: Set<string> | undefined
  const warn = resolveWarnHandler(source.warn)

  async function ensure() {
    if (cached) {
      return cached
    }

    let entries: Awaited<ReturnType<PageEntryMatcherSource['loadEntries']>>
    try {
      entries = await source.loadEntries()
    }
    catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      warn(`[wevu] 解析页面入口失败：${message}`)
      return new Set<string>()
    }

    const set = new Set<string>()
    for (const pageEntry of entries.pages ?? []) {
      const normalized = stripLeadingSlashes(String(pageEntry))
      if (!normalized) {
        continue
      }
      set.add(path.resolve(source.srcRoot, normalized))
    }

    for (const meta of entries.subPackages ?? []) {
      const root = meta.root ?? ''
      for (const pageEntry of meta.pages ?? []) {
        const normalized = stripLeadingSlashes(String(pageEntry))
        if (!normalized) {
          continue
        }
        set.add(path.resolve(source.srcRoot, root, normalized))
      }
    }

    for (const entry of entries.pluginPages ?? []) {
      const normalized = stripLeadingSlashes(String(entry))
      if (!normalized) {
        continue
      }
      set.add(path.resolve(source.srcRoot, removeExtensionDeep(normalized)))
    }

    cached = set
    return set
  }

  return {
    markDirty() {
      cached = undefined
    },
    async isPageFile(filePath: string) {
      const pages = await ensure()
      const normalized = removeExtensionDeep(filePath)
      return pages.has(normalized)
    },
  }
}
