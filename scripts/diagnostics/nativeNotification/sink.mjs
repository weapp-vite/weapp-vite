import assert from 'node:assert/strict'
import { AsyncLocalStorage } from 'node:async_hooks'
import path from 'node:path'
import process from 'node:process'

export function createSink(root, limit = 20_000) {
  const ownerContext = new AsyncLocalStorage()
  const coreContext = new AsyncLocalStorage()
  const events = Array.from({ length: limit })
  let size = 0
  let overflow = false
  let target
  let current
  let sequence = 0
  let spanSequence = 0
  const mutations = []
  const selectedModules = []
  const normalize = file => typeof file === 'string' ? path.resolve(file).replaceAll('\\', '/') : undefined
  const match = file => target && normalize(file) === target
  const primitiveExtra = extra => Object.fromEntries(Object.entries(extra ?? {}).map(([key, value]) => [key, Array.isArray(value) ? value.map(String) : typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean' || value == null ? value : String(value)]))
  function record(type, context, extra) {
    if (size >= limit) {
      overflow = true
      return
    }
    events[size++] = { sequence: ++sequence, at: performance.now(), type, observationWindow: context ? context.mutation : current?.id ?? null, owner: context?.owner ?? null, ownerSpan: context?.ownerSpan ?? null, coreSpan: context?.coreSpan ?? null, ...primitiveExtra(extra) }
  }
  const api = {
    module(item) {
      selectedModules.push({ path: item.path, sourceHash: item.sourceHash, transformedHash: item.transformedHash, kind: item.kind })
    },
    activate(input) {
      assert(!current, 'Previous observation window still active')
      assert.equal(typeof input.id, 'string')
      assert(path.isAbsolute(input.file))
      if (target) {
        assert.equal(normalize(input.file), target, 'Only one exact script target is supported')
      }
      target = normalize(input.file)
      current = { id: input.id, phase: input.phase, cycle: input.cycle, inputHash: input.inputHash, file: path.relative(root, target).replaceAll('\\', '/') }
      mutations.push({ ...current, begin: performance.now() })
      record('window.begin')
      return { now: performance.now(), timeOrigin: performance.timeOrigin, pid: process.pid, id: current.id }
    },
    finish(id) {
      assert.equal(current?.id, id)
      record('window.end')
      mutations.at(-1).end = performance.now()
      current = undefined
      return { now: performance.now(), timeOrigin: performance.timeOrigin, pid: process.pid, id }
    },
    receipt(file, event) {
      if (match(file)) {
        record('vite.receipt', undefined, { event })
      }
    },
    owner(kind, file, event, plugin, run) {
      if (!match(file)) {
        return run()
      }
      const context = { mutation: current?.id ?? null, owner: kind, ownerSpan: ++spanSequence }
      record(kind === 'native-js' ? 'native.callback' : 'vite.dispatch', context, { event, plugin })
      return ownerContext.run(context, run)
    },
    beginCore(file, event) {
      if (!match(file)) {
        return undefined
      }
      const context = { mutation: current?.id ?? null, ...ownerContext.getStore(), coreSpan: ++spanSequence }
      record('core.enter', context, { event })
      return context
    },
    event(context, type, extra) {
      if (context) {
        record(type, context, extra)
      }
    },
    notify(context, run) {
      if (!context) {
        return run()
      }
      record('core.notify', context)
      return coreContext.run(context, run)
    },
    sessionSource(file) {
      if (match(file)) {
        record('session.source', coreContext.getStore() ?? ownerContext.getStore())
      }
    },
    export(reason) {
      return { schema: 1, diagnosticOnly: true, reason, pid: process.pid, timeOrigin: performance.timeOrigin, overflow, incompleteWindow: current?.id ?? null, attribution: 'observation window, not native event causality; late events may belong to an earlier mutation', selectedModules, mutations, events: events.slice(0, size) }
    },
  }
  return api
}
