import { setImmediate as nextTurn } from 'node:timers/promises'
import path from 'pathe'
import { beforeEach, expect, it, vi } from 'vitest'
import { createRuntimeState } from '../runtime/runtimeState'
import { createDevModuleGraphProvider } from './devProvider'
import { createModuleGraphService } from './service'

const mocks = vi.hoisted(() => ({
  createServer: vi.fn(),
  bindWxml: vi.fn(),
}))

vi.mock('vite', async (importOriginal) => {
  const actual = await importOriginal<typeof import('vite')>()
  return { ...actual, createServer: mocks.createServer }
})

vi.mock('../wxml/processing/watch', () => ({
  bindWxmlDependencyWatch: mocks.bindWxml,
  ownsExternalWxmlWatch: () => false,
}))

beforeEach(() => vi.resetAllMocks())

function fixture() {
  const cwd = path.resolve('provider-cleanup-fixture')
  const source = path.join(cwd, 'src/input.ts')
  const node = { id: source, file: source }
  const server = {
    close: vi.fn(async () => {}),
    moduleGraph: {
      getModuleById: (id: string) => id === source ? node : undefined,
      getModulesByFile: (id: string) => id === source ? new Set([node]) : undefined,
    },
  }
  mocks.createServer.mockResolvedValue(server)
  const ctx = {
    runtimeState: createRuntimeState(),
    configService: { cwd, outDir: path.join(cwd, 'dist'), inlineConfig: {} },
    moduleGraphService: createModuleGraphService(),
  } as any
  return { ctx, server, source }
}

it.each([false, true])('drains and releases the Vite server when external WXML close fails (server fails: %s)', async (serverFails) => {
  const { ctx, server, source } = fixture()
  const wxmlFailure = new Error('external WXML unsubscribe failed')
  const serverFailure = new Error('Vite server close failed')
  const serverStarted = Promise.withResolvers<void>()
  const serverRelease = Promise.withResolvers<void>()
  const wxmlClose = vi.fn(async () => {
    throw wxmlFailure
  })
  mocks.bindWxml.mockReturnValue(Object.assign(wxmlClose, { ready: Promise.resolve('ready') }))
  server.close.mockImplementationOnce(async () => {
    serverStarted.resolve()
    await serverRelease.promise
    if (serverFails) {
      throw serverFailure
    }
  })
  const provider = await createDevModuleGraphProvider(ctx, {}, vi.fn())
  expect(ctx.moduleGraphService.hasModule(source)).toBe(true)
  const closing = provider.close()
  let settled = false
  const result = closing.catch((error: unknown) => {
    settled = true
    return error
  })
  await serverStarted.promise
  await nextTurn()
  expect(settled).toBe(false)
  expect(provider.close()).toBe(closing)
  serverRelease.resolve()
  const failure = await result

  if (serverFails) {
    expect(failure).toBeInstanceOf(AggregateError)
    expect((failure as AggregateError).errors).toEqual([wxmlFailure, serverFailure])
  }
  else {
    expect(failure).toBe(wxmlFailure)
  }
  expect(ctx.moduleGraphService.hasModule(source)).toBe(false)
  expect(wxmlClose).toHaveBeenCalledOnce()
  expect(server.close).toHaveBeenCalledOnce()
})

it.each([
  { wxmlFails: false, serverFails: false },
  { wxmlFails: true, serverFails: false },
  { wxmlFails: false, serverFails: true },
  { wxmlFails: true, serverFails: true },
])('preserves startup readiness failure while independently releasing WXML and Vite ($wxmlFails/$serverFails)', async ({ wxmlFails, serverFails }) => {
  const { ctx, server, source } = fixture()
  const initialFailure = new Error('external WXML startup failed')
  const wxmlFailure = new Error('external WXML unsubscribe failed')
  const serverFailure = new Error('Vite server close failed')
  const wxmlClose = vi.fn(async () => {
    if (wxmlFails) {
      throw wxmlFailure
    }
  })
  mocks.bindWxml.mockReturnValue(Object.assign(wxmlClose, { ready: Promise.reject(initialFailure) }))
  if (serverFails) {
    server.close.mockRejectedValueOnce(serverFailure)
  }
  const failure = await createDevModuleGraphProvider(ctx, {}, vi.fn()).catch(error => error)
  const expected = [initialFailure, ...(wxmlFails ? [wxmlFailure] : []), ...(serverFails ? [serverFailure] : [])]

  if (expected.length === 1) {
    expect(failure).toBe(initialFailure)
  }
  else {
    expect(failure).toBeInstanceOf(AggregateError)
    expect(failure.errors).toEqual(expected)
    expect(failure.cause).toBe(initialFailure)
  }
  expect(ctx.moduleGraphService.hasModule(source)).toBe(false)
  expect(wxmlClose).toHaveBeenCalledOnce()
  expect(server.close).toHaveBeenCalledOnce()
})

it('releases the Vite server and retains both failures when WXML binding throws synchronously', async () => {
  const { ctx, server, source } = fixture()
  const bindingFailure = new Error('WXML binding failed')
  const serverFailure = new Error('Vite server close failed')
  mocks.bindWxml.mockImplementationOnce(() => {
    throw bindingFailure
  })
  server.close.mockRejectedValueOnce(serverFailure)

  const failure = await createDevModuleGraphProvider(ctx, {}, vi.fn()).catch(error => error)

  expect(failure).toBeInstanceOf(AggregateError)
  expect(failure.errors).toEqual([bindingFailure, serverFailure])
  expect(failure.cause).toBe(bindingFailure)
  expect(ctx.moduleGraphService.hasModule(source)).toBe(false)
  expect(server.close).toHaveBeenCalledOnce()
})
