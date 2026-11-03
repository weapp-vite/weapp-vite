import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import vm from 'node:vm'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { fixtureProcessSource, isFixtureProcessAlive, parseFixturePid, readFixturePid, requestFixtureCleanup } from './fixtureProcessControl'

let root: string
const platformDescriptor = Object.getOwnPropertyDescriptor(process, 'platform')!
beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'fixture-process-control-'))
})
afterEach(() => {
  vi.restoreAllMocks()
  Object.defineProperty(process, 'platform', platformDescriptor)
  fs.rmSync(root, { recursive: true, force: true })
})

it.each(['', ' ', '\n', '0', '-1', '1.5', '1e3', 'NaN', 'Infinity', '12x', '01', '123\n', '123\r\n', '9007199254740992'])('rejects invalid PID %j before any process observation', (text) => {
  const kill = vi.spyOn(process, 'kill').mockReturnValue(true)
  expect(() => parseFixturePid(text)).toThrow('Invalid fixture process PID')
  expect(kill).not.toHaveBeenCalled()
})

it.each([0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, Number.MAX_SAFE_INTEGER + 1])('rejects invalid numeric process observation %s', (pid) => {
  const kill = vi.spyOn(process, 'kill').mockReturnValue(true)
  expect(() => isFixtureProcessAlive(pid)).toThrow('Invalid fixture process PID')
  expect(kill).not.toHaveBeenCalled()
})

it('accepts complete decimal registrations and keeps missing or pending readiness unknown', () => {
  const file = path.join(root, 'child.pid')
  expect(readFixturePid(file)).toBeUndefined()
  fs.writeFileSync(`${file}.pending`, '')
  expect(readFixturePid(file)).toBeUndefined()
  fs.writeFileSync(`${file}.pending`, '42')
  fs.renameSync(`${file}.pending`, file)
  expect(readFixturePid(file)).toBe(42)
  expect(parseFixturePid(String(Number.MAX_SAFE_INTEGER))).toBe(Number.MAX_SAFE_INTEGER)
  fs.writeFileSync(file, '')
  expect(() => readFixturePid(file)).toThrow('Invalid fixture process PID')
})

it.each([['R', true], ['Z', false], ['X', false]] as const)('observes Linux %s without sending a termination signal', (state, alive) => {
  Object.defineProperty(process, 'platform', { value: 'linux', configurable: true })
  const kill = vi.spyOn(process, 'kill').mockReturnValue(true)
  vi.spyOn(fs, 'readFileSync').mockReturnValue(`42 (fixture with ) brackets) ${state} 1 2 3`)
  expect(isFixtureProcessAlive(42)).toBe(alive)
  expect(kill.mock.calls).toEqual([[42, 0]])
})

it.each(['ESRCH', 'ENOENT', 'EPERM'])('preserves process observation error %s', (code) => {
  const error = Object.assign(new Error(code), { code })
  vi.spyOn(process, 'kill').mockImplementation(() => {
    throw error
  })
  if (code === 'EPERM') {
    expect(() => isFixtureProcessAlive(42)).toThrow(error)
  }
  else {
    expect(isFixtureProcessAlive(42)).toBe(false)
  }
})

function fixtureRuntime(cleanupExists: boolean) {
  const pidFile = path.join(root, 'child.pid')
  const cleanupFile = path.join(root, 'cleanup')
  const files = new Map<string, string>(cleanupExists ? [[cleanupFile, 'cleanup']] : [])
  const events: string[] = []
  const intervals: (() => void)[] = []
  const timeouts: (() => void)[] = []
  const unreferenced = { cleanup: false, watchdog: false }
  const exit = vi.fn((code: number) => {
    throw Object.assign(new Error('fixture self exit'), { code })
  })
  const kill = vi.fn()
  const stderr = vi.fn()
  const context = {
    process: {
      pid: 42,
      exit,
      kill,
      stderr: { write: stderr },
      getBuiltinModule: (name: string) => {
        expect(name).toBe('node:fs')
        return {
          existsSync: (file: string) => files.has(file),
          writeFileSync: (file: string, content: string) => {
            events.push('write-pending')
            files.set(file, content)
          },
          renameSync: (pending: string, file: string) => {
            events.push('publish-ready')
            expect(pending).toBe(`${pidFile}.pending`)
            files.set(file, files.get(pending)!)
            files.delete(pending)
          },
        }
      },
    },
    setInterval: (callback: () => void) => {
      events.push('install-cleanup')
      intervals.push(callback)
      return { unref() {
        unreferenced.cleanup = true
      } }
    },
    setTimeout: (callback: () => void) => {
      events.push('install-watchdog')
      timeouts.push(callback)
      return { unref() {
        unreferenced.watchdog = true
      } }
    },
  }
  return { pidFile, cleanupFile, files, events, intervals, timeouts, unreferenced, exit, kill, stderr, context }
}

