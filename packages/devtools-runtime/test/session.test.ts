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

  it('closes non-shared sessions after runner completes', async () => {
    const miniProgram = createMiniProgram()
    const hooks = {
      connectMiniProgram: vi.fn(async () => miniProgram),
    }

    const result = await withMiniProgram(hooks, { projectPath: '/project-a' }, async () => 'ok')

    expect(result).toBe('ok')
    expect(miniProgram.close).toHaveBeenCalledTimes(1)
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
})
