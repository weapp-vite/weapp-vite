import { writeFileSync } from 'node:fs'
import path from 'node:path'
import { afterEach, expect, it } from 'vitest'
import { bump, cleanupPreparationFixtures, createPreparationFixture, publicName } from './repoctl-release/preparation'

afterEach(cleanupPreparationFixtures)

it('verifies main with pending intents once before preparing the version PR', async () => {
  const fixture = await createPreparationFixture()
  fixture.setVersion(() => {
    const releases = [bump(publicName)]
    fixture.apply(releases)
    writeFileSync(path.join(fixture.cwd, 'packages/library/CHANGELOG.md'), '# Changelog\n\n## 1.0.1\n\n- 发布回归。\n')
    return { status: 0, stdout: JSON.stringify(releases), stderr: '' }
  })

  await fixture.runStage('plan')
  expect(fixture.hooks).toEqual([])
  await fixture.runStage('verify')
  expect(fixture.hooks).toEqual(['before-version', 'quality'])
  expect(fixture.versionCalls).toEqual([])
  const prepared = await fixture.runStage('prepare')
  expect(prepared).toMatchObject({ action: 'prepare', publish: false, done: ['plan', 'verify', 'prepare'] })
  expect(fixture.hooks).toEqual(['before-version', 'quality', 'after-version'])
  expect(fixture.versionCalls).toHaveLength(1)
  expect(fixture.github.ensurePullRequest).toHaveBeenCalledTimes(1)
  expect(fixture.gitCommands.filter(args => args[0] === 'push')).toHaveLength(1)
  expect(fixture.github.ensureTag).not.toHaveBeenCalled()
  expect(fixture.github.ensureRelease).not.toHaveBeenCalled()
})
