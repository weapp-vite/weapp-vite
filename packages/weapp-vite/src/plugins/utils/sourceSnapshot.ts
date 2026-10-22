import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { fs } from '@weapp-core/shared/fs'
import { normalizeFsResolvedId } from '../../utils/resolvedId'
import { compilerSourceId, getCompilerHmrHostByConfig, getCompilerRawSnapshot } from '../compilerPlugin/hmr'
import { getCompilerSourceSnapshot, getCompilerSourceSnapshotView, replaceCompilerSourceSnapshotView } from './sourceSnapshot/registry'

export { getCompilerSourceResolutions, getCompilerSourceSnapshot } from './sourceSnapshot/registry'

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
  const sourceId = compilerSnapshotSourceId(getCompilerSourceSnapshot(owner), id)
  if (/\.[cm]?[jt]s$/.test(sourceId) && collector.accepts(sourceId)) {
    collector.versions.set(sourceId, compilerNativeScriptVersion(source))
  }
  return source
}

export function readCompilerSourceSnapshot(sources: ReadonlyMap<string, string | null> | undefined, id: string): string | undefined {
  const source = sources?.get(compilerSnapshotSourceId(sources, id))
  if (source === null) {
    throw new Error(`Source removed from compiler snapshot: ${id}`)
  }
  return source
}

/** 快照视图绑定独立编译上下文，原生异步回调不依赖 Node 异步上下文传播。 */
export function setCompilerSourceSnapshot(owner: object, sources: ReadonlyMap<string, string | null>): void {
  replaceCompilerSourceSnapshotView(owner, {
    sources,
    readSource: id => readCompilerSourceSnapshot(sources, id),
  })
}

export function compilerSourceResolutionKey(source: string, importer: string) {
  return JSON.stringify([compilerSourceId(importer), source])
}

/** 临时输入版本只属于当前串行构建，失败后也必须恢复外层快照。 */
export async function withCompilerSourceSnapshot<T>(
  owner: object,
  sources: ReadonlyMap<string, string | null>,
  run: () => Promise<T>,
  resolutions?: ReadonlyMap<string, string | undefined>,
): Promise<T> {
  const previous = getCompilerSourceSnapshotView(owner)
  replaceCompilerSourceSnapshotView(owner, {
    sources,
    resolutions,
    readSource: id => readCompilerSourceSnapshot(sources, id),
  })
  try {
    return await run()
  }
  finally {
    replaceCompilerSourceSnapshotView(owner, previous)
  }
}

function createCompilerInputObserver(owner: object, id: string) {
  const observers = inputObservers.get(owner)
  const observed = [...(observers ?? [])]
  const observedId = observers ? compilerSnapshotSourceId(getCompilerSourceSnapshot(owner), id) : id
  return (source: string) => {
    if (inputObservers.get(owner) === observers) {
      for (const callback of observed) {
        if (observers?.has(callback)) {
          callback(observedId, source)
        }
      }
    }
    return observeNativeInput(owner, id, source)
  }
}

/** 同步 JSX 展开沿用同一冻结输入和依赖登记，不能从后续磁盘版本重建模板。 */
export function readCompilerInputSync(owner: object, id: string): string {
  const observe = createCompilerInputObserver(owner, id)
  const pinned = readCompilerSourceSnapshot(getCompilerSourceSnapshot(owner), id)
  if (pinned !== undefined) {
    return observe(pinned)
  }
  const source = readFileSync(id, 'utf8')
  const host = getCompilerHmrHostByConfig(owner)
  if (host?.onDependencyChange) {
    host.captureRaw(id, source)
  }
  return observe(source)
}

export async function readCompilerInput(owner: object, id: string, read?: (file: string) => Promise<string>): Promise<string> {
  const observe = createCompilerInputObserver(owner, id)
  const pinned = readCompilerSourceSnapshot(getCompilerSourceSnapshot(owner), id)
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
