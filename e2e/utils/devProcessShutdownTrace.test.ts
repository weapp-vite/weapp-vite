/* eslint-disable e18e/ban-dependencies -- 原生 Node 子进程验证诊断不会引用 IPC 或改变退出结果。 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { execa } from 'execa'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { withDevProcessShutdownTrace } from './devProcessShutdownTrace'
import { startRuntimeDevProcess } from './runtimeDevProcess'

const mocks = vi.hoisted(() => ({ start: vi.fn(() => ({ pid: 17 })) }))
vi.mock('./dev-process', () => ({ startDevProcess: mocks.start }))

interface Observation {
  event: string
  eventName?: string
  listener?: string
  listeners?: Record<string, string[]>
}

describe('optional native CLI shutdown observation', () => {
  let directory: string

  beforeEach(() => {
    directory = fs.mkdtempSync(path.join(os.tmpdir(), 'dev-shutdown-trace-'))
    vi.stubEnv('WEAPP_VITE_E2E_DEV_SHUTDOWN_TRACE', '1')
    vi.stubEnv('WEAPP_VITE_E2E_DEV_PROCESS_TRACE_DIR', directory)
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.clearAllMocks()
    fs.rmSync(directory, { recursive: true, force: true })
  })

  function observations(): Observation[] {
    return fs.readdirSync(directory).filter(file => file.endsWith('.jsonl')).flatMap(file => fs.readFileSync(path.join(directory, file), 'utf8').trim().split('\n').map(line => JSON.parse(line) as Observation))
  }

  async function child(script: string, env = withDevProcessShutdownTrace(process.env)) {
    return await execa(process.execPath, ['--input-type=module', '-e', script], {
      env,
      extendEnv: false,
      ipc: true,
      timeout: 10_000,
      reject: false,
    })
  }

  it('preserves the prepared environment and all launcher options while appending a native preload', async () => {
    const env = { NODE_OPTIONS: '--no-warnings', CHILD_ONLY: 'kept' }
    const options = { cwd: directory, env, all: true, reject: false, stdin: 'ignore' as const }
    await startRuntimeDevProcess('wv', ['entry.js', 'dev'], options)
    expect(mocks.start).toHaveBeenCalledWith(process.execPath, ['entry.js', 'dev'], {
      ...options,
      ipc: true,
      env: {
        CHILD_ONLY: 'kept',
        NODE_OPTIONS: expect.stringMatching(/^--no-warnings --import=file:/),
        WEAPP_VITE_DEV_SHUTDOWN_TRACE_DIR: directory,
        WEAPP_VITE_DEV_SHUTDOWN_TRACE_ID: expect.any(String),
      },
    })
    expect(env).toEqual({ NODE_OPTIONS: '--no-warnings', CHILD_ONLY: 'kept' })
  })

  it('does not prepare observation unless explicitly enabled', () => {
    vi.stubEnv('WEAPP_VITE_E2E_DEV_SHUTDOWN_TRACE', undefined)
    const env = { NODE_OPTIONS: '--no-warnings' }
    expect(withDevProcessShutdownTrace(env)).toBe(env)
    expect(withDevProcessShutdownTrace(undefined)).toBeUndefined()
    expect(fs.readdirSync(directory)).toEqual([])
  })

  it('does not add listeners or retain an otherwise unreferenced native IPC channel', async () => {
    const result = await child(`
      import assert from 'node:assert/strict'
      for (const event of ['disconnect', 'beforeExit', 'exit', 'SIGINT', 'SIGTERM']) {
        assert.equal(process.listenerCount(event), 0, event)
      }
      console.log('naturally-finished')
    `, withDevProcessShutdownTrace({ ...process.env, PRIVATE_DIAGNOSTIC_VALUE: 'must-not-be-recorded' }))
    expect(result.timedOut).toBe(false)
    expect(result.exitCode).toBe(0)
    expect(result.signal).toBeUndefined()
    expect(result.stdout).toBe('naturally-finished')
    const events = observations()
    expect(events.map(event => event.event)).toEqual(['OBSERVER_READY', 'BEFORE_EXIT_0', 'PROCESS_EXIT_0'])
    expect(JSON.stringify(events)).not.toContain('must-not-be-recorded')
  })

  it('preserves event return values, thrown errors and listener removal while every diagnostic timer is unreferenced', async () => {
    const result = await child(`
      import assert from 'node:assert/strict'
      import { EventEmitter } from 'node:events'
      const timers = []
      const nativeTimer = globalThis.setTimeout
      globalThis.setTimeout = (...args) => {
        const timer = nativeTimer(...args)
        timers.push(timer)
        return timer
      }
      const onSigterm = () => {}
      function onDisconnect() { process.off('SIGTERM', onSigterm) }
      process.on('SIGTERM', onSigterm)
      process.on('disconnect', onDisconnect)
      assert.equal(process.emit('disconnect'), true)
      assert.equal(process.off('disconnect', onDisconnect), process)
      assert.equal(process.listenerCount('SIGTERM'), 0)
      assert.equal(process.listenerCount('disconnect'), 0)
      const failure = new Error('original listener failure')
      process.once('disconnect', () => { throw failure })
      assert.throws(() => process.emit('disconnect'), error => error === failure)
      assert.equal(process.emit('unused-diagnostic-event'), false)
      const foreign = new EventEmitter()
      let seen = false
      const listener = () => { seen = true }
      foreign.on('example', listener)
      assert.equal(process.emit.call(foreign, 'example'), true)
      assert.equal(seen, true)
      assert.equal(process.removeListener.call(foreign, 'example', listener), foreign)
      assert.equal(timers.length, 12)
      assert.equal(timers.every(timer => !timer.hasRef()), true)
      console.log('original-control-flow-preserved')
    `)
    expect(result.timedOut).toBe(false)
    expect(result.exitCode).toBe(0)
    expect(result.stdout).toBe('original-control-flow-preserved')
    const events = observations()
    expect(events).toContainEqual(expect.objectContaining({ event: 'LISTENER_REMOVED', eventName: 'SIGTERM', listener: 'onSigterm' }))
    expect(events.filter(event => event.event === 'IPC_DISCONNECT_AFTER')).toHaveLength(2)
    expect(events.at(-1)?.event).toBe('PROCESS_EXIT_0')
  })

  it('retains a diagnostic setup failure without changing natural exit', async () => {
    const invalidDirectory = path.join(directory, 'regular-file')
    fs.writeFileSync(invalidDirectory, 'not a directory')
    const env = withDevProcessShutdownTrace(process.env)!
    const result = await child('console.log("still-finished")', { ...env, WEAPP_VITE_DEV_SHUTDOWN_TRACE_DIR: invalidDirectory })
    expect(result.timedOut).toBe(false)
    expect(result.exitCode).toBe(0)
    expect(result.stdout).toBe('still-finished')
    expect(result.stderr).toContain('[dev-shutdown-trace-error]')
  })

  it('restores exact method descriptors and timers idempotently without replacing subsequent caller changes', async () => {
    const preload = new URL('./devProcessShutdownTrace/preload.mjs', import.meta.url).href
    const env = withDevProcessShutdownTrace(process.env)!
    const result = await child(`
      import assert from 'node:assert/strict'
      const original = Object.fromEntries(['emit', 'off', 'removeListener'].map(method => [method, Object.getOwnPropertyDescriptor(process, method)]))
      const timers = new Set()
      const nativeTimer = globalThis.setTimeout
      const nativeClear = globalThis.clearTimeout
      globalThis.setTimeout = (...args) => {
        const timer = nativeTimer(...args)
        timers.add(timer)
        return timer
      }
      globalThis.clearTimeout = timer => {
        timers.delete(timer)
        return nativeClear(timer)
      }
      const observer = await import(${JSON.stringify(preload)})
      assert.equal(process.emit('disconnect'), false)
      assert.equal(timers.size, 6)
      observer.restoreDevProcessShutdownTrace()
      observer.restoreDevProcessShutdownTrace()
      assert.equal(timers.size, 0)
      for (const method of ['emit', 'off', 'removeListener']) {
        assert.deepEqual(Object.getOwnPropertyDescriptor(process, method), original[method])
      }
      const replacement = () => 'caller-owned'
      Object.defineProperty(process, 'off', { configurable: true, writable: true, value: replacement })
      observer.restoreDevProcessShutdownTrace()
      assert.equal(process.off, replacement)
      console.log('restored-exactly')
    `, { ...env, NODE_OPTIONS: process.env.NODE_OPTIONS ?? '' })
    expect(result.timedOut).toBe(false)
    expect(result.exitCode).toBe(0)
    expect(result.stdout).toBe('restored-exactly')
    expect(observations().map(event => event.event)).toEqual(['OBSERVER_READY', 'IPC_DISCONNECT_BEFORE', 'IPC_DISCONNECT_AFTER'])
  })
})
