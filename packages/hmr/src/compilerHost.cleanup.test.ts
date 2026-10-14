import { expect, it, vi } from 'vitest'
import { HmrCompilerHost } from './compilerHost'
import { CompilerHmrResyncError } from './errors'

it.each(['provider', 'duplicate-asset'] as const)('retains the %s failure and attempts all partial preparation cleanup', async (failureKind) => {
  const host = new HmrCompilerHost()
  const original = new Error('provider rejected')
  const syncFailure = new Error('synchronous disposal failed')
  const asyncFailure = new Error('asynchronous disposal failed')
  const first = vi.fn(() => {
    throw syncFailure
  })
  const second = vi.fn(async () => {
    throw asyncFailure
  })
  const last = vi.fn()
  const asset = { fileName: 'styles/app.wxss', code: 'view {}' }
  host.register('first', async () => ({ dispose: first, assets: [asset] }))
  host.register('second', async () => ({ dispose: second, assets: failureKind === 'duplicate-asset' ? [asset] : [] }))
  host.register('last', async () => ({ dispose: last }))
  if (failureKind === 'provider') {
    host.register('broken', async () => {
      throw original
    })
  }
  const error = await host.prepare(host.freeze(['app.wxss'])).catch(error => error)

  expect(first).toHaveBeenCalledOnce()
  expect(second).toHaveBeenCalledOnce()
  expect(last).toHaveBeenCalledOnce()
  expect(error).toBeInstanceOf(AggregateError)
  const primary = failureKind === 'provider' ? original : expect.any(CompilerHmrResyncError)
  expect(error.errors).toEqual([primary, syncFailure, asyncFailure])
  expect(error.cause).toBe(error.errors[0])
  if (failureKind === 'duplicate-asset') {
    expect(error.cause.files).toEqual(['app.wxss'])
    expect(error.cause.message).toContain(asset.fileName)
  }
})

it('preserves the original provider failure identity when partial cleanup succeeds', async () => {
  const host = new HmrCompilerHost()
  const original = new Error('provider rejected')
  const dispose = vi.fn()
  host.register('prepared', async () => ({ dispose }))
  host.register('broken', async () => {
    throw original
  })
  await expect(host.prepare(host.freeze([]))).rejects.toBe(original)
  expect(dispose).toHaveBeenCalledOnce()
})

it('retains a duplicate-asset resync error when all cleanup succeeds', async () => {
  const host = new HmrCompilerHost()
  const first = vi.fn()
  const second = vi.fn()
  host.register('first', async () => ({ dispose: first, assets: [{ fileName: 'styles\\app.wxss', code: '' }] }))
  host.register('second', async () => ({ dispose: second, assets: [{ fileName: 'styles/app.wxss', code: '' }] }))
  const error = await host.prepare(host.freeze(['app.wxss'])).catch(error => error)
  expect(error).toBeInstanceOf(CompilerHmrResyncError)
  expect(error.files).toEqual(['app.wxss'])
  expect(first).toHaveBeenCalledOnce()
  expect(second).toHaveBeenCalledOnce()
})
