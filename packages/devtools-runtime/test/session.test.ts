import type { AutomatorMiniProgram } from '../src'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  acquireSharedMiniProgram,
  closeSharedMiniProgram,
  getSharedMiniProgramSessionCount,
  releaseSharedMiniProgram,
  withMiniProgram,
} from '../src'

type TestMiniProgram = AutomatorMiniProgram & {
  close: ReturnType<typeof vi.fn>
  disconnect: ReturnType<typeof vi.fn>
}

function createMiniProgram() {
  return {
    close: vi.fn(async () => {}),
    disconnect: vi.fn(),
  } as TestMiniProgram
}

beforeEach(async () => {
  await Promise.all([
    closeSharedMiniProgram('/project-a'),
    closeSharedMiniProgram('/project-b'),
    closeSharedMiniProgram('/project-a', 'worker-a'),
    closeSharedMiniProgram('/project-a', 'worker-b'),
    closeSharedMiniProgram('/project-a', 19_510),
    closeSharedMiniProgram('/project-a', 19_511),
  ])
})

describe('devtools runtime shared sessions', () => {
  it('keeps the same project isolated by installation and refuses ambiguous legacy cleanup', async () => {
    const stable = createMiniProgram()
    const rc = createMiniProgram()
    const hooks = { connectMiniProgram: vi.fn().mockResolvedValueOnce(stable).mockResolvedValueOnce(rc) }
    const projectPath = 'installation-fixture'
    await acquireSharedMiniProgram(hooks, { projectPath, installationId: 'stable', cliPath: 'stable-cli' })
    await acquireSharedMiniProgram(hooks, { projectPath, installationId: 'rc' })
    expect(hooks.connectMiniProgram).toHaveBeenCalledTimes(2)
    await closeSharedMiniProgram(projectPath)
    expect(stable.disconnect).not.toHaveBeenCalled()
    expect(rc.disconnect).not.toHaveBeenCalled()
    await closeSharedMiniProgram(projectPath, undefined, { cliPath: 'stable-cli' })
    expect(stable.disconnect).toHaveBeenCalledExactlyOnceWith()
    expect(rc.disconnect).not.toHaveBeenCalled()
    await closeSharedMiniProgram(projectPath)
    expect(rc.disconnect).toHaveBeenCalledExactlyOnceWith()
  })

  it('does not ignore an explicitly changed port for the same named session', async () => {
    const first = createMiniProgram()
    const second = createMiniProgram()
    const hooks = { connectMiniProgram: vi.fn().mockResolvedValueOnce(first).mockResolvedValueOnce(second) }
    const input = { projectPath: 'named-fixture', installationId: 'stable', sessionId: 'worker' }
    await acquireSharedMiniProgram(hooks, { ...input, port: 19510 })
    await acquireSharedMiniProgram(hooks, { ...input, port: 19511 })
    expect(hooks.connectMiniProgram).toHaveBeenCalledTimes(2)
    const firstInput = { ...input, port: 19510 }
    await closeSharedMiniProgram(input.projectPath, 'worker', firstInput)
    expect(first.disconnect).toHaveBeenCalledOnce()
    expect(second.disconnect).not.toHaveBeenCalled()
    await closeSharedMiniProgram(input.projectPath, 'worker', input)
  })

  it('resolves the installation before reading the shared cache', async () => {
    const stable = createMiniProgram()
    const rc = createMiniProgram()
    const hooks = {
      resolveSessionOptions: vi.fn(async (input: { projectPath: string }) => ({ ...input, installationId: 'stable' })),
      connectMiniProgram: vi.fn().mockResolvedValueOnce(stable).mockResolvedValueOnce(rc),
    }
    const options = { projectPath: 'resolved-fixture' }
    await acquireSharedMiniProgram(hooks, options)
    hooks.resolveSessionOptions.mockImplementation(async input => ({ ...input, installationId: 'rc' }))
    await acquireSharedMiniProgram(hooks, options)
    expect(hooks.connectMiniProgram).toHaveBeenCalledTimes(2)
    await closeSharedMiniProgram(options.projectPath, undefined, { installationId: 'stable' })
    await closeSharedMiniProgram(options.projectPath, undefined, { installationId: 'rc' })
  })

  it('reuses shared mini program sessions per project', async () => {
    const miniProgram = createMiniProgram()
    const hooks = {
      connectMiniProgram: vi.fn(async () => miniProgram),
    }

    const first = await acquireSharedMiniProgram(hooks, { projectPath: '/project-a' })
    const second = await acquireSharedMiniProgram(hooks, { projectPath: '/project-a' })

    expect(first).toBe(second)
    expect(hooks.connectMiniProgram).toHaveBeenCalledTimes(1)
    expect(getSharedMiniProgramSessionCount()).toBe(1)

    releaseSharedMiniProgram('/project-a')
    releaseSharedMiniProgram('/project-a')
    expect(getSharedMiniProgramSessionCount()).toBe(1)

    await closeSharedMiniProgram('/project-a')
    expect(miniProgram.disconnect).toHaveBeenCalledTimes(1)
    expect(getSharedMiniProgramSessionCount()).toBe(0)
  })

  it('separates shared sessions by explicit session id', async () => {
    const miniProgramA = createMiniProgram()
    const miniProgramB = createMiniProgram()
    const hooks = {
      connectMiniProgram: vi.fn()
        .mockResolvedValueOnce(miniProgramA)
        .mockResolvedValueOnce(miniProgramB),
    }

    const first = await acquireSharedMiniProgram(hooks, {
      projectPath: '/project-a',
      sessionId: 'worker-a',
    })
    const second = await acquireSharedMiniProgram(hooks, {
      projectPath: '/project-a',
      sessionId: 'worker-b',
    })

    expect(first).toBe(miniProgramA)
    expect(second).toBe(miniProgramB)
    expect(hooks.connectMiniProgram).toHaveBeenCalledTimes(2)
    expect(getSharedMiniProgramSessionCount()).toBe(2)
  })

  it('separates shared sessions by explicit port', async () => {
    const miniProgramA = createMiniProgram()
    const miniProgramB = createMiniProgram()
    const hooks = {
      connectMiniProgram: vi.fn()
        .mockResolvedValueOnce(miniProgramA)
        .mockResolvedValueOnce(miniProgramB),
    }

    await acquireSharedMiniProgram(hooks, {
      port: 19_510,
      projectPath: '/project-a',
    })
    await acquireSharedMiniProgram(hooks, {
      port: 19_511,
      projectPath: '/project-a',
    })

    expect(hooks.connectMiniProgram).toHaveBeenCalledTimes(2)
    expect(getSharedMiniProgramSessionCount()).toBe(2)
  })

  it('normalizes shared session connection errors', async () => {
    const hooks = {
      connectMiniProgram: vi.fn(async () => {
        throw new Error('raw')
      }),
      normalizeConnectionError: vi.fn(() => new Error('normalized')),
    }

    await expect(acquireSharedMiniProgram(hooks, { projectPath: '/project-a' })).rejects.toThrow('normalized')
    expect(getSharedMiniProgramSessionCount()).toBe(0)
  })

  it('disconnects non-shared sessions after runner completes', async () => {
    const miniProgram = createMiniProgram()
    const hooks = {
      connectMiniProgram: vi.fn(async () => miniProgram),
    }

    const result = await withMiniProgram(hooks, { projectPath: '/project-a' }, async () => 'ok')

    expect(result).toBe('ok')
    expect(miniProgram.disconnect).toHaveBeenCalledTimes(1)
    expect(miniProgram.close).not.toHaveBeenCalled()
  })

  it('keeps a closing shared connection registered until disposal succeeds and retries failures', async () => {
    const miniProgram = createMiniProgram()
    const hooks = { connectMiniProgram: vi.fn(async () => miniProgram) }
    const projectPath = 'async-cleanup-fixture'
    await acquireSharedMiniProgram(hooks, { projectPath })
    let finish!: () => void
    miniProgram.disconnect.mockImplementationOnce(() => new Promise<void>((resolve) => {
      finish = resolve
    }))
    const first = closeSharedMiniProgram(projectPath)
    const second = closeSharedMiniProgram(projectPath)
    await Promise.resolve()
    expect(getSharedMiniProgramSessionCount()).toBe(1)
    expect(miniProgram.disconnect).toHaveBeenCalledOnce()
    finish()
    await Promise.all([first, second])
    expect(getSharedMiniProgramSessionCount()).toBe(0)

    await acquireSharedMiniProgram(hooks, { projectPath })
    miniProgram.disconnect.mockRejectedValueOnce(new Error('close unconfirmed'))
    await expect(closeSharedMiniProgram(projectPath)).rejects.toThrow('close unconfirmed')
    expect(getSharedMiniProgramSessionCount()).toBe(1)
    await closeSharedMiniProgram(projectPath)
    expect(getSharedMiniProgramSessionCount()).toBe(0)
  })

  it('resets shared sessions when runner fails', async () => {
    const miniProgram = createMiniProgram()
    const hooks = {
      connectMiniProgram: vi.fn(async () => miniProgram),
      normalizeConnectionError: vi.fn(() => new Error('runner failed')),
    }

    await expect(withMiniProgram(hooks, {
      projectPath: '/project-a',
      sharedSession: true,
    }, async () => {
      throw new Error('raw')
    })).rejects.toThrow('runner failed')

    expect(miniProgram.disconnect).toHaveBeenCalledTimes(1)
    expect(getSharedMiniProgramSessionCount()).toBe(0)
  })

  it('never lends a closing session again after failed disposal and reconnects only after confirmation', async () => {
    const previous = createMiniProgram()
    const replacement = createMiniProgram()
    const hooks = { connectMiniProgram: vi.fn().mockResolvedValueOnce(previous).mockResolvedValueOnce(replacement) }
    const options = { projectPath: 'failed-close-acquire-fixture' }
    await acquireSharedMiniProgram(hooks, options)
    const failure = new Error('socket closure unconfirmed')
    previous.disconnect.mockRejectedValueOnce(failure).mockRejectedValueOnce(failure)

    await expect(closeSharedMiniProgram(options.projectPath)).rejects.toBe(failure)
    await expect(acquireSharedMiniProgram(hooks, options)).rejects.toBe(failure)
    expect(hooks.connectMiniProgram).toHaveBeenCalledOnce()

    let finish!: () => void
    previous.disconnect.mockImplementationOnce(() => new Promise<void>((resolve) => {
      finish = resolve
    }))
    const recovered = acquireSharedMiniProgram(hooks, options)
    await vi.waitFor(() => expect(previous.disconnect).toHaveBeenCalledTimes(3))
    expect(hooks.connectMiniProgram).toHaveBeenCalledOnce()
    finish()
    await expect(recovered).resolves.toBe(replacement)
    expect(hooks.connectMiniProgram).toHaveBeenCalledTimes(2)
    await closeSharedMiniProgram(options.projectPath)
  })

  it.each([false, true])('preserves runner and async cleanup failures for shared=%s', async (sharedSession) => {
    const program = createMiniProgram()
    const failure = new Error('runner failed')
    const cleanupFailure = new Error('socket unconfirmed')
    program.disconnect.mockRejectedValueOnce(cleanupFailure)
    const hooks = { connectMiniProgram: vi.fn(async () => program) }
    await expect(withMiniProgram(hooks, { projectPath: '/project-a', sharedSession }, async () => {
      throw failure
    })).rejects.toMatchObject({ errors: [failure, cleanupFailure], cause: failure })
    if (sharedSession) {
      await closeSharedMiniProgram('/project-a')
    }
  })
})
