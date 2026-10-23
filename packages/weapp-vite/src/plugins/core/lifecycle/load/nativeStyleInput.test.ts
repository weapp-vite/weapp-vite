import type { CompilerContext } from '../../../../context'
import type { CorePluginState } from '../../helpers'
import { mkdtemp, realpath, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'pathe'
import { afterEach, expect, it, vi } from 'vitest'
import { createRuntimeState } from '../../../../runtime/runtimeState'
import { CompilerHmrResyncError, compilerSourceId, getCompilerHmrHost } from '../../../compilerPlugin/hmr'
import { observeCompilerInputs, setCompilerSourceSnapshot } from '../../../utils/sourceSnapshot'
import { createLoadHook } from './index'

const mocks = vi.hoisted(() => ({
  readFile: vi.fn<(file: string, options?: { checkMtime?: boolean }) => Promise<string>>(),
}))

vi.mock('../../../utils/cache', async importOriginal => ({
  ...await importOriginal<typeof import('../../../utils/cache')>(),
  readFile: mocks.readFile,
}))

const roots: string[] = []
const releases: Array<() => void> = []
const before = '.probe { width: 10px; }'
const after = '.probe { width: 20px; }'

afterEach(async () => {
  releases.splice(0).forEach(release => release())
  mocks.readFile.mockReset()
  await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })))
})

async function fixture(isDev = true) {
  const root = await realpath(await mkdtemp(path.join(tmpdir(), 'native-style-input-')))
  roots.push(root)
  const file = path.join(root, 'page.wxss')
  await writeFile(file, before)
  const ctx = {
    configService: { isDev, platform: 'weapp', weappViteConfig: {}, packageJson: {} },
    runtimeState: createRuntimeState(),
  } as CompilerContext
  const host = getCompilerHmrHost(ctx)
  host.onDependencyChange = vi.fn()
  host.captureRaw(file, before)
  const observer = vi.fn()
  releases.push(observeCompilerInputs(ctx.configService, observer))
  const load = createLoadHook({ ctx } as CorePluginState)
  const request = `${path.join(root, 'page.css')}?nativeStyle=wxss`
  return { ctx, host, file, request, observer, load: (id = request) => load.call({}, id) }
}

it.each([false, true])('preserves cached native-style mtime checks for isDev=%s', async (isDev) => {
  const { host, file, observer, load } = await fixture(isDev)
  mocks.readFile.mockResolvedValueOnce(after)
  await expect(load()).resolves.toEqual({ code: after })
  expect(mocks.readFile).toHaveBeenCalledExactlyOnceWith(file, { checkMtime: isDev })
  expect(host.readSource(file)).toBe(after)
  expect(observer).toHaveBeenCalledExactlyOnceWith(compilerSourceId(file), after)
})

it('rejects a late native-style read without rolling back a newer watcher capture', async () => {
  const { host, file, observer, load } = await fixture()
  const pending = Promise.withResolvers<string>()
  mocks.readFile.mockReturnValueOnce(pending.promise)
  const reading = load()
  host.captureRaw(file, after, false)
  pending.resolve(before)
  await expect(reading).rejects.toBeInstanceOf(CompilerHmrResyncError)
  expect(host.readSource(file)).toBe(after)
  expect(observer).not.toHaveBeenCalled()
})

it('rejects a late native-style read when a replacement host owns the same config', async () => {
  const { ctx, host, file, observer, load } = await fixture()
  const pending = Promise.withResolvers<string>()
  mocks.readFile.mockReturnValueOnce(pending.promise)
  const reading = load()
  const replacement = getCompilerHmrHost({ configService: ctx.configService } as CompilerContext)
  replacement.onDependencyChange = vi.fn()
  replacement.captureRaw(file, after, false)
  pending.resolve(before)
  await expect(reading).rejects.toBeInstanceOf(CompilerHmrResyncError)
  expect(host.readSource(file)).toBe(before)
  expect(replacement.readSource(file)).toBe(after)
  expect(observer).not.toHaveBeenCalled()
})

it('accepts a concurrent native-style capture with the exact returned bytes', async () => {
  const { host, file, observer, load } = await fixture()
  const pending = Promise.withResolvers<string>()
  mocks.readFile.mockReturnValueOnce(pending.promise)
  const reading = load()
  host.captureRaw(file, after, false)
  pending.resolve(after)
  await expect(reading).resolves.toEqual({ code: after })
  expect(host.readSource(file)).toBe(after)
  expect(observer).toHaveBeenCalledExactlyOnceWith(compilerSourceId(file), after)
})

it.each(['nativeStyle=wxss', 'wxss'])('keeps frozen empty bytes for %s out of the live ledger', async (query) => {
  const { ctx, host, file, request, observer, load } = await fixture()
  setCompilerSourceSnapshot(ctx.configService, new Map([[compilerSourceId(file), '']]))
  await expect(load(`${request.split('?')[0]}?${query}`)).resolves.toEqual({ code: '' })
  expect(mocks.readFile).not.toHaveBeenCalled()
  expect(host.readSource(file)).toBe(before)
  expect(observer).toHaveBeenCalledExactlyOnceWith(compilerSourceId(file), '')
})

it('does not replace a frozen removed native style with live cached bytes', async () => {
  const { ctx, host, file, observer, load } = await fixture()
  setCompilerSourceSnapshot(ctx.configService, new Map([[compilerSourceId(file), null]]))
  await expect(load()).rejects.toThrow('Source removed from compiler snapshot:')
  expect(mocks.readFile).not.toHaveBeenCalled()
  expect(host.readSource(file)).toBe(before)
  expect(observer).not.toHaveBeenCalled()
})

it('keeps missing native styles available to later loaders without capturing them', async () => {
  const { host, file, observer, load } = await fixture()
  mocks.readFile.mockRejectedValueOnce(Object.assign(new Error('not found'), { code: 'ENOENT' }))
  await expect(load()).resolves.toBeNull()
  expect(host.readSource(file)).toBe(before)
  expect(observer).not.toHaveBeenCalled()
})

it.each(['EPERM', 'EIO', 'ENOTDIR'])('preserves real native-style read failures with code %s', async (code) => {
  const { host, file, observer, load } = await fixture()
  const failure = Object.assign(new Error('source read failed'), { code })
  mocks.readFile.mockRejectedValueOnce(failure)
  await expect(load()).rejects.toBe(failure)
  expect(host.readSource(file)).toBe(before)
  expect(observer).not.toHaveBeenCalled()
})
