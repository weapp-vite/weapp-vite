import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
// eslint-disable-next-line e18e/ban-dependencies -- 通过临时 Git 仓库覆盖真实索引与重命名行为。
import { execa } from 'execa'
import { afterEach, expect, it } from 'vitest'
import { normalizeChangedPath, parseChangedNames, readChanges } from './changes.ts'

const roots: string[] = []
afterEach(async () => {
  await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })))
})

async function repository() {
  const root = await mkdtemp(path.join(os.tmpdir(), 'verify-changes-'))
  roots.push(root)
  const git = (args: string[]) => execa('git', args, { cwd: root })
  await git(['init', '--quiet', '--initial-branch=fixture'])
  await writeFile(path.join(root, 'tracked.ts'), 'export const value = 1\n')
  await writeFile(path.join(root, 'deleted.ts'), 'export {}\n')
  await git(['add', '.'])
  await git(['-c', 'user.name=Verification Test', '-c', 'user.email=verification@example.invalid', 'commit', '--quiet', '-m', 'fixture'])
  return { root, git }
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

it('includes staged, unstaged, deleted and untracked files relative to the base', async () => {
  const { root, git } = await repository()
  const baseline = await readFile(path.join(root, 'tracked.ts'), 'utf8')
  await writeFile(path.join(root, 'tracked.ts'), 'export const value = 2\n')
  await git(['add', 'tracked.ts'])
  // 工作区回到基线时，索引中的变更依然不能遗漏。
  await writeFile(path.join(root, 'tracked.ts'), baseline)
  await rm(path.join(root, 'deleted.ts'))
  await writeFile(path.join(root, 'new file.ts'), 'export {}\n')
  const result = await readChanges(root, { base: 'HEAD' })
  expect(result.files).toEqual(['deleted.ts', 'new file.ts', 'tracked.ts'])
  expect(result.fallback).toBe(false)
  const next = await readChanges(root, { base: 'HEAD' })
  expect(next.fingerprint).toBe(result.fingerprint)
  await writeFile(path.join(root, 'new file.ts'), 'export const changed = true\n')
  expect((await readChanges(root, { base: 'HEAD' })).fingerprint).not.toBe(result.fingerprint)
})

it('rejects an invalid explicit base and conservatively handles a missing automatic base', async () => {
  const { root } = await repository()
  await expect(readChanges(root, { base: 'missing-reference' })).rejects.toThrow()
  const result = await readChanges(root)
  expect(result.fallback).toBe(true)
  expect(result.warnings).toHaveLength(1)
})
