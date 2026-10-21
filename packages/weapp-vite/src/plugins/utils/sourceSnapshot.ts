import { createHash } from 'node:crypto'
import { fs } from '@weapp-core/shared/fs'
import { normalizeFsResolvedId } from '../../utils/resolvedId'
import { compilerSourceId, getCompilerHmrHostByConfig, getCompilerRawSnapshot } from '../compilerPlugin/hmr'

interface CompilerSourceSnapshot {
  sources: ReadonlyMap<string, string | null>
  resolutions?: ReadonlyMap<string, string | undefined>
}

const snapshots = new WeakMap<object, CompilerSourceSnapshot>()
const nativeInputs = new WeakMap<object, { versions: Map<string, string>, accepts: (id: string) => boolean }>()
const inputObservers = new WeakMap<object, Set<(id: string, source: string) => void>>()

/** 只观察本上下文实际返回的输入；释放回调不会移除其他代际的观察者。 */
export function observeCompilerInputs(owner: object, observe: (id: string, source: string) => void): () => void {
  let observers = inputObservers.get(owner)
  if (!observers) {
    observers = new Set()
    inputObservers.set(owner, observers)
  }
  observers.add(observe)
  return () => {
    observers.delete(observe)
    if (!observers.size && inputObservers.get(owner) === observers) {
      inputObservers.delete(owner)
    }
  }
}

export function compilerNativeScriptVersion(source: string): string {
  return createHash('sha256').update(source).digest('hex')
}

/** 只记录本轮实际返回给编译器的原生入口输入；独立上下文与嵌套作用域互不覆盖。 */
export async function captureCompilerNativeScriptInputs<T>(
  owner: object,
  run: () => Promise<T>,
  accepts: (id: string) => boolean = () => true,
): Promise<{ value: T, versions: ReadonlyMap<string, string> }> {
  const previous = nativeInputs.get(owner)
  const versions = new Map<string, string>()
  nativeInputs.set(owner, { versions, accepts })
  try {
    return { value: await run(), versions }
  }
  finally {
    if (previous) {
      nativeInputs.set(owner, previous)
    }
    else {
      nativeInputs.delete(owner)
    }
  }
}

/** 冻结输入沿用捕获时的 alias 绑定，不从后续磁盘改指推断旧批次身份。 */
export function compilerSnapshotSourceId(sources: ReadonlyMap<string, string | null> | undefined, id: string): string {
  const binding = sources && getCompilerRawSnapshot(sources)?.bindings.get(normalizeFsResolvedId(id))
  return binding?.target ?? compilerSourceId(id)
}

function observeNativeInput(owner: object, id: string, source: string): string {
  const collector = nativeInputs.get(owner)
  if (!collector) {
    return source
  }
  const sourceId = compilerSnapshotSourceId(snapshots.get(owner)?.sources, id)
  if (/\.[cm]?[jt]s$/.test(sourceId) && collector.accepts(sourceId)) {
    collector.versions.set(sourceId, compilerNativeScriptVersion(source))
  }
  return source
}

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
  const source = sources?.get(compilerSnapshotSourceId(sources, id))
  if (source === null) {
    throw new Error(`Source removed from compiler snapshot: ${id}`)
  }
  return source
}

export async function readCompilerInput(owner: object, id: string, read?: (file: string) => Promise<string>): Promise<string> {
  const observers = inputObservers.get(owner)
  const observed = [...(observers ?? [])]
  const observedId = observers ? compilerSnapshotSourceId(snapshots.get(owner)?.sources, id) : id
  const observe = (source: string) => {
    if (inputObservers.get(owner) === observers) {
      for (const callback of observed) {
        if (observers?.has(callback)) {
          callback(observedId, source)
        }
      }
    }
    return observeNativeInput(owner, id, source)
  }
  const pinned = readCompilerSourceSnapshot(snapshots.get(owner)?.sources, id)
  if (pinned !== undefined) {
    return observe(pinned)
  }
  const source = await (read ? read(id) : fs.readFile(id, 'utf8'))
  const host = getCompilerHmrHostByConfig(owner)
  if (host?.onDependencyChange) {
    host.captureRaw(id, source)
  }
  return observe(source)
}
