import assert from 'node:assert/strict'
import path from 'node:path'
import { performance } from 'node:perf_hooks'
import process from 'node:process'

const nextTurn = () => new Promise(resolve => setImmediate(resolve))

/** 只观察当前 owner 的原 listener，不接管原生订阅、读取门禁或节流计时器。 */
export function observeFileListeners(watcher, { turn = nextTurn, now = () => performance.now() } = {}) {
  const files = new Map()
  const failures = []
  const handler = watcher.handler ?? watcher._nodeFsHandler
  let reconciliationEpoch = 0
  let pendingReconciliations = 0
  let reconciliationCalls = 0
  let completedReconciliations = 0
  const stateFor = (file) => {
    const absolute = path.resolve(String(file))
    let state = files.get(absolute)
    if (!state) {
      state = { epoch: 0, pending: 0, calls: 0, completed: 0 }
      files.set(absolute, state)
    }
    return state
  }
  const observe = (listener, state) => function (...args) {
    state.epoch++
    state.calls++
    state.pending++
    const complete = () => {
      state.pending--
      state.completed++
      state.epoch++
    }
    let result
    try {
      result = listener.apply(this, args)
    }
    catch (error) {
      failures.push(error)
      complete()
      throw error
    }
    if (result && typeof result.then === 'function') {
      // 原 Promise 原样返回；旁路拒绝作为独立测试失败，不能混入 public error 事件。
      void result.then(complete, (error) => {
        failures.push(error)
        complete()
      })
    }
    else { complete() }
    return result
  }
  if (watcher.handler) {
    // v6 原生后端由目录 reconciliation 观察文件，文件本身没有独立 listener。
    const originalFile = handler.handleFile
    handler.handleFile = function (file, ...args) {
      stateFor(file)
      return originalFile.call(this, file, ...args)
    }
    const originalReconcile = handler.reconcileBackendTrigger
    handler.reconcileBackendTrigger = function (scope, mapRelative, trigger, reconcile, ...args) {
      const observed = function (...values) {
        const state = { epoch: 0, pending: 0, calls: 0, completed: 0 }
        pendingReconciliations++
        reconciliationCalls++
        reconciliationEpoch++
        const complete = () => {
          pendingReconciliations--
          completedReconciliations++
          reconciliationEpoch++
        }
        let result
        try {
          result = observe(reconcile, state).apply(this, values)
        }
        catch (error) {
          complete()
          throw error
        }
        if (result && typeof result.then === 'function') {
          void result.then(complete, complete)
        }
        else { complete() }
        return result
      }
      return originalReconcile.call(this, scope, mapRelative, trigger, observed, ...args)
    }
  }
  else {
    const original = handler._watchWithNodeFs
    handler._watchWithNodeFs = function (file, listener, directory, ...rest) {
      if (directory || typeof listener !== 'function') {
        return original.call(this, file, listener, directory, ...rest)
      }
      return original.call(this, file, observe(listener, stateFor(file)), directory, ...rest)
    }
  }

  function snapshot(file) {
    const absolute = path.resolve(file)
    const state = files.get(absolute) ?? (watcher.tree?.observed.has(absolute) ? stateFor(absolute) : undefined)
    assert.ok(state, 'the exact file listener must be observed before draining its event phase')
    const entries = []
    for (const action of ['watch', 'change']) {
      const base = action === 'change' ? watcher.options.cwd || process.cwd() : process.cwd()
      for (const [key, entry] of (watcher.events?.throttled ?? watcher._throttled).get(action) || []) {
        if (path.resolve(base, key) === absolute) {
          entries.push({ action, entry })
        }
      }
    }
    return { ...state, calls: state.calls + reconciliationCalls, completed: state.completed + completedReconciliations, epoch: state.epoch + reconciliationEpoch, pending: state.pending + pendingReconciliations, entries }
  }

  return {
    failures,
    snapshot,
    get pending() { return pendingReconciliations + [...files.values()].reduce((count, state) => count + state.pending, 0) },
    async settle(timeoutMs) {
      assert.ok(Number.isFinite(timeoutMs) && timeoutMs > 0, 'listener settlement requires a finite positive budget')
      assert.equal(watcher.closed, true, 'final listener settlement follows public owner close')
      const deadline = now() + timeoutMs
      for (;;) {
        const before = reconciliationEpoch + [...files.values()].reduce((epoch, state) => epoch + state.epoch, 0)
        if (now() >= deadline) {
          throw new Error('Deadline exceeded: closed owner listener settlement')
        }
        await turn()
        if (now() >= deadline) {
          throw new Error('Deadline exceeded: closed owner listener settlement')
        }
        const after = reconciliationEpoch + [...files.values()].reduce((epoch, state) => epoch + state.epoch, 0)
        if (!this.pending && before === after) {
          return
        }
      }
    },
    async drain(file, timeoutMs) {
      assert.ok(Number.isFinite(timeoutMs) && timeoutMs > 0, 'event-phase observation requires a finite positive budget')
      assert.equal(watcher.options.atomic, false, 'observed listener drain does not cover atomic pending-unlink work')
      assert.ok(!watcher.options.awaitWriteFinish, 'observed listener drain does not cover awaitWriteFinish pending-write work')
      const deadline = now() + timeoutMs
      const seen = { watch: new Set(), change: new Set() }
      const check = () => {
        if (failures.length) {
          throw failures[0]
        }
        assert.equal(watcher.closed, false, 'a closed owner cannot establish a later event phase')
        if (now() >= deadline) {
          throw new Error(`Deadline exceeded: observed event phase ${path.basename(file)}`)
        }
        const state = snapshot(file)
        for (const { action, entry } of state.entries) {
          seen[action].add(entry)
        }
        return state
      }
      let turns = 0
      for (;;) {
        const before = check()
        await turn()
        turns++
        const after = check()
        if (!before.pending && !after.pending && !before.entries.length && !after.entries.length && before.epoch === after.epoch) {
          return {
            listenerCalls: after.calls,
            completedListeners: after.completed,
            epoch: after.epoch,
            turns,
            naturalThrottleEntries: { watch: seen.watch.size, change: seen.change.size },
          }
        }
      }
    },
  }
}

/** 等待已观察回调与原有冷却自然结束，不声称操作系统未来不会再交付旧通知。 */
export async function waitForObservedEventPhase(owner, file, evidence, timeoutMs) {
  const observation = await owner.eventPhases.drain(file, timeoutMs)
  evidence.push({ checkpoint: 'observed-event-phase-drained', file: path.basename(file), ...observation })
}
