import type { CompilerContext } from '../../context'
import { pruneOwnedAssetFiles } from '../asset/prune'

const ownedOutputs = new WeakMap<CompilerContext, Map<string, Set<string>>>()

/** 在原生 write 完成后撤销旧完整产物清单中的文件；增量批次只扩展清单。 */
export function prepareOutputOwnership(ctx: CompilerContext, outDir: string, files: Iterable<string>, partial: boolean, retired: Iterable<string> = []) {
  let targets = ownedOutputs.get(ctx)
  if (!targets) {
    targets = new Map()
    ownedOutputs.set(ctx, targets)
  }
  const previous = targets.get(outDir) ?? new Set<string>()
  const retiredNames = new Set(retired)
  const next = new Set(partial ? [...previous].filter(file => !retiredNames.has(file)).concat([...files]) : files)
  const removed = [...previous].filter(file => !next.has(file))
  return async () => {
    await pruneOwnedAssetFiles(outDir, removed)
    targets.set(outDir, next)
  }
}
