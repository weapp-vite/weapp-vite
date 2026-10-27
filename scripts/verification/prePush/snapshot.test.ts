import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
// eslint-disable-next-line e18e/ban-dependencies -- 通过真实临时 Git 仓库证明快照隔离与定向回收。
import { execa } from 'execa'
import { afterEach, expect, it } from 'vitest'
import { clearedGitEnvironment } from './git.ts'
import { withPushSnapshot } from './snapshot.ts'

const roots = new Set<string>()
afterEach(async () => {
  await Promise.all([...roots].map(async (root) => {
    await rm(root, { recursive: true, force: true })
    roots.delete(root)
  }))
})

async function repository() {
  const root = await mkdtemp(path.join(os.tmpdir(), 'push-snapshot-'))
  roots.add(root)
  const env = await clearedGitEnvironment(root)
  const git = (args: string[]) => execa('git', args, { cwd: root, env })
  await git(['init', '--quiet', '--initial-branch=fixture', '--template='])
  await git(['config', 'core.hooksPath', path.join(root, '.git/fixture-hooks')])
  await writeFile(path.join(root, '.gitignore'), '.tmp/\nnode_modules/\n')
  await writeFile(path.join(root, 'source.ts'), 'export const value = 1\n')
  await writeFile(path.join(root, 'pnpm-lock.yaml'), 'lockfileVersion: 9\n')
  await git(['add', '.'])
  await git(['-c', 'commit.gpgsign=false', '-c', 'user.name=Verification Test', '-c', 'user.email=verification@example.invalid', 'commit', '--quiet', '-m', 'fixture'])
  const head = (await git(['rev-parse', 'HEAD'])).stdout.trim()
  return { root, head, env, git }
}

it('borrows the clean matching checkout without installing or creating a worktree', async () => {
  const fixture = await repository()
  const directory = await withPushSnapshot({
    ...fixture,
    dependenciesReady: async () => true,
    install: async () => {
      throw new Error('unexpected install')
    },
  }, async directory => directory)
  expect(directory).toBe(fixture.root)
})

it('installs independent dependencies for dirty inputs and preserves the original worktree', async () => {
  const fixture = await repository()
  await writeFile(path.join(fixture.root, 'pnpm-lock.yaml'), 'dirty dependency draft\n')
  await mkdir(path.join(fixture.root, 'node_modules'))
  await writeFile(path.join(fixture.root, 'node_modules/owned.txt'), 'original')
  let owned: string | undefined
  const value = await withPushSnapshot({
    ...fixture,
    install: async (directory) => {
      owned = directory
      expect(directory).not.toBe(fixture.root)
      await expect(readFile(path.join(directory, 'node_modules/owned.txt'))).rejects.toMatchObject({ code: 'ENOENT' })
      await mkdir(path.join(directory, 'node_modules'))
      await writeFile(path.join(directory, 'node_modules/isolated.txt'), 'isolated')
    },
  }, async directory => readFile(path.join(directory, 'pnpm-lock.yaml'), 'utf8'))
  expect(value).toBe('lockfileVersion: 9\n')
  expect(await readFile(path.join(fixture.root, 'pnpm-lock.yaml'), 'utf8')).toBe('dirty dependency draft\n')
  expect(await readFile(path.join(fixture.root, 'node_modules/owned.txt'), 'utf8')).toBe('original')
  await expect(readFile(path.join(owned!, 'source.ts'))).rejects.toMatchObject({ code: 'ENOENT' })
  expect((await fixture.git(['worktree', 'list', '--porcelain'])).stdout.match(/^worktree /gm)).toHaveLength(1)
})

it('uses the pushed SHA even when another clean branch is checked out', async () => {
  const fixture = await repository()
  await writeFile(path.join(fixture.root, 'source.ts'), 'export const value = 2\n')
  await fixture.git(['add', '.'])
  await fixture.git(['-c', 'commit.gpgsign=false', '-c', 'user.name=Verification Test', '-c', 'user.email=verification@example.invalid', 'commit', '--quiet', '-m', 'other'])
  const source = await withPushSnapshot({ ...fixture, install: async () => {} }, async directory => readFile(path.join(directory, 'source.ts'), 'utf8'))
  expect(source).toBe('export const value = 1\n')
  expect(await readFile(path.join(fixture.root, 'source.ts'), 'utf8')).toBe('export const value = 2\n')
})

it('cleans its own checkout after installation failure and rejects source-changing installs', async () => {
  const fixture = await repository()
  await writeFile(path.join(fixture.root, 'untracked.ts'), 'draft')
  await expect(withPushSnapshot({
    ...fixture,
    install: async () => {
      throw new Error('frozen install failed')
    },
  }, async () => {}))
    .rejects
    .toThrow('frozen install failed')
  await expect(withPushSnapshot({ ...fixture, install: async directory => writeFile(path.join(directory, 'source.ts'), 'changed') }, async () => {}))
    .rejects
    .toThrow('冻结依赖安装修改了候选快照')
  expect((await fixture.git(['worktree', 'list', '--porcelain'])).stdout.match(/^worktree /gm)).toHaveLength(1)
  expect(await readFile(path.join(fixture.root, 'untracked.ts'), 'utf8')).toBe('draft')
})
