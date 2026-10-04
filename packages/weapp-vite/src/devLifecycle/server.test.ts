import type { ViteDevServer } from 'vite'
import { expect, it, vi } from 'vitest'
import { getDevServerCloseRecord, replaceDevServerClose } from './server'

function createHost() {
  const nativeClose = vi.fn(async () => {})
  return { server: { close: nativeClose } as unknown as ViteDevServer, nativeClose }
}

it('retains later user close wrappers as single-use local layers without recursive lookup', async () => {
  const { server, nativeClose } = createHost()
  const record = getDevServerCloseRecord(server)
  const first = vi.fn(async () => {})
  const second = vi.fn(async () => {})
  const previous = server.close
  server.close = async () => {
    await first()
    await previous()
  }
  const wrapped = server.close
  server.close = async () => {
    await second()
    await wrapped()
  }
  expect(server.close).toBe(server.close)
  await Promise.all([server.close(), server.close(), record.close()])
  expect(first).toHaveBeenCalledTimes(1)
  expect(second).toHaveBeenCalledTimes(1)
  expect(nativeClose).toHaveBeenCalledTimes(1)
})

it('gates before user cleanup while retaining the explicit local cleanup entry', async () => {
  const { server, nativeClose } = createHost()
  const record = getDevServerCloseRecord(server)
  const completed = Promise.withResolvers<void>()
  record.gate = () => completed.promise
  const previous = server.close
  const cleanup = vi.fn(async () => {})
  server.close = async () => {
    await cleanup()
    await previous()
  }
  const closing = server.close()
  expect(cleanup).not.toHaveBeenCalled()
  record.gate = close => close()
  await record.close()
  completed.resolve()
  await closing
  expect(cleanup).toHaveBeenCalledTimes(1)
  expect(nativeClose).toHaveBeenCalledTimes(1)
})

it('adopts the new generation during native Object.assign without chaining through the old gate', async () => {
  const first = createHost()
  const second = createHost()
  const old = getDevServerCloseRecord(first.server)
  const current = getDevServerCloseRecord(second.server)
  const gate = vi.fn(close => close())
  current.gate = gate
  const before = second.server.close
  const cleanup = vi.fn(async () => {})
  second.server.close = async () => {
    await cleanup()
    await before()
  }
  Object.assign(first.server, second.server)
  expect(getDevServerCloseRecord(first.server)).toBe(current)
  expect(getDevServerCloseRecord(first.server)).not.toBe(old)
  await Promise.all([first.server.close(), current.close()])
  expect(first.nativeClose).not.toHaveBeenCalled()
  expect(second.nativeClose).toHaveBeenCalledTimes(1)
  expect(cleanup).toHaveBeenCalledTimes(1)
  expect(gate).toHaveBeenCalled()
})

it('supports restoring a previously captured close and replacing the local lifecycle', async () => {
  const { server, nativeClose } = createHost()
  const record = getDevServerCloseRecord(server)
  const original = server.close
  const unused = vi.fn(async () => {})
  server.close = unused
  server.close = original
  const before = record.close
  const cleanup = vi.fn(async () => {
    await before()
  })
  expect(replaceDevServerClose(server, cleanup)).toBe(before)
  await Promise.all([server.close(), record.close()])
  expect(unused).not.toHaveBeenCalled()
  expect(cleanup).toHaveBeenCalledTimes(1)
  expect(nativeClose).toHaveBeenCalledTimes(1)
})

it('preserves both user and host failures while closing the lower layer only once', async () => {
  const { server, nativeClose } = createHost()
  getDevServerCloseRecord(server)
  const userError = new Error('user cleanup failed')
  const hostError = new Error('host cleanup failed')
  nativeClose.mockRejectedValue(hostError)
  const userClose = vi.fn(async () => {
    throw userError
  })
  server.close = userClose
  await expect(server.close()).rejects.toMatchObject({ errors: [userError, hostError] })
  await expect(server.close()).rejects.toMatchObject({ errors: [userError, hostError] })
  expect(userClose).toHaveBeenCalledTimes(1)
  expect(nativeClose).toHaveBeenCalledTimes(1)
})
