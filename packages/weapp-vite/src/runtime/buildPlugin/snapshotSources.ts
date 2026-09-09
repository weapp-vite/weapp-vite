import type { MutableCompilerContext } from '../../context'
import { invalidateFileCache } from '../../plugins/utils/cache'
import { isTemplate } from '../../utils'
import { normalizeFsResolvedId } from '../../utils/resolvedId'

/** 一次性 snapshot 不经过 watchChange，构建前必须刷新整个批次的真实源状态。 */
export async function refreshSnapshotSources(ctx: MutableCompilerContext, files: Iterable<string>) {
  const changedFiles = new Set(Array.from(files, file => normalizeFsResolvedId(file)))
  for (const file of changedFiles) {
    invalidateFileCache(file)
  }
  for (const file of changedFiles) {
    if (isTemplate(file)) {
      await ctx.wxmlService?.scan(file)
    }
  }
}
