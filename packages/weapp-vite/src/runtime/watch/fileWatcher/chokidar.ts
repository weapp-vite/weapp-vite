import type { FSWatcher } from 'chokidar'
import type { Stats } from 'node:fs'
import type { FileWatchChange, FileWatchConfig, FileWatcher, FileWatchOptions, FileWatchReadiness, FileWatchTargets } from './types'
import { statSync } from 'node:fs'
import chokidar from 'chokidar'
import path from 'pathe'
import { createSidecarWatchOptions } from '../options'
import { createSidecarWatcherReadiness } from '../sidecarReadiness'
import { observeChokidarRenames } from './chokidarRenames'
import { isMissingWatchPath } from './errors'
import { createFileWatchEvents, throwFileWatchFailures } from './events'
import { containsWatchPath, createFileWatchIgnored, normalizeWatchTargets, resolveWatchPath } from './paths'

interface ChokidarGroup {
  targets: string[]
  watcher: FSWatcher
  ready: Promise<FileWatchReadiness>
  close: () => Promise<void>
}

export function createChokidarFileWatcher(config: FileWatchConfig, targets: FileWatchTargets, options: FileWatchOptions): FileWatcher {
  const events = createFileWatchEvents()
  const reported = new Set<unknown>()
  const report = (error: unknown) => {
    if (!reported.has(error)) {
      reported.add(error)
      events.report(error)
    }
  }
  const groups = new Set<ChokidarGroup>()
  const signatures = new Map<string, string>()
  let activeTargets = new Set(normalizeWatchTargets(targets))
  let closed = false
  let closing: Promise<void> | undefined
  const completion = Promise.withResolvers<FileWatchReadiness>()
  const ignored = createFileWatchIgnored(options.ignored)
  const watchOptions = {
    ...createSidecarWatchOptions(config, {
      ...(options.persistent !== undefined ? { persistent: options.persistent } : {}),
      ...(options.ignoreInitial !== undefined ? { ignoreInitial: options.ignoreInitial } : {}),
      ...(options.ignored !== undefined ? { ignored: options.ignored } : {}),
      ...(options.stability ? { awaitWriteFinish: { stabilityThreshold: options.stability.threshold, pollInterval: options.stability.interval } } : {}),
    }),
  }
  if (options.depth !== undefined) {
    watchOptions.depth = options.depth
  }
  if (options.atomic !== undefined) {
    watchOptions.atomic = options.atomic
  }
  const accepts = (file: string) => [...activeTargets].some(target => containsWatchPath(target, file))
  const covers = (target: string, file: string) => containsWatchPath(target, file)
    && (options.depth === undefined || path.relative(target, file).split('/').filter(Boolean).length <= options.depth + 1)
  const coversTarget = (root: string, target: string) => root === target || (covers(root, target)
    && (options.depth === undefined || statSync(target, { throwIfNoEntry: false })?.isFile() === true))
  const start = (paths: string[]): ChokidarGroup => {
    const watcher = chokidar.watch(paths, watchOptions)
    const readiness = createSidecarWatcherReadiness(watcher)
    let ready = false
    const onReady = () => {
      ready = true
      watcher.off?.('ready', onReady)
    }
    watcher.on('ready', onReady)
    let group: ChokidarGroup
    const deliver = (change: FileWatchChange, stats?: Stats) => {
      const owner = [...groups].find(candidate => candidate.targets.some(target => covers(target, change.file)))
      if (!closed && accepts(change.file) && owner === group) {
        if (change.kind === 'file' && stats) {
          if (change.event === 'update') {
            try {
              const current = statSync(change.file, { throwIfNoEntry: false })
              if (!current) {
                return
              }
              stats = current
            }
            catch (error) {
              if (!isMissingWatchPath(error)) {
                report(error)
              }
              return
            }
          }
          const signature = `${stats.mtimeMs}:${stats.ctimeMs}:${stats.size}:${stats.ino}:${stats.mode}`
          if (change.event === 'update' && signatures.get(change.file) === signature) {
            return
          }
          signatures.set(change.file, signature)
        }
        if (change.event === 'delete') {
          signatures.delete(change.file)
        }
        events.emit([change])
      }
    }
    const rename = options.recoverRenames
      ? observeChokidarRenames(watcher, paths[0]!, ignored, deliver, () => ready)
      : undefined
    const listen = (name: 'add' | 'change' | 'unlink' | 'addDir' | 'unlinkDir', event: FileWatchChange['event'], kind: FileWatchChange['kind']) => {
      watcher.on(name, (input, stats) => {
        const change: FileWatchChange = { event, file: resolveWatchPath(input), kind, ...(event === 'create' && !ready ? { initial: true } : {}) }
        rename?.observe(change)
        deliver(change, stats)
      })
    }
    listen('add', 'create', 'file')
    listen('change', 'update', 'file')
    listen('unlink', 'delete', 'file')
    listen('addDir', 'create', 'directory')
    listen('unlinkDir', 'delete', 'directory')
    watcher.on('error', (error) => {
      watcher.off?.('ready', onReady)
      report(error)
    })
    let groupClosing: Promise<void> | undefined
    group = {
      targets: paths,
      watcher,
      ready: readiness.ready.then((state) => {
        ready = state === 'ready'
        return state
      }),
      close() {
        if (!groupClosing) {
          readiness.close()
          watcher.off?.('ready', onReady)
          rename?.close()
          groupClosing = Promise.resolve().then(async () => await watcher.close()).then(() => {
            groups.delete(group)
          })
        }
        return groupClosing
      },
    }
    groups.add(group)
    return group
  }
  let pending: Promise<unknown> = Promise.resolve()
  const schedule = (operation: () => Promise<FileWatchReadiness>) => {
    const result = pending.then(() => closed ? 'closed' as const : operation())
    pending = result.catch(report)
    return result
  }
  const registerTargets = async (nextTargets: Set<string>) => {
    const previousTargets = activeTargets
    const previousGroups = new Map([...groups].map(group => [group, [...group.targets]]))
    const added = [...nextTargets].filter(target => !activeTargets.has(target))
    activeTargets = new Set([...previousTargets, ...nextTargets])
    try {
      const uncovered = added.filter((target) => {
        const owner = [...groups].find(group => group.targets.some(root => coversTarget(root, target)))
        if (owner) {
          owner.targets.push(target)
        }
        return !owner
      })
      const state = uncovered.length ? await start(uncovered).ready : closed ? 'closed' as const : 'ready' as const
      activeTargets = nextTargets
      return state
    }
    catch (error) {
      activeTargets = previousTargets
      for (const [group, targets] of previousGroups) {
        group.targets = targets
      }
      for (const file of signatures.keys()) {
        if (!accepts(file)) {
          signatures.delete(file)
        }
      }
      const addedGroups = [...groups].filter(group => !previousGroups.has(group))
      const cleanup = await Promise.allSettled(addedGroups.map(group => group.close()))
      throwFileWatchFailures([{ status: 'rejected', reason: error }, ...cleanup])
      throw error
    }
  }
  const initial = activeTargets.size ? start([...activeTargets]).ready : Promise.resolve<FileWatchReadiness>('ready')
  const close = () => {
    if (!closing) {
      closed = true
      events.close()
      // group 关闭直接终结底层扫描；先前已发生的注册错误不能被外层 closed 覆盖。
      const released = Promise.allSettled([initial, ...[...groups].map(group => group.close())])
      closing = (async () => {
        const results = await released
        await pending
        activeTargets.clear()
        signatures.clear()
        throwFileWatchFailures(results)
      })()
    }
    return closing
  }
  pending = initial.then(completion.resolve, (error) => {
    report(error)
    // 初始化失败和显式关闭共用同一 owner；ready 交付注册原错，close 保留完整收尾结果。
    void close().then(() => completion.reject(error), () => completion.reject(error))
  })
  void completion.promise.catch(() => {})
  return {
    ready: completion.promise,
    onChange: events.onChange,
    onError: events.onError,
    add: next => schedule(async () => {
      const added = normalizeWatchTargets(next).filter(target => !activeTargets.has(target))
      if (!added.length) {
        return 'ready'
      }
      return await registerTargets(new Set([...activeTargets, ...added]))
    }),
    updateTargets: next => schedule(async () => {
      const nextTargets = new Set(normalizeWatchTargets(next))
      const previousGroups = [...groups]
      const state = await registerTargets(nextTargets)
      const retired: ChokidarGroup[] = []
      for (const group of previousGroups) {
        const retained = group.targets.filter(target => nextTargets.has(target))
        const removed = group.targets.filter(target => !nextTargets.has(target))
        const unwatch = removed.filter(target => !retained.some(current => containsWatchPath(target, current) || containsWatchPath(current, target)))
        if (unwatch.length) {
          group.watcher.unwatch(unwatch)
        }
        group.targets = retained
        if (!retained.length) {
          retired.push(group)
        }
      }
      throwFileWatchFailures(await Promise.allSettled(retired.map(group => group.close())))
      return state
    }),
    close,
  }
}
