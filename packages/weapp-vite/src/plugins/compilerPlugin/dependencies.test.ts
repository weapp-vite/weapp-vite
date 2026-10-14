import type { ViteDevServer } from 'vite'
import type { CompilerContext } from '../../context'
import { EventEmitter } from 'node:events'
import { mkdir, mkdtemp, realpath, rm, symlink, unlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { expect, it, vi } from 'vitest'
import { createSnapshotAssetInputs } from '../../runtime/statefulHmr/snapshotAssetInputs'
import { createCompilerDependencyTracker } from './dependencies'
import { CompilerHmrResyncError, compilerSourceId, getCompilerHmrHost, getCompilerRawSnapshot } from './hmr'

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

it('registers a real dependency read as raw after an earlier asset loader loses executable classification', async () => {
  const directory = await realpath(await mkdtemp(path.join(tmpdir(), 'compiler-raw-asset-')))
  const file = path.join(directory, 'logo.svg')
  const watcher = new EventEmitter()
  const ctx = { configService: { isDev: true } } as CompilerContext
  const tracker = createCompilerDependencyTracker(ctx)
  const host = getCompilerHmrHost(ctx)
  host.onDependencyChange = vi.fn()
  try {
    await writeFile(file, '<svg>before</svg>')
    tracker.remember(file)
    host.captureNative(file, 'export default "/assets/logo.svg"')
    host.setNativeSources([])
    tracker.configureServer({ watcher } as unknown as ViteDevServer)
    await writeFile(file, '<svg>after</svg>')
    watcher.emit('change', file)
    expect(host.readSource(file)).toBe('<svg>after</svg>')
    expect(host.ownsRawSource(file)).toBe(true)
    expect(getCompilerRawSnapshot(host.freeze([]).sources)?.files.has(compilerSourceId(file))).toBe(true)
    await writeFile(file, '<svg>next</svg>')
    watcher.emit('change', file)
    expect(host.readSource(file)).toBe('<svg>next</svg>')
    expect(host.onDependencyChange).toHaveBeenCalledTimes(2)
    host.setNativeSources([file])
    watcher.emit('change', file)
    expect(host.onDependencyChange).toHaveBeenCalledTimes(2)
  }
  finally {
    tracker.dispose()
    await rm(directory, { recursive: true, force: true })
  }
})

it('admits unchanged binary bytes after a real dependency watcher has refreshed the asset input', async () => {
  const directory = await realpath(await mkdtemp(path.join(tmpdir(), 'compiler-binary-asset-')))
  const file = path.join(directory, 'binary.asset')
  const watcher = new EventEmitter()
  const ctx = { configService: { isDev: true } } as CompilerContext
  const tracker = createCompilerDependencyTracker(ctx)
  const host = getCompilerHmrHost(ctx)
  try {
    await writeFile(file, new Uint8Array([255]))
    tracker.remember(file)
    const initial = host.freeze([])
    host.captureNative(file, 'export default "/assets/binary.asset"')
    host.setNativeSources([])
    tracker.configureServer({ watcher } as unknown as ViteDevServer)
    await writeFile(file, new Uint8Array([254]))
    watcher.emit('change', file)
    const initialAdmission = createSnapshotAssetInputs(initial.sources)
    initialAdmission.configure(id => id.endsWith('.asset'))
    expect(() => initialAdmission.capture(file)).toThrow(CompilerHmrResyncError)
    const admission = createSnapshotAssetInputs(host.freeze([]).sources)
    expect(() => {
      admission.configure(id => id.endsWith('.asset'))
      admission.capture(file)
      admission.validate()
    }).not.toThrow()
    await unlink(file)
    watcher.emit('unlink', file)
    const tombstone = host.freeze([])
    const removedAdmission = createSnapshotAssetInputs(tombstone.sources)
    removedAdmission.configure(id => id.endsWith('.asset'))
    expect(() => removedAdmission.validate()).not.toThrow()
    expect(() => removedAdmission.capture(file)).toThrow(CompilerHmrResyncError)
    await writeFile(file, new Uint8Array([253]))
    watcher.emit('add', file)
    const recovered = createSnapshotAssetInputs(host.freeze([]).sources)
    recovered.configure(id => id.endsWith('.asset'))
    expect(() => recovered.capture(file)).not.toThrow()
    expect(() => recovered.validate()).not.toThrow()
    expect(() => removedAdmission.capture(file)).toThrow(CompilerHmrResyncError)
  }
  finally {
    tracker.dispose()
    await rm(directory, { recursive: true, force: true })
  }
})

it('records a removed lexical alias at its new tombstone without nulling its old physical source', async () => {
  const directory = await realpath(await mkdtemp(path.join(tmpdir(), 'compiler-alias-tombstone-')))
  const physical = path.join(directory, 'physical')
  const replacement = path.join(directory, 'replacement')
  await mkdir(physical)
  await mkdir(replacement)
  const file = path.join(physical, 'logo.asset')
  await writeFile(file, 'frozen asset')
  const alias = path.join(directory, 'alias')
  await symlink(physical, alias, 'junction')
  const aliasFile = path.join(alias, 'logo.asset')
  const watcher = new EventEmitter()
  const ctx = { configService: { isDev: true } } as CompilerContext
  const tracker = createCompilerDependencyTracker(ctx)
  const host = getCompilerHmrHost(ctx)
  try {
    tracker.remember(aliasFile)
    const oldInput = host.freeze([])
    tracker.configureServer({ watcher } as unknown as ViteDevServer)
    await unlink(alias)
    await symlink(replacement, alias, 'junction')
    watcher.emit('unlink', aliasFile)
    const input = host.freeze([])
    expect(input.sources.get(compilerSourceId(file))).toBe('frozen asset')
    expect(input.sources.get(compilerSourceId(aliasFile))).toBeNull()
    expect(host.ownsDependency(aliasFile)).toBe(true)
    const admission = createSnapshotAssetInputs(input.sources)
    expect(() => admission.configure(() => true)).not.toThrow()
    expect(() => admission.validate()).not.toThrow()
    expect(() => admission.capture(aliasFile)).toThrow(CompilerHmrResyncError)
    expect(() => createSnapshotAssetInputs(oldInput.sources).configure(() => true)).toThrow(CompilerHmrResyncError)
    await writeFile(path.join(replacement, 'logo.asset'), 'recovered asset')
    watcher.emit('add', aliasFile)
    const recovered = createSnapshotAssetInputs(host.freeze([]).sources)
    expect(() => {
      recovered.configure(() => true)
      recovered.capture(aliasFile)
      recovered.validate()
    }).not.toThrow()
    expect(host.readSource(file)).toBe('frozen asset')
  }
  finally {
    tracker.dispose()
    await rm(directory, { recursive: true, force: true })
  }
})
