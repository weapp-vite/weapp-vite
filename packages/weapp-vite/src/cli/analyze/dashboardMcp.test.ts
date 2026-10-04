import type { DevframeInstance } from 'devframe/initiate'
import type { Server } from 'node:http'
import path from 'node:path'
import { beforeEach, expect, it, vi } from 'vitest'
import { createDashboardMcp } from './dashboardMcp'

const disposeMock = vi.hoisted(() => vi.fn())
const unregisterMock = vi.hoisted(() => vi.fn())
const registerMock = vi.hoisted(() => vi.fn(() => ({ unregister: unregisterMock })))

vi.mock('devframe/adapters/mcp', () => ({
  createMcpFetchHandler: () => ({ dispose: disposeMock, fetch: vi.fn() }),
}))

vi.mock('devframe/internal', () => ({
  registerDevframeInstance: registerMock,
}))

beforeEach(() => {
  vi.clearAllMocks()
  disposeMock.mockResolvedValue(undefined)
})

it('disposes MCP after unregister failure and preserves both failures through repeated close', async () => {
  const unregisterFailure = new Error('registry removal failed')
  const disposeFailure = new Error('MCP disposal failed')
  const order: string[] = []
  unregisterMock.mockImplementationOnce(() => {
    order.push('unregister')
    throw unregisterFailure
  })
  disposeMock.mockImplementationOnce(async () => {
    order.push('dispose')
    throw disposeFailure
  })
  const instance = { base: '/dashboard/', context: Promise.resolve({}) } as unknown as DevframeInstance
  const httpServer = { listening: true, address: () => ({ address: '127.0.0.1', port: 0 }) } as unknown as Server
  const mcp = await createDashboardMcp(instance, httpServer, { projectRoot: path.resolve('.'), id: 'cleanup-test' })
  mcp.register()
  const closing = mcp.close()
  expect(mcp.close()).toBe(closing)
  await expect(closing).rejects.toMatchObject({ errors: [unregisterFailure, disposeFailure] })
  mcp.register()
  expect(order).toEqual(['unregister', 'dispose'])
  expect(registerMock).toHaveBeenCalledTimes(1)
  expect(unregisterMock).toHaveBeenCalledTimes(1)
  expect(disposeMock).toHaveBeenCalledTimes(1)
})
