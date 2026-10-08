import process from 'node:process'
import { beforeEach, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ identity: vi.fn(), self: vi.fn(), platform: 'linux' }))
vi.mock('../host', () => ({ readManagedProcessIdentity: mocks.identity }))
vi.mock('./windowsSelfIdentity', () => ({ readWindowsJournalWriterIdentity: mocks.self }))
vi.mock('node:process', async (importOriginal) => {
  const original = await importOriginal<{ default: NodeJS.Process }>()
  return {
    default: {
      ...original.default,
      get platform() {
        return mocks.platform
      },
    },
  }
})
const writer = { pid: process.pid, executable: 'journal-writer', started: 'current-generation' }

beforeEach(() => {
  vi.resetModules()
  mocks.identity.mockReset()
  mocks.self.mockReset()
  mocks.platform = 'linux'
})

it('uses and caches only self inspection on Windows without changing generic host reads', async () => {
  mocks.platform = 'win32'
  mocks.self.mockResolvedValueOnce(writer)
  const { readManagedJournalWriterIdentity: readIdentity } = await import('./writerIdentity')
  await expect(Promise.all([readIdentity(), readIdentity()])).resolves.toEqual([writer, writer])
  await expect(readIdentity()).resolves.toBe(writer)
  expect(mocks.self).toHaveBeenCalledExactlyOnceWith()
  expect(mocks.identity).not.toHaveBeenCalled()
})

it('retains Windows self inspection failures and retries only a later explicit operation', async () => {
  mocks.platform = 'win32'
  const failure = new Error('writer permission denied')
  mocks.self.mockRejectedValueOnce(failure).mockResolvedValueOnce(writer)
  const { readManagedJournalWriterIdentity: readIdentity } = await import('./writerIdentity')
  const first = readIdentity()
  expect(readIdentity()).toBe(first)
  await expect(first).rejects.toBe(failure)
  expect(mocks.self).toHaveBeenCalledOnce()
  await expect(readIdentity()).resolves.toBe(writer)
  expect(mocks.self).toHaveBeenCalledTimes(2)
  expect(mocks.identity).not.toHaveBeenCalled()
})

it('shares one pending query and caches its successful identity', async () => {
  const query = Promise.withResolvers<typeof writer | undefined>()
  mocks.identity.mockReturnValueOnce(query.promise)
  const { readManagedJournalWriterIdentity: readIdentity } = await import('./writerIdentity')
  const first = readIdentity()
  const second = readIdentity()
  expect(second).toBe(first)
  expect(mocks.identity).toHaveBeenCalledExactlyOnceWith(process.pid)
  query.resolve(writer)
  await expect(Promise.all([first, second])).resolves.toEqual([writer, writer])
  await expect(readIdentity()).resolves.toBe(writer)
  expect(mocks.identity).toHaveBeenCalledOnce()
})

it('preserves the same failure for concurrent callers and rechecks only on the next explicit call', async () => {
  const query = Promise.withResolvers<typeof writer | undefined>()
  const failure = new Error('identity query timed out')
  mocks.identity.mockReturnValueOnce(query.promise)
  const { readManagedJournalWriterIdentity: readIdentity } = await import('./writerIdentity')
  const first = readIdentity()
  const second = readIdentity()
  expect(second).toBe(first)
  const completed = Promise.allSettled([first, second])
  query.reject(failure)
  expect(await completed).toEqual([
    { status: 'rejected', reason: failure },
    { status: 'rejected', reason: failure },
  ])
  expect(mocks.identity).toHaveBeenCalledOnce()
  mocks.identity.mockResolvedValueOnce(writer)
  await expect(readIdentity()).resolves.toBe(writer)
  expect(mocks.identity).toHaveBeenCalledTimes(2)
  await expect(readIdentity()).resolves.toBe(writer)
  expect(mocks.identity).toHaveBeenCalledTimes(2)
})

it('does not cache missing metadata as a successful writer identity', async () => {
  mocks.identity.mockResolvedValueOnce(undefined).mockResolvedValueOnce(writer)
  const { readManagedJournalWriterIdentity: readIdentity } = await import('./writerIdentity')
  await expect(readIdentity()).rejects.toThrow('Cannot identify the managed DevTools journal writer')
  expect(mocks.identity).toHaveBeenCalledOnce()
  await expect(readIdentity()).resolves.toBe(writer)
  expect(mocks.identity).toHaveBeenCalledTimes(2)
})
