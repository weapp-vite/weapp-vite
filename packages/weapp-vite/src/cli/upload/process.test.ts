import type * as ChildProcessModule from 'node:child_process'
import type * as ProcessTreeModule from './processTree'
import type { UploadContext, UploadExecutionOptions } from './types'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { UploadExecutionError } from './executionError'
import { executeUpload } from './process'
import { terminateUploadDescendants, terminateUploadProcess } from './processTree'

const state = vi.hoisted(() => ({ workerPath: '', children: [] as ChildProcessModule.ChildProcess[] }))
vi.mock('node:child_process', async (importOriginal) => {
  const actual = await importOriginal<typeof ChildProcessModule>()
  return {
    ...actual,
    fork: (_module: string, args: readonly string[], options: ChildProcessModule.ForkOptions) => {
      const child = actual.fork(state.workerPath, args, options)
      state.children.push(child)
      return child
    },
  }
})
vi.mock('../../logger', () => ({ default: { info: vi.fn() } }))
vi.mock('./processTree', async (importOriginal) => {
  const actual = await importOriginal<typeof ProcessTreeModule>()
  return { ...actual, terminateUploadDescendants: vi.fn(actual.terminateUploadDescendants) }
})

let root: string
let context: UploadContext
let listeners: number[]

beforeEach(async () => {
  root = await mkdtemp(path.join(os.tmpdir(), 'weapp-upload-lifecycle-'))
  state.workerPath = path.join(root, 'worker.mjs')
  state.children = []
  vi.mocked(terminateUploadDescendants).mockClear()
  context = { cwd: root, projectPath: root, version: '1.0.0', desc: 'fixture', env: { ...process.env } }
  listeners = ['SIGINT', 'SIGTERM', 'exit'].map(event => process.listenerCount(event))
  // 子进程的 interval 仅模拟 SDK 常驻句柄；超时测试由父进程假时钟推进，不等待固定时长。
  await writeFile(state.workerPath, `
    import { spawn } from 'node:child_process'
    import { once } from 'node:events'
    import { promisify } from 'node:util'
    let input = ''
    for await (const chunk of process.stdin) input += chunk
    const { action, context } = JSON.parse(input)
    const scenario = context.env.SCENARIO ?? 'success'
    if (scenario === 'before-start') {
      setInterval(() => {}, 1000)
    } else {
      const permitted = once(process, 'message')
      process.send({ type: 'started', action })
      await permitted
      if (scenario.startsWith('overflow-')) {
        const secret = context.env.LOG_SECRET
        const write = promisify(process.stdout.write.bind(process.stdout))
        await write('x'.repeat(4 * 1024 * 1024 - secret.length + 1))
        if (scenario === 'overflow-split') {
          await write(secret.slice(0, 40))
          await write(secret.slice(40))
        } else {
          await write(secret)
        }
        setInterval(() => {}, 1000)
      } else if (scenario === 'interrupted-secret') {
        const stream = process[context.env.DIAGNOSTIC_STREAM]
        const other = stream === process.stdout ? process.stderr : process.stdout
        const write = promisify(stream.write.bind(stream))
        await write(context.env.LOG_SECRET.slice(0, 40))
        await promisify(other.write.bind(other))('ordinary-sdk-diagnostic')
        await write(context.env.LOG_SECRET.slice(40, -1))
        setInterval(() => {}, 1000)
      } else if (scenario === 'root-death' || scenario === 'detached-pipe') {
        const child = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], { stdio: ['ignore', 'inherit', 'inherit'], detached: scenario === 'detached-pipe' })
        await once(child, 'spawn')
        process.send({ type: 'progress', action, event: { type: 'log', message: String(child.pid) } }, () => {
          if (scenario === 'detached-pipe') {
            process.send({ type: 'completed', action, result: {} }, () => process.exit(0))
          } else {
            process.exit(1)
          }
        })
      } else if (scenario === 'descendants') {
        const child = spawn(process.execPath, ['-e', \`
          const { spawn } = require('node:child_process')
          process.on('SIGTERM', () => {})
          const grandchild = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], { stdio: 'ignore', detached: process.platform !== 'win32' })
          process.stdout.write(JSON.stringify([process.pid, grandchild.pid]))
          setInterval(() => {}, 1000)
        \`], { stdio: ['ignore', 'pipe', 'ignore'] })
        const [pids] = await once(child.stdout, 'data')
        process.send({ type: 'progress', action, event: { type: 'log', message: String(pids) } })
        setInterval(() => {}, 1000)
      } else {
        process.send({ type: 'progress', action, event: { type: 'progress', percent: 40, message: 'upload secret-fixture' } })
        if (scenario === 'hang') {
          process.on('SIGTERM', () => {})
          setInterval(() => {}, 1000)
        } else if (scenario === 'no-completion') {
          process.exit(0)
        } else if (scenario === 'disconnect') {
          process.disconnect()
          setInterval(() => {}, 1000)
        } else {
          process.send({ type: 'completed', action, result: action === 'preview' ? {} : { sdkVersion: '1.2.3' } }, () => {
            process.exit(scenario === 'bad-exit' ? 1 : 0)
          })
        }
      }
    }
  `)
})

