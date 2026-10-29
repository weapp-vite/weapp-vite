import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { fs } from '@weapp-core/shared/fs'
import { normalizeFsResolvedId } from '../../utils/resolvedId'
import { CompilerHmrResyncError, compilerSourceId, getCompilerHmrHostByConfig, getCompilerRawSnapshot } from '../compilerPlugin/hmr'
import { getCompilerSourceSnapshot, getCompilerSourceSnapshotView, replaceCompilerSourceSnapshotView } from './sourceSnapshot/registry'

export { getCompilerSourceResolutions, getCompilerSourceSnapshot } from './sourceSnapshot/registry'

const nativeInputs = new WeakMap<object, { versions: Map<string, string>, accepts: (id: string) => boolean }>()
const inputObservers = new WeakMap<object, Set<(id: string, source: string) => void>>()

/** 没有来源订阅时跳过纯观察路径，避免常规构建承担额外模块处理。 */
export function hasCompilerInputObservers(owner: object): boolean {
  return inputObservers.has(owner)
}

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

function createCompilerInputNotification(owner: object, id: string) {
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
  }
}

/** 通知打包器实际消费的输入，不把普通模块重新归类为原生入口。 */
export function notifyCompilerInput(owner: object, id: string, source: string): void {
  if (inputObservers.has(owner)) {
    createCompilerInputNotification(owner, id)(source)
  }
}

function createCompilerInputObserver(owner: object, id: string) {
  const notify = createCompilerInputNotification(owner, id)
  return (source: string) => {
    notify(source)
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
  const host = getCompilerHmrHostByConfig(owner)
  const binding = host?.onDependencyChange
  const sourceId = binding ? compilerSourceId(id) : undefined
  const revision = sourceId === undefined ? undefined : host?.sourceRevision(sourceId)
  const source = await (read ? read(id) : fs.readFile(id, 'utf8'))
  const currentHost = getCompilerHmrHostByConfig(owner)
  if (binding || currentHost?.onDependencyChange) {
    // 异步读取只归属启动时的会话及 physical 身份，不能写入替换后的 owner。
    if (!host || sourceId === undefined || currentHost !== host || currentHost?.onDependencyChange !== binding || compilerSourceId(id) !== sourceId) {
      throw new CompilerHmrResyncError([id], 'Compiler input ownership changed during its read')
    }
    const current = host.readSource(sourceId)
    // 相同字节的重复捕获及 ABA 不产生冲突；较新的不同输入不能被旧读取倒退。
    if (host.sourceRevision(sourceId) !== revision && current !== source) {
      throw new CompilerHmrResyncError([id], 'Compiler input changed during its read')
    }
  }
  if (host && binding) {
    host.captureRaw(id, source)
  }
  return observe(source)
}
