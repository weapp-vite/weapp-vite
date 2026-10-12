import type { ViteDevServer } from 'vite'
import type { CompilerContext } from '../../context'
import { EventEmitter } from 'node:events'
import { mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { createCompilerDependencyTracker } from './dependencies'
import { CompilerHmrResyncError, compilerSourceId, getCompilerHmrHost } from './hmr'
import { readCompilerRawInput } from './rawInputs'

const harness = vi.hoisted(() => ({ afterRead: undefined as (() => void) | undefined, reads: 0 }))
vi.mock('node:fs', async (importOriginal) => {
  const fs = await importOriginal<typeof import('node:fs')>()
  return {
    ...fs,
    readFileSync(...args: Parameters<typeof fs.readFileSync>) {
      const bytes = fs.readFileSync(...args)
      harness.reads++
      const after = harness.afterRead
      harness.afterRead = undefined
      after?.()
      return bytes
    },
  }
})

let directory: string
beforeEach(() => {
  directory = realpathSync(mkdtempSync(path.join(tmpdir(), 'compiler-raw-read-')))
  harness.afterRead = undefined
  harness.reads = 0
})
afterEach(() => {
  harness.afterRead = undefined
  rmSync(directory, { recursive: true, force: true })
})

it('reads bytes once and rejects a file changed between the surrounding version checks', () => {
  const file = path.join(directory, 'data.asset')
  writeFileSync(file, new Uint8Array([255]))
  harness.afterRead = () => writeFileSync(file, new Uint8Array([254, 253]))
  expect(() => readCompilerRawInput(file)).toThrow(CompilerHmrResyncError)
  expect(harness.reads).toBe(1)
  const read = readCompilerRawInput(file)!
  expect(read.byteLength).toBe(2)
  expect(read.source).toBe(readFileSync(file, 'utf8'))
  expect(Object.isFrozen(read)).toBe(true)
})

it('retries a failed first dependency read instead of caching a tombstone', () => {
  const file = path.join(directory, 'data.asset')
  writeFileSync(file, 'first')
  const ctx = { configService: { isDev: true } } as CompilerContext
  const tracker = createCompilerDependencyTracker(ctx)
  harness.afterRead = () => writeFileSync(file, 'second-version')
  expect(() => tracker.remember(file)).toThrow(CompilerHmrResyncError)
  expect(() => tracker.remember(file)).not.toThrow()
  expect(getCompilerHmrHost(ctx).freeze([]).sources.get(compilerSourceId(file))).toBe('second-version')
  expect(harness.reads).toBe(2)
  const watcher = new EventEmitter()
  tracker.configureServer({ watcher } as unknown as ViteDevServer)
  tracker.dispose()
  expect(watcher.listenerCount('change')).toBe(0)
})
