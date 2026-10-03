import type { ViteDevServer } from 'vite'
import type { CompilerContext } from '../../context'
import { EventEmitter } from 'node:events'
import { mkdtemp, realpath, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { expect, it, vi } from 'vitest'
import { createCompilerDependencyTracker } from './dependencies'
import { compilerSourceId, getCompilerHmrHost } from './hmr'

it('freezes declared dependency content and removes listeners when its server closes', async () => {
  const directory = await realpath(await mkdtemp(path.join(tmpdir(), 'compiler-dependency-')))
  const file = path.join(directory, 'tokens.json')
  const watcher = new EventEmitter()
  const httpServer = new EventEmitter()
  const ctx = { configService: { isDev: true } } as CompilerContext
  const tracker = createCompilerDependencyTracker(ctx)
  const host = getCompilerHmrHost(ctx)
  host.onDependencyChange = vi.fn()
  try {
    await writeFile(file, 'red')
    tracker.remember(file)
    const first = host.freeze([file])
    tracker.configureServer({ watcher, httpServer } as unknown as ViteDevServer)
    await writeFile(file, 'blue')
    watcher.emit('change', file)
    expect(first.sources.get(compilerSourceId(file))).toBe('red')
    expect(host.freeze([file]).sources.get(compilerSourceId(file))).toBe('blue')
    expect(host.onDependencyChange).toHaveBeenCalledExactlyOnceWith(compilerSourceId(file))
    host.setNativeSources([file])
    watcher.emit('change', file)
    expect(host.onDependencyChange).toHaveBeenCalledTimes(1)
    httpServer.emit('close')
    expect(watcher.listenerCount('change')).toBe(0)
    expect(watcher.listenerCount('unlink')).toBe(0)
  }
  finally {
    await rm(directory, { recursive: true, force: true })
  }
})

it('keeps concurrent source dependencies separate and clears middleware-mode listeners on disposal', async () => {
  const replaceTransformDependencies = vi.fn()
  const tracker = createCompilerDependencyTracker({
    configService: { isDev: false },
    moduleGraphService: { replaceTransformDependencies },
  } as unknown as CompilerContext)
  await Promise.all(['first', 'second'].map(id => tracker.trackSource(id, async () => {
    tracker.remember(`${id}.tokens`)
    await Promise.resolve()
    tracker.remember(`${id}.more`)
  })))
  expect(replaceTransformDependencies).toHaveBeenCalledWith('first', new Set(['first.tokens', 'first.more']))
  expect(replaceTransformDependencies).toHaveBeenCalledWith('second', new Set(['second.tokens', 'second.more']))
  await tracker.trackSource('first', async () => undefined)
  expect(replaceTransformDependencies).toHaveBeenLastCalledWith('first', new Set())
  const watcher = new EventEmitter()
  tracker.configureServer({ watcher } as unknown as ViteDevServer)
  tracker.dispose()
  tracker.dispose()
  expect(watcher.listenerCount('change')).toBe(0)
  expect(watcher.listenerCount('add')).toBe(0)
})
