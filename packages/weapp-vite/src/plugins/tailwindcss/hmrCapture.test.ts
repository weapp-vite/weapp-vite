import type { ViteDevServer } from 'vite'
import type { CompilerContext } from '../../context'
import { EventEmitter } from 'node:events'
import { readFileSync } from 'node:fs'
import { mkdtemp, realpath, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { fs } from '@weapp-core/shared/fs'
import path from 'pathe'
import { afterEach, expect, it, vi } from 'vitest'
import { CompilerHmrResyncError, compilerSourceId, getCompilerHmrHost } from '../compilerPlugin/hmr'
import { readCompilerRawInput } from '../compilerPlugin/rawInputs'
import { createTailwindHmrAdapter } from './hmr'
import { createTailwindHmrSources } from './hmrSources'

const roots: string[] = []

vi.mock('node:fs', async (importOriginal) => {
  const original = await importOriginal<typeof import('node:fs')>()
  return { ...original, readFileSync: vi.fn(original.readFileSync) }
})

afterEach(async () => {
  vi.mocked(readFileSync).mockReset()
  const original = await vi.importActual<typeof import('node:fs')>('node:fs')
  vi.mocked(readFileSync).mockImplementation(original.readFileSync)
  await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })))
})

async function fixture() {
  const root = await realpath(await mkdtemp(path.join(tmpdir(), 'tailwind-input-capture-')))
  roots.push(root)
  const file = path.join(root, 'page.vue')
  const previous = '<template><view class="w-[37px]" /></template><script setup>const value = "before"</script>'
  const current = previous.replace('"before"', '"restored"')
  await writeFile(file, previous)
  const ctx = { configService: { cwd: root, outDir: path.join(root, 'dist') } } as CompilerContext
  const host = getCompilerHmrHost(ctx)
  const adapter = createTailwindHmrAdapter(ctx, {
    compiler: async () => { throw new Error('Input capture must not initialize the Tailwind compiler') },
    render: async () => {},
  })
  host.captureRaw(file, previous, false, readCompilerRawInput(file)!)
  await writeFile(file, current)
  const read = readCompilerRawInput(file)!
  host.captureRaw(file, read.source, false, read)
  return { file, current, host, adapter, ctx }
}

it('does not replace current raw input with a tombstone when a late unlink arrives after atomic recreation', async () => {
  const { file, current, host, adapter } = await fixture()
  const revision = host.sourceRevision(file)
  const frozen = host.freeze([file])
  const capture = vi.spyOn(host, 'capture')

  await adapter.captureFile(file, true)

  expect(host.readSource(file)).toBe(current)
  expect(host.sourceRevision(file)).toBe(revision)
  expect(host.freeze([file]).sources.get(compilerSourceId(file))).toBe(current)
  expect(frozen.sources.get(compilerSourceId(file))).toBe(current)
  expect(capture).not.toHaveBeenCalledWith(file, null)
})

it.each(['ENOENT', 'ENOTDIR'] as const)('does not erase newer raw input after a transient %s while the source still exists', async (code) => {
  const { file, current, host, adapter } = await fixture()
  const revision = host.sourceRevision(file)
  const missing = Object.assign(new Error('atomic-save read temporarily missed the source'), { code })
  vi.mocked(readFileSync).mockImplementationOnce(() => {
    throw missing
  })
  let failure: unknown
  try {
    await adapter.captureFile(file, false)
  }
  catch (error) {
    failure = error
  }

  expect(host.readSource(file)).toBe(current)
  expect(host.sourceRevision(file)).toBe(revision)
  expect(host.freeze([file]).sources.get(compilerSourceId(file))).toBe(current)
  if (failure !== undefined) {
    expect(failure === missing || failure instanceof CompilerHmrResyncError).toBe(true)
  }
})

it.each([false, true])('records an actual deletion after the source has disappeared (unlink: %s)', async (deleted) => {
  const { file, current, host, adapter } = await fixture()
  const frozen = host.freeze([file])
  await rm(file)

  await adapter.captureFile(file, deleted)

  expect(host.readSource(file)).toBeNull()
  expect(host.freeze([file]).sources.get(compilerSourceId(file))).toBeNull()
  expect(frozen.sources.get(compilerSourceId(file))).toBe(current)
})

it.each(['EPERM', 'EIO'] as const)('preserves the original %s error and newer raw input', async (code) => {
  const { file, current, host, adapter } = await fixture()
  const revision = host.sourceRevision(file)
  const failure = Object.assign(new Error('raw source read failed'), { code })
  vi.mocked(readFileSync).mockImplementationOnce(() => {
    throw failure
  })

  await expect(Promise.resolve().then(() => adapter.captureFile(file, false))).rejects.toBe(failure)
  expect(host.readSource(file)).toBe(current)
  expect(host.sourceRevision(file)).toBe(revision)
  expect(host.freeze([file]).sources.get(compilerSourceId(file))).toBe(current)
})

