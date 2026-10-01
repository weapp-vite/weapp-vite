import { EventEmitter } from 'node:events'
import path from 'node:path'
import process from 'node:process'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { runChunkModesCarousel } from './chunk-modes-devtools-carousel.mjs'

const { spawnMock, questionMock, closeInputMock } = vi.hoisted(() => ({
  spawnMock: vi.fn(),
  questionMock: vi.fn(),
  closeInputMock: vi.fn(),
}))

vi.mock('node:child_process', () => ({ spawn: spawnMock }))
vi.mock('node:readline', () => ({
  default: { createInterface: () => ({ question: questionMock, close: closeInputMock }) },
}))

function childWithExitCode(code: number) {
  const child = new EventEmitter()
  queueMicrotask(() => child.emit('exit', code, null))
  return child
}

describe('chunk modes carousel resource boundary', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.spyOn(process, 'platform', 'get').mockReturnValue('darwin')
    vi.spyOn(console, 'log').mockImplementation(() => {})
    spawnMock.mockReset().mockImplementation(() => childWithExitCode(0))
    questionMock.mockReset().mockImplementation((_message, answer) => answer(''))
    closeInputMock.mockReset()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it.each(['manual', 'auto'])('opens every %s scenario without stopping shared IDE instances', async (mode) => {
    const completion = runChunkModesCarousel(['--mode', mode, '--interval', '1'])
    await vi.runAllTimersAsync()
    await completion

    expect(spawnMock).toHaveBeenCalledTimes(11)
    for (const [command, args] of spawnMock.mock.calls) {
      expect(command).toBe('node')
      expect(path.basename(args[0])).toBe('chunk-modes-project.mjs')
      expect(args.slice(1)).toEqual(['--scenario', expect.any(String), '--open'])
    }
    expect(new Set(spawnMock.mock.calls.map(([, args]) => args[2])).size).toBe(11)
    expect(closeInputMock).toHaveBeenCalledTimes(mode === 'manual' ? 11 : 0)
  })

  it('preserves the original scenario failure without trying global recovery', async () => {
    spawnMock.mockImplementationOnce(() => childWithExitCode(1))
    await expect(runChunkModesCarousel(['--mode', 'auto']))
      .rejects
      .toThrow('Scenario duplicate-common failed with code 1')
    expect(spawnMock).toHaveBeenCalledTimes(1)
  })
})
