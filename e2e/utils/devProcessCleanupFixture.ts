import type { Mock } from 'vitest'
import { EventEmitter } from 'node:events'
import path from 'node:path'
import process from 'node:process'
import { vi } from 'vitest'
import { fixtureWindowsProcessRows } from './testSupport/windowsProcessRows'

export function createChild() {
  let settle!: () => void
  const result = new Promise<{ exitCode: number, signal: undefined }>((resolve) => {
    settle = () => resolve({ exitCode: 0, signal: undefined })
  })
  const nodeChildProcess = { exitCode: null as number | null, signalCode: null }
  return {
    child: Object.assign(result, { pid: 61, all: new EventEmitter(), nodeChildProcess }),
    exitNative() {
      nodeChildProcess.exitCode = 0
    },
    settle,
    exit() {
      nodeChildProcess.exitCode = 0
      settle()
    },
  }
}

interface FixtureProcess {
  pid: number
  ppid: number
  executable: string
  started: string
}

export function createProcessTreeFixture(execaMock: Mock) {
  const owned = createChild()
  const executable = path.resolve('fixture-node')
  const started = (second: number) => process.platform === 'win32'
    ? `2026-10-05T12:30:0${second}.0000000Z`
    : `Mon Oct 5 12:30:0${second} 2026`
  const processes = new Map<number, FixtureProcess>([
    [61, { pid: 61, ppid: 41, executable, started: started(1) }],
    [62, { pid: 62, ppid: 61, executable, started: started(2) }],
    [71, { pid: 71, ppid: 21, executable, started: started(3) }],
    [72, { pid: 72, ppid: 71, executable, started: started(4) }],
  ])
  const state = {
    processes,
    owned,
    signals: [] as { pid: number, signal: string | number }[],
    identityReads: [] as FixtureProcess[],
    blockedSignals: new Set<number>(),
    unknownIdentityPids: new Set<number>(),
    ignoreTermPids: new Set([62]),
    afterDiscovery: undefined as (() => void) | undefined,
    afterSignal: undefined as ((pid: number, signal: string | number) => void) | undefined,
    drainOutput: true,
    finish() {
      processes.delete(61)
      processes.delete(62)
      state.unknownIdentityPids.clear()
      state.blockedSignals.clear()
      owned.exit()
    },
  }

  function signalProcess(pid: number, signal: string | number = 'SIGTERM'): true {
    if (!processes.has(pid)) {
      throw Object.assign(new Error('Process exited'), { code: 'ESRCH' })
    }
    if (signal === 0) {
      return true
    }
    state.signals.push({ pid, signal })
    if (state.blockedSignals.has(pid)) {
      throw Object.assign(new Error('Signal denied'), { code: 'EPERM' })
    }
    if (signal !== 'SIGTERM' || !state.ignoreTermPids.has(pid)) {
      processes.delete(pid)
      if (pid === owned.child.pid) {
        owned.exitNative()
        if (state.drainOutput) {
          owned.settle()
        }
      }
    }
    state.afterSignal?.(pid, signal)
    return true
  }

  execaMock.mockImplementation((command: string, args: string[]) => {
    if (command === 'node') {
      return owned.child
    }
    if (command === 'powershell.exe') {
      const script = args.at(-1) ?? ''
      if (!script.includes('Get-CimInstance Win32_Process') || !script.includes('ParentProcessId') || !script.includes('ExecutablePath')) {
        throw new Error('Unexpected process fixture CIM query')
      }
      const selected = [...script.matchAll(/ProcessId=(\d+)/g)].map(match => Number(match[1]))
      const entries = [...processes.values()].filter(entry => !selected.length || selected.includes(entry.pid))
      if (entries.some(entry => state.unknownIdentityPids.has(entry.pid))) {
        return Promise.resolve({ exitCode: 1, stdout: '', stderr: 'Process inspection failed' })
      }
      const stdout = fixtureWindowsProcessRows(entries.map(entry => ({ ProcessId: entry.pid, ParentProcessId: entry.ppid, ExecutablePath: entry.executable, Started: entry.started })))
      state.identityReads.push(...entries.map(entry => ({ ...entry })))
      if (!selected.length) {
        state.afterDiscovery?.()
      }
      return Promise.resolve({ exitCode: 0, stdout })
    }
    if (command === 'taskkill') {
      if (args.includes('/T') || args.at(-1) !== '/F') {
        throw new Error('Process fixture requires exact PID termination without /T')
      }
      for (let index = 0; index < args.length - 1; index += 2) {
        if (args[index] !== '/PID') {
          throw new Error('Unexpected process fixture taskkill arguments')
        }
        signalProcess(Number(args[index + 1]), 'SIGKILL')
      }
      return Promise.resolve({ exitCode: 0, stdout: '' })
    }
    if (command !== 'ps') {
      throw new Error(`Unexpected process fixture command: ${command}`)
    }
    if (args.join(' ') === '-Ao pid=,ppid=,lstart=,comm=') {
      const stdout = [...processes.values()].map(entry => `${entry.pid} ${entry.ppid} ${entry.started} ${entry.executable}`).join('\n')
      state.afterDiscovery?.()
      return Promise.resolve({ exitCode: 0, stdout })
    }
    if (args.length === 6 && args[0] === '-p' && args.slice(2).join(' ') === '-o lstart= -o comm=') {
      const pid = Number(args[1])
      if (state.unknownIdentityPids.has(pid)) {
        return Promise.resolve({ exitCode: 2, stdout: '', stderr: 'Process inspection failed' })
      }
      const entry = processes.get(pid)
      if (!entry) {
        return Promise.resolve({ exitCode: 1, stdout: '' })
      }
      state.identityReads.push({ ...entry })
      return Promise.resolve({ exitCode: 0, stdout: `${entry.started} ${entry.executable}\n` })
    }
    throw new Error(`Unexpected process fixture ps arguments: ${args.join(' ')}`)
  })

  vi.spyOn(process, 'kill').mockImplementation(signalProcess)
  return state
}
