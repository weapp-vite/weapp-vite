import { fs } from '@weapp-core/shared/fs'
import { compilerSourceId, getCompilerHmrHostByConfig } from '../compilerPlugin/hmr'

interface CompilerSourceSnapshot {
  sources: ReadonlyMap<string, string | null>
  resolutions?: ReadonlyMap<string, string | undefined>
}

const snapshots = new WeakMap<object, CompilerSourceSnapshot>()

/** 快照视图绑定独立编译上下文，原生异步回调不依赖 Node 异步上下文传播。 */
export function setCompilerSourceSnapshot(owner: object, sources: ReadonlyMap<string, string | null>): void {
  snapshots.set(owner, { sources })
}

export function getCompilerSourceSnapshot(owner: object): ReadonlyMap<string, string | null> | undefined {
  return snapshots.get(owner)?.sources
}

export function compilerSourceResolutionKey(source: string, importer: string) {
  return JSON.stringify([compilerSourceId(importer), source])
}

export function getCompilerSourceResolutions(owner: object) {
  return snapshots.get(owner)?.resolutions
}

/** 临时输入版本只属于当前串行构建，失败后也必须恢复外层快照。 */
export async function withCompilerSourceSnapshot<T>(
  owner: object,
  sources: ReadonlyMap<string, string | null>,
  run: () => Promise<T>,
  resolutions?: ReadonlyMap<string, string | undefined>,
): Promise<T> {
  const previous = snapshots.get(owner)
  snapshots.set(owner, { sources, resolutions })
  try {
    return await run()
  }
  finally {
    if (previous) {
      snapshots.set(owner, previous)
    }
    else {
      snapshots.delete(owner)
    }
  }
}

export function readCompilerSourceSnapshot(sources: ReadonlyMap<string, string | null> | undefined, id: string): string | undefined {
  const source = sources?.get(compilerSourceId(id))
  if (source === null) {
    throw new Error(`Source removed from compiler snapshot: ${id}`)
  }
  return source
}

export async function readCompilerInput(owner: object, id: string, read?: (file: string) => Promise<string>): Promise<string> {
  const pinned = readCompilerSourceSnapshot(snapshots.get(owner)?.sources, id)
  if (pinned !== undefined) {
    return pinned
  }
  const source = await (read ? read(id) : fs.readFile(id, 'utf8'))
  const host = getCompilerHmrHostByConfig(owner)
  if (host?.onDependencyChange) {
    host.captureNative(id, source)
  }
  return source
}
