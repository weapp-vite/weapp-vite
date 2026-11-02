import { expect, it, vi } from 'vitest'
import { HmrCompilerHost } from './compilerHost'

it('releases only the provider registration owned by the returned callback', async () => {
  const host = new HmrCompilerHost()
  const prepare = vi.fn(async () => ({}))
  const release = host.register('content', prepare)
  const releaseUnsupported = host.register('legacy')
  expect(host.enabled).toBe(true)
  expect(host.supported).toBe(false)

  releaseUnsupported()
  releaseUnsupported()
  expect(host.supported).toBe(true)
  await host.prepare(host.freeze([]))
  expect(prepare).toHaveBeenCalledOnce()

  release()
  release()
  expect(host.enabled).toBe(false)
  await expect(host.prepare(host.freeze([]))).resolves.toEqual([])
  expect(prepare).toHaveBeenCalledOnce()
})

it('preserves a replacement provider when an older registration is released later', async () => {
  const host = new HmrCompilerHost()
  const retired = vi.fn(async () => ({}))
  const current = vi.fn(async () => ({}))
  const releaseRetired = host.register('content', retired)
  const releaseCurrent = host.register('content', current)

  releaseRetired()
  releaseRetired()
  await host.prepare(host.freeze([]))
  expect(retired).not.toHaveBeenCalled()
  expect(current).toHaveBeenCalledOnce()
  expect(host.enabled).toBe(true)

  releaseCurrent()
  expect(host.enabled).toBe(false)
})
