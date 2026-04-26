import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const cleanupTrackedDevProcessesMock = vi.hoisted(() => vi.fn())
const cleanupProcessesByCommandPatternsMock = vi.hoisted(() => vi.fn())
const execaMock = vi.hoisted(() => vi.fn())

vi.mock('../utils/dev-process', () => ({
  cleanupProcessesByCommandPatterns: cleanupProcessesByCommandPatternsMock,
  cleanupTrackedDevProcesses: cleanupTrackedDevProcessesMock,
}))

vi.mock('execa', () => ({
  execa: execaMock,
}))

describe('dev process cleanup', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    cleanupTrackedDevProcessesMock.mockReset()
    cleanupTrackedDevProcessesMock.mockResolvedValue(undefined)
    cleanupProcessesByCommandPatternsMock.mockReset()
    cleanupProcessesByCommandPatternsMock.mockResolvedValue(undefined)
    execaMock.mockReset()
    execaMock.mockResolvedValue({ exitCode: 0, stderr: '', stdout: '' })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('cleans tracked dev processes on Windows without Unix process scans', async () => {
    const { cleanupResidualDevProcesses } = await import('../utils/dev-process-cleanup')

    const task = cleanupResidualDevProcesses('win32')
    await vi.runAllTimersAsync()
    await task

    expect(cleanupTrackedDevProcessesMock).toHaveBeenCalledWith(2_500)
    expect(cleanupProcessesByCommandPatternsMock).not.toHaveBeenCalled()
    expect(execaMock).not.toHaveBeenCalled()
  })

  it('runs Unix command-pattern cleanup outside Windows', async () => {
    const { cleanupResidualDevProcesses } = await import('../utils/dev-process-cleanup')

    const task = cleanupResidualDevProcesses('darwin')
    await vi.runAllTimersAsync()
    await task

    expect(cleanupTrackedDevProcessesMock).toHaveBeenCalledWith(2_500)
    expect(execaMock).toHaveBeenCalledWith('pkill', expect.any(Array), expect.objectContaining({
      reject: false,
    }))
    expect(cleanupProcessesByCommandPatternsMock).toHaveBeenCalledTimes(1)
  })
})
