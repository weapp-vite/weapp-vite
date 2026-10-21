import type { ViteDevServer } from 'vite'
import type { getCompilerHmrHost } from '../../../../src/plugins/compilerPlugin/hmr'
import type { StatefulHmrDevEngineBatch } from '../../../../src/runtime/statefulHmr/viteAdapter'
import { createHash } from 'node:crypto'
import process from 'node:process'
import path from 'pathe'
import { vi } from 'vitest'
import { compilerSourceId } from '../../../../src/plugins/compilerPlugin/hmr'
import * as outputWriter from '../../../../src/runtime/statefulHmr/outputWriter'
import { StatefulHmrViteAdapter } from '../../../../src/runtime/statefulHmr/viteAdapter'

interface AdapterObservation {
  handleHmrUpdates: (batch: StatefulHmrDevEngineBatch | Error) => void
  callbacks: { onBatch?: (batch: StatefulHmrDevEngineBatch) => void }
}

/** 有界记录真实边界，所有观察器都同步透传原参数、接收者与返回值。 */
export function createNativeCompilerTrace(root: string) {
  const rows: Array<Record<string, unknown>> = []
  const restores: Array<() => void> = []
  const allNativeFiles = new Set<string>()
  const nativeFiles = new Set<string>()
  const dependencyChanges = new Set<string>()
  const committedStyles = new Set<string>()
  const unsupported = Promise.withResolvers<never>()
  void unsupported.promise.catch(() => {})
  const started = performance.now()
  let measured = false
  let sequence = 0
  let dropped = 0
  let unsupportedError: Error | undefined
  let initialPayloadConfirmations = 0
  const hash = (value: string) => createHash('sha256').update(value).digest('hex')
  const file = (value: string) => {
    if (value.startsWith('\0')) {
      return '<virtual>'
    }
    const relative = path.relative(root, value).replaceAll('\\', '/')
    return relative.startsWith('../') || path.isAbsolute(relative) ? '<external>' : relative || '<root>'
  }
  const record = (stage: string, details: Record<string, unknown> = {}) => {
    if (rows.length >= 2_000) {
      dropped++
      return
    }
    rows.push({ seq: ++sequence, elapsedMs: performance.now() - started, measured, stage, ...details })
  }
  const observeBatch = (batch: StatefulHmrDevEngineBatch) => {
    const ids = batch.changedFiles.map(compilerSourceId)
    ids.forEach(id => allNativeFiles.add(id))
    if (measured) {
      ids.forEach(id => nativeFiles.add(id))
    }
    const updates = batch.updates.map(item => ({ clientId: item.clientId, type: item.update.type }))
    record('native.batch', { changedFiles: batch.changedFiles.map(file), updateTypes: updates.map(update => update.type), updates })
    if (updates.some(update => update.type !== 'Noop') && !unsupportedError) {
      unsupportedError = new Error(`Unsupported no-client native update: ${updates.map(update => update.type).join(', ')}; this fixture does not execute or acknowledge runtime payloads`)
      unsupportedError.name = 'UnsupportedNoClientNativeUpdateError'
      record('native.unsupported', { changedFiles: batch.changedFiles.map(file), updates })
      unsupported.reject(unsupportedError)
    }
  }
  const assertSupported = () => {
    if (unsupportedError) {
      throw unsupportedError
    }
    if (dropped) {
      throw new Error(`Native compiler trace dropped ${dropped} observations`)
    }
  }
  return {
    record,
    file,
    hash,
    assertSupported,
    begin() {
      measured = true
      record('observation.boundary', { initialPayloadConfirmations, shippedRuntimeObserved: false })
    },
    hasNativeFile: (value: string, includeSetup = false) => (includeSetup ? allNativeFiles : nativeFiles).has(compilerSourceId(value)),
    hasDependencyChange: (value: string) => dependencyChanges.has(compilerSourceId(value)),
    hasCommittedStyle: (value: string) => committedStyles.has(value),
    guard: <T>(pending: Promise<T>) => Promise.race([pending, unsupported.promise]),
    install(host: ReturnType<typeof getCompilerHmrHost>) {
      const captureRaw = host.captureRaw
      const rawSpy = vi.spyOn(host, 'captureRaw').mockImplementation(function (this: typeof host, ...args) {
        record('raw.capture', { file: file(args[0]), hash: typeof args[1] === 'string' ? hash(args[1]) : null })
        return captureRaw.apply(this, args)
      })
      restores.push(() => rawSpy.mockRestore())
      const captureNative = host.captureNative
      const nativeSpy = vi.spyOn(host, 'captureNative').mockImplementation(function (this: typeof host, ...args) {
        record('native.capture', { file: file(args[0]), hash: hash(args[1]) })
        return captureNative.apply(this, args)
      })
      restores.push(() => nativeSpy.mockRestore())
      const prototype = StatefulHmrViteAdapter.prototype as unknown as AdapterObservation
      const nativeBatch = prototype.handleHmrUpdates
      const observing = new WeakSet<AdapterObservation['callbacks']>()
      const batchSpy = vi.spyOn(prototype, 'handleHmrUpdates').mockImplementation(function (this: AdapterObservation, batch) {
        record('native.batch.raw', batch instanceof Error
          ? { name: batch.name, message: batch.message }
          : { changedFiles: batch.changedFiles.map(file), updates: batch.updates.map(item => ({ clientId: item.clientId, type: item.update.type })) })
        const callbacks = this.callbacks
        const onBatch = callbacks.onBatch
        if (!onBatch || observing.has(callbacks)) {
          return nativeBatch.call(this, batch)
        }
        const observed: typeof onBatch = function (this: typeof callbacks, ...args) {
          // 这里观察产品已筛选的 batch，不复制或替换它，也不在原生回调内抛错。
          observeBatch(args[0])
          return onBatch.apply(this, args)
        }
        observing.add(callbacks)
        callbacks.onBatch = observed
        try {
          return nativeBatch.call(this, batch)
        }
        finally {
          observing.delete(callbacks)
          if (callbacks.onBatch === observed) {
            callbacks.onBatch = onBatch
          }
        }
      })
      restores.push(() => batchSpy.mockRestore())
      const delivered = StatefulHmrViteAdapter.prototype.markPayloadDelivered
      const deliveredSpy = vi.spyOn(StatefulHmrViteAdapter.prototype, 'markPayloadDelivered').mockImplementation(function (this: StatefulHmrViteAdapter, filename) {
        initialPayloadConfirmations++
        record('initial.payload.confirmed', { file: filename })
        return delivered.call(this, filename)
      })
      restores.push(() => deliveredSpy.mockRestore())
      const writeOutput = outputWriter.writeStatefulHmrOutput
      const outputSpy = vi.spyOn(outputWriter, 'writeStatefulHmrOutput').mockImplementation(function (this: unknown, ...args) {
        const targetMutation = measured
        const styles = args[1].flatMap(item => item.type === 'asset' && item.fileName.endsWith('.wxss')
          ? [{ fileName: item.fileName, hash: hash(String(item.source)) }]
          : [])
        record('output.commit.enter', { styles })
        const pending = writeOutput.apply(this, args)
        void pending.then(() => {
          if (targetMutation) {
            styles.forEach(style => committedStyles.add(style.fileName))
          }
          record('output.commit.resolved', { styles })
        }, () => record('output.commit.rejected', { styles }))
        return pending
      })
      restores.push(() => outputSpy.mockRestore())
    },
    observeDependencyChanges(host: ReturnType<typeof getCompilerHmrHost>) {
      const dependencyChange = host.onDependencyChange!
      const spy = vi.spyOn(host, 'onDependencyChange').mockImplementation(function (this: typeof host, ...args) {
        if (measured) {
          dependencyChanges.add(compilerSourceId(args[0]))
        }
        record('vite.onDependencyChange', { file: file(args[0]) })
        return dependencyChange.apply(this, args)
      })
      const observed = host.onDependencyChange
      restores.push(() => {
        const owned = host.onDependencyChange === observed
        const descriptor = Object.getOwnPropertyDescriptor(host, 'onDependencyChange')
        spy.mockRestore()
        // teardown 已清空或替换的回调归产品所有，恢复 spy 不能复活旧 session。
        if (!owned) {
          if (descriptor) {
            Object.defineProperty(host, 'onDependencyChange', descriptor)
          }
          else { delete host.onDependencyChange }
        }
      })
    },
    observeWatcher(server: ViteDevServer) {
      const originalEmit = server.watcher.emit
      const descriptor = Object.getOwnPropertyDescriptor(server.watcher, 'emit')
      const emit: typeof server.watcher.emit = function (event, ...args) {
        if (['add', 'change', 'unlink', 'ready'].includes(String(event))) {
          record('vite.watcher.emit', { event, file: typeof args[0] === 'string' ? file(args[0]) : undefined })
        }
        return originalEmit.call(this, event, ...args)
      }
      server.watcher.emit = emit
      restores.push(() => {
        if (server.watcher.emit === emit) {
          if (descriptor) {
            Object.defineProperty(server.watcher, 'emit', descriptor)
          }
          else { delete (server.watcher as Partial<typeof server.watcher>).emit }
        }
      })
    },
    restore() {
      const failures: unknown[] = []
      for (const restore of restores.splice(0).reverse()) {
        try {
          restore()
        }
        catch (error) {
          failures.push(error)
        }
      }
      return failures
    },
    report(kind: string, cleanupConfirmed: boolean, retainedFixture?: string) {
      process.stderr.write(`[provider-real-native] ${JSON.stringify({ schemaVersion: 1, kind, dropped, initialPayloadConfirmations, shippedRuntimeObserved: false, cleanupConfirmed, retainedFixture, rows })}\n`)
      if (dropped) {
        throw new Error(`Native compiler trace dropped ${dropped} observations`)
      }
    },
  }
}
