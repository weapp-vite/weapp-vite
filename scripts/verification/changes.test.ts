import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
// eslint-disable-next-line e18e/ban-dependencies -- 通过临时 Git 仓库覆盖真实索引与重命名行为。
import { execa } from 'execa'
import { afterEach, expect, it } from 'vitest'
import { normalizeChangedPath, parseChangedNames, readChanges } from './changes.ts'
import { FixtureLifecycle } from './fixtureLifecycle.ts'

const roots = new Set<string>()
const lifecycles: FixtureLifecycle[] = []
afterEach(async () => {
  await Promise.all(lifecycles.splice(0).map(lifecycle => lifecycle.close()))
  await Promise.all([...roots].map(async (root) => {
    await rm(root, { recursive: true, force: true })
    roots.delete(root)
  }))
})

async function repository(signal: AbortSignal) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'verify-changes-'))
  roots.add(root)
  const git = (args: string[]) => {
    signal.throwIfAborted()
    return execa('git', args, { cwd: root, cancelSignal: signal })
  }
  await git(['init', '--quiet', '--initial-branch=fixture', '--template='])
  await git(['config', 'core.hooksPath', path.join(root, '.git/fixture-hooks')])
  await writeFile(path.join(root, 'tracked.ts'), 'export const value = 1\n')
  await writeFile(path.join(root, 'deleted.ts'), 'export {}\n')
  await git(['add', '.'])
  await git(['-c', 'commit.gpgsign=false', '-c', 'user.name=Verification Test', '-c', 'user.email=verification@example.invalid', 'commit', '--quiet', '-m', 'fixture'])
  return { root, git, signal }
}

function withRepository(signal: AbortSignal, work: (fixture: Awaited<ReturnType<typeof repository>>) => Promise<void>) {
  const lifecycle = new FixtureLifecycle(signal)
  lifecycles.push(lifecycle)
  return lifecycle.run(async () => {
    const fixture = await repository(lifecycle.signal)
    lifecycle.signal.throwIfAborted()
    return work(fixture)
  })
}

it('parses rename and copy endpoints without splitting spaces or newlines', () => {
  expect(parseChangedNames('R100\0old name.ts\0new\nname.ts\0M\0other.ts\0'))
    .toEqual(['new\nname.ts', 'old name.ts', 'other.ts'])
  expect(() => parseChangedNames('R100\0only-one.ts\0')).toThrow('不完整')
  expect(normalizeChangedPath('src\\file.ts')).toBe('src/file.ts')
  for (const file of ['../escape.ts', '/outside.ts', 'C:\\outside.ts']) {
    expect(() => normalizeChangedPath(file)).toThrow()
  }
})

it('includes staged, unstaged, deleted and untracked files relative to the base', ({ signal }) => withRepository(signal, async ({ root, git, signal }) => {
  const baseline = await readFile(path.join(root, 'tracked.ts'), 'utf8')
  await writeFile(path.join(root, 'tracked.ts'), 'export const value = 2\n')
  await git(['add', 'tracked.ts'])
  // 工作区回到基线时，索引中的变更依然不能遗漏。
  await writeFile(path.join(root, 'tracked.ts'), baseline)
  await rm(path.join(root, 'deleted.ts'))
  await writeFile(path.join(root, 'new file.ts'), 'export {}\n')
  const result = await readChanges(root, { base: 'HEAD', signal })
  expect(result.files).toEqual(['deleted.ts', 'new file.ts', 'tracked.ts'])
  expect(result.fallback).toBe(false)
  const next = await readChanges(root, { base: 'HEAD', signal })
  expect(next.fingerprint).toBe(result.fingerprint)
  await writeFile(path.join(root, 'new file.ts'), 'export const changed = true\n')
  expect((await readChanges(root, { base: 'HEAD', signal })).fingerprint).not.toBe(result.fingerprint)
}))

it('rejects an invalid explicit base and conservatively handles a missing automatic base', ({ signal }) => withRepository(signal, async ({ root, signal }) => {
  await expect(readChanges(root, { base: 'missing-reference', signal })).rejects.toThrow()
  const result = await readChanges(root, { signal })
  expect(result.fallback).toBe(true)
  expect(result.warnings).toHaveLength(1)
}))
