import { EventEmitter } from 'node:events'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const emitKeypressEventsMock = vi.hoisted(() => vi.fn())

class FakeStdin extends EventEmitter {
  isTTY = true
  pause = vi.fn()
  resume = vi.fn()
  setRawMode = vi.fn()
}

class FakeProcess {
  stdin: FakeStdin

  constructor(stdin: FakeStdin) {
    this.stdin = stdin
  }
}

vi.mock('node:readline', () => ({
  emitKeypressEvents: emitKeypressEventsMock,
}))

describe('inputCoordinator carry-over guard', () => {
  let stdin: FakeStdin
  let fakeProcess: FakeProcess

  beforeEach(() => {
    vi.resetModules()
    vi.useFakeTimers()
    emitKeypressEventsMock.mockReset()
    stdin = new FakeStdin()
    fakeProcess = new FakeProcess(stdin)
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('ignores repeated confirm keypresses across sequential exclusive prompts until the repeat stops', async () => {
    vi.doMock('node:process', () => ({
      default: fakeProcess,
    }))
    const { waitForExclusiveKeypress } = await import('../src/cli/inputCoordinator')

    const firstPrompt = waitForExclusiveKeypress({
      onKeypress: (_str, key) => {
        if (key?.name === 'enter') {
          return 'retry'
        }
      },
      timeoutMs: 1000,
    })

    stdin.emit('keypress', '\r', { name: 'enter' })
    await expect(firstPrompt).resolves.toBe('retry')

    const secondHandler = vi.fn((_str: string, key: { name?: string, ctrl?: boolean } | undefined) => {
      if (key?.name === 'enter') {
        return 'retry'
      }
    })
    const secondPrompt = waitForExclusiveKeypress({
      onKeypress: secondHandler,
      timeoutMs: 2000,
    })

    stdin.emit('keypress', '\r', { name: 'enter' })
    await vi.advanceTimersByTimeAsync(200)
    stdin.emit('keypress', '\r', { name: 'enter' })
    await vi.advanceTimersByTimeAsync(200)
    stdin.emit('keypress', '\r', { name: 'enter' })
    await Promise.resolve()

    expect(secondHandler).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(600)
    stdin.emit('keypress', '\r', { name: 'enter' })

    await expect(secondPrompt).resolves.toBe('retry')
    expect(secondHandler).toHaveBeenCalledTimes(1)
  })
})
