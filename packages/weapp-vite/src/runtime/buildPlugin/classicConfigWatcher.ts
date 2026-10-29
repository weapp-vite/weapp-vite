import type { ConfigService } from '../config/types'
import { normalizeFsResolvedId } from '../../utils/resolvedId'
import { createFileWatcher } from '../watch/fileWatcher'

/** 配置通知属于整个 classic 会话；旧构建代退出时仍须观察后续保存。 */
export function createClassicConfigWatcher(config: Pick<ConfigService, 'inlineConfig' | 'configFileDependencies'>, onError: (error: unknown) => void) {
  let watcher: ReturnType<typeof createFileWatcher> | undefined
  let watchedFiles = new Set<string>()
  let watcherReady = false
  let revision = 0
  let loadedRevision = 0
  let request: (() => void) | undefined
  const failures = new Set<unknown>()
  let dependencyUpdates = Promise.resolve()
  let dependenciesInitialized = false
  let closed = false
  let closing: Promise<void> | undefined

  function createWatcher(files: string[]) {
    const next = createFileWatcher(config, files, { persistent: true, ignoreInitial: true })
    void next.ready.then((state) => {
      watcherReady = state === 'ready'
    }, () => {})
    next.onChange((changes) => {
      for (const change of changes) {
        if (!closed && change.kind === 'file' && watchedFiles.has(normalizeFsResolvedId(change.file))) {
          revision += 1
          request?.()
        }
      }
    })
    // ready 之前由启动调用方接收原错；ready 之后也不能让监听器异常被静默吞掉。
    next.onError((error) => {
      if (watcherReady && !closed) {
        failures.add(error)
        onError(error)
      }
    })
    return next
  }

  async function updateDependencies() {
    if (closed) {
      return
    }
    const isInitialUpdate = !dependenciesInitialized
    dependenciesInitialized = true
    const next = new Set((config.configFileDependencies ?? []).map(file => normalizeFsResolvedId(file)))
    const added = [...next].filter(file => !watchedFiles.has(file))
    if (added.length) {
      added.forEach(file => watchedFiles.add(file))
      // 目标注册与交接门禁由唯一 adapter 管理，旧依赖在等待期间保持连续观察。
      let readiness: 'ready' | 'closed'
      if (!watcher) {
        watcher = createWatcher(added)
        readiness = await watcher.ready
      }
      else {
        readiness = await watcher.add(added)
      }
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
    watchedFiles = next
    await watcher?.updateTargets([...next])
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
        watchedFiles.clear()
        closing = Promise.resolve().then(async () => {
          try {
            await watcher?.close()
          }
          catch (error) {
            failures.add(error)
          }
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
