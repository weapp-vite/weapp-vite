import { readFile, rm, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { afterEach, expect, it } from 'vitest'
import { cleanupSourceRecoveryFixtures, marketplaceHook, mirrorHook, releasedPackage, withSourceRecoveryFixture } from './repoctlReleaseSourceRecovery/fixture'

afterEach(cleanupSourceRecoveryFixtures)

it('resumes all six source recovery stages without duplicate publication or consuming current intents', ({ signal }) => withSourceRecoveryFixture(signal, async (fixture) => {
  const planned = await fixture.runStage('plan')
  expect(planned.done).toEqual(['plan'])
  expect((await stat(path.join(fixture.recoveryRoot, 'package-manager'))).isDirectory()).toBe(true)

  let final = planned
  for (const stage of ['verify', 'prepare', 'upload', 'confirm', 'finalize'] as const) {
    final = await fixture.runStage(stage)
  }

  expect(final.done).toEqual(['plan', 'verify', 'prepare', 'upload', 'confirm', 'finalize'])
  expect(final.stages.every(stage => stage.status === 'complete')).toBe(true)
  expect(fixture.installs).toEqual([path.join(fixture.recoveryRoot, 'checkout')])
  expect(fixture.toolchains).toHaveLength(6)
  expect(new Set(fixture.toolchains).size).toBe(1)
  expect(fixture.hooks.map(({ script, cwd, head }) => ({ script, cwd, head }))).toEqual([
    { script: 'quality', cwd: path.join(fixture.recoveryRoot, 'checkout'), head: fixture.sourceSha },
    { script: mirrorHook, cwd: path.join(fixture.recoveryRoot, 'checkout'), head: fixture.sourceSha },
  ])
  expect(fixture.hooks.at(-1)?.source).toBe(fixture.sourceSha)
  expect(fixture.publishes).toEqual([])
  expect(fixture.github.ensurePullRequest).not.toHaveBeenCalled()
  expect(fixture.github.ensureRelease).not.toHaveBeenCalled()
  expect(fixture.github.ensureTag).toHaveBeenCalledWith({ tag: `${releasedPackage.name}@${releasedPackage.version}`, target: fixture.sourceSha })
  expect(fixture.checkpoint().state).toMatchObject({
    npm: 'complete',
    complete: true,
    metadata: [`${releasedPackage.name}@${releasedPackage.version}`],
    hooks: { [marketplaceHook]: 'complete', [mirrorHook]: 'complete' },
  })
  expect(final.releaseRecord).toMatch(/^[a-f0-9]{64}$/)
  expect(final.docsSites).toEqual(['website'])
  expect(fixture.automation.get(`releases/${final.releaseRecord}`)?.value).toMatchObject({
    sourceSha: fixture.sourceSha,
    packages: [{ ...releasedPackage, sourceSha: fixture.sourceSha }],
    releasedPackages: [releasedPackage.name],
  })
  expect(await fixture.output()).toContain(`release-record=${final.releaseRecord}\ndocs-sites=["website"]\n`)
  expect(await fixture.intent()).toBe(fixture.originalIntent)
  expect(fixture.git('rev-parse', 'HEAD')).toBe(fixture.mainSha)
  expect(fixture.git('status', '--porcelain')).toBe('')
  await expect(stat(fixture.recoveryRoot)).rejects.toMatchObject({ code: 'ENOENT' })
}), 30_000)

it('requires the exact interrupted hook acknowledgement before publishing completion outputs', ({ signal }) => withSourceRecoveryFixture(signal, async (fixture) => {
  for (const stage of ['plan', 'verify', 'prepare', 'upload', 'confirm'] as const) {
    await fixture.runStage(stage)
  }

  await expect(fixture.runStage('finalize')).rejects.toThrow(/afterPublish hook marketplace:publish has an unknown outcome/)
  expect(fixture.publishes).toEqual([])
  expect(fixture.hooks.map(hook => hook.script)).toEqual(['quality'])
  expect(fixture.checkpoint().state).toMatchObject({
    npm: 'complete',
    complete: false,
    hooks: { [marketplaceHook]: 'running', [mirrorHook]: 'pending' },
  })
  expect(fixture.automation.size).toBe(0)
  expect(await fixture.output()).not.toMatch(/release-record=[a-f0-9]{64}/)
  expect(await fixture.intent()).toBe(fixture.originalIntent)
  expect(fixture.git('rev-parse', 'HEAD')).toBe(fixture.mainSha)
}, `${marketplaceHook}:different`), 30_000)

it('rejects a conflicting file at the recovered package manager directory', ({ signal }) => withSourceRecoveryFixture(signal, async (fixture) => {
  await fixture.runStage('plan')
  const directory = path.join(fixture.recoveryRoot, 'package-manager')
  await rm(directory, { recursive: true })
  await writeFile(directory, 'conflicting fixture file')

  await expect(fixture.runStage('verify')).rejects.toThrow(/EEXIST|ENOTDIR/)
  expect(await readFile(directory, 'utf8')).toBe('conflicting fixture file')
  expect(fixture.installs).toEqual([])
  expect(fixture.hooks).toEqual([])
  expect(fixture.publishes).toEqual([])
  expect(fixture.checkpoint().state.complete).toBe(false)
}), 30_000)
