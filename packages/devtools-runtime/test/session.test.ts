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
