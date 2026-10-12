import { afterEach, expect, it } from 'vitest'
import { cleanupReleaseFixtures, createReleaseFixture, packages } from './repoctl-release/fixtures'

afterEach(cleanupReleaseFixtures)

it('runs quality once and preserves publish hooks across the six native stages', async () => {
  const fixture = await createReleaseFixture()
  fixture.setPublish(() => {
    fixture.summary()
    packages.forEach(pkg => fixture.visible.add(pkg.name))
    return { status: 0, stdout: '', stderr: '' }
  })

  for (const stage of ['plan', 'verify', 'prepare', 'upload', 'confirm', 'finalize'] as const) {
    await fixture.runStage(stage)
  }

  expect(fixture.hooks).toEqual(['quality', 'before', 'after'])
  expect(fixture.publishes).toHaveLength(1)
  for (const pkg of packages) {
    const tag = `${pkg.name}@${pkg.version}`
    expect(fixture.github.ensureTag).toHaveBeenCalledWith({ tag, target: 'a'.repeat(40) })
    expect(fixture.github.ensureRelease).toHaveBeenCalledWith(expect.objectContaining({ tag }))
  }
  const progress = await fixture.stageProgress()
  expect(progress.done).toEqual(['plan', 'verify', 'prepare', 'upload', 'confirm', 'finalize'])
  expect(progress.stages.every(stage => stage.status === 'complete' && stage.elapsedMs >= 0)).toBe(true)
})

it('requires successful verification before preparation or upload', async () => {
  const fixture = await createReleaseFixture()
  await fixture.runStage('plan')
  await expect(fixture.runStage('prepare')).rejects.toThrow(/preceding stage/)

  fixture.failHook('quality')
  await expect(fixture.runStage('verify')).rejects.toThrow(/command failed/)
  await expect(fixture.runStage('prepare')).rejects.toThrow(/preceding stage/)
  await expect(fixture.runStage('upload')).rejects.toThrow(/preceding stage/)
  expect(fixture.hooks).toEqual(['quality'])
  expect(fixture.publishes).toEqual([])
  expect(fixture.github.ensurePullRequest).not.toHaveBeenCalled()
  expect((await fixture.stageProgress()).stages.at(-1)).toMatchObject({ stage: 'verify', status: 'failed' })
})

it.each(['source', 'diff', 'candidates', 'configuration', 'run', 'attempt'] as const)(
  'rejects a verified receipt after its %s changes',
  async (change) => {
    const fixture = await createReleaseFixture()
    await fixture.runStage('plan')
    await fixture.runStage('verify')
    if (change === 'source') {
      fixture.setSource('b'.repeat(40))
    }
    if (change === 'diff') {
      fixture.setDiff('diff --git a/source.ts b/source.ts\n+changed\n')
    }
    if (change === 'candidates') {
      const { writeFile } = await import('node:fs/promises')
      const { default: path } = await import('node:path')
      await writeFile(path.join(fixture.cwd, 'packages/0/package.json'), JSON.stringify({ ...packages[0], version: '1.0.1' }))
    }
    const overrides = change === 'configuration'
      ? { config: { qualityScripts: ['different-quality'] } }
      : change === 'run' || change === 'attempt'
        ? { env: { [change === 'run' ? 'GITHUB_RUN_ID' : 'GITHUB_RUN_ATTEMPT']: 'different-run' } }
        : {}

    await expect(fixture.runStage('prepare', overrides)).rejects.toThrow(/Stale release stage receipt/)
    expect(fixture.hooks).toEqual(['quality'])
    expect(fixture.publishes).toEqual([])
  },
)
