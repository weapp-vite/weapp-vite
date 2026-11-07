import { spawnSync } from 'node:child_process'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { afterEach, expect, it } from 'vitest'
import { parse } from 'yaml'

interface ReleaseWorkflow {
  jobs: { release: { env: Record<string, unknown> } }
}

const roots: string[] = []

afterEach(async () => {
  await Promise.all(roots.splice(0).map(root => fs.rm(root, { recursive: true, force: true })))
})

it('creates the prepared source annotated tag with the workflow identity in a clean checkout', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'release-git-identity-'))
  roots.push(root)
  const emptyConfig = path.join(root, 'empty.gitconfig')
  const config = '[user]\n  useConfigOnly = true\n'
  await fs.writeFile(emptyConfig, config)
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    GIT_CONFIG_GLOBAL: emptyConfig,
    GIT_CONFIG_SYSTEM: emptyConfig,
    GIT_CONFIG_NOSYSTEM: '1',
    GIT_CONFIG_COUNT: undefined,
    GIT_CONFIG_PARAMETERS: undefined,
    EMAIL: undefined,
  }
  for (const key of Object.keys(env)) {
    if (/^GIT_(?:AUTHOR|COMMITTER)_/.test(key)) {
      delete env[key]
    }
  }
  const workflow = parse(await fs.readFile(new URL('../.github/workflows/release.yml', import.meta.url), 'utf8')) as ReleaseWorkflow
  for (const key of ['GIT_AUTHOR_NAME', 'GIT_AUTHOR_EMAIL', 'GIT_COMMITTER_NAME', 'GIT_COMMITTER_EMAIL']) {
    const value = workflow.jobs.release.env[key]
    if (typeof value === 'string') {
      env[key] = value
    }
  }
  const git = (args: string[], cwd = root) => spawnSync('git', args, { cwd, env, encoding: 'utf8' })
  const remote = path.join(root, 'origin.git')
  expect(git(['init', '--bare', remote]).status).toBe(0)
  const checkout = path.join(root, 'checkout')
  expect(git(['clone', remote, checkout]).status).toBe(0)
  const commit = () => git(['-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.test', 'commit', '--allow-empty', '-m', 'fixture'], checkout)
  expect(commit().status).toBe(0)
  const source = git(['rev-parse', 'HEAD'], checkout).stdout.trim()
  expect(commit().status).toBe(0)
  const head = git(['rev-parse', 'HEAD'], checkout).stdout.trim()
  expect(source).not.toBe(head)
  expect(git(['config', '--local', '--get', 'user.name'], checkout).status).toBe(1)
  const tag = 'vscode-extension-v1.2.3'
  const tagged = git(['tag', '-a', tag, source, '-m', tag], checkout)
  expect(tagged.status, tagged.stderr).toBe(0)
  expect(git(['push', 'origin', `refs/tags/${tag}`], checkout).status).toBe(0)
  expect(git(['--git-dir', remote, 'cat-file', '-t', `refs/tags/${tag}`]).stdout.trim()).toBe('tag')
  expect(git(['--git-dir', remote, 'rev-parse', `${tag}^{}`]).stdout.trim()).toBe(source)
  expect(git(['rev-parse', 'HEAD'], checkout).stdout.trim()).toBe(head)
  expect(git(['config', '--local', '--get', 'user.name'], checkout).status).toBe(1)
  expect(await fs.readFile(emptyConfig, 'utf8')).toBe(config)
}, 30_000)
