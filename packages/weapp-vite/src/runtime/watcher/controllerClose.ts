import type { WatcherService } from '../watcherPlugin'
import type { WatcherInstance } from './types'

type ControllerClose = () => void | Promise<void>

interface ControllerCloseRecord {
  close: ControllerClose
  cleanup: Set<() => void>
  closing?: Promise<void>
  finished: boolean
}

const controllerCloses = new WeakMap<WatcherService, WeakMap<WatcherInstance, ControllerCloseRecord>>()

function closeResources(record: ControllerCloseRecord): Promise<void> {
  if (!record.closing) {
    const completed = Promise.withResolvers<void>()
    record.closing = completed.promise
    void (async () => {
      const errors: unknown[] = []
      try {
        await record.close()
      }
      catch (error) {
        errors.push(error)
      }
      for (const cleanup of record.cleanup) {
        try {
          cleanup()
        }
        catch (error) {
          errors.push(error)
        }
      }
      record.cleanup.clear()
      record.finished = true
      if (errors.length) {
        throw errors.length === 1 ? errors[0] : new AggregateError(errors, 'Development controller resource close failed', { cause: errors[0] })
      }
    })().then(completed.resolve, completed.reject)
  }
  return record.closing
}

/** 整体 drain 只关闭控制器资源，不能反向调用等待整体 drain 的公共入口。 */
export function closeWatcherControllerResources(service: WatcherService, watcher: WatcherInstance) {
  const record = controllerCloses.get(service)?.get(watcher)
  return record ? closeResources(record) : watcher.close()
}

/** 公共控制器关闭同时等待在途代次与同项目完整 drain；本代资源入口独立保存。 */
export function bindWatcherServiceController(service: WatcherService, watcher: WatcherInstance, cleanup?: () => void): boolean {
  let controllers = controllerCloses.get(service)
  if (!controllers) {
    controllers = new WeakMap()
    controllerCloses.set(service, controllers)
  }
  let record = controllers.get(watcher)
  if (record) {
    if (cleanup) {
      if (record.finished) {
        cleanup()
      }
      else {
        record.cleanup.add(cleanup)
      }
    }
    return Boolean(record.closing)
  }
  record = { close: watcher.close.bind(watcher), cleanup: new Set(cleanup ? [cleanup] : []), finished: false }
  controllers.set(watcher, record)
  const owned = record
  let closing: Promise<void> | undefined
  watcher.close = () => {
    if (!closing) {
      const completed = Promise.withResolvers<void>()
      closing = completed.promise
      void (async () => {
        const results = await Promise.allSettled([
          Promise.resolve().then(() => closeResources(owned)),
          Promise.resolve().then(() => service.closeAll()),
        ])
        const errors = [...new Set(results.flatMap(result => result.status === 'rejected' ? [result.reason] : []))]
        if (errors.length) {
          throw errors.length === 1 ? errors[0] : new AggregateError(errors, 'Development controller shutdown failed', { cause: errors[0] })
        }
      })().then(completed.resolve, completed.reject)
    }
    return closing
  }
  return false
}
