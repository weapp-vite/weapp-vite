import { beforeEach, describe, expect, it, vi } from 'vitest'

const { artifact, buildMock } = vi.hoisted(() => {
  const artifact = {
    appConfigPath: '/project/.weapp-vite/test-artifacts/app.json',
    miniprogramRootPath: '/project/.weapp-vite/test-artifacts',
    projectPath: '/project',
    sourceRootPath: '/project/src',
  }
  return {
    artifact,
    buildMock: vi.fn(async () => artifact),
  }
})

vi.mock('node:fs/promises', () => ({
  default: { access: vi.fn(async () => undefined) },
}))
vi.mock('weapp-vite/test', () => ({
  buildTestArtifact: buildMock,
  watchTestArtifact: vi.fn(),
}))

describe('@mpcore/weapp-vite', () => {
  beforeEach(async () => {
    buildMock.mockClear()
    const { clearWeappViteTestArtifactCache } = await import('./index')
    clearWeappViteTestArtifactCache()
  })

  it('reuses a valid test artifact for repeated project requests', async () => {
    const { buildWeappViteTestArtifact } = await import('./index')

    await expect(buildWeappViteTestArtifact({ cwd: '/project' })).resolves.toEqual(artifact)
    await expect(buildWeappViteTestArtifact({ cwd: '/project' })).resolves.toEqual(artifact)
    expect(buildMock).toHaveBeenCalledTimes(1)
  })
})
