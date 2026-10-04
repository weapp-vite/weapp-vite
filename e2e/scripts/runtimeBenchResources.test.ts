import type { BenchSessionResource } from './runtimeBench/resources'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { assertBenchResourcesClosed, closeBenchProject, createBenchResourceRegistry } from './runtimeBench/resources'

const execaMock = vi.hoisted(() => vi.fn())
vi.mock('execa', () => ({ execa: execaMock }))
beforeEach(() => vi.clearAllMocks())

function registry() {
  const closeProject = vi.fn(async (_resource: BenchSessionResource) => {})
  const waitForPortClosed = vi.fn(async (_port: number) => {})
  const onResource = vi.fn(async (_resource: BenchSessionResource) => {})
  return { closeProject, waitForPortClosed, onResource, resources: createBenchResourceRegistry({ cliPath: 'stable-cli', closeProject, waitForPortClosed, onResource }) }
}

describe('benchmark owned snapshot disposal', () => {
  it('closes only registered snapshots using the originally selected installation', async () => {
    const { resources, closeProject, waitForPortClosed, onResource } = registry()
    const metadata = Object.freeze({ projectPath: 'snapshot', wsEndpoint: 'ws://127.0.0.1:9415', port: 9415 })
    await resources.ownProject({ projectPath: 'snapshot', cliPath: 'stable-cli' })
    await resources.attachMetadata(metadata)
    await expect(resources.attachMetadata({ ...metadata, projectPath: 'manual-project' })).rejects.toThrow('not an owned snapshot')
    await expect(resources.ownProject({ projectPath: 'another-installation', cliPath: 'rc-cli' })).rejects.toThrow('different DevTools CLI')
    await resources.closeAll()
    await resources.closeAll()
    expect(closeProject).toHaveBeenCalledOnce()
    expect(closeProject).toHaveBeenCalledWith(expect.objectContaining({ projectPath: 'snapshot', cliPath: 'stable-cli' }))
    expect(waitForPortClosed).toHaveBeenCalledExactlyOnceWith(9415, '127.0.0.1')
    const final = onResource.mock.calls.at(-1)![0]
    expect(final).toMatchObject({ status: 'closed', projectClosed: true, portClosed: true })
    expect(() => assertBenchResourcesClosed([final])).not.toThrow()
    expect(metadata).toEqual({ projectPath: 'snapshot', wsEndpoint: 'ws://127.0.0.1:9415', port: 9415 })
    await closeBenchProject(final)
    expect(execaMock).toHaveBeenCalledExactlyOnceWith('stable-cli', ['close', '--project', 'snapshot'], { timeout: 30_000 })
  })

  it.each(['project', 'port'] as const)('retains %s cleanup failure and never disposes the resource twice', async (kind) => {
    const { resources, closeProject, waitForPortClosed, onResource } = registry()
    await resources.ownProject({ projectPath: 'snapshot', cliPath: 'stable-cli' })
    await resources.attachMetadata({ projectPath: 'snapshot', wsEndpoint: 'ws://127.0.0.1:9415', port: 9415 })
    if (kind === 'project') {
      closeProject.mockRejectedValue(new Error('CLI close rejected'))
    }
    else {
      waitForPortClosed.mockRejectedValue(new Error('port remains open'))
    }
    await expect(resources.closeAll()).rejects.toThrow('owned resource cleanup failed')
    await expect(resources.closeAll()).rejects.toThrow('owned resource cleanup failed')
    expect(closeProject).toHaveBeenCalledOnce()
    expect(waitForPortClosed).toHaveBeenCalledOnce()
    const final = onResource.mock.calls.at(-1)![0]
    expect(final.status).toBe('failed')
    expect(() => assertBenchResourcesClosed([final])).toThrow('was not closed')
  })

  it('releases all registered launch attempts even when an earlier attempt cannot close', async () => {
    const { resources, closeProject } = registry()
    await resources.ownProject({ projectPath: 'first-attempt', cliPath: 'stable-cli' })
    await resources.ownProject({ projectPath: 'second-attempt', cliPath: 'stable-cli' })
    closeProject.mockRejectedValueOnce(new Error('first close failed'))
    await expect(resources.closeAll()).rejects.toThrow('owned resource cleanup failed')
    expect(closeProject.mock.calls.map(([resource]) => resource.projectPath)).toEqual(['first-attempt', 'second-attempt'])
  })

  it('rejects missing ownership or endpoint evidence without touching unknown ports', async () => {
    const { resources, closeProject, waitForPortClosed } = registry()
    await resources.ownProject({ projectPath: 'snapshot', cliPath: 'stable-cli' })
    await expect(resources.attachMetadata({ projectPath: 'snapshot', wsEndpoint: 'ws://remote-host:9415', port: 9415 })).rejects.toThrow('loopback')
    await resources.closeAll()
    expect(closeProject).toHaveBeenCalledOnce()
    expect(waitForPortClosed).not.toHaveBeenCalled()
    expect(() => assertBenchResourcesClosed([])).toThrow('Missing benchmark owned resource evidence')
    expect(() => assertBenchResourcesClosed([{ status: 'closed', projectClosed: true } as BenchSessionResource])).toThrow('Incomplete')
  })
})
