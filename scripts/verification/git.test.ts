import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
// eslint-disable-next-line e18e/ban-dependencies -- 通过真实短命 fsmonitor hook 验证命令隔离与配置保留。
import { execa } from 'execa'
import { afterEach, expect, it } from 'vitest'
import { readChanges } from './changes.ts'
import { verificationGitArgs } from './git.ts'
import { clearedGitEnvironment } from './prePush/git.ts'
import { withPushSnapshot } from './prePush/snapshot.ts'
import { fullRuntimeBlock } from './runtime.ts'

const roots = new Set<string>()
afterEach(async () => {
  await Promise.all([...roots].map(async (root) => {
    await rm(root, { recursive: true, force: true })
    roots.delete(root)
  }))
})

async function repository() {
  const inheritedGitEnvironment = Object.fromEntries(Object.entries(process.env).filter(([name]) => name.startsWith('GIT_')))
  const root = await mkdtemp(path.join(os.tmpdir(), 'verification-fsmonitor-'))
  roots.add(root)
  const env = await clearedGitEnvironment(root)
  const git = (args: string[]) => execa('git', verificationGitArgs(args), { cwd: root, env })
  await git(['init', '--quiet', '--initial-branch=main', '--template='])
  await git(['config', 'core.hooksPath', path.join(root, '.git/fixture-hooks')])
  await writeFile(path.join(root, '.gitignore'), '.tmp/\nnode_modules/\n')
  await writeFile(path.join(root, 'source.ts'), 'export const value = 1\n')
  await git(['add', '.'])
  await git(['-c', 'commit.gpgsign=false', '-c', 'user.name=Verification Test', '-c', 'user.email=verification@example.invalid', 'commit', '--quiet', '-m', 'fixture'])
  const head = (await git(['rev-parse', 'HEAD'])).stdout.trim()
  await git(['update-ref', 'refs/remotes/origin/main', head])
  const signal = path.join(root, '.git/fsmonitor-signal')
  const hook = path.join(root, '.git/fsmonitor-sentinel.cjs')
  await writeFile(hook, `require('node:fs').writeFileSync(${JSON.stringify(signal)}, 'called'); process.stdout.write('fixture-token\\0')`)
  // 使用 Git 自身的 shell 执行短命 Node hook，不依赖 shebang 或执行位。
  const quote = (value: string) => `'${value.replaceAll('\\', '/').replaceAll('\'', `'\\''`)}'`
  await git(['config', 'core.fsmonitor', `${quote(process.execPath)} ${quote(hook)}`])
  await git(['config', 'core.fsmonitorHookVersion', '2'])
  await execa('git', ['status', '--porcelain'], { cwd: root, env })
  expect(await readFile(signal, 'utf8')).toBe('called')
  await rm(signal)
  const config = await readFile(path.join(root, '.git/config'))
  return { root, head, env, git, monitorSignal: signal, config, inheritedGitEnvironment }
}

async function assertUnchangedConfiguration(fixture: Awaited<ReturnType<typeof repository>>) {
  await expect(readFile(fixture.monitorSignal)).rejects.toMatchObject({ code: 'ENOENT' })
  expect(await readFile(path.join(fixture.root, '.git/config'))).toEqual(fixture.config)
  expect(Object.fromEntries(Object.entries(process.env).filter(([name]) => name.startsWith('GIT_')))).toEqual(fixture.inheritedGitEnvironment)
}

it.each([false, true])('checks a push snapshot and its worker inputs without invoking fsmonitor (dirty: %s)', async (dirty) => {
  const fixture = await repository()
  if (dirty) {
    await writeFile(path.join(fixture.root, 'source.ts'), 'export const draft = true\n')
  }
  let installs = 0
  let checkout: string | undefined
  const result = await withPushSnapshot({
    ...fixture,
    dependenciesReady: async () => true,
    install: async () => { installs++ },
  }, async (directory) => {
    checkout = directory
    expect(await readFile(path.join(directory, 'source.ts'), 'utf8')).toBe('export const value = 1\n')
    return readChanges(directory, { head: fixture.head })
  })
  expect(result).toMatchObject({ head: fixture.head, files: ['.gitignore', 'source.ts'] })
  expect(installs).toBe(dirty ? 1 : 0)
  if (dirty) {
    expect(checkout).not.toBe(fixture.root)
    await expect(readFile(path.join(checkout!, 'source.ts'))).rejects.toMatchObject({ code: 'ENOENT' })
    expect(await readFile(path.join(fixture.root, 'source.ts'), 'utf8')).toBe('export const draft = true\n')
  }
  else {
    expect(checkout).toBe(fixture.root)
  }
  await assertUnchangedConfiguration(fixture)
})

it('reads affected changes from the real worktree without invoking fsmonitor', async () => {
  const fixture = await repository()
  await writeFile(path.join(fixture.root, 'source.ts'), 'export const value = 2\n')
  expect((await readChanges(fixture.root, { base: fixture.head })).files).toEqual(['source.ts'])
  await assertUnchangedConfiguration(fixture)
})

it('checks the formal runtime checkout without invoking fsmonitor', async () => {
  const fixture = await repository()
  expect(await fullRuntimeBlock(fixture.root)).toBeUndefined()
  await assertUnchangedConfiguration(fixture)
})
