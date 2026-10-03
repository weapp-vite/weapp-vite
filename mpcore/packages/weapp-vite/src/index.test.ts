import { beforeEach, describe, expect, it, vi } from 'vitest'

const { artifact, buildMock, currentMock } = vi.hoisted(() => {
  const artifact = {
    appConfigPath: '/project/.weapp-vite/test-artifacts/app.json',
    miniprogramRootPath: '/project/.weapp-vite/test-artifacts',
    projectPath: '/project',
    sourceRootPath: '/project/src',
  }
  return {
    artifact,
    buildMock: vi.fn(async () => artifact),
    currentMock: vi.fn(async () => true),
  }
})

vi.mock('weapp-vite/test', () => ({
  buildTestArtifact: buildMock,
  isTestArtifactCurrent: currentMock,
  watchTestArtifact: vi.fn(),
}))

describe('@mpcore/weapp-vite', () => {
  beforeEach(async () => {
    buildMock.mockReset().mockResolvedValue(artifact)
    currentMock.mockReset().mockResolvedValue(true)
    const { clearWeappViteTestArtifactCache } = await import('./index')
    clearWeappViteTestArtifactCache()
  })

  it('reuses a valid test artifact for repeated project requests', async () => {
    const { buildWeappViteTestArtifact } = await import('./index')

    await expect(buildWeappViteTestArtifact({ cwd: '/project' })).resolves.toEqual(artifact)
    await expect(buildWeappViteTestArtifact({ cwd: '/project' })).resolves.toEqual(artifact)
    expect(buildMock).toHaveBeenCalledTimes(1)
  })

  it('coalesces concurrent requests when an input change invalidates the cache', async () => {
    const { buildWeappViteTestArtifact } = await import('./index')
    await buildWeappViteTestArtifact({ cwd: '/project' })
    currentMock.mockResolvedValueOnce(false)
    await Promise.all(Array.from({ length: 5 }, () => buildWeappViteTestArtifact({ cwd: '/project' })))
    expect(buildMock).toHaveBeenCalledTimes(2)
  })

  it('does not let an obsolete failure evict a replacement after explicit invalidation', async () => {
    const { buildWeappViteTestArtifact, clearWeappViteTestArtifactCache } = await import('./index')
    let reject!: (error: Error) => void
    buildMock.mockImplementationOnce(() => new Promise((_, rejectBuild) => {
      reject = rejectBuild
    }))
    const old = buildWeappViteTestArtifact({ cwd: '/project' })
    const failed = expect(old).rejects.toThrow('obsolete')
    clearWeappViteTestArtifactCache()
    await buildWeappViteTestArtifact({ cwd: '/project' })
    reject(new Error('obsolete'))
    await failed
    await buildWeappViteTestArtifact({ cwd: '/project' })
    expect(buildMock).toHaveBeenCalledTimes(2)
  })
})