afterEach(async () => {
  vi.useRealTimers()
  for (const child of state.children) {
    if (child.pid && child.exitCode === null && child.signalCode === null) {
      terminateUploadDescendants(child.pid)
      terminateUploadProcess(child.pid, { processGroup: true })
    }
  }
  await rm(root, { recursive: true, force: true })
  expect(['SIGINT', 'SIGTERM', 'exit'].map(event => process.listenerCount(event))).toEqual(listeners)
})

function run(scenario: string, options: UploadExecutionOptions = {}) {
  context.env.SCENARIO = scenario
  return executeUpload('weapp', context, ['secret-fixture'], 'upload', options)
}

describe('upload worker lifecycle', () => {
  it('requires completion and clean exit, and delivers sanitized progress before completion', async () => {
    let settled = false
    const progress = vi.fn(() => expect(settled).toBe(false))
    const execution = run('success', { onProgress: progress }).finally(() => {
      settled = true
    })
    await expect(execution).resolves.toEqual({ sdkVersion: '1.2.3' })
    expect(progress).toHaveBeenCalledWith({ type: 'progress', percent: 40, message: 'upload [REDACTED]' })
  })

  it('does not apply the SDK deadline after the worker exits while pipes are closing', async () => {
    vi.useFakeTimers()
    const execution = run('success', { timeoutMs: 10 })
    state.children[0]!.once('exit', () => vi.advanceTimersByTime(10))
    await expect(execution).resolves.toEqual({ sdkVersion: '1.2.3' })
  })

  it('rejects exit zero without a completion handshake even after progress', async () => {
    await expect(run('no-completion')).rejects.toMatchObject({
      name: 'UploadExecutionError',
      reason: 'failed',
      remoteOutcome: 'unknown',
    })
  })

  it('does not turn a completed message followed by nonzero exit into success', async () => {
    await expect(run('bad-exit')).rejects.toMatchObject({ reason: 'failed', remoteOutcome: 'unknown' })
  })

  it('stops a disconnected worker instead of waiting for it indefinitely', async () => {
    await expect(run('disconnect')).rejects.toMatchObject({ reason: 'failed', remoteOutcome: 'unknown' })
  })

  it('rejects missing preview metadata after a confirmed worker completion', async () => {
    const failure = await executeUpload('weapp', context, [], 'preview').catch(error => error)
    expect(failure).toBeInstanceOf(Error)
    expect(failure).not.toBeInstanceOf(UploadExecutionError)
  })

  it('does not launch a worker for an already-aborted signal', async () => {
    const controller = new AbortController()
    controller.abort()
    await expect(run('hang', { signal: controller.signal })).rejects.toMatchObject({ reason: 'interrupted', remoteOutcome: 'not-started' })
    expect(state.children).toEqual([])
  })

  it('reports timeout before SDK start as not-started', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    const execution = expect(run('before-start', { timeoutMs: 100 }))
      .rejects
      .toMatchObject({ reason: 'timeout', remoteOutcome: 'not-started' })
    vi.advanceTimersByTime(100)
    await execution
  }, 15000)

  it('times out a running SDK with an unknown remote outcome and removes its signal listener', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    const controller = new AbortController()
    const remove = vi.spyOn(controller.signal, 'removeEventListener')
    const progress = vi.fn(() => vi.advanceTimersByTime(2000))
    await expect(run('hang', { timeoutMs: 2000, signal: controller.signal, onProgress: progress }))
      .rejects
      .toMatchObject({ reason: 'timeout', remoteOutcome: 'unknown' })
    expect(progress).toHaveBeenCalledWith({ type: 'progress', percent: 40, message: 'upload [REDACTED]' })
    expect(remove).toHaveBeenCalledWith('abort', expect.any(Function))
  }, 15000)

  it('cancels the active worker and its SDK descendants, including a detached grandchild', async () => {
    const controller = new AbortController()
    let pids: number[] = []
    try {
      await expect(run('descendants', {
        signal: controller.signal,
        onProgress(event) {
          pids = JSON.parse(event.message!) as number[]
          controller.abort()
        },
      })).rejects.toMatchObject({ reason: 'interrupted', remoteOutcome: 'unknown' })
      expect(pids).toHaveLength(2)
      await vi.waitFor(() => {
        for (const pid of pids) {
          expect(() => process.kill(pid, 0)).toThrow()
        }
      }, { timeout: 5000 })
    }
    finally {
      for (const pid of pids) {
        try {
          process.kill(pid, 'SIGKILL')
        }
        catch { /* 后代应已被生命周期清理。 */ }
      }
    }
  }, 20000)

  it.each(['overflow-whole', 'overflow-split'])('omits raw diagnostics when the log cap crosses a secret: %s', async (scenario) => {
    context.env.SCENARIO = scenario
    context.env.LOG_SECRET = '-----BEGIN PRIVATE KEY-----\nconfidential-fixture-key-body\n-----END PRIVATE KEY-----'
    const failure = await executeUpload('weapp', context, [context.env.LOG_SECRET]).catch(error => error)
    expect(failure).toMatchObject({ reason: 'failed', remoteOutcome: 'unknown' })
    expect(failure.message).not.toContain('confidential-fixture-key-body')
    expect(failure.message).not.toContain('-----BEGIN PRIVATE KEY-----')
  }, 15000)

  it.each(['stdout', 'stderr'] as const)('redacts a split credential when interruption cuts %s while preserving other diagnostics', async (stream) => {
    const controller = new AbortController()
    context.env.SCENARIO = 'interrupted-secret'
    context.env.DIAGNOSTIC_STREAM = stream
    context.env.LOG_SECRET = '-----BEGIN PRIVATE KEY-----\nconfidential-fixture-key-body\n-----END PRIVATE KEY-----'
    const other = stream === 'stdout' ? 'stderr' : 'stdout'
    const observed = { stdout: '', stderr: '' }
    const execution = executeUpload('weapp', context, ['-----BEGIN PRIVATE KEY-----', context.env.LOG_SECRET], 'upload', { signal: controller.signal })
    for (const name of ['stdout', 'stderr'] as const) {
      state.children[0]![name]!.on('data', (chunk: string) => {
        observed[name] += chunk
        if (observed[stream].length >= context.env.LOG_SECRET!.length - 1 && observed[other] === 'ordinary-sdk-diagnostic') {
          controller.abort()
        }
      })
    }
    const failure = await execution.catch(error => error)
    expect(failure).toMatchObject({ reason: 'interrupted', remoteOutcome: 'unknown' })
    expect(failure.message).not.toContain('confidential-fixture-key-body')
    expect(failure.message).not.toContain('-----BEGIN PRIVATE KEY-----')
    expect(failure.message).toContain('ordinary-sdk-diagnostic')
  }, 15000)

  // 真实子进程持有日志管道；父进程假时钟不能替代宿主的进程退出与句柄释放。
  it('recovers descendants holding inherited pipes after the worker has exited', async () => {
    let pid: number | undefined
    try {
      await expect(run('root-death', {
        onProgress(event) {
          pid = Number(event.message)
        },
      })).rejects.toMatchObject({ reason: 'failed', remoteOutcome: 'unknown' })
      expect(pid).toBeGreaterThan(0)
      await vi.waitFor(() => expect(() => process.kill(pid!, 0)).toThrow(), { timeout: 5000 })
    }
    finally {
      if (pid) {
        try {
          process.kill(pid, 'SIGKILL')
        }
        catch { /* 后代应已被生命周期清理。 */ }
      }
    }
  }, 15000)

  it.skipIf(process.platform === 'win32').each(['deadline', 'interrupt'] as const)('does not reclaim an exited POSIX PID while waiting for escaped pipes: %s', async (trigger) => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    const controller = new AbortController()
    let pid: number | undefined
    try {
      await expect(run('detached-pipe', {
        signal: controller.signal,
        onProgress(event) {
          pid = Number(event.message)
          state.children[0]!.once('exit', () => {
            if (trigger === 'interrupt') {
              controller.abort()
            }
            vi.advanceTimersByTime(1000)
          })
        },
      })).rejects.toMatchObject({ reason: trigger === 'interrupt' ? 'interrupted' : 'failed', remoteOutcome: 'unknown' })
      expect(terminateUploadDescendants).not.toHaveBeenCalled()
      expect(pid).toBeGreaterThan(0)
      expect(process.kill(pid!, 0)).toBe(true)
    }
    finally {
      if (pid) {
        try {
          process.kill(pid, 'SIGKILL')
        }
        catch { /* 清理 fixture 主动脱离进程组的子进程。 */ }
      }
    }
  }, 15000)

  it.each(['SIGINT', 'SIGTERM'] as const)('retains %s handling for callers without a batch signal', async (signal) => {
    const existing = process.listeners(signal)
    await expect(run('hang', {
      onProgress() {
        // 仅触发本次上传的处理器，不能向测试运行器广播退出信号。
        const cancel = process.listeners(signal).find(listener => !existing.includes(listener))
        expect(cancel).toBeTypeOf('function')
        cancel?.()
      },
    })).rejects.toMatchObject({ reason: 'interrupted', remoteOutcome: 'unknown' })
  }, 15000)
})
