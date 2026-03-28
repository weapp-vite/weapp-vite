import type { ResolvedPageLayout } from '../vue/transform/pageLayout/types'
import { normalizeWatchPath } from '../../utils/path'
import { collectNativeLayoutAssets } from '../vue/transform/pageLayout'

export async function expandResolvedPageLayoutFiles(
  layouts: ResolvedPageLayout[],
) {
  const files: string[] = []

  for (const layout of layouts) {
    files.push(layout.file)
    if (layout.kind !== 'native') {
      continue
    }

    const nativeAssets = await collectNativeLayoutAssets(layout.file)
    for (const asset of Object.values(nativeAssets)) {
      if (asset) {
        files.push(asset)
      }
    }
  }

  return files
}

export async function addResolvedPageLayoutWatchFiles(
  pluginCtx: {
    addWatchFile?: (id: string) => void
  },
  layouts: ResolvedPageLayout[],
) {
  if (typeof pluginCtx.addWatchFile !== 'function') {
    return
  }

  for (const file of await expandResolvedPageLayoutFiles(layouts)) {
    pluginCtx.addWatchFile(normalizeWatchPath(file))
  }
}
