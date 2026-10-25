import { EventEmitter } from 'node:events'
import path from 'node:path'
import process from 'node:process'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'

const execute = vi.hoisted(() => vi.fn())
const filesystem = vi.hoisted(() => ({ readFile: vi.fn(), readlink: vi.fn(), readdir: vi.fn() }))
vi.mock('execa', () => ({ execa: execute }))
vi.mock('node:fs/promises', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs/promises')>()
  return { ...actual, default: { ...actual, ...filesystem } }
})
vi.mock('./ideWarningReport', () => ({ resolveReportProjectPath: () => 'fixture' }))
vi.mock('./devProcessDiagnostics', () => ({ createDevProcessDiagnostics: () => ({ write() {}, flush() {} }) }))

beforeEach(() => {
  vi.resetModules()
  vi.resetAllMocks()
  vi.spyOn(process, 'platform', 'get').mockReturnValue('linux')
})
afterEach(() => {
  vi.restoreAllMocks()
  vi.useRealTimers()
})

async function fixture({ rootPresent = true, descendant = false, inspectionFailure = undefined as Error | undefined } = {}) {
  let rootIdentityFailure = inspectionFailure
  const missing = Promise.withResolvers<void>()
  const drained = Promise.withResolvers<{ exitCode: number, signal: undefined }>()
  const original = Object.assign(new Error('original-configure-startup-failure'), { exitCode: 1, stderr: 'original-configure-startup-failure' })
  const native = Object.assign(new EventEmitter(), { exitCode: null as number | null, signalCode: null, connected: false })
  native.on('error', () => {})
  const output = new EventEmitter()
  const child = Object.assign(drained.promise, { pid: 61, all: output, nodeChildProcess: native })
  execute.mockReturnValue(child)
  filesystem.readdir.mockImplementation(async () => {
    if (!rootPresent) {
      missing.resolve()
    }
    return [...rootPresent ? ['61'] : [], ...descendant ? ['62'] : [], '71']
  })
  filesystem.readFile.mockImplementation(async (file: string) => {
    if (file === '/proc/sys/kernel/random/boot_id') {
      return 'fixture-boot\n'
    }
    const pid = Number(/^\/proc\/(\d+)\/stat$/.exec(file)?.[1])
    const fields = Array.from({ length: 20 }).fill('0')
    fields[0] = 'S'
    fields[1] = pid === 62 ? '61' : '41'
    fields[19] = String(pid)
    return `${pid} (fixture-node) ${fields.join(' ')}`
  })
  filesystem.readlink.mockImplementation(async (file: string) => {
    if (file === '/proc/61/exe') {
      missing.resolve()
      throw rootIdentityFailure ?? Object.assign(new Error('Native root is no longer executable'), { code: 'ENOENT' })
    }
    return path.resolve('fixture-node')
  })
  const kill = vi.spyOn(process, 'kill').mockReturnValue(true)
  const request = vi.fn((settledExit: Promise<unknown>) => settledExit)
  const dispose = vi.fn(async () => undefined)
  const { startDevProcess, cleanupTrackedDevProcesses } = await import('./dev-process')
  const dev = startDevProcess('node', ['native-vite-cli.js'], { ipc: false, gracefulShutdown: request, disposeShutdown: dispose })
  output.emit('data', 'original-configure-startup-failure\n')
  const exit = () => {
    native.exitCode = 1
    native.emit('exit', 1, null)
  }
  const drain = () => {
    output.emit('data', 'native startup failure exit=1\nfinal startup diagnostic\n')
    drained.reject(original)
  }
  return { dev, missing, native, exit, drain, kill, request, dispose, original, cleanupTrackedDevProcesses, clearInspectionFailure: () => rootIdentityFailure = undefined }
}

