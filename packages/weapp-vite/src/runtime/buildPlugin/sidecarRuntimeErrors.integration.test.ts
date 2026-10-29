import type { ReadinessHarness, ReadinessWatcher } from '../../../test/sidecarReadiness/fixture'
import { EventEmitter } from 'node:events'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { cleanupReadinessFixtures, startInitialBuild, withHeldReadiness } from '../../../test/sidecarReadiness/fixture'
import { logger } from '../../context/shared'

const harness = vi.hoisted(() => ({
  build: vi.fn(),
  sidecars: [] as ReadinessWatcher[],
  readinessHold: undefined as ReadinessHarness['readinessHold'],
  controllers: [] as Array<{ watcher: unknown, errors: unknown[] }>,
}))

vi.mock('vite', async importOriginal => ({ ...await importOriginal<typeof import('vite')>(), build: harness.build }))
vi.mock('../../moduleGraph/devProvider', () => ({
  createDevModuleGraphProvider: vi.fn(async () => ({ close: vi.fn(async () => {}) })),
}))
vi.mock('./devBuildWatcher', async (importOriginal) => {
  const original = await importOriginal<typeof import('./devBuildWatcher')>()
  return {
    ...original,
    createDevBuildWatcher() {
      const controller = original.createDevBuildWatcher()
      const observation = { watcher: controller.watcher, errors: [] as unknown[] }
      harness.controllers.push(observation)
      const emit = controller.emitEvent
      controller.emitEvent = (event) => {
        if (event.code === 'ERROR') {
          observation.errors.push(event.error)
        }
        emit(event)
      }
      return controller
    },
  }
})
vi.mock('chokidar', () => ({
  default: {
    watch: vi.fn((_roots, options?: { ignoreInitial?: boolean }) => {
      const asset = options?.ignoreInitial === false
      const watcher = Object.assign(new EventEmitter(), {
        asset,
        closed: false,
        add: vi.fn(),
        unwatch: vi.fn(),
        close: vi.fn(async () => {
          watcher.closed = true
          watcher.removeAllListeners()
        }),
      })
      harness.sidecars.push(watcher)
      setImmediate(() => {
        if (watcher.closed) {
          return
        }
        const hold = harness.readinessHold
        if (hold?.asset === asset) {
          hold.observe(watcher)
        }
        else {
          watcher.emit('ready')
        }
      })
      return watcher
    }),
  },
}))

const cleanups: Array<() => Promise<void>> = []
const expectedCleanupErrors = new Set<unknown>()

beforeEach(() => {
  harness.build.mockReset()
  harness.sidecars = []
  harness.controllers = []
  harness.readinessHold = undefined
  expectedCleanupErrors.clear()
})

afterEach(async () => {
  try {
    await cleanupReadinessFixtures(cleanups, expectedCleanupErrors)
  }
  finally {
    vi.restoreAllMocks()
  }
})

it('delivers an error emitted synchronously after native ready exactly once', async () => withHeldReadiness(harness, 'sidecar', async (readiness) => {
  const fixture = await startInitialBuild(harness, cleanups, readiness)
  harness.readinessHold = undefined
  const errorSpy = vi.spyOn(logger, 'error').mockImplementation(() => {})
  const failure = new Error('runtime failure immediately after ready')
  // 原生 ready 与 error 可以在同一调用栈内交付；不得依赖 Promise reaction 已经运行。
  fixture.sidecar.emit('ready')
  fixture.sidecar.emit('error', failure)
  const result = await fixture.outcome
  expect(result).toHaveProperty('watcher')
  if (!('watcher' in result)) {
    throw new Error('Expected a successfully initialized watcher')
  }
  expect(errorSpy).toHaveBeenCalledExactlyOnceWith(failure)
  expect(harness.controllers.find(controller => controller.watcher === result.watcher)?.errors).toEqual([failure])
}))

it('keeps a rejected initial scan with its startup owner without runtime redelivery', async () => withHeldReadiness(harness, 'sidecar', async (readiness) => {
  const fixture = await startInitialBuild(harness, cleanups, readiness)
  harness.readinessHold = undefined
  const errorSpy = vi.spyOn(logger, 'error').mockImplementation(() => {})
  const failure = new Error('initial scan failed before ready')
  expectedCleanupErrors.add(failure)
  fixture.sidecar.emit('error', failure)
  const result = await fixture.outcome
  expect(result).toEqual({ error: failure })
  expect(errorSpy).not.toHaveBeenCalled()
  expect(harness.controllers.flatMap(controller => controller.errors)).toEqual([])
  expect(harness.sidecars.every(watcher => watcher.closed)).toBe(true)
}))

it('discards a pending runtime notification when its owning scope closes before readiness reactions', async () => withHeldReadiness(harness, 'sidecar', async (readiness) => {
  const fixture = await startInitialBuild(harness, cleanups, readiness)
  harness.readinessHold = undefined
  const errorSpy = vi.spyOn(logger, 'error').mockImplementation(() => {})
  const root = `${fixture.ctx.configService.absoluteSrcRoot}::dev-snapshot`
  const scope = fixture.ctx.watcherService.sidecarWatcherMap.get(root)
  expect(scope).toBeDefined()
  const failure = new Error('runtime failure immediately before owner closes')
  fixture.sidecar.emit('ready')
  fixture.sidecar.emit('error', failure)
  // 直接关闭当前登记的 snapshot owner，不等待微任务，也不关闭任何未知资源。
  const closing = scope!.close()
  await closing
  const result = await fixture.outcome
  expect(result).toHaveProperty('watcher')
  expect(errorSpy).not.toHaveBeenCalled()
  expect(harness.controllers.flatMap(controller => controller.errors)).toEqual([])
  expect(fixture.sidecar.close).toHaveBeenCalledOnce()
  expect(fixture.sidecar.eventNames()).toEqual([])
}))
