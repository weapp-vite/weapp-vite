import type { FSWatcher } from 'chokidar'
import type { ConfigService } from '../config/types'
import chokidar from 'chokidar'
import { normalizeFsResolvedId } from '../../utils/resolvedId'
import { createSidecarWatchOptions } from '../watch/options'
import { createSidecarWatcherReadiness } from '../watch/sidecarReadiness'

interface ConfigWatchGroup {
  watcher: FSWatcher
  readiness: ReturnType<typeof createSidecarWatcherReadiness>
  files: Set<string>
  close: () => Promise<void>
}

/** 配置通知属于整个 classic 会话；旧构建代退出时仍须观察后续保存。 */
export function createClassicConfigWatcher(config: Pick<ConfigService, 'inlineConfig' | 'configFileDependencies'>, onError: (error: unknown) => void) {
  const groups = new Set<ConfigWatchGroup>()
  const owners = new Map<string, ConfigWatchGroup>()
  let revision = 0
  let loadedRevision = 0
  let request: (() => void) | undefined
  const failures = new Set<unknown>()
  let dependencyUpdates = Promise.resolve()
  let dependenciesInitialized = false
  let closed = false
  let closing: Promise<void> | undefined

  function createGroup(files: string[]) {
    const watcher = chokidar.watch(files, createSidecarWatchOptions(config, { persistent: true, ignoreInitial: true }))
    const readiness = createSidecarWatcherReadiness(watcher)
    let ready = false
    let stopping: Promise<void> | undefined
    const markReady = () => {
      ready = true
    }
    const group: ConfigWatchGroup = {
      watcher,
      readiness,
      files: new Set(files),
      close() {
        readiness.close()
        watcher.off('ready', markReady)
        return stopping ??= Promise.resolve().then(async () => {
          try {
            await watcher.close()
          }
          catch (error) {
            failures.add(error)
            throw error
          }
          finally {
            groups.delete(group)
          }
        })
      },
    }
    groups.add(group)
    for (const file of files) {
      owners.set(file, group)
    }
    watcher.once('ready', markReady)
    watcher.on('all', (_event, file) => {
      if (!closed && file && owners.get(normalizeFsResolvedId(file)) === group) {
        revision += 1
        request?.()
      }
    })
    // ready 之前由启动调用方接收原错；ready 之后也不能让监听器异常被静默吞掉。
    watcher.on('error', (error) => {
      if (ready && !closed) {
        failures.add(error)
        onError(error)
      }
    })
    return group
  }

  async function updateDependencies() {
    if (closed) {
      return
    }
    const isInitialUpdate = !dependenciesInitialized
    dependenciesInitialized = true
    const next = new Set((config.configFileDependencies ?? []).map(file => normalizeFsResolvedId(file)))
    const added = [...next].filter(file => !owners.has(file))
    if (added.length) {
      // Chokidar.add 没有每批 ready；仅新增文件独占新 group，旧依赖保持连续监听。
      const group = createGroup(added)
      const readiness = await group.readiness.ready
      if (closed || readiness === 'closed') {
        return
      }
      if (!isInitialUpdate) {
        // 原生监听安装之后再读配置，才能覆盖新增依赖交接期间的保存。
        revision += 1
      }
    }
    if (closed) {
      return
    }
    for (const group of groups) {
      const removed = [...group.files].filter(file => !next.has(file))
      for (const file of removed) {
        if (owners.get(file) === group) {
          owners.delete(file)
        }
        group.files.delete(file)
      }
      if (!group.files.size) {
        await group.close()
      }
      else if (removed.length) {
        await group.watcher.unwatch(removed)
      }
    }
  }

  const resource = {
    get isClosed() {
      return closed
    },
    get hasPendingChanges() {
      return revision !== loadedRevision
    },
    updateDependencies() {
      dependencyUpdates = dependencyUpdates.then(updateDependencies)
      return dependencyUpdates
    },
    subscribe(listener: () => void) {
      request = listener
      if (!closed && resource.hasPendingChanges) {
        listener()
      }
      return () => {
        if (request === listener) {
          request = undefined
        }
      }
    },
    async reload(load: () => Promise<void>, isClosing: () => boolean) {
      // load 期间到达的配置保存合并到新代首构；不用旧配置先写出一轮来触发 END。
      while (true) {
        if (closed || isClosing()) {
          return
        }
        const observedRevision = revision
        await load()
        if (closed || isClosing()) {
          return
        }
        await resource.updateDependencies()
        if (observedRevision === revision) {
          loadedRevision = observedRevision
          return
        }
      }
    },
    close() {
      if (!closing) {
        closed = true
        request = undefined
        owners.clear()
        // 同步结束所有 ready 等待，关闭不能等待尚未安装完成的监听器。
        for (const group of groups) {
          group.readiness.close()
        }
        closing = Promise.resolve().then(async () => {
          await Promise.allSettled([...groups].map(group => group.close()))
          if (failures.size) {
            const errors = [...failures]
            throw errors.length === 1 ? errors[0] : new AggregateError(errors, 'Classic config watcher shutdown failed', { cause: errors[0] })
          }
        })
      }
      return closing
    },
  }
  return resource
}

export type ClassicConfigWatcher = ReturnType<typeof createClassicConfigWatcher>
