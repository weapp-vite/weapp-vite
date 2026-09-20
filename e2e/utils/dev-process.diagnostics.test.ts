import { EventEmitter } from 'node:events'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { startDevProcess } from './dev-process'
import { appendIdeReportEvent } from './ideWarningReport'

const execaMock = vi.hoisted(() => vi.fn())
vi.mock('execa', () => ({ execa: execaMock }))
vi.mock('./ideWarningReport', () => ({ appendIdeReportEvent: vi.fn(), resolveReportProjectPath: () => 'apps/demo' }))

describe('dev process startup diagnostics', () => {
  afterEach(() => vi.useRealTimers())

  it('waits for the completed initial Vite build instead of partial emitted assets', async () => {
    vi.useFakeTimers()
    let finish!: (result: { exitCode: number }) => void
    const output = new EventEmitter()
    const child = Object.assign(new Promise<{ exitCode: number }>((resolve) => {
      finish = resolve
    }), { all: output, nodeChildProcess: { exitCode: 0 } })
    execaMock.mockReturnValue(child)
    const dev = startDevProcess('mock-cli', [], { all: true })
    let ready = false
    const initialBuild = dev.waitForInitialBuild().then(() => {
      ready = true
    })
    output.emit('data', 'dist/app.json 0.4 kB\ndist/app.wxss 5.0 kB\n')
    await vi.advanceTimersByTimeAsync(1_000)
    expect(ready).toBe(false)
    output.emit('data', '[success] 小程序初次构建')
    await vi.advanceTimersByTimeAsync(200)
    expect(ready).toBe(false)
    output.emit('data', '完成，耗时：1s\n')
    await vi.advanceTimersByTimeAsync(200)
    await initialBuild
    expect(ready).toBe(true)
    finish({ exitCode: 0 })
    await dev.stop(0)
  })

  it('journals startup output before readiness and flushes the final line on exit', async () => {
    let finish!: (result: { exitCode: number }) => void
    const output = new EventEmitter()
    const child = Object.assign(new Promise<{ exitCode: number }>((resolve) => {
      finish = resolve
    }), {
      all: output,
      nodeChildProcess: { exitCode: 0 },
    })
    execaMock.mockReturnValue(child)
    const dev = startDevProcess('mock-cli', [], { cwd: 'apps/demo', all: true })
    output.emit('data', '[mini:error] startup failure\n')
    await dev.waitFor(Promise.resolve(), 'ready')
    expect(appendIdeReportEvent).toHaveBeenCalledWith(expect.objectContaining({
      source: 'runtime',
      level: 'error',
      channel: 'forward-console',
      text: 'startup failure',
    }))
    output.emit('data', '[error] final compile failure')
    finish({ exitCode: 0 })
    await dev.stop(0)
    expect(appendIdeReportEvent).toHaveBeenCalledWith(expect.objectContaining({
      source: 'build',
      level: 'error',
      channel: 'dev-process',
      text: '[error] final compile failure',
    }))
  })
})
