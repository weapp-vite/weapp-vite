import type { CompilerContext } from '../../../context'
import { removeExtensionDeep } from '@weapp-core/shared'
import path from 'pathe'
import { stripLeadingSlashes } from '../../../utils/path'

export function createPageEntryMatcher(ctx: CompilerContext) {
  let cached: Set<string> | undefined

  async function ensure() {
    const { configService, scanService } = ctx
    if (!configService || !scanService) {
      return new Set<string>()
    }
    if (cached) {
      return cached
    }

    const set = new Set<string>()
    const appEntry = await scanService.loadAppEntry()
    for (const pageEntry of appEntry.json?.pages ?? []) {
      const normalized = stripLeadingSlashes(String(pageEntry))
      if (!normalized) {
        continue
      }
      set.add(path.resolve(configService.absoluteSrcRoot, normalized))
    }

    for (const meta of scanService.loadSubPackages()) {
      const root = meta.subPackage.root ?? ''
      for (const pageEntry of meta.subPackage.pages ?? []) {
        const normalized = stripLeadingSlashes(String(pageEntry))
        if (!normalized) {
          continue
        }
        set.add(path.resolve(configService.absoluteSrcRoot, root, normalized))
      }
    }

    if (scanService.pluginJson) {
      const pluginPages = Object.values((scanService.pluginJson as any).pages ?? {})
      for (const entry of pluginPages) {
        const normalized = stripLeadingSlashes(String(entry))
        if (!normalized) {
          continue
        }
        set.add(path.resolve(configService.absoluteSrcRoot, removeExtensionDeep(normalized)))
      }
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