it('keeps deletion and capture ownership isolated between compiler contexts', async () => {
  const first = await fixture()
  const second = await fixture()
  const revision = second.host.sourceRevision(second.file)
  await rm(first.file)

  await first.adapter.captureFile(first.file, true)

  expect(first.host.readSource(first.file)).toBeNull()
  expect(second.host.readSource(second.file)).toBe(second.current)
  expect(second.host.sourceRevision(second.file)).toBe(revision)
})

it('does not capture after repeated disposal while atomic-save verification is pending', async () => {
  const { file, current, host, adapter } = await fixture()
  const checked = Promise.withResolvers<void>()
  const release = Promise.withResolvers<boolean>()
  const probe = vi.spyOn(fs, 'pathExists').mockImplementationOnce(async () => {
    checked.resolve()
    return release.promise
  })
  try {
    const capture = adapter.captureFile(file, true)
    await checked.promise
    adapter.dispose()
    adapter.dispose()
    await writeFile(file, 'source saved after disposal')
    release.resolve(true)
    await capture
    expect(host.readSource(file)).toBe(current)
  }
  finally {
    release.resolve(true)
    probe.mockRestore()
  }
})

it('captures the latest atomic recreation when another save completes during delete verification', async () => {
  const { file, host, adapter } = await fixture()
  await rm(file)
  const checked = Promise.withResolvers<void>()
  const release = Promise.withResolvers<boolean>()
  const probe = vi.spyOn(fs, 'pathExists').mockImplementationOnce(async () => {
    checked.resolve()
    return release.promise
  })
  try {
    const capture = adapter.captureFile(file, true)
    await checked.promise
    const next = 'latest source saved during atomic verification'
    await writeFile(file, next)
    host.captureRaw(file, next, false)
    const revision = host.sourceRevision(file)
    release.resolve(false)
    await capture
    expect(host.readSource(file)).toBe(next)
    expect(host.sourceRevision(file)).toBe(revision)
  }
  finally {
    release.resolve(false)
    probe.mockRestore()
  }
})

async function watcherFixture() {
  const app = await fixture()
  const sources = createTailwindHmrSources(app.ctx, new Map([[0, { sources: [], matches: () => true }]]), new Set([compilerSourceId(app.file)]), new Set())
  const watcher = Object.assign(new EventEmitter(), { add: vi.fn() })
  const reported = Promise.withResolvers<void>()
  const error = vi.fn<ViteDevServer['config']['logger']['error']>(() => reported.resolve())
  const server = { watcher, config: { logger: { error } } } as unknown as ViteDevServer
  app.host.onDependencyChange = vi.fn()
  sources.configureServer(server)
  return { ...app, sources, server, watcher, error, reported }
}

it.each(['change', 'unlink'] as const)('reports %s capture failures without rejecting an EventEmitter callback or notifying consumers', async (event) => {
  const { file, current, host, sources, watcher, error, reported } = await watcherFixture()
  const failure = Object.assign(new Error('watcher source read failed'), { code: 'EPERM' })
  vi.mocked(readFileSync).mockImplementationOnce(() => {
    throw failure
  })
  try {
    expect(() => watcher.emit(event, file)).not.toThrow()
    await reported.promise
    expect(error).toHaveBeenCalledExactlyOnceWith('Tailwind source input capture failed', { error: failure })
    expect(error.mock.calls[0]?.[1]?.error).toBe(failure)
    expect(host.readSource(file)).toBe(current)
    expect(host.onDependencyChange).not.toHaveBeenCalled()
  }
  finally {
    sources.dispose()
  }
})

it('ignores a previous watcher binding after reconfiguration while delete verification is pending', async () => {
  const { file, current, host, sources, server, watcher } = await watcherFixture()
  const checked = Promise.withResolvers<void>()
  const release = Promise.withResolvers<boolean>()
  const probe = vi.spyOn(fs, 'pathExists').mockImplementationOnce(async () => {
    checked.resolve()
    return release.promise
  })
  const external = vi.fn()
  watcher.on('change', external)
  try {
    watcher.emit('unlink', file)
    await checked.promise
    sources.configureServer(server)
    await writeFile(file, 'source saved after watcher replacement')
    release.resolve(true)
    // 队列已明确释放；下一轮事件循环核验旧订阅不再捕获或交付。
    await new Promise(resolve => setImmediate(resolve))
    expect(host.readSource(file)).toBe(current)
    expect(host.onDependencyChange).not.toHaveBeenCalled()
    sources.dispose()
    sources.dispose()
    expect(watcher.listeners('change')).toEqual([external])
    expect(watcher.listenerCount('unlink')).toBe(0)
  }
  finally {
    release.resolve(true)
    probe.mockRestore()
    sources.dispose()
  }
})
