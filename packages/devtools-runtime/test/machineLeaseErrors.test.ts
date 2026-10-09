import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, expect, it, vi } from 'vitest'
import { withMachineE2ELease } from '../src/lease/machine'

const roots: string[] = []

afterEach(async () => {
  vi.restoreAllMocks()
  await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })))
})

async function fixture() {
  const stateDirectory = await mkdtemp(path.join(tmpdir(), 'machine-lease-errors-'))
  roots.push(stateDirectory)
  return { stateDirectory, env: {} }
}

it.each([new Error('callback failed'), undefined])('preserves callback failure %s when release also fails', async (callbackError) => {
  const options = await fixture()
  const releaseError = new Error('lease release failed')
  const release = vi.fn<() => Promise<void>>().mockRejectedValue(releaseError)
  const failure: unknown = await withMachineE2ELease(async (lease) => {
    vi.spyOn(lease, 'release').mockImplementation(release)
    throw callbackError
  }, options).catch((error: unknown) => error)

  expect(failure).toBeInstanceOf(AggregateError)
  if (!(failure instanceof AggregateError)) {
    throw new Error('Expected callback and release failures to be aggregated.')
  }
  expect(failure.cause).toBe(callbackError)
  expect(failure.errors).toHaveLength(2)
  expect(failure.errors[0]).toBe(callbackError)
  expect(failure.errors[1]).toBe(releaseError)
  expect(release).toHaveBeenCalledTimes(1)
  expect(options.env).toEqual({})
})

it('rejects with the release failure after the callback succeeds', async () => {
  const options = await fixture()
  const releaseError = new Error('lease release failed')
  const release = vi.fn<() => Promise<void>>().mockRejectedValue(releaseError)

  await expect(withMachineE2ELease(async (lease) => {
    vi.spyOn(lease, 'release').mockImplementation(release)
    return 'callback result'
  }, options)).rejects.toBe(releaseError)

  expect(release).toHaveBeenCalledTimes(1)
  expect(options.env).toEqual({})
})
