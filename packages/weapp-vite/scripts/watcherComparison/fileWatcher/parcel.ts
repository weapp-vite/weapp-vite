import type { Event } from '@parcel/watcher'
import type { FileWatchRecord, FileWatchSnapshot, WatchPathMapping } from './scan'
import type { FileWatchConfig, FileWatcher, FileWatchOptions, FileWatchReadiness, FileWatchTargets } from './types'
import path from 'pathe'
import { createFileWatchEvents, throwFileWatchFailures } from '../../../src/runtime/watch/fileWatcher/events'
import { containsWatchPath, normalizeWatchTargets } from '../../../src/runtime/watch/fileWatcher/paths'
import { createSidecarWatchOptions } from '../../../src/runtime/watch/options'
import { createParcelSubscriptions } from './parcelSubscriptions'
import { reconcileFileWatchBatch } from './reconcile'
import { createWatchMappings, diffFileWatchSnapshots, scanFileWatchTargets, watchMappingMatches } from './scan'
import { waitFileWatchStability } from './stability'

export function createParcelFileWatcher(config: FileWatchConfig, input: FileWatchTargets, options: FileWatchOptions): FileWatcher {
  if (createSidecarWatchOptions(config, {}).backend === 'polling') {
    throw new Error('Parcel watcher does not support polling. Select the experimental chokidar engine for polling environments.')
  }
  if (options.persistent === false) {
    throw new Error('Parcel watcher does not support persistent: false. Select the experimental chokidar engine for non-persistent subscriptions.')
  }
  const events = createFileWatchEvents()
  const reported = new Set<unknown>()
  const controller = new AbortController()
  const completion = Promise.withResolvers<FileWatchReadiness>()
  let targets = normalizeWatchTargets(input)
  let records = new Map<string, FileWatchRecord>()
  let mappings: WatchPathMapping[] = []
  let closed = false
  let initialized = false
  let startupFailure: unknown
  let failedDuringStartup = false
  let closing: Promise<void> | undefined
  let pending: Promise<unknown> = Promise.resolve()
  let received: Event[] = []
  let reconcileQueued = false
  const report = (error: unknown) => {
    if (!closed) {
      if (!initialized) {
        startupFailure = error
        failedDuringStartup = true
      }
      if (!reported.has(error)) {
        reported.add(error)
        events.report(error)
      }
    }
  }
  const schedule = (operation: () => Promise<FileWatchReadiness>) => {
    const task = pending.then(() => closed ? 'closed' as const : operation())
    pending = task.catch(report)
    return task
  }
  let subscriptions: ReturnType<typeof createParcelSubscriptions>
  const settleSnapshot = async (touched?: Set<string>): Promise<FileWatchSnapshot> => {
    if (!touched) {
      const registered = mappings.filter(mapping => targets.some(target => containsWatchPath(target, mapping.logical)))
      mappings = [...await createWatchMappings(targets), ...registered]
      await subscriptions.sync(mappings)
    }
    const scan = (previous: FileWatchSnapshot) => touched
      ? reconcileFileWatchBatch(previous, targets, touched, options, controller.signal)
      : scanFileWatchTargets(targets, options, controller.signal)
    let snapshot = await scan({ records, mappings })
    for (;;) {
      if (closed) {
        break
      }
      mappings = snapshot.mappings
      if (!await subscriptions.sync(mappings)) {
        break
      }
      // 新发现的外部链接先建立观察，再重新扫描以封闭扫描与订阅之间的窗口。
      snapshot = await scan(snapshot)
    }
    return snapshot
  }
  async function reconcile(initial: boolean, batch: Event[] = []): Promise<FileWatchReadiness> {
    const touched = new Set(batch.map(event => path.normalize(event.path)))
    await waitFileWatchStability(touched, options.stability, controller.signal)
    const snapshot = await settleSnapshot(initialized && batch.length ? touched : undefined)
    if (closed) {
      return 'closed'
    }
    const changes = diffFileWatchSnapshots(records, snapshot.records, initial, options.ignoreInitial === true)
    records = snapshot.records
    mappings = snapshot.mappings
    events.emit(changes)
    return 'ready'
  }
  function receive(batch: Event[]) {
    if (closed) {
      return
    }
    received.push(...batch.filter(event => watchMappingMatches(mappings, path.normalize(event.path))))
    if (!reconcileQueued && received.length) {
      reconcileQueued = true
      void schedule(async () => {
        reconcileQueued = false
        const batch = received
        received = []
        return await reconcile(false, batch)
      }).catch(() => {})
    }
  }
  subscriptions = createParcelSubscriptions(receive, (error) => {
    report(error)
    if (initialized && !closed) {
      void schedule(async () => {
        await subscriptions.reset()
        return await reconcile(false)
      }).catch(() => {})
    }
  })
  const replaceTargets = async (next: string[]) => {
    const previous = { targets, records, mappings }
    targets = next
    // 取消观察不合成磁盘删除，剩余目标的持续变化仍与上一份快照比较。
    records = new Map([...records].filter(([file]) => targets.some(target => containsWatchPath(target, file))))
    try {
      return await reconcile(true)
    }
    catch (error) {
      targets = previous.targets
      records = previous.records
      mappings = previous.mappings
      // 恢复订阅范围并重读旧目标，补齐失败注册期间已经发生的真实保存。
      const restored = await Promise.allSettled([reconcile(false)])
      throwFileWatchFailures([{ status: 'rejected', reason: error }, ...restored])
      throw error
    }
  }
  pending = (async () => {
    const state = await reconcile(true)
    if (failedDuringStartup) {
      throw startupFailure
    }
    initialized = true
    completion.resolve(state)
  })().catch(async (error) => {
    if (closed) {
      return
    }
    report(error)
    closed = true
    controller.abort()
    events.close()
    closing = subscriptions.close()
    try {
      await closing
    }
    catch {
      // 关闭错误仍通过 close 交付，初始 ready 保留原始注册错误。
    }
    completion.reject(error)
  })
  const close = () => {
    if (!closing) {
      closed = true
      controller.abort()
      completion.resolve('closed')
      events.close()
      closing = (async () => {
        const released = subscriptions.close()
        const results = await Promise.allSettled([pending, released])
        records.clear()
        mappings = []
        received = []
        throwFileWatchFailures(results)
      })()
    }
    return closing
  }
  void completion.promise.catch(() => {})
  return {
    ready: completion.promise,
    onChange: events.onChange,
    onError: events.onError,
    add: next => schedule(async () => {
      const added = normalizeWatchTargets(next).filter(target => !targets.includes(target))
      if (!added.length) {
        return 'ready'
      }
      return await replaceTargets([...targets, ...added])
    }),
    updateTargets: next => schedule(async () => await replaceTargets(normalizeWatchTargets(next))),
    close,
  }
}
