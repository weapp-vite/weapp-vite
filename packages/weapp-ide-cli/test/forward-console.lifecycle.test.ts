import type { AutomatorMiniProgram } from '@weapp-vite/devtools-runtime'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const connectMiniProgramMock = vi.hoisted(() => vi.fn())
const releaseSharedMiniProgramMock = vi.hoisted(() => vi.fn())

vi.mock('../src/cli/automator-session', async () => {
  const runtime = await import('@weapp-vite/devtools-runtime')
  releaseSharedMiniProgramMock.mockImplementation(runtime.releaseSharedMiniProgram)
  return {
    resolveAutomatorSessionOptions: async (options: unknown) => options,
    acquireConsoleMiniProgram: (options: Parameters<typeof runtime.acquireSharedMiniProgram>[1]) => runtime.acquireSharedMiniProgram({ connectMiniProgram: connectMiniProgramMock }, options),
    closeSharedMiniProgram: runtime.closeSharedMiniProgram,
    closeOwnedSharedMiniProgram: runtime.closeOwnedSharedMiniProgram,
    connectConsoleMiniProgram: connectMiniProgramMock,
    releaseSharedMiniProgram: releaseSharedMiniProgramMock,
  }
})

function connection() {
  const miniProgram = {
    on: vi.fn(),
    off: vi.fn(),
    enableLog: vi.fn().mockResolvedValue(undefined),
    disconnect: vi.fn().mockResolvedValue(undefined),
  }
  return { miniProgram, runtime: miniProgram as unknown as AutomatorMiniProgram }
}

describe('forward console shared connection lifecycle without terminal hotkeys', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    connectMiniProgramMock.mockReset()
    releaseSharedMiniProgramMock.mockClear()
  })

  afterEach(async () => {
    const runtime = await import('@weapp-vite/devtools-runtime')
    for (const project of ['fixture-project', 'other-project']) {
      await runtime.closeSharedMiniProgram(project)
    }
    vi.clearAllTimers()
    vi.useRealTimers()
  })

  it('disconnects its unused connection on the first close without a terminal cleanup owner', async () => {
    const { miniProgram, runtime: program } = connection()
    connectMiniProgramMock.mockResolvedValue(program)
    const runtime = await import('@weapp-vite/devtools-runtime')
    const { startForwardConsole } = await import('../src/cli/forwardConsole')
    const session = await startForwardConsole({ projectPath: 'fixture-project' })
    expect(runtime.getSharedMiniProgramSessionCount()).toBe(1)

    const firstClose = session.close()
    expect(session.close()).toBe(firstClose)
    await firstClose
    await session.close()

    expect(releaseSharedMiniProgramMock).toHaveBeenCalledOnce()
    expect(miniProgram.disconnect).toHaveBeenCalledOnce()
    expect(runtime.getSharedMiniProgramSessionCount()).toBe(0)
  })

  it('keeps another borrower and another project connected until their own release', async () => {
    const current = connection()
    const other = connection()
    connectMiniProgramMock.mockImplementation(async ({ projectPath }: { projectPath: string }) => projectPath === 'fixture-project' ? current.runtime : other.runtime)
    const runtime = await import('@weapp-vite/devtools-runtime')
    const { startForwardConsole } = await import('../src/cli/forwardConsole')
    await runtime.acquireSharedMiniProgram({ connectMiniProgram: connectMiniProgramMock }, { projectPath: 'fixture-project' })
    await runtime.acquireSharedMiniProgram({ connectMiniProgram: connectMiniProgramMock }, { projectPath: 'other-project' })
    const session = await startForwardConsole({ projectPath: 'fixture-project' })

    await session.close()

    expect(current.miniProgram.disconnect).not.toHaveBeenCalled()
    expect(other.miniProgram.disconnect).not.toHaveBeenCalled()
    expect(runtime.getSharedMiniProgramSessionCount()).toBe(2)
    await runtime.releaseSharedMiniProgram('fixture-project')
    expect(current.miniProgram.disconnect).toHaveBeenCalledOnce()
    expect(other.miniProgram.disconnect).not.toHaveBeenCalled()
    expect(runtime.getSharedMiniProgramSessionCount()).toBe(1)
    await session.close()
    expect(current.miniProgram.disconnect).toHaveBeenCalledOnce()
  })

  it('retries a failed disconnect without releasing a second reference', async () => {
    const { miniProgram, runtime: program } = connection()
    const failure = new Error('connection close not confirmed')
    miniProgram.disconnect.mockRejectedValueOnce(failure)
    connectMiniProgramMock.mockResolvedValue(program)
    const runtime = await import('@weapp-vite/devtools-runtime')
    const { startForwardConsole } = await import('../src/cli/forwardConsole')
    const session = await startForwardConsole({ projectPath: 'fixture-project' })

    await expect(session.close()).rejects.toMatchObject({ errors: [failure] })
    expect(runtime.getSharedMiniProgramSessionCount()).toBe(1)
    await session.close()

    expect(releaseSharedMiniProgramMock).toHaveBeenCalledOnce()
    expect(miniProgram.disconnect).toHaveBeenCalledTimes(2)
    expect(runtime.getSharedMiniProgramSessionCount()).toBe(0)
  })
})
