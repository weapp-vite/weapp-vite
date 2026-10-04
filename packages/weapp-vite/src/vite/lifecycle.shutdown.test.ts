import type { ViteDevServer } from 'vite'
import type { DevShutdownScope } from '../devLifecycle/shutdown'
import process from 'node:process'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { getDevServerCloseRecord } from '../devLifecycle/server'
import { createDevShutdownScope } from '../devLifecycle/shutdown'
import { bindHostLifecycle } from './lifecycle'

const scopes: DevShutdownScope[] = []
const initialExitCode = process.exitCode

beforeEach(() => {
  if (process.disconnect) {
    vi.spyOn(process, 'disconnect').mockImplementation(() => {})
  }
})

afterEach(async () => {
  await Promise.allSettled(scopes.splice(0).map(scope => scope.close()))
  process.exitCode = initialExitCode
  vi.restoreAllMocks()
})

function createScope() {
  const scope = createDevShutdownScope()
  scopes.push(scope)
  return scope
}

function bindGate(server: ViteDevServer, scope: DevShutdownScope) {
  const record = getDevServerCloseRecord(server)
  record.gate = close => scope.stopping && !scope.isInternalOperation() ? scope.done : close()
}

it('keeps the public exit gate outside host cleanup without waiting on itself', async () => {
  const scope = createScope()
  const released = Promise.withResolvers<void>()
  const closing = Promise.withResolvers<void>()
  const nativeClose = vi.fn(async () => {})
  const closeSession = vi.fn(async () => {})
  const server = { config: { inlineConfig: {} }, close: nativeClose, restart: vi.fn(async () => {}) } as unknown as ViteDevServer
  await scope.run('startup', () => {
    bindGate(server, scope)
    bindHostLifecycle(server, closeSession)
    scope.own(async () => {
      closing.resolve()
      await released.promise
    })
    scope.own(() => server.close())
  })
  scope.request()
  let finished = false
  const publicClose = server.close().then(() => {
    finished = true
  })
  try {
    await closing.promise
    expect(closeSession).toHaveBeenCalledOnce()
    expect(nativeClose).toHaveBeenCalledOnce()
    expect(finished).toBe(false)
  }
  finally {
    released.resolve()
    await Promise.all([publicClose, scope.close()])
  }
})

it('cancels native restart after the current session releases during shutdown', async () => {
  const scope = createScope()
  const entered = Promise.withResolvers<void>()
  const released = Promise.withResolvers<void>()
  const nativeClose = vi.fn(async () => {})
  const nativeRestart = vi.fn(async () => {})
  const server = { config: { inlineConfig: {} }, close: nativeClose, restart: nativeRestart } as unknown as ViteDevServer
  await scope.run('startup', () => {
    bindGate(server, scope)
    bindHostLifecycle(server, async () => {
      entered.resolve()
      await released.promise
    })
    scope.own(() => server.close())
  })
  const restarting = server.restart()
  try {
    await entered.promise
    scope.request()
  }
  finally {
    released.resolve()
    await Promise.all([restarting, scope.close()])
  }
  expect(nativeRestart).not.toHaveBeenCalled()
  expect(nativeClose).toHaveBeenCalledOnce()
})

it('closes the replacement generation before allowing process exit during restart', async () => {
  const scope = createScope()
  const entered = Promise.withResolvers<void>()
  const ready = Promise.withResolvers<void>()
  const nativeClose = vi.fn(async () => {})
  const replacementClose = vi.fn(async () => {})
  const replacementSession = vi.fn(async () => {})
  const server = {
    config: { inlineConfig: {} },
    close: nativeClose,
    restart: async () => {
      const replacement = {
        config: { inlineConfig: server.config.inlineConfig },
        close: replacementClose,
        restart: vi.fn(async () => {}),
      } as unknown as ViteDevServer
      bindGate(replacement, scope)
      bindHostLifecycle(replacement, replacementSession)
      entered.resolve()
      await ready.promise
      Object.assign(server, replacement)
    },
  } as unknown as ViteDevServer
  await scope.run('startup', () => {
    bindGate(server, scope)
    bindHostLifecycle(server, async () => {})
    scope.own(() => server.close())
  })
  const restarting = server.restart()
  let finished = false
  let publicClose: Promise<void> | undefined
  try {
    await entered.promise
    scope.request()
    publicClose = server.close().then(() => {
      finished = true
    })
    await Promise.resolve()
    expect(finished).toBe(false)
    expect(replacementClose).not.toHaveBeenCalled()
  }
  finally {
    ready.resolve()
    await Promise.all([restarting, publicClose, scope.close()])
  }
  expect(nativeClose).not.toHaveBeenCalled()
  expect(replacementSession).toHaveBeenCalledOnce()
  expect(replacementClose).toHaveBeenCalledOnce()
})

it('lets failed replacement startup close locally while its parent restart is pending', async () => {
  const scope = createScope()
  const replacementClose = vi.fn(async () => {})
  const replacementRestart = vi.fn(async () => {})
  const server = {
    config: { inlineConfig: {} },
    close: vi.fn(async () => {}),
    restart: async () => {
      const replacement = {
        config: { inlineConfig: server.config.inlineConfig },
        close: replacementClose,
        restart: replacementRestart,
      } as unknown as ViteDevServer
      bindGate(replacement, scope)
      bindHostLifecycle(replacement, async () => {})
      const queuedRestart = replacement.restart()
      scope.request()
      // Vite 初始化失败会等待公共 close；本次调用必须走内部资源清理。
      await replacement.close()
      await queuedRestart
    },
  } as unknown as ViteDevServer
  await scope.run('startup', () => {
    bindGate(server, scope)
    bindHostLifecycle(server, async () => {})
    scope.own(() => server.close())
  })
  await server.restart()
  await scope.close()
  expect(replacementClose).toHaveBeenCalledOnce()
  expect(replacementRestart).not.toHaveBeenCalled()
})
