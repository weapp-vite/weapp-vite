import { fs } from '@weapp-core/shared/fs'
import { compilerSourceId } from '../compilerPlugin/hmr'

const snapshots = new WeakMap<object, ReadonlyMap<string, string | null>>()

/** 快照视图绑定独立编译上下文，原生异步回调不依赖 Node 异步上下文传播。 */
export function setCompilerSourceSnapshot(owner: object, sources: ReadonlyMap<string, string | null>): void {
  snapshots.set(owner, sources)
}

export function getCompilerSourceSnapshot(owner: object): ReadonlyMap<string, string | null> | undefined {
  return snapshots.get(owner)
}

export function readCompilerSourceSnapshot(sources: ReadonlyMap<string, string | null> | undefined, id: string): string | undefined {
  const source = sources?.get(compilerSourceId(id))
  if (source === null) {
    throw new Error(`Source removed from compiler snapshot: ${id}`)
  }
  return source
}

export async function readCompilerInput(owner: object, id: string): Promise<string> {
  return readCompilerSourceSnapshot(snapshots.get(owner), id) ?? await fs.readFile(id, 'utf8')
}
