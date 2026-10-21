import type { CompilerContext } from '../../context'
import type { HmrRuntimeSession } from '../../runtime/hmrRuntimeSession'
import path from 'pathe'
import { getHmrRuntimeSession } from '../../runtime/hmrRuntimeSession'
import { pruneOwnedAssetFiles } from '../asset/prune'

type OutputOwnershipScope = string

interface OwnershipChange {
  scope: OutputOwnershipScope
  names: string[]
  partial: boolean
  retired: Set<string>
}

interface OutputPublicationOwnership {
  outputNames: Iterable<string>
  independentOutputNames: Iterable<string>
  publicOutputNames: Iterable<string>
  partial: boolean
  retireStateful: boolean
}

function prepareOwnershipCommit(
  session: HmrRuntimeSession,
  outDir: string,
  changes: OwnershipChange[],
  protectedNames: Iterable<string> = [],
) {
  // 账本由命令会话持有，Vite 更换编译上下文或重新加载插件模块都沿用同一载体。
  const targets = session.outputOwnership
  const root = path.resolve(outDir)
  const protectedFiles = [...protectedNames]
  return async () => {
    const previous = targets.get(root) ?? new Map<OutputOwnershipScope, Set<string>>()
    const next = new Map(previous)
    const removed = new Set<string>()
    for (const change of changes) {
      const owned = previous.get(change.scope) ?? new Set<string>()
      const names = new Set(change.partial ? [...owned].filter(file => !change.retired.has(file)).concat(change.names) : change.names)
      next.set(change.scope, names)
      for (const file of owned) {
        if (!names.has(file)) {
          removed.add(file)
        }
      }
    }
    const retained = new Set([...protectedFiles, ...[...next.values()].flatMap(files => [...files])])
    await pruneOwnedAssetFiles(root, [...removed].filter(file => !retained.has(file)))
    // 所有范围一起提交；裁剪失败时保留旧账本，后续原生写出仍可重试同一交接。
    targets.set(root, next)
  }
}

/** 在原生 write 完成后撤销旧完整产物清单中的文件；增量批次只扩展清单。 */
export function prepareOutputOwnership(
  ctx: CompilerContext,
  outDir: string,
  files: Iterable<string>,
  partial: boolean,
  retired: Iterable<string> = [],
  scope: OutputOwnershipScope = 'default',
) {
  return prepareOwnershipCommit(getHmrRuntimeSession(ctx), outDir, [{ scope, names: [...files], partial, retired: new Set(retired) }])
}

/** classic 原生完整写出后一次交接所有编译范围，并保护本轮 public 发射文件。 */
export function prepareOutputPublicationOwnership(ctx: CompilerContext, outDir: string, publication: OutputPublicationOwnership) {
  const session = getHmrRuntimeSession(ctx)
  const changes: OwnershipChange[] = [
    { scope: 'default', names: [...publication.outputNames], partial: publication.partial, retired: new Set() },
    { scope: 'independent', names: [...publication.independentOutputNames], partial: false, retired: new Set() },
  ]
  if (publication.retireStateful && !publication.partial) {
    changes.push({ scope: 'stateful-hmr', names: [], partial: false, retired: new Set() })
  }
  return prepareOwnershipCommit(session, outDir, changes, publication.publicOutputNames)
}
