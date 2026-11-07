import { lstat, mkdir, readFile, rm, stat, symlink, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { afterEach, expect, it } from 'vitest'
import { emitFixtureDeclarations } from './repoctlReleaseSourceRecovery/declarations'
import { cleanupSourceRecoveryFixtures, marketplaceHook, mirrorHook, releasedPackage, withSourceRecoveryFixture } from './repoctlReleaseSourceRecovery/fixture'

afterEach(cleanupSourceRecoveryFixtures)

it('resumes all six source recovery stages without duplicate publication or consuming current intents', ({ signal }) => withSourceRecoveryFixture(signal, async (fixture) => {
  const planned = await fixture.runStage('plan')
  expect(planned.done).toEqual(['plan'])
  expect(fixture.recoveryRoot.split(path.sep)).not.toContain('.git')
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
  expect((await stat(path.join(fixture.cwd, '.git/repoctl-release-ci/receipt.json'))).isFile()).toBe(true)
  await expect(stat(fixture.recoveryRoot)).rejects.toMatchObject({ code: 'ENOENT' })
}), 30_000)

it('emits portable declarations in the recovered quality checkout while reproducing the legacy .git failure', ({ signal }) => withSourceRecoveryFixture(signal, async (fixture) => {
  const legacy = emitFixtureDeclarations(path.join(fixture.cwd, '.git/legacy-probe'))
  expect(new Set(legacy.diagnostics)).toEqual(new Set([2883]))
  let compiled = false
  fixture.setQuality((cwd) => {
    expect(cwd.split(path.sep)).not.toContain('.git')
    const result = emitFixtureDeclarations(cwd)
    expect(result.diagnostics).toEqual([])
    expect(result.declarations).toContain('import("@fixture/parser").ParseResult')
    compiled = true
  })

  await fixture.runStage('plan')
  await fixture.runStage('verify')

  expect(compiled).toBe(true)
  expect(fixture.hooks.map(hook => hook.script)).toEqual(['quality'])
  expect(fixture.git('status', '--porcelain')).toBe('')
}), 30_000)

it('replans only its existing recovery root', ({ signal }) => withSourceRecoveryFixture(signal, async (fixture) => {
  await fixture.runStage('plan')
  const recoveryRoot = fixture.recoveryRoot
  const marker = path.join(recoveryRoot, 'previous-plan')
  await writeFile(marker, 'owned earlier plan')

  await fixture.runStage('plan')

  expect(fixture.recoveryRoot).toBe(recoveryRoot)
  expect(fixture.checkouts).toEqual([path.join(recoveryRoot, 'checkout'), path.join(recoveryRoot, 'checkout')])
  await expect(stat(marker)).rejects.toMatchObject({ code: 'ENOENT' })
  expect(fixture.git('rev-parse', 'HEAD')).toBe(fixture.mainSha)
}), 30_000)

for (const identity of [{ runId: 'another-fixture-run' }, { attempt: '2' }]) {
  it(`isolates another workflow identity: ${JSON.stringify(identity)}`, ({ signal }) => withSourceRecoveryFixture(signal, async (fixture) => {
    await fixture.runStage('plan')
    const originalRoot = fixture.recoveryRoot
    const marker = path.join(originalRoot, 'original-run')
    await writeFile(marker, 'preserved earlier run')

    await fixture.runStage('plan', identity)

    expect(fixture.recoveryRoot).not.toBe(originalRoot)
    expect(await readFile(marker, 'utf8')).toBe('preserved earlier run')
    await fixture.runStage('verify', identity)
    expect(fixture.installs).toEqual([path.join(fixture.recoveryRoot, 'checkout')])
    expect(fixture.hooks.at(-1)?.head).toBe(fixture.sourceSha)
  }), 30_000)
}

for (const stage of ['prepare', 'upload'] as const) {
  it(`rejects changed recovered source before ${stage}`, ({ signal }) => withSourceRecoveryFixture(signal, async (fixture) => {
    for (const preceding of ['plan', 'verify', ...(stage === 'upload' ? ['prepare'] as const : [])] as const) {
      await fixture.runStage(preceding)
    }
    const source = path.join(fixture.recoveryRoot, 'checkout/packages/library/CHANGELOG.md')
    await writeFile(source, '# Altered after verification\n')

    await expect(fixture.runStage(stage)).rejects.toThrow(/Recovery checkout changed; restart at plan and verify/)

    expect(await readFile(source, 'utf8')).toBe('# Altered after verification\n')
    expect(fixture.hooks.map(hook => hook.script)).toEqual(['quality'])
    expect(fixture.publishes).toEqual([])
    expect(fixture.checkpoint().state.complete).toBe(false)
  }), 30_000)
}

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
  expect((await stat(path.join(fixture.recoveryRoot, 'checkout'))).isDirectory()).toBe(true)
}, `${marketplaceHook}:different`), 30_000)

it('preserves the recovery root when finalize cannot report its successful result', ({ signal }) => withSourceRecoveryFixture(signal, async (fixture) => {
  for (const stage of ['plan', 'verify', 'prepare', 'upload', 'confirm'] as const) {
    await fixture.runStage(stage)
  }

  await expect(fixture.runStage('finalize', { summary: fixture.cwd })).rejects.toThrow(/EISDIR|illegal operation on a directory/i)

  expect((await stat(path.join(fixture.recoveryRoot, 'checkout'))).isDirectory()).toBe(true)
  expect(fixture.publishes).toEqual([])
  expect(await fixture.intent()).toBe(fixture.originalIntent)
}), 30_000)

for (const [entry, type] of [
  ['root', 'file'],
  ['root', 'symlink'],
  ['checkout', 'file'],
  ['checkout', 'symlink'],
  ['package-manager', 'file'],
  ['package-manager', 'symlink'],
] as const) {
  it(`rejects a conflicting ${entry} ${type} without deleting foreign contents`, ({ signal }) => withSourceRecoveryFixture(signal, async (fixture) => {
    await fixture.runStage('plan')
    const directory = entry === 'root' ? fixture.recoveryRoot : path.join(fixture.recoveryRoot, entry)
    const foreign = path.join(fixture.cwd, '.git/foreign-target')
    await mkdir(foreign)
    await writeFile(path.join(foreign, 'preserve'), 'unrelated target')
    await rm(directory, { recursive: true })
    if (type === 'symlink') {
      await symlink(foreign, directory, 'junction')
    }
    else {
      await writeFile(directory, 'conflicting fixture file')
    }

    await expect(fixture.runStage(entry === 'root' ? 'plan' : 'verify')).rejects.toThrow(/Recovery directory is invalid/)
    expect((await lstat(directory)).isSymbolicLink()).toBe(type === 'symlink')
    expect(await readFile(type === 'symlink' ? path.join(directory, 'preserve') : directory, 'utf8')).toBe(type === 'symlink' ? 'unrelated target' : 'conflicting fixture file')
    expect(await readFile(path.join(foreign, 'preserve'), 'utf8')).toBe('unrelated target')
    expect(fixture.installs).toEqual([])
    expect(fixture.hooks).toEqual([])
    expect(fixture.publishes).toEqual([])
    expect(fixture.checkpoint().state.complete).toBe(false)
  }), 30_000)
}
