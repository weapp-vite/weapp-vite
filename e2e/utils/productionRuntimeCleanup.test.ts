import { access, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { expect, it, vi } from 'vitest'
import { MANAGED_PROJECT_JOURNAL_ENV } from 'weapp-ide-cli'
import { createProductionRuntime } from './productionRuntime'
import { releaseProductionRuntimeResources } from './productionRuntimeCleanup'

it.each(['runtime', 'build'] as const)('retains project files while the %s owner has not closed', async (owner) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'production-cleanup-'))
  const evidence = path.join(root, 'project.json')
  const firstFailure = new Error('Original runtime failure')
  const closeFailure = new Error(`${owner} still owns the project`)
  const closeRuntime = vi.fn(async () => {
    if (owner === 'runtime') {
      throw closeFailure
    }
  })
  const closeBuild = vi.fn(async () => {
    if (owner === 'build') {
      throw closeFailure
    }
  })
  const removeFixture = vi.fn(() => rm(root, { recursive: true, force: true }))
  try {
    await writeFile(evidence, 'owned cleanup evidence')
    await expect(releaseProductionRuntimeResources({ closeRuntime, closeBuild, removeFixture, pendingFailures: [firstFailure] }))
      .rejects
      .toMatchObject({ cause: firstFailure, errors: [firstFailure, closeFailure] })
    expect(closeRuntime).toHaveBeenCalledOnce()
    expect(closeBuild).toHaveBeenCalledOnce()
    expect(removeFixture).not.toHaveBeenCalled()
    expect(await readFile(evidence, 'utf8')).toBe('owned cleanup evidence')
  }
  finally {
    await rm(root, { recursive: true, force: true })
  }
})

it('removes its project after both owners close while retaining the original verification failure', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'production-cleanup-'))
  const firstFailure = new Error('Verification failed')
  const order: string[] = []
  try {
    await expect(releaseProductionRuntimeResources({
      closeRuntime: async () => { order.push('runtime') },
      closeBuild: async () => { order.push('build') },
      removeFixture: async () => {
        order.push('fixture')
        await rm(root, { recursive: true, force: true })
      },
      pendingFailures: [firstFailure],
    })).rejects.toMatchObject({ cause: firstFailure, errors: [firstFailure] })
    expect(order).toEqual(['runtime', 'build', 'fixture'])
    await expect(access(root)).rejects.toMatchObject({ code: 'ENOENT' })
  }
  finally {
    await rm(root, { recursive: true, force: true })
  }
})

it('preserves every cleanup failure without deleting files still owned by either resource', async () => {
  const runtimeFailure = new Error('Runtime close failed')
  const buildFailure = new Error('Build close failed')
  const removeFixture = vi.fn(async () => {})
  await expect(releaseProductionRuntimeResources({
    closeRuntime: async () => { throw runtimeFailure },
    closeBuild: async () => { throw buildFailure },
    removeFixture,
  })).rejects.toMatchObject({ cause: runtimeFailure, errors: [runtimeFailure, buildFailure] })
  expect(removeFixture).not.toHaveBeenCalled()
})

it('retains an uncertain failed production launch until its managed journal is recovered', async () => {
  const failure = new Error('Lost project launch receipt')
  const launch = vi.fn().mockRejectedValue(failure)
  const closeBuild = vi.fn(async () => {})
  const removeFixture = vi.fn(async () => {})
  vi.stubEnv(MANAGED_PROJECT_JOURNAL_ENV, 'owned-failed-launch-journal')
  try {
    const runtime = createProductionRuntime({ projectPath: path.resolve('owned production project'), cliPath: 'selected-cli', provider: 'devtools', launch })
    await expect(runtime.open()).rejects.toBe(failure)
    await expect(releaseProductionRuntimeResources({ closeRuntime: runtime.close, closeBuild, removeFixture }))
      .rejects
      .toMatchObject({ cause: expect.objectContaining({ cause: failure }) })
    expect(closeBuild).toHaveBeenCalledOnce()
    expect(removeFixture).not.toHaveBeenCalled()
  }
  finally {
    vi.unstubAllEnvs()
  }
})