it.each([true, false])('converges a disappearing Linux root (stat present=%s) on native exit and drains final output before preserving the startup failure', async (rootPresent) => {
  const ctx = await fixture({ rootPresent })
  let completed = false
  const stopping = ctx.dev.stop(0)
  const outcome = stopping.catch((error: unknown) => error).finally(() => completed = true)
  try {
    await ctx.missing.promise
    await new Promise(resolve => setImmediate(resolve))
    expect(completed, 'missing /proc/exe alone is not a cleanup failure before the native root exit arrives').toBe(false)
    ctx.native.emit('error', new Error('A send or kill error does not prove native exit'))
    await new Promise(resolve => setImmediate(resolve))
    expect(completed).toBe(false)
    ctx.exit()
    await new Promise(resolve => setImmediate(resolve))
    expect(completed, 'native root exit cannot stand in for final output drain').toBe(false)
    expect(ctx.dispose).not.toHaveBeenCalled()
    ctx.drain()
    expect(await outcome).toMatchObject({ name: 'Error', message: expect.stringContaining('original-configure-startup-failure'), cause: ctx.original })
    expect(ctx.dev.getOutput()).toContain('final startup diagnostic')
    expect(ctx.dispose).toHaveBeenCalledOnce()
    expect(ctx.kill).not.toHaveBeenCalled()
    expect(ctx.native.listenerCount('exit')).toBe(0)
    expect(ctx.dev.stop(0)).toBe(stopping)
    await expect(ctx.cleanupTrackedDevProcesses(0)).resolves.toBeUndefined()
  }
  finally {
    ctx.exit()
    ctx.drain()
    await outcome
  }
})

it('rejects a still-held root with missing identity after the native-exit observation budget', async () => {
  vi.useFakeTimers()
  const ctx = await fixture()
  const outcome = ctx.dev.stop(0).catch((error: unknown) => error)
  try {
    await ctx.missing.promise
    await vi.runAllTimersAsync()
    expect(await outcome).toMatchObject({ message: expect.stringContaining('identity could not be verified') })
    expect(ctx.dispose).not.toHaveBeenCalled()
    expect(ctx.request).not.toHaveBeenCalled()
    expect(ctx.kill).not.toHaveBeenCalled()
    expect(ctx.native.listenerCount('exit')).toBe(0)
  }
  finally {
    ctx.exit()
    ctx.drain()
    await outcome
  }
})

it('keeps a discovered descendant unconfirmed when the native root later exits', async () => {
  const ctx = await fixture({ descendant: true })
  const outcome = ctx.dev.stop(0).catch((error: unknown) => error)
  try {
    expect(await outcome).toMatchObject({ pids: [62] })
    ctx.exit()
    ctx.drain()
    await expect(ctx.cleanupTrackedDevProcesses(0)).rejects.toMatchObject({ pids: [62] })
    expect(ctx.dispose).not.toHaveBeenCalled()
    expect(ctx.kill).not.toHaveBeenCalled()
  }
  finally {
    ctx.exit()
    ctx.drain()
    await outcome
  }
})

it('preserves a real identity inspection error even after the native root exits', async () => {
  const original = Object.assign(new Error('Identity access denied'), { code: 'EACCES' })
  const ctx = await fixture({ inspectionFailure: original })
  try {
    await expect(ctx.dev.stop(0)).rejects.toBe(original)
    ctx.exit()
    ctx.drain()
    await expect(ctx.cleanupTrackedDevProcesses(0)).rejects.toMatchObject({ message: expect.stringContaining('snapshot remains incomplete'), cause: original })
    expect(ctx.dispose).not.toHaveBeenCalled()
    expect(ctx.kill).not.toHaveBeenCalled()
  }
  finally {
    ctx.exit()
    ctx.drain()
  }
})

it('does not clear an earlier incomplete snapshot when a later missing-root inspection confirms native exit', async () => {
  const original = Object.assign(new Error('The earlier snapshot was not complete'), { code: 'EACCES' })
  const ctx = await fixture({ inspectionFailure: original })
  try {
    await expect(ctx.dev.stop(0)).rejects.toBe(original)
    ctx.clearInspectionFailure()
    const recovered = ctx.dev.stop(0).catch((error: unknown) => error)
    await new Promise(resolve => setImmediate(resolve))
    ctx.exit()
    ctx.drain()
    expect(await recovered).toMatchObject({ message: expect.stringContaining('snapshot remains incomplete'), cause: original })
    expect(ctx.dispose).not.toHaveBeenCalled()
    expect(ctx.kill).not.toHaveBeenCalled()
  }
  finally {
    ctx.exit()
    ctx.drain()
  }
})
