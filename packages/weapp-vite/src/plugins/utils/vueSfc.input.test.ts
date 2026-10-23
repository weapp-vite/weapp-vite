import type { CompilerContext } from '../../context'
import { mkdtemp, realpath, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'pathe'
import { afterEach, expect, it, vi } from 'vitest'
import { CompilerHmrResyncError, compilerSourceId, getCompilerHmrHost } from '../compilerPlugin/hmr'
import { observeCompilerInputs, setCompilerSourceSnapshot } from './sourceSnapshot'
import { createSfcResolveSrcOptions } from './vueSfc'

const mocks = vi.hoisted(() => ({
  readFile: vi.fn<(file: string, options?: { checkMtime?: boolean }) => Promise<string>>(),
}))

vi.mock('wevu/compiler', async importOriginal => ({
  ...await importOriginal<typeof import('wevu/compiler')>(),
  readFile: mocks.readFile,
}))

const roots: string[] = []
const releases: Array<() => void> = []

afterEach(async () => {
  releases.splice(0).forEach(release => release())
  mocks.readFile.mockReset()
  await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })))
})

async function fixture() {
  const root = await realpath(await mkdtemp(path.join(tmpdir(), 'sfc-input-contract-')))
  roots.push(root)
  const file = path.join(root, 'template.html')
  await writeFile(file, '<view>before</view>')
  const ctx = { configService: { isDev: true } } as CompilerContext
  const host = getCompilerHmrHost(ctx)
  host.onDependencyChange = vi.fn()
  host.captureRaw(file, '<view>before</view>')
  const observer = vi.fn()
  releases.push(observeCompilerInputs(ctx.configService, observer))
  const options = createSfcResolveSrcOptions({}, ctx.configService)
  return { ctx, host, file, observer, options }
}

it.each([undefined, false, true])('passes checkMtime=%s through the unified SFC block input reader', async (checkMtime) => {
  const { host, file, observer, options } = await fixture()
  const readOptions = checkMtime === undefined ? undefined : { checkMtime }
  mocks.readFile.mockResolvedValueOnce('<view>read</view>')
  await expect(options.readFile!(file, readOptions)).resolves.toBe('<view>read</view>')
  expect(mocks.readFile).toHaveBeenCalledExactlyOnceWith(file, readOptions)
  expect(host.readSource(file)).toBe('<view>read</view>')
  expect(observer).toHaveBeenCalledExactlyOnceWith(compilerSourceId(file), '<view>read</view>')
})

it('keeps pinned empty SFC block bytes out of the live ledger and cached reader', async () => {
  const { ctx, host, file, observer } = await fixture()
  setCompilerSourceSnapshot(ctx.configService, new Map([[compilerSourceId(file), '']]))
  const options = createSfcResolveSrcOptions({}, ctx.configService)
  await expect(options.readFile!(file, { checkMtime: true })).resolves.toBe('')
  expect(mocks.readFile).not.toHaveBeenCalled()
  expect(host.readSource(file)).toBe('<view>before</view>')
  expect(observer).toHaveBeenCalledExactlyOnceWith(compilerSourceId(file), '')
})

it('rejects a removed frozen SFC block without falling back to cached disk bytes', async () => {
  const { ctx, host, file, observer } = await fixture()
  setCompilerSourceSnapshot(ctx.configService, new Map([[compilerSourceId(file), null]]))
  const options = createSfcResolveSrcOptions({}, ctx.configService)
  await expect(options.readFile!(file)).rejects.toThrow('Source removed from compiler snapshot:')
  expect(mocks.readFile).not.toHaveBeenCalled()
  expect(host.readSource(file)).toBe('<view>before</view>')
  expect(observer).not.toHaveBeenCalled()
})

it('accepts a concurrent SFC block capture when it contains exactly the returned bytes', async () => {
  const { host, file, observer, options } = await fixture()
  const pending = Promise.withResolvers<string>()
  mocks.readFile.mockReturnValueOnce(pending.promise)
  const reading = options.readFile!(file)
  host.captureRaw(file, '<view>current</view>', false)
  pending.resolve('<view>current</view>')
  await expect(reading).resolves.toBe('<view>current</view>')
  expect(host.readSource(file)).toBe('<view>current</view>')
  expect(observer).toHaveBeenCalledExactlyOnceWith(compilerSourceId(file), '<view>current</view>')
})

it('rejects a late SFC block read when the same config belongs to a replacement host', async () => {
  const { ctx, host, file, observer, options } = await fixture()
  const pending = Promise.withResolvers<string>()
  mocks.readFile.mockReturnValueOnce(pending.promise)
  const reading = options.readFile!(file)
  const replacement = getCompilerHmrHost({ configService: ctx.configService } as CompilerContext)
  replacement.onDependencyChange = vi.fn()
  replacement.captureRaw(file, '<view>replacement</view>', false)
  pending.resolve('<view>before</view>')
  await expect(reading).rejects.toBeInstanceOf(CompilerHmrResyncError)
  expect(host.readSource(file)).toBe('<view>before</view>')
  expect(replacement.readSource(file)).toBe('<view>replacement</view>')
  expect(observer).not.toHaveBeenCalled()
})

it('preserves the original SFC block read error after its session owner changes', async () => {
  const { host, file, observer, options } = await fixture()
  const pending = Promise.withResolvers<string>()
  const failure = Object.assign(new Error('source denied'), { code: 'EPERM' })
  mocks.readFile.mockReturnValueOnce(pending.promise)
  const reading = options.readFile!(file)
  host.onDependencyChange = vi.fn()
  pending.reject(failure)
  await expect(reading).rejects.toBe(failure)
  expect(host.readSource(file)).toBe('<view>before</view>')
  expect(observer).not.toHaveBeenCalled()
})
