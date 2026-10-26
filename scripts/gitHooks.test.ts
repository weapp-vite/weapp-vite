import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { describe, expect, it } from 'vitest'
import { createGitFixture, invalid, valid } from './changesetFrontmatter/test/fixture'
import { selectStagedFiles } from './gitHooks/files.mjs'
import { groupTypecheckFiles } from './gitHooks/typecheck.mjs'

it('keeps source, Vue style, project config and public skill gates distinct', () => {
  const selected = selectStagedFiles([
    'packages/sample/space\'s 中文.vue',
    'apps/demo/index.vue',
    'e2e-apps/__temp__/generated.vue',
    'e2e-apps/demo space\'s 中文/project.config.json',
    '.changeset/example.md',
    'scripts/helper.cts',
    'e2e/ide/example.test.ts',
    'skills/example/catalog.yaml',
  ])
  expect(selected.styles).toEqual(['packages/sample/space\'s 中文.vue'])
  expect(selected.projectConfigs).toEqual(['e2e-apps/demo space\'s 中文/project.config.json'])
  expect(selected.changesets).toEqual(['.changeset/example.md'])
  expect(selected.eslint).toContain('scripts/helper.cts')
  expect(selected.eslint).not.toContain('.changeset/example.md')
  expect(selected.eslint).not.toContain('apps/demo/index.vue')
  expect(selected.e2e && selected.skillsSync && selected.skillsYaml).toBe(true)
})

it('keeps root tooling and package typechecks when both are staged', () => {
  const f = createGitFixture()
  try {
    f.write('packages/known/package.json', JSON.stringify({ name: '@scope/known', scripts: { typecheck: 'tsc --noEmit' } }))
    const groups = groupTypecheckFiles(['repoctl.config.ts', 'packages/known/src/index.ts', 'packages/known/package.json', 'docs/example.md'], f.root)
    expect([...groups.entries()]).toEqual([
      [f.root, ['repoctl.config.ts']],
      [path.join(f.root, 'packages/known'), ['packages/known/src/index.ts', 'packages/known/package.json']],
    ])
  }
  finally { f.cleanup() }
})

describe('hook installation ownership', () => {
  it.each(['.husky', '.husky/_'])('migrates only repository-owned legacy path %s', (legacy) => {
    const f = createGitFixture(true)
    try {
      delete f.env.CI
      delete f.env.LEFTHOOK
      f.git(['config', '--local', 'core.hooksPath', legacy])
      f.assertResult(f.run(process.execPath, ['scripts/gitHooks/install.mjs']), 0)
      expect(f.run('git', ['config', '--get', 'core.hooksPath']).status).toBe(1)
      expect(fs.readFileSync(path.join(f.root, '.git/hooks/pre-commit'), 'utf8')).toContain('lefthook')
    }
    finally { f.cleanup() }
  }, 30_000)

  it.each([false, true])('preserves custom hooks exposed after migration: %s', (global) => {
    const f = createGitFixture(true)
    try {
      delete f.env.CI
      delete f.env.LEFTHOOK
      const custom = path.join(f.directory, 'custom hooks\'s 中文')
      fs.mkdirSync(custom)
      fs.writeFileSync(path.join(custom, 'pre-commit'), 'owned by user\n')
      f.git(['config', global ? '--global' : '--local', 'core.hooksPath', custom])
      if (global) {
        f.git(['config', '--local', 'core.hooksPath', '.husky/_'])
      }
      f.assertResult(f.run(process.execPath, ['scripts/gitHooks/install.mjs']), 0)
      expect(f.git(['config', '--get', 'core.hooksPath']).trim()).toBe(custom)
      expect(fs.readFileSync(path.join(custom, 'pre-commit'), 'utf8')).toBe('owned by user\n')
    }
    finally { f.cleanup() }
  }, 30_000)
})

it('native hooks fix project config paths and reject invalid commit messages', () => {
  const f = createGitFixture(true)
  try {
    f.assertResult(f.commit(), 0)
    f.enableHooks()
    const config = 'fixtures/app space\'s 中文/project.config.json'
    f.write(config, '{"appid":"real-fixture-appid"}\n\n')
    f.git(['add', config])
    f.assertResult(f.lefthook(['run', 'pre-commit']), 0)
    expect(f.git(['show', `:${config}`])).toBe('{"appid":"real-fixture-appid"}')
    f.write('.git/COMMIT_EDITMSG', 'unknown: 不支持的类型\n')
    const rejected = f.lefthook(['run', 'commit-msg', '--', '.git/COMMIT_EDITMSG'])
    expect(rejected.status).not.toBe(0)
    expect(`${rejected.stdout}${rejected.stderr}`).toContain('type-enum')
    f.write('.git/COMMIT_EDITMSG', 'fix: 合法提交\n')
    f.assertResult(f.lefthook(['run', 'commit-msg', '--', '.git/COMMIT_EDITMSG']), 0)
    f.write('.git/MERGE_MSG', 'unknown: 合并消息也须校验\n')
    expect(f.lefthook(['run', 'commit-msg', '--', '.git/MERGE_MSG']).status).not.toBe(0)
  }
  finally { f.cleanup() }
}, 30_000)

it('native hook honors an alternate index and keeps fixture installation state isolated', () => {
  const f = createGitFixture(true)
  try {
    expect(fs.lstatSync(path.join(f.root, 'node_modules')).isSymbolicLink()).toBe(false)
    expect(fs.lstatSync(path.join(f.root, 'node_modules/.bin')).isSymbolicLink()).toBe(false)
    expect(fs.existsSync(path.join(f.root, 'node_modules/.pnpm'))).toBe(false)
    expect(f.env.pnpm_config_verify_deps_before_run).toBe('false')
    f.assertResult(f.commit(), 0)
    f.write('.changeset/example.md', invalid)
    f.git(['add', '.changeset/example.md'])
    const alternate = path.join(f.directory, 'alternate index')
    fs.copyFileSync(path.join(f.root, f.git(['rev-parse', '--git-path', 'index']).trim()), alternate)
    f.env.GIT_INDEX_FILE = alternate
    f.write('.changeset/example.md', valid())
    f.git(['add', '.changeset/example.md'])
    f.write('.changeset/example.md', invalid)
    f.assertResult(f.lefthook(['run', 'pre-commit']), 0)
    expect(f.git(['show', ':.changeset/example.md'])).toBe(valid())
    expect(fs.readFileSync(path.join(f.root, '.changeset/example.md'), 'utf8')).toBe(invalid)
    delete f.env.GIT_INDEX_FILE
    expect(f.git(['show', ':.changeset/example.md'])).toBe(invalid)
  }
  finally { f.cleanup() }
}, 30_000)
