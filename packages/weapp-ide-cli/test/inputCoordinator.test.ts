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

describe('inputCoordinator', () => {
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

  it('routes shared input events and tears down terminal state on close', async () => {
    vi.doMock('node:process', () => ({
      default: fakeProcess,
    }))
    const { createSharedInputSession } = await import('../src/cli/inputCoordinator')
    const onData = vi.fn()
    const onKeypress = vi.fn()

    const session = createSharedInputSession({
      onData,
      onKeypress,
    })

    expect(session).toBeDefined()
    expect(emitKeypressEventsMock).toHaveBeenCalledWith(stdin)
    expect(stdin.setRawMode).toHaveBeenCalledWith(true)
    expect(stdin.resume).toHaveBeenCalled()

    stdin.emit('data', 'r')
    stdin.emit('keypress', 'r', { name: 'r' })

    expect(onData).toHaveBeenCalledWith('r')
    expect(onKeypress).toHaveBeenCalledWith('r', { name: 'r' })

    session?.close()

    expect(stdin.setRawMode).toHaveBeenLastCalledWith(false)
    expect(stdin.pause).toHaveBeenCalled()
  })

  it('gives exclusive keypress prompts priority over shared sessions and restores shared input after resolve', async () => {
    vi.doMock('node:process', () => ({
      default: fakeProcess,
    }))
    const { createSharedInputSession, waitForExclusiveKeypress } = await import('../src/cli/inputCoordinator')
    const onSharedKeypress = vi.fn()

    const session = createSharedInputSession({
      onKeypress: onSharedKeypress,
    })

    const pending = waitForExclusiveKeypress({
      onKeypress: (_str, key) => {
        if (key?.name === 'r') {
          return 'retry'
        }
      },
      timeoutMs: 1000,
    })

    stdin.emit('keypress', 'r', { name: 'r' })

    await expect(pending).resolves.toBe('retry')
    expect(onSharedKeypress).not.toHaveBeenCalled()

    stdin.emit('keypress', 'h', { name: 'h' })

    expect(onSharedKeypress).toHaveBeenCalledWith('h', { name: 'h' })
    session?.close()
  })

  it('suspends shared sessions while running exclusive terminal work and restores them afterwards', async () => {
    vi.doMock('node:process', () => ({
      default: fakeProcess,
    }))
    const { createSharedInputSession, runWithSuspendedSharedInput } = await import('../src/cli/inputCoordinator')
    const onSharedKeypress = vi.fn()

    const session = createSharedInputSession({
      onKeypress: onSharedKeypress,
    })

    const pending = runWithSuspendedSharedInput(async () => {
      stdin.emit('keypress', 'r', { name: 'r' })
      return 'done'
    })

    await expect(pending).resolves.toBe('done')
    expect(onSharedKeypress).not.toHaveBeenCalled()

    stdin.emit('keypress', 'h', { name: 'h' })

    expect(onSharedKeypress).toHaveBeenCalledWith('h', { name: 'h' })
    session?.close()
  })
})
