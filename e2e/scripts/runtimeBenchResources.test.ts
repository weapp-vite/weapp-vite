import type { BenchSessionResource } from './runtimeBench/resources'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { assertBenchResourcesClosed, closeBenchProject, createBenchResourceRegistry } from './runtimeBench/resources'

const mocks = vi.hoisted(() => ({ close: vi.fn(), read: vi.fn() }))
vi.mock('../../packages/weapp-ide-cli/src/devtoolsProjectOwnership', () => ({
  closeManagedWechatProject: mocks.close,
  readManagedWechatProjectRecords: mocks.read,
}))
beforeEach(() => vi.resetAllMocks())

const managedProject = { id: 'confirmed-owner', journalPath: 'task-journal' }
function metadata(projectPath = 'snapshot') {
  return { projectPath, wsEndpoint: 'ws://127.0.0.1:9415', port: 9415, managedProject }
}
function registry() {
  const closeProject = vi.fn(async (_resource: BenchSessionResource) => {})
  const waitForPortClosed = vi.fn(async (_port: number) => {})
  const onResource = vi.fn(async (_resource: BenchSessionResource) => {})
  return { closeProject, waitForPortClosed, onResource, resources: createBenchResourceRegistry({ cliPath: 'stable-cli', closeProject, waitForPortClosed, onResource }) }
}

describe('benchmark managed resource reporting', () => {
  it('delegates cleanup to confirmed ownership and reports released ports', async () => {
    const { resources, closeProject, waitForPortClosed, onResource } = registry()
    const value = Object.freeze(metadata())
    await resources.ownProject({ projectPath: 'snapshot', cliPath: 'stable-cli' })
    await resources.attachMetadata(value)
    await expect(resources.attachMetadata(metadata('manual-project'))).rejects.toThrow('not an owned snapshot')
    await expect(resources.ownProject({ projectPath: 'another-installation', cliPath: 'rc-cli' })).rejects.toThrow('different DevTools CLI')
    await resources.closeAll()
    await resources.closeAll()
    expect(closeProject).toHaveBeenCalledOnce()
    expect(waitForPortClosed).toHaveBeenCalledExactlyOnceWith(9415, '127.0.0.1')
    const final = onResource.mock.calls.at(-1)![0]
    expect(final).toMatchObject({ status: 'closed', projectClosed: true, portClosed: true })
    expect(() => assertBenchResourcesClosed([final])).not.toThrow()
    expect(value).toEqual(metadata())
    mocks.read.mockResolvedValue([{ id: managedProject.id, openedProjectWindow: true, projectPath: 'snapshot', target: { cliPath: 'stable-cli' }, port: 9415 }])
    await closeBenchProject(final)
    expect(mocks.close).toHaveBeenCalledExactlyOnceWith(managedProject)
  })

  it.each(['project', 'port'] as const)('retries a failed %s release without repeating successful work', async (kind) => {
    const { resources, closeProject, waitForPortClosed, onResource } = registry()
    await resources.ownProject({ projectPath: 'snapshot', cliPath: 'stable-cli' })
    await resources.attachMetadata(metadata())
    if (kind === 'project') {
      closeProject.mockRejectedValueOnce(new Error('CLI close rejected'))
    }
    else {
      waitForPortClosed.mockRejectedValueOnce(new Error('port remains open'))
    }
    await expect(resources.closeAll()).rejects.toThrow('owned resource cleanup failed')
    expect(onResource.mock.calls.at(-1)![0].status).toBe('failed')
    await resources.closeAll()
    await resources.closeAll()
    expect(closeProject).toHaveBeenCalledTimes(kind === 'project' ? 2 : 1)
    expect(waitForPortClosed).toHaveBeenCalledTimes(kind === 'port' ? 2 : 1)
    expect(() => assertBenchResourcesClosed([onResource.mock.calls.at(-1)![0]])).not.toThrow()
  })

  it('tries all confirmed owners even when an earlier cleanup fails', async () => {
    const { resources, closeProject } = registry()
    for (const projectPath of ['first-attempt', 'second-attempt']) {
      await resources.ownProject({ projectPath, cliPath: 'stable-cli' })
      await resources.attachMetadata(metadata(projectPath))
    }
    closeProject.mockRejectedValueOnce(new Error('first close failed'))
    await expect(resources.closeAll()).rejects.toThrow('owned resource cleanup failed')
    expect(closeProject.mock.calls.map(([resource]) => resource.projectPath)).toEqual(['first-attempt', 'second-attempt'])
  })

  it('never treats snapshot preparation or an arbitrary endpoint as window ownership', async () => {
    const { resources, closeProject, waitForPortClosed } = registry()
    await resources.ownProject({ projectPath: 'snapshot', cliPath: 'stable-cli' })
    await expect(resources.attachMetadata({ ...metadata(), managedProject: undefined })).rejects.toThrow('managed project ownership')
    await expect(resources.attachMetadata({ ...metadata(), wsEndpoint: 'ws://remote-host:9415' })).rejects.toThrow('loopback')
    await resources.closeAll()
    expect(closeProject).not.toHaveBeenCalled()
    expect(waitForPortClosed).not.toHaveBeenCalled()
    expect(() => assertBenchResourcesClosed([])).toThrow('Missing benchmark owned resource evidence')
    expect(() => assertBenchResourcesClosed([{ status: 'closed', projectClosed: true } as BenchSessionResource])).toThrow('Incomplete')
  })

  it.each([false, undefined])('preserves a borrowed or unknown project (%s)', async (openedProjectWindow) => {
    const resource: BenchSessionResource = { ...metadata(), id: 'session', cliPath: 'stable-cli', status: 'owned', projectClosed: false, portClosed: false }
    mocks.read.mockResolvedValue([{ id: managedProject.id, openedProjectWindow, projectPath: 'snapshot', target: { cliPath: 'stable-cli' }, port: 9415 }])
    await expect(closeBenchProject(resource)).rejects.toThrow('does not match its confirmed owner')
    expect(mocks.close).not.toHaveBeenCalled()
  })
})
