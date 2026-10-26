import assert from 'node:assert/strict'
import { AsyncLocalStorage } from 'node:async_hooks'
import path from 'node:path'
import { performance } from 'node:perf_hooks'

/** 观察注入给 Chokidar 的真实 timer 与 stat，不推进时钟或接管调度。 */
export function createPollingScheduler() {
  const scope = new AsyncLocalStorage()
  const timers = []
  const reads = []
  const byTimer = new WeakMap()
  let epoch = 0
  let emergency = false
  const scheduler = {
    now: () => Date.now(),
    setTimeout(callback, delay) {
      const parent = scope.getStore()
      const record = { id: timers.length + 1, path: parent?.path, polling: parent?.polling === true, delay, fired: false, cleared: false, refChanges: [] }
      const timer = setTimeout(function (...args) {
        record.fired = true
        epoch++
        return scope.run(record, () => callback.apply(this, args))
      }, delay)
      record.timer = timer
      timers.push(record)
      byTimer.set(timer, record)
      for (const method of ['ref', 'unref']) {
        const original = timer[method]
        timer[method] = function (...args) {
          const result = original.apply(this, args)
          record.refChanges.push(method)
          return result
        }
      }
      if (emergency) {
        scheduler.clearTimeout(timer)
      }
      epoch++
      return timer
    },
    clearTimeout(timer) {
      const record = timer && byTimer.get(timer)
      if (record) {
        record.cleared = true
        epoch++
      }
      clearTimeout(timer)
    },
  }
  const active = file => timers.filter(record => !record.fired && !record.cleared && (!file || record.path === path.resolve(file)))
  const pendingReads = file => reads.filter(record => !record.settled && (!file || record.path === path.resolve(file)))
  async function wait(label, timeoutMs, predicate) {
    const deadline = performance.now() + timeoutMs
    for (;;) {
      const before = epoch
      await new Promise(resolve => setImmediate(resolve))
      if (predicate() && before === epoch) {
        return
      }
      assert.ok(performance.now() < deadline, `Deadline exceeded: ${label}`)
    }
  }
  return {
    scheduler,
    timers,
    reads,
    withPaths(paths, callback) {
      const values = Array.isArray(paths) ? paths : [paths]
      return scope.run({ path: values.length === 1 ? path.resolve(values[0]) : undefined }, callback)
    },
    observeStat(file, invoke) {
      const parent = scope.getStore()
      if (!parent?.timer) {
        return invoke()
      }
      parent.polling = true
      parent.path = path.resolve(file)
      const record = { path: parent.path, timer: parent.id, settled: false }
      reads.push(record)
      epoch++
      let result
      try {
        result = invoke()
      }
      catch (error) {
        record.settled = true
        epoch++
        throw error
      }
      void Promise.resolve(result).then(() => {
        record.settled = true
        epoch++
      }, () => {
        record.settled = true
        epoch++
      })
      return result
    },
    async pendingPoll(file, interval, timeoutMs) {
      const absolute = path.resolve(file)
      await wait('one shared polling timer with the selected interval', timeoutMs, () => {
        const current = active(absolute)
        return reads.some(record => record.path === absolute)
          && !pendingReads(absolute).length && current.length === 1 && current[0].delay <= interval
      })
      const record = active(absolute)[0]
      return { id: record.id, delay: record.delay, persistent: record.timer.hasRef() }
    },
    async assertPathClosed(file, timeoutMs) {
      await wait('closed polling resource has no timer or in-flight stat', timeoutMs, () => !active(file).length && !pendingReads(file).length)
    },
    async assertAllClosed(timeoutMs) {
      await wait('all injected scheduler resources are terminal', timeoutMs, () => !active().length && !pendingReads().length)
    },
    async emergencyClose(timeoutMs) {
      emergency = true
      const outstanding = active()
      for (const record of outstanding) {
        scheduler.clearTimeout(record.timer)
      }
      await this.assertAllClosed(timeoutMs)
      return outstanding.map(record => `scheduler:${record.id}`)
    },
    snapshot(root) {
      const relative = file => file ? path.relative(root, file).replaceAll('\\', '/') || '.' : null
      return {
        timers: timers.map(({ id, path: file, polling, delay, fired, cleared, refChanges, timer }) => ({ id, path: relative(file), polling, delay, fired, cleared, refChanges, persistent: timer.hasRef() })),
        reads: reads.map(({ path: file, timer, settled }) => ({ path: relative(file), timer, settled })),
      }
    },
  }
}
