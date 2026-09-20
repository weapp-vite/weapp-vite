/* eslint-disable e18e/ban-dependencies -- 验证 dev 进程控制器已有的 execa stdio 契约。 */
import type { Options } from 'execa'
import { EventEmitter } from 'node:events'
import { describe, expect, it, vi } from 'vitest'
import { startDevProcess } from './dev-process'
import { captureDevProcessOutput } from './devProcessStdio'

const execaMock = vi.hoisted(() => vi.fn())
vi.mock('execa', () => ({ execa: execaMock }))
vi.mock('./ideWarningReport', () => ({ appendIdeReportEvent: vi.fn(), resolveReportProjectPath: () => 'fixture' }))

describe('dev process inherited output', () => {
  it.each([
    [{ stdio: 'inherit' }, { stdio: ['inherit', ['pipe', 'inherit'], ['pipe', 'inherit']] }],
    [{ stdio: ['ignore', 'inherit', 'inherit', 'pipe'] }, { stdio: ['ignore', ['pipe', 'inherit'], ['pipe', 'inherit'], 'pipe'] }],
    [{ stdin: 'ignore', stdout: 'inherit', stderr: 'pipe' }, { stdin: 'ignore', stdout: ['pipe', 'inherit'], stderr: 'pipe' }],
    [{ stdout: ['inherit'], stderr: 'inherit' }, { stdout: ['pipe', 'inherit'], stderr: ['pipe', 'inherit'] }],
    [{ stdout: ['pipe', 'inherit'], stderr: 'ignore' }, { stdout: ['pipe', 'inherit'], stderr: 'ignore' }],
  ] as [Options, Options][])('captures output while retaining configured destinations %#', (input, expected) => {
    expect(captureDevProcessOutput(input)).toEqual(expected)
  })

  it('passes inherited output through the capture adapter before spawning', async () => {
    const output = new EventEmitter()
    let finish!: (value: { exitCode: number }) => void
    execaMock.mockImplementation((_command, _args, options: Options) => Object.assign(new Promise<{ exitCode: number }>((resolve) => {
      finish = resolve
    }), {
      stdout: Array.isArray(options.stdio) && Array.isArray(options.stdio[1]) ? output : undefined,
      nodeChildProcess: { exitCode: 0 },
    }))
    const dev = startDevProcess('fixture-cli', [], { stdio: 'inherit' })
    output.emit('data', '小程序初次构建完成\n')
    try {
      await expect(dev.waitForInitialBuild(1)).resolves.toContain('小程序初次构建完成')
      expect(dev.getOutput()).toBe('小程序初次构建完成\n')
    }
    finally {
      finish({ exitCode: 0 })
      await dev.stop(0)
    }
  })

  it('rejects output waits immediately when both output streams were intentionally disabled', async () => {
    let finish!: (value: { exitCode: number }) => void
    execaMock.mockReturnValue(Object.assign(new Promise<{ exitCode: number }>((resolve) => {
      finish = resolve
    }), { nodeChildProcess: { exitCode: 0 } }))
    const dev = startDevProcess('fixture-cli', [], { stdio: 'ignore' })
    try {
      await expect(dev.waitForInitialBuild(1)).rejects.toThrow('requires captured stdout or stderr')
    }
    finally {
      finish({ exitCode: 0 })
      await dev.stop(0)
    }
  })
})