it.each([false, true])('publishes atomic readiness after installing cleanup, including late start=%s', (lateStart) => {
  const fixture = fixtureRuntime(lateStart)
  const run = () => vm.runInNewContext(fixtureProcessSource(fixture.pidFile, fixture.cleanupFile, 15_000), fixture.context)
  if (lateStart) {
    expect(run).toThrow(expect.objectContaining({ code: 0 }))
  }
  else {
    run()
    expect(fixture.exit).not.toHaveBeenCalled()
    fixture.files.set(fixture.cleanupFile, 'cleanup')
    expect(() => fixture.intervals[0]!()).toThrow(expect.objectContaining({ code: 0 }))
  }
  expect(fixture.events).toEqual(['install-cleanup', 'install-watchdog', 'write-pending', 'publish-ready'])
  expect(fixture.unreferenced).toEqual({ cleanup: true, watchdog: true })
  expect(fixture.files.get(fixture.pidFile)).toBe('42')
  expect(fixture.files.has(`${fixture.pidFile}.pending`)).toBe(false)
  expect(fixture.kill).not.toHaveBeenCalled()
})

it('records watchdog termination as failure rather than cleanup success', () => {
  const fixture = fixtureRuntime(false)
  vm.runInNewContext(fixtureProcessSource(fixture.pidFile, fixture.cleanupFile, 15_000), fixture.context)
  expect(() => fixture.timeouts[0]!()).toThrow(expect.objectContaining({ code: 2 }))
  expect(fixture.stderr).toHaveBeenCalledWith('Fixture process watchdog expired\n')
  expect(fixture.kill).not.toHaveBeenCalled()
})

it.each(['missing', 'invalid', 'running', 'runner-pending'] as const)('retains controls when cleanup is unconfirmed: %s', async (state) => {
  const file = path.join(root, 'child.pid')
  const cleanupFile = path.join(root, 'cleanup')
  if (state !== 'missing') {
    fs.writeFileSync(file, state === 'invalid' ? '' : '42')
  }
  const read = fs.readFileSync.bind(fs)
  vi.spyOn(fs, 'readFileSync').mockImplementation((...args: Parameters<typeof fs.readFileSync>) => String(args[0]).startsWith('/proc/') ? '42 (fixture) R 1 2 3' : read(...args))
  const kill = vi.spyOn(process, 'kill').mockImplementation(() => {
    if (state === 'running') {
      return true
    }
    throw Object.assign(new Error('stopped'), { code: 'ESRCH' })
  })
  await expect(requestFixtureCleanup({ cleanupFile, pidFiles: [file], timeoutMs: 0, runnerSettled: () => state !== 'runner-pending' })).rejects.toThrow(state === 'invalid' ? 'Invalid fixture process PID' : 'not confirmed')
  expect(fs.readFileSync(cleanupFile, 'utf8')).toBe('cleanup')
  expect(fs.existsSync(root)).toBe(true)
  expect(kill.mock.calls.every(([, signal]) => signal === 0)).toBe(true)
})

it('repeats self cleanup without affecting another fixture directory', async () => {
  const pidFile = path.join(root, 'child.pid')
  const cleanupFile = path.join(root, 'cleanup')
  const other = path.join(root, 'other')
  fs.mkdirSync(other)
  fs.writeFileSync(pidFile, '42')
  const kill = vi.spyOn(process, 'kill').mockImplementation(() => {
    throw Object.assign(new Error('stopped'), { code: 'ESRCH' })
  })
  const options = { cleanupFile, pidFiles: [pidFile], timeoutMs: 0 }
  await requestFixtureCleanup(options)
  await requestFixtureCleanup(options)
  expect(fs.existsSync(path.join(other, 'cleanup'))).toBe(false)
  expect(fs.existsSync(root)).toBe(true)
  expect(kill.mock.calls).toEqual([[42, 0], [42, 0]])
})

it('retains control files until every registered wrapper and descendant has stopped', async () => {
  const pidFiles = ['outer', 'runner', 'descendant'].map(name => path.join(root, `${name}.pid`))
  const cleanupFile = path.join(root, 'cleanup')
  pidFiles.forEach((file, index) => fs.writeFileSync(file, String(42 + index)))
  const read = fs.readFileSync.bind(fs)
  vi.spyOn(fs, 'readFileSync').mockImplementation((...args: Parameters<typeof fs.readFileSync>) => String(args[0]).startsWith('/proc/') ? '43 (runner) R 1 2 3' : read(...args))
  let activeWrapper: number | undefined = 43
  const kill = vi.spyOn(process, 'kill').mockImplementation((pid) => {
    if (pid === activeWrapper) {
      return true
    }
    throw Object.assign(new Error('stopped'), { code: 'ESRCH' })
  })
  const options = { cleanupFile, pidFiles, timeoutMs: 0 }
  await expect(requestFixtureCleanup(options)).rejects.toThrow('not confirmed')
  expect(pidFiles.every(file => fs.existsSync(file))).toBe(true)
  expect(fs.existsSync(cleanupFile)).toBe(true)
  activeWrapper = undefined
  await requestFixtureCleanup(options)
  expect(fs.existsSync(root)).toBe(true)
  expect(kill.mock.calls.every(([, signal]) => signal === 0)).toBe(true)
})
