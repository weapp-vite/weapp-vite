import assert from 'node:assert/strict'
import { AsyncLocalStorage } from 'node:async_hooks'
import fs from 'node:fs'
import { syncBuiltinESMExports } from 'node:module'
import path from 'node:path'
import { watcherPathKey } from './watcherPathKey.mjs'

const valueOf = value => typeof value === 'bigint' ? Number(value) : value
function statValue(stats, key) {
  const nanoseconds = stats[`${key.slice(0, -2)}Ns`]
  if (key.endsWith('Ms') && typeof stats[key] === 'bigint' && typeof nanoseconds === 'bigint') {
    return Number(nanoseconds / 1000000000n) * 1e3 + Number(nanoseconds % 1000000000n) / 1e6
  }
  return valueOf(stats[key])
}
const fileState = stats => stats && Object.fromEntries(['dev', 'ino', 'size', 'mtimeMs', 'ctimeMs', 'atimeMs'].map(key => [key, statValue(stats, key)]))
const generation = stats => stats && Object.fromEntries(['dev', 'ino', 'size', 'mtimeMs', 'ctimeMs'].map(key => [key, statValue(stats, key)]))

/** 只为 atomic 场景关联真实通知、文件 listener、原始 _emit 与公开事件，不接管或过滤交付。 */
export function createAtomicDeliveryObserver({ root, file }, { watchApi = fs, synchronize = syncBuiltinESMExports } = {}) {
  const context = new AsyncLocalStorage()
  const native = []
  const registrations = []
  const listeners = []
  const calls = []
  const events = []
  const flushes = []
  const pendingIds = new WeakMap()
  let pendingCount = 0
  let boundary
  let owner
  let originalRegistration
  let originalReconcile
  let originalEmit
  const originalWatch = watchApi.watch
  const relative = value => path.relative(root, value).replaceAll('\\', '/')
  const pendingId = (value) => {
    if (!value) {
      return null
    }
    if (!pendingIds.has(value)) {
      pendingIds.set(value, ++pendingCount)
    }
    return pendingIds.get(value)
  }
  watchApi.watch = function (watched, ...args) {
    const absolute = path.resolve(String(watched))
    const index = args.findLastIndex(value => typeof value === 'function')
    if ([file, path.dirname(file)].includes(absolute) && index >= 0) {
      const callback = args[index]
      args[index] = function (...values) {
        const notification = { id: native.length + 1, path: relative(absolute), event: values[0], filename: String(values[1]) }
        native.push(notification)
        return context.run({ native: notification.id }, () => callback.apply(this, values))
      }
    }
    return originalWatch.call(this, watched, ...args)
  }
  synchronize()
  const publicEvent = (event, emitted) => {
    if (path.resolve(String(emitted)) !== file) {
      return
    }
    const source = context.getStore() || {}
    const record = { event, call: source.call, flush: source.flush }
    events.push(record)
    if (source.call) {
      calls[source.call - 1].outputs.push(event)
    }
    if (source.flush) {
      flushes[source.flush - 1].outputs.push(event)
    }
  }
  return {
    attach(value) {
      assert.equal(owner, undefined, 'atomic observation owns exactly one public owner')
      owner = value
      const watcher = owner.watcher
      assert.ok(!watcher.options?.alwaysStat && !watcher.options?.awaitWriteFinish && !watcher.options?.cwd)
      const handler = watcher.handler ?? watcher._nodeFsHandler
      if (watcher.handler) {
        originalRegistration = watcher.tree.recordObserved
        watcher.tree.recordObserved = function (watched, stats, ...rest) {
          if (path.resolve(String(watched)) === file) {
            const prior = registrations.at(-1)?.stats
            if (!prior || prior.dev !== valueOf(stats.dev) || prior.ino !== valueOf(stats.ino)) {
              registrations.push({ id: registrations.length + 1, stats: fileState(stats) })
            }
          }
          return originalRegistration.call(this, watched, stats, ...rest)
        }
        originalReconcile = handler.reconcileBackendTrigger
        handler.reconcileBackendTrigger = function (scope, mapRelative, trigger, reconcile, ...rest) {
          const observed = function (...args) {
            const source = context.getStore() || {}
            const invocation = { id: listeners.length + 1, registration: registrations.at(-1)?.id, native: source.native }
            listeners.push(invocation)
            return context.run({ ...source, listener: invocation.id }, () => reconcile.apply(this, args))
          }
          return originalReconcile.call(this, scope, mapRelative, trigger, observed, ...rest)
        }
      }
      else {
        originalRegistration = handler._watchWithNodeFs
        handler._watchWithNodeFs = function (watched, listener, directory, ...rest) {
          if (directory || path.resolve(String(watched)) !== file) {
            return originalRegistration.call(this, watched, listener, directory, ...rest)
          }
          const registration = { id: registrations.length + 1, stats: fileState(rest[0]) }
          registrations.push(registration)
          const observed = function (...args) {
            const source = context.getStore() || {}
            const invocation = { id: listeners.length + 1, registration: registration.id, native: source.native }
            listeners.push(invocation)
            return context.run({ ...source, listener: invocation.id }, () => listener.apply(this, args))
          }
          return originalRegistration.call(this, watched, observed, directory, ...rest)
        }
      }
      const emitMethod = watcher.handler ? 'emitEvent' : '_emit'
      const pending = watcher.events?.pendingUnlinks ?? watcher._pendingUnlinks
      const pendingKey = watcherPathKey(watcher, file)
      originalEmit = watcher[emitMethod]
      watcher[emitMethod] = function (event, emitted, stats, ...rest) {
        if (path.resolve(String(emitted)) !== file) {
          return originalEmit.call(this, event, emitted, stats, ...rest)
        }
        const source = context.getStore() || {}
        const call = { id: calls.length + 1, event, native: source.native, listener: source.listener, flush: source.flush, stats: fileState(stats), before: pendingId(pending.get(pendingKey)), outputs: [] }
        calls.push(call)
        return context.run({ ...source, call: call.id }, () => {
          try {
            return originalEmit.call(this, event, emitted, stats, ...rest)
          }
          finally { call.after = pendingId(pending.get(pendingKey)) }
        })
      }
      watcher.prependListener('all', publicEvent)
    },
    start() {
      assert.equal(registrations.length, 1, 'the observer must capture the initial exact file registration before public ready')
      boundary = { call: calls.length, event: events.length }
    },
    flush(run) {
      const flush = { id: flushes.length + 1, outputs: [] }
      flushes.push(flush)
      return context.run({ flush: flush.id }, run)
    },
    assert(replacementStats, finalStats, allEvents) {
      assert.ok(boundary, 'atomic observation requires its original event boundary')
      assert.equal(owner.watcher.closed, true, 'all observed listeners must settle after public close before final assertions')
      const observed = events.slice(boundary.event)
      assert.deepEqual(observed.map(item => item.event), allEvents, 'every original all-event remains in the causal record')
      assert.ok(observed.every(item => item.call), 'no public event may lack its exact original _emit invocation')
      const active = calls.slice(boundary.call)
      const unlinks = active.filter(item => item.event === 'unlink')
      const adds = active.filter(item => item.event === 'add')
      assert.equal(unlinks.length, 1, 'one original unlink enters the held atomic buffer')
      assert.ok(unlinks[0].native, 'the original unlink must originate from a real native notification')
      assert.ok(unlinks[0].after)
      assert.deepEqual(unlinks[0].outputs, [])
      assert.equal(adds.length, 1, 'one original ADD consumes the held unlink')
      assert.ok(adds[0].native, 'the replacement ADD must originate from a real native notification')
      assert.equal(adds[0].before, unlinks[0].after, 'ADD consumes the exact original pending entry')
      assert.equal(adds[0].after, null)
      assert.deepEqual(adds[0].outputs, ['change'], 'the original atomic ADD produces exactly one public change')
      for (const key of ['dev', 'ino', 'size', 'mtimeMs']) {
        assert.equal(finalStats[key], replacementStats[key], 'the final file must be the prewritten replacement')
      }
      assert.deepEqual(generation(adds[0].stats), generation(finalStats))
      assert.equal(registrations.length, 2, 'only the initial and replacement file generations are subscribed')
      assert.deepEqual(generation(registrations[1].stats), generation(finalStats))
      assert.equal(flushes.length, 1)
      assert.deepEqual(flushes[0].outputs, [], 'the original held atomic flush emits nothing, including asynchronous output')
      const usedNotifications = new Set([unlinks[0].native, adds[0].native])
      const usedListeners = new Set()
      for (const call of active) {
        assert.ok(['unlink', 'add', 'change'].includes(call.event), 'unexpected target _emit input')
        if (call.event !== 'change') {
          continue
        }
        assert.equal(call.flush, undefined, 'the original flush cannot emit independent change')
        assert.ok(call.native && call.listener, 'independent change requires a real native notification and exact file listener')
        const listener = listeners[call.listener - 1]
        assert.equal(listener.native, call.native)
        const beforeUnlink = call.id < unlinks[0].id
        assert.equal(listener.registration, beforeUnlink ? 1 : 2, beforeUnlink ? 'pre-unlink changes require the initial file listener' : 'old file listeners cannot account for replacement changes')
        const notification = native[call.native - 1]
        assert.ok(notification, 'native notification token must be owned by this observer')
        assert.ok(notification.path === relative(file)
          || (notification.path === relative(path.dirname(file)) && path.resolve(path.dirname(file), notification.filename) === file), 'the real notification must address the exact target')
        assert.deepEqual(generation(call.stats), generation(beforeUnlink ? registrations[0].stats : finalStats), beforeUnlink ? 'pre-unlink change observes the exact initial generation' : 'independent change observes the exact replacement generation')
        if (beforeUnlink) {
          assert.equal(call.before, null, 'pre-unlink change cannot enter an atomic pending generation')
          assert.equal(call.after, null, 'pre-unlink change cannot leave an atomic pending generation')
        }
        assert.ok(call.outputs.length <= 1 && call.outputs.every(event => event === 'change'), 'one original _emit may publish at most one change')
        if (call.outputs.length) {
          assert.ok(!usedNotifications.has(call.native) && !usedListeners.has(call.listener), 'one real notification/listener cannot justify duplicate public changes')
          usedNotifications.add(call.native)
          usedListeners.add(call.listener)
        }
      }
    },
    snapshot() { return { native, registrations, listeners, calls, events, flushes } },
    close() {
      if (owner) {
        owner.watcher.off('all', publicEvent)
        if (owner.watcher.handler) {
          owner.watcher.emitEvent = originalEmit
          owner.watcher.tree.recordObserved = originalRegistration
          owner.watcher.handler.reconcileBackendTrigger = originalReconcile
        }
        else {
          owner.watcher._emit = originalEmit
          owner.watcher._nodeFsHandler._watchWithNodeFs = originalRegistration
        }
      }
      watchApi.watch = originalWatch
      synchronize()
    },
  }
}
