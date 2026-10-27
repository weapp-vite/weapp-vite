import type { VerificationTask } from './types.ts'
import { mkdir, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
// eslint-disable-next-line e18e/ban-dependencies -- 使用两个真实 Git 仓库验证 hook 环境隔离。
import { execa } from 'execa'
import { afterEach, expect, it, vi } from 'vitest'
import { createTaskExecutor } from './run.ts'
import { resolveVerificationTopology, topologyEnvironment } from './topology.ts'

const directories: string[] = []
afterEach(async () => {
  vi.unstubAllEnvs()
  await Promise.all(directories.splice(0).map(directory => rm(directory, { recursive: true, force: true })))
})

it.each([false, true])('isolates child Git fixtures from a hook checkout (observed: %s)', async (observed) => {
  const localVariables = (await execa('git', ['rev-parse', '--local-env-vars'])).stdout.split(/\r?\n/).filter(Boolean)
  const cleared = Object.fromEntries(localVariables.map(name => [name, undefined]))
  const root = await realpath(await mkdtemp(path.join(os.tmpdir(), 'verification-git-environment-')))
  directories.push(root)
  const child = path.join(root, '.tmp/child')
  await mkdir(child, { recursive: true })
  const globalConfig = path.join(root, '.tmp/empty.gitconfig')
  await writeFile(globalConfig, '')
  await writeFile(path.join(root, '.gitignore'), '.tmp/\n')
  const fixtureEnvironment = { ...cleared, GIT_CONFIG_GLOBAL: globalConfig, GIT_CONFIG_NOSYSTEM: '1' }
  const git = (args: string[]) => execa('git', args, { cwd: root, env: fixtureEnvironment })
  await git(['init', '--quiet', '--template='])
  await git(['add', '.gitignore'])
  await git(['-c', 'user.name=Verification Fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '--quiet', '-m', 'test fixture'])
  const config = await readFile(path.join(root, '.git/config'))
  const index = await readFile(path.join(root, '.git/index'))
  for (const name of localVariables) {
    vi.stubEnv(name, undefined)
  }
  const hookDirectory = path.join(root, '.git')
  vi.stubEnv('GIT_DIR', hookDirectory)
  vi.stubEnv('GIT_COMMON_DIR', hookDirectory)
  vi.stubEnv('GIT_INDEX_FILE', path.join(hookDirectory, 'index'))
  vi.stubEnv('GIT_SSH_COMMAND', 'preserved-git-transport')
  vi.stubEnv('GIT_CONFIG_GLOBAL', globalConfig)
  vi.stubEnv('GIT_CONFIG_NOSYSTEM', '1')
  vi.stubEnv('WEAPP_VITE_VERIFICATION_LOCAL_DIR', observed ? path.join(root, '.tmp/observed') : undefined)
  vi.stubEnv('WEAPP_VITE_VERIFICATION_LOCAL_ROOT', root)
  vi.stubEnv('WEAPP_VITE_VERIFICATION_LOCAL_RUN', 'git-environment-regression')
  vi.stubEnv('WEAPP_VITE_VERIFICATION_LOCAL_MODE', 'quick')
  const task: VerificationTask = {
    id: 'git-fixture',
    kind: 'test',
    command: process.execPath,
    directory: '.tmp/child',
    dependencies: [],
    reason: 'hook environment regression',
    env: { ...topologyEnvironment(resolveVerificationTopology()), VERIFICATION_PROBE: 'preserved', GIT_DIR: hookDirectory },
    args: ['--input-type=module', '-e', `
      import { execFileSync } from 'node:child_process'
      import { writeFileSync } from 'node:fs'
      execFileSync('git', ['init', '--quiet', '--template='], { stdio: 'pipe' })
      writeFileSync('marker.txt', 'child repository')
      execFileSync('git', ['add', 'marker.txt'], { stdio: 'pipe' })
      writeFileSync('receipt.json', JSON.stringify({
        staged: execFileSync('git', ['ls-files'], { encoding: 'utf8' }).trim(),
        probe: process.env.VERIFICATION_PROBE,
        inheritedGitDirectory: process.env.GIT_DIR ?? null,
        inheritedGitIndex: process.env.GIT_INDEX_FILE ?? null,
        transport: process.env.GIT_SSH_COMMAND,
      }))
    `],
  }
  expect(await createTaskExecutor(root)(task)).toMatchObject({ exitCode: 0 })
  const receipt = JSON.parse(await readFile(path.join(child, 'receipt.json'), 'utf8')) as unknown
  expect(receipt).toEqual({ staged: 'marker.txt', probe: 'preserved', inheritedGitDirectory: null, inheritedGitIndex: null, transport: 'preserved-git-transport' })
  expect(await readFile(path.join(root, '.git/config'))).toEqual(config)
  expect(await readFile(path.join(root, '.git/index'))).toEqual(index)
  expect(process.env.GIT_DIR).toBe(hookDirectory)
  expect(task.env?.GIT_DIR).toBe(hookDirectory)
})
