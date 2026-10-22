import { Buffer } from 'node:buffer'
import { ChildProcess } from 'node:child_process'
import process from 'node:process'
import { PassThrough } from 'node:stream'
import { afterEach, expect, it, vi } from 'vitest'
import { observeWindowsCompilerChild } from './windowsCompilerChildTrace'

function compilerChild(pid?: number) {
  const child = new ChildProcess()
  Object.assign(child, { pid, stdout: new PassThrough(), stderr: new PassThrough() })
  return child
}

afterEach(() => vi.restoreAllMocks())

it('records compiler lifecycle timings without output or consuming stream contents', () => {
  const output = vi.spyOn(process.stdout, 'write').mockReturnValue(true)
  let now = 10
  vi.spyOn(performance, 'now').mockImplementation(() => now)
  const child = compilerChild(83)
  const stdout = vi.fn()
  child.stdout!.on('data', stdout)
  const observer = observeWindowsCompilerChild({ nodeChildProcess: child }, now)
  now = 12
  child.emit('spawn')
  now = 15
  const chunk = Buffer.from('private compiler output')
  child.stdout!.emit('data', chunk)
  child.stdout!.emit('data', chunk)
  now = 18
  child.stderr!.emit('data', Buffer.from('private compiler error'))
  now = 30
  child.emit('exit', 0, null)
  now = 40
  child.emit('close', 0, null)
  const snapshot = observer.snapshot()
  observer.dispose()
  expect(snapshot).toEqual({
    phase: 'closed',
    events: [
      { event: 'handle', elapsedMs: 0 },
      { event: 'spawn', elapsedMs: 2 },
      { event: 'first-stdout', elapsedMs: 5 },
      { event: 'first-stderr', elapsedMs: 8 },
      { event: 'exit', elapsedMs: 20, exitCode: 0, signalled: false },
      { event: 'close', elapsedMs: 30, exitCode: 0, signalled: false },
    ],
  })
  expect(stdout).toHaveBeenCalledTimes(2)
  expect(stdout).toHaveBeenNthCalledWith(1, chunk)
  expect(child.stdout!.listeners('data')).toEqual([stdout])
  expect(child.stderr!.listenerCount('data')).toBe(0)
  expect(child.eventNames()).toEqual([])
  expect(JSON.stringify(snapshot)).not.toContain('private')
  expect(output).not.toHaveBeenCalled()
})

it.each(['not-spawned', 'spawn-failed', 'running', 'exited-awaiting-close', 'closed'] as const)('distinguishes %s when compilation settles without waiting for another event', (phase) => {
  const child = compilerChild()
  const observer = observeWindowsCompilerChild({ nodeChildProcess: child }, performance.now())
  if (phase === 'spawn-failed') {
    child.emit('error', new Error('private command details'))
  }
  else if (phase !== 'not-spawned') {
    child.emit('spawn')
    if (phase !== 'running') {
      child.emit('exit', null, 'SIGTERM')
      if (phase === 'closed') {
        child.emit('close', null, 'SIGTERM')
      }
    }
  }
  expect(observer.snapshot().phase).toBe(phase)
  const snapshot = observer.snapshot()
  observer.dispose()
  observer.dispose()
  expect(child.eventNames()).toEqual([])
  expect(child.stdout!.listenerCount('data')).toBe(0)
  expect(child.stderr!.listenerCount('data')).toBe(0)
  child.emit('close', null, 'SIGTERM')
  expect(observer.snapshot()).toEqual(snapshot)
})

it('reports unavailable observation and releases earlier registrations when a listener cannot be attached', () => {
  const missing = observeWindowsCompilerChild({}, performance.now())
  expect(missing.snapshot()).toEqual({ phase: 'unavailable', events: [] })
  missing.dispose()
  const child = compilerChild(83)
  const once = child.once.bind(child)
  vi.spyOn(child, 'once').mockImplementation((event, listener) => {
    if (event === 'exit') {
      throw new Error('diagnostic listener unavailable')
    }
    return once(event, listener)
  })
  const observer = observeWindowsCompilerChild({ nodeChildProcess: child }, performance.now())
  expect(observer.snapshot().phase).toBe('unavailable')
  expect(child.eventNames()).toEqual([])
})
