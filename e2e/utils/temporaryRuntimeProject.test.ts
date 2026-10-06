import { access, mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanupTemporaryRuntimeProject } from './temporaryRuntimeProject'

const { cleanupOwned } = vi.hoisted(() => ({ cleanupOwned: vi.fn() }))
vi.mock('./ide-devtools-cleanup', () => ({ cleanupResidualIdeProcesses: cleanupOwned }))

describe('temporary runtime project lifetime', () => {
  let project: string
  beforeEach(async () => {
    cleanupOwned.mockReset().mockResolvedValue(undefined)
    project = await mkdtemp(path.join(os.tmpdir(), 'runtime-project-'))
    await writeFile(path.join(project, 'project.config.json'), '{}')
  })
  afterEach(async () => {
    await rm(project, { recursive: true, force: true })
  })

  it('preserves the project when launch failed before returning a session and ownership is unresolved', async () => {
    const failure = new Error('Unconfirmed project ownership')
    cleanupOwned.mockRejectedValue(failure)
    const stopDev = vi.fn()
    await expect(cleanupTemporaryRuntimeProject({ project, closeSession: () => {}, stopDev })).rejects.toThrow('E2E cleanup did not complete')
    await expect(access(path.join(project, 'project.config.json'))).resolves.toBeUndefined()
    expect(stopDev).toHaveBeenCalledOnce()
    expect(cleanupOwned).toHaveBeenCalledOnce()
  })

  it('stops the dev process and checks journal ownership even if session close fails', async () => {
    const stopDev = vi.fn()
    await expect(cleanupTemporaryRuntimeProject({
      project,
      closeSession: () => { throw new Error('Session close failed') },
      stopDev,
    })).rejects.toThrow('E2E cleanup did not complete')
    expect(stopDev).toHaveBeenCalledOnce()
    expect(cleanupOwned).toHaveBeenCalledOnce()
    await expect(access(project)).resolves.toBeUndefined()
  })

  it('keeps the project available until all owned windows and watchers have stopped', async () => {
    const order: string[] = []
    cleanupOwned.mockImplementation(async () => {
      await access(project)
      order.push('owned resources')
    })
    await cleanupTemporaryRuntimeProject({
      project,
      disposeTransport: () => { order.push('transport') },
      closeSession: async () => {
        await access(project)
        order.push('session')
      },
      stopDev: async () => {
        await access(project)
        order.push('dev')
      },
    })
    expect(order).toEqual(['transport', 'session', 'dev', 'owned resources'])
    await expect(access(project)).rejects.toMatchObject({ code: 'ENOENT' })
  })

  it('retains the project and still releases owned resources when a watcher cannot stop', async () => {
    await expect(cleanupTemporaryRuntimeProject({
      project,
      closeSession: () => {},
      stopDev: () => { throw new Error('Watcher is still active') },
    })).rejects.toThrow('E2E cleanup did not complete')
    expect(cleanupOwned).toHaveBeenCalledOnce()
    await expect(access(project)).resolves.toBeUndefined()
  })
})
