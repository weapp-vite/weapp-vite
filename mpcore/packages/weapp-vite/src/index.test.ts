import { beforeEach, describe, expect, it, vi } from 'vitest'

const { artifact, buildMock, createTestProjectMock, currentMock, mpcoreMatchersMock } = vi.hoisted(() => {
  const artifact = {
    appConfigPath: '/project/.weapp-vite/test-artifacts/app.json',
    miniprogramRootPath: '/project/.weapp-vite/test-artifacts',
    projectPath: '/project',
    sourceRootPath: '/project/src',
  }
  return {
    artifact,
    buildMock: vi.fn(async () => artifact),
    createTestProjectMock: vi.fn(),
    currentMock: vi.fn(async () => true),
    mpcoreMatchersMock: {},
  }
})

vi.mock('weapp-vite/test', () => ({
  buildTestArtifact: buildMock,
  createTestProject: createTestProjectMock,
  isTestArtifactCurrent: currentMock,
  mpcoreMatchers: mpcoreMatchersMock,
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

  it('keeps package namespaces aligned with weapp-vite test and e2e APIs', async () => {
    const [adapter, adapterE2e, adapterTest, e2e, test] = await Promise.all([
      import('./index'),
      import('./e2e'),
      import('./test'),
      import('weapp-vite/e2e'),
      import('weapp-vite/test'),
    ])

    expect(adapterE2e).not.toHaveProperty('buildTestArtifact')
    expect(adapterE2e.launchAutomator).toBe(e2e.launchAutomator)
    expect(adapterTest.createTestProject).toBe(test.createTestProject)
    expect(adapterTest.mpcoreMatchers).toBe(test.mpcoreMatchers)
    expect(typeof adapterTest.createWeappViteTestProject).toBe('function')
    expect(adapterTest).not.toHaveProperty('launchAutomator')
    expect(adapterE2e).not.toHaveProperty('createTestProject')
    expect(adapterTest.buildTestArtifact).toBe(test.buildTestArtifact)
    expect(adapterTest.isTestArtifactCurrent).toBe(test.isTestArtifactCurrent)
    expect(adapterTest.watchTestArtifact).toBe(test.watchTestArtifact)
    expect(typeof adapterTest.buildWeappViteTestArtifact).toBe('function')
    expect(typeof adapterTest.clearWeappViteTestArtifactCache).toBe('function')
    expect(typeof adapterTest.watchWeappViteTestArtifact).toBe('function')
    expect(adapter.createTestProject).toBe(test.createTestProject)
    expect(adapter.mpcoreMatchers).toBe(test.mpcoreMatchers)
    expect(adapter.buildTestArtifact).toBe(test.buildTestArtifact)
    expect(adapter.isTestArtifactCurrent).toBe(test.isTestArtifactCurrent)
    expect(adapter.watchTestArtifact).toBe(test.watchTestArtifact)
    expect(adapter.createWeappViteTestProject).toBe(adapterTest.createWeappViteTestProject)
  })
})
