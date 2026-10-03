import type { CompilerContext } from '../../context'
import { pruneOwnedAssetFiles } from '../asset/prune'

type OutputOwnershipScope = string

const ownedOutputs = new WeakMap<CompilerContext, Map<string, Map<OutputOwnershipScope, Set<string>>>>()

/** 在原生 write 完成后撤销旧完整产物清单中的文件；增量批次只扩展清单。 */
export function prepareOutputOwnership(
  ctx: CompilerContext,
  outDir: string,
  files: Iterable<string>,
  partial: boolean,
  retired: Iterable<string> = [],
  scope: OutputOwnershipScope = 'default',
) {
  let targets = ownedOutputs.get(ctx)
  if (!targets) {
    targets = new Map()
    ownedOutputs.set(ctx, targets)
  }
  let scopedTargets = targets.get(outDir)
  if (!scopedTargets) {
    scopedTargets = new Map()
    targets.set(outDir, scopedTargets)
  }
  const names = [...files]
  const retiredNames = new Set(retired)
  return async () => {
    const previous = scopedTargets!.get(scope) ?? new Set<string>()
    const next = new Set(partial ? [...previous].filter(file => !retiredNames.has(file)).concat(names) : names)
    const removed = [...previous].filter(file => !next.has(file))
    const retainedByOtherScopes = new Set(
      [...scopedTargets!.entries()]
        .filter(([owner]) => owner !== scope)
        .flatMap(([, files]) => [...files]),
    )
    await pruneOwnedAssetFiles(outDir, removed.filter(file => !retainedByOtherScopes.has(file)))
    scopedTargets!.set(scope, next)
  }
}
