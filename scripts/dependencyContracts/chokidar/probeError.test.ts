import fs from 'node:fs'
import path from 'node:path'
import { afterEach, expect, it, vi } from 'vitest'
import { createContext } from './context.mjs'

const native = vi.hoisted(() => ({ install: vi.fn() }))

vi.mock('./support.mjs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./support.mjs')>()
  return { ...actual, installNativeInstrumentation: native.install }
})

interface HookArguments {
  file: string
  original: () => Promise<unknown>
}

type Hook = (arguments_: HookArguments) => Promise<unknown>

interface InstrumentationOptions {
  beforeWatch: (file: string) => void
  promiseHooks: Partial<Record<'lstat' | 'stat', Hook>>
}

afterEach(() => {
  vi.restoreAllMocks()
  native.install.mockClear()
})

function fixture() {
  vi.spyOn(fs, 'rmSync').mockImplementation(() => {})
  const context = createContext({
    id: 'missing-probe-error-win32-propagates-original',
    kind: 'classify',
    platform: 'win32',
    remove: true,
    probeError: true,
  }, path.join('fixture', 'probe'))
  context.install()
  const options = native.install.mock.calls[0]![0] as InstrumentationOptions
  const invoke = (method: 'lstat' | 'stat', file: string, original: HookArguments['original']) => {
    const hook = options.promiseHooks[method]
    return hook ? hook({ file, original }) : original()
  }
  const injectWatchError = () => {
    expect(() => options.beforeWatch(context.target)).toThrow('exact directory native registration failure')
    expect(context.injected).toBe(1)
  }
  return { context, invoke, injectWatchError }
}

it('leaves stat on the removed target native after injecting the exact watch error', async () => {
  const ctx = fixture()
  const missing = Object.assign(new Error('the target is really absent'), { code: 'ENOENT' })
  const original = vi.fn(async () => {
    throw missing
  })
  ctx.injectWatchError()
  await expect(ctx.invoke('stat', ctx.context.target, original)).rejects.toBe(missing)
  expect(original).toHaveBeenCalledExactlyOnceWith()
  expect(ctx.context.probeErrorCount).toBe(0)
})

it('injects only the first exact lstat after the watch error and restores subsequent native reads', async () => {
  const ctx = fixture()
  const missing = Object.assign(new Error('the target is really absent'), { code: 'ENOENT' })
  const original = vi.fn(async () => {
    throw missing
  })
  ctx.injectWatchError()
  await expect(ctx.invoke('lstat', ctx.context.target, original)).rejects.toMatchObject({
    code: 'EACCES',
    syscall: 'lstat',
    path: ctx.context.target,
    message: 'presence probe denied',
  })
  expect(original).not.toHaveBeenCalled()
  await expect(ctx.invoke('lstat', ctx.context.target, original)).rejects.toBe(missing)
  await expect(ctx.invoke('stat', ctx.context.target, original)).rejects.toBe(missing)
  expect(original).toHaveBeenCalledTimes(2)
  expect(ctx.context.probeErrorCount).toBe(1)
})

it('keeps reads before the watch error and reads of sibling paths outside the injection', async () => {
  const ctx = fixture()
  const result = { native: true }
  const original = vi.fn(async () => result)
  expect(await ctx.invoke('lstat', ctx.context.target, original)).toBe(result)
  expect(await ctx.invoke('stat', ctx.context.target, original)).toBe(result)
  ctx.injectWatchError()
  const sibling = path.join(ctx.context.watched, 'sibling')
  expect(await ctx.invoke('lstat', sibling, original)).toBe(result)
  expect(await ctx.invoke('stat', sibling, original)).toBe(result)
  expect(ctx.context.probeErrorCount).toBe(0)
  await expect(ctx.invoke('lstat', ctx.context.target, original)).rejects.toMatchObject({ code: 'EACCES' })
  expect(ctx.context.probeErrorCount).toBe(1)
  expect(original).toHaveBeenCalledTimes(4)
})

it('preserves genuine errors from later target and sibling reads without replacing their identity', async () => {
  const ctx = fixture()
  ctx.injectWatchError()
  await expect(ctx.invoke('lstat', ctx.context.target, async () => 'unused')).rejects.toMatchObject({ code: 'EACCES' })
  const nativeError = Object.assign(new Error('later native permission failure'), { code: 'EACCES' })
  const original = vi.fn(async () => {
    throw nativeError
  })
  for (const method of ['lstat', 'stat'] as const) {
    await expect(ctx.invoke(method, ctx.context.target, original)).rejects.toBe(nativeError)
    await expect(ctx.invoke(method, path.join(ctx.context.watched, 'sibling'), original)).rejects.toBe(nativeError)
  }
  expect(original).toHaveBeenCalledTimes(4)
  expect(ctx.context.probeErrorCount).toBe(1)
})
