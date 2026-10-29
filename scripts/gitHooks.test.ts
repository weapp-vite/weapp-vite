import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { describe, expect, it } from 'vitest'
import { parse } from 'yaml'
import { createGitFixture, invalid, valid } from './changesetFrontmatter/test/fixture'

it('native Git pathspecs preserve application exclusions, mini-program styles and dedicated formatters', () => {
  const f = createGitFixture(true)
  try {
    f.assertResult(f.commit(), 0)
    const files = [
      'packages/sample/space\'s 中文.vue',
      'packages/sample/index.wxss',
      'apps/demo/index.vue',
      'e2e-apps/__temp__/generated.vue',
      'e2e-apps/demo space\'s 中文/project.config.json',
      'project.private.config.json',
      '.changeset/example.md',
      'scripts/helper.cts',
    ]
    files.forEach(file => f.write(file, 'fixture\n'))
    f.git(['add', '.'])
    const hooks = parse(fs.readFileSync(path.join(f.root, 'lefthook.yml'), 'utf8')) as { 'pre-commit': { jobs: { name: string, run: string }[] } }
    const selected = (name: string) => {
      const command = hooks['pre-commit'].jobs.find(job => job.name === name)!.run
      const pathspecs = [...command.split('|')[0]!.matchAll(/'([^']+)'/g)].map(match => match[1]!)
      return f.git(['diff', '--cached', '--name-only', '--diff-filter=ACMR', '-z', '--', ...pathspecs]).split('\0').filter(Boolean)
    }
    expect(selected('stylelint')).toEqual(['packages/sample/index.wxss', 'packages/sample/space\'s 中文.vue'])
    expect(selected('project-configs')).toEqual(['e2e-apps/demo space\'s 中文/project.config.json', 'project.private.config.json'])
    expect(selected('changeset-eslint')).toEqual(['.changeset/example.md'])
    expect(selected('eslint')).toEqual(['e2e-apps/__temp__/generated.vue', 'packages/sample/space\'s 中文.vue', 'scripts/helper.cts'])
  }
  finally { f.cleanup() }
})

it('native repoctl keeps root tooling and package typechecks when both are staged', () => {
  const f = createGitFixture(true)
  try {
    f.write('packages/known/package.json', JSON.stringify({ name: '@scope/known', scripts: { typecheck: 'node --version' } }))
    f.write('tooling.ts', 'export {}\n')
    f.write('packages/known/src/index.ts', 'export {}\n')
    f.git(['add', '.'])
    const result = f.repo(['verify', 'staged-typecheck'])
    f.assertResult(result, 0)
    expect(result.stdout).toContain('[staged:typecheck] .')
    expect(result.stdout.replaceAll('\\', '/')).toContain('[staged:typecheck] packages/known')
  }
  finally { f.cleanup() }
}, 30_000)

describe('hook installation ownership', () => {
  it.each(['.husky', '.husky/_'])('migrates only repository-owned legacy path %s', (legacy) => {
    const f = createGitFixture(true)
    try {
      delete f.env.CI
      delete f.env.LEFTHOOK
      f.git(['config', '--local', 'core.hooksPath', legacy])
      f.assertResult(f.repo(['tooling', 'hooks', 'install']), 0)
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
      f.assertResult(f.repo(['tooling', 'hooks', 'install']), 0)
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
    const rejected = f.run('git', ['hook', 'run', 'commit-msg', '--', '.git/COMMIT_EDITMSG'])
    expect(rejected.status).not.toBe(0)
    expect(`${rejected.stdout}${rejected.stderr}`).toContain('type-enum')
    f.write('.git/COMMIT_EDITMSG', 'fix: 合法提交\n')
    f.assertResult(f.run('git', ['hook', 'run', 'commit-msg', '--', '.git/COMMIT_EDITMSG']), 0)
    f.write('.git/MERGE_MSG', 'unknown: 合并消息也须校验\n')
    expect(f.run('git', ['hook', 'run', 'commit-msg', '--', '.git/MERGE_MSG']).status).not.toBe(0)
  }
  finally { f.cleanup() }
}, 30_000)

it('native commit-msg preserves a custom message path and overrides inherited message environment', () => {
  const f = createGitFixture(true)
  try {
    f.assertResult(f.commit(), 0)
    f.enableHooks()
    const message = path.join(f.root, 'message with space\'s 中文.txt')
    const inherited = path.join(f.root, 'inherited valid message.txt')
    fs.writeFileSync(inherited, 'fix: 继承的文件不能代替 Git 参数\n')
    f.env.WEAPP_VITE_GIT_COMMIT_MESSAGE_FILE = inherited
    fs.writeFileSync(message, 'unknown: 自定义文件也须校验\n')
    const rejected = f.run('git', ['hook', 'run', 'commit-msg', '--', message])
    expect(rejected.status).not.toBe(0)
    expect(`${rejected.stdout}${rejected.stderr}`).toContain('type-enum')
    fs.writeFileSync(message, 'fix: 自定义消息路径保持完整\n')
    f.assertResult(f.run('git', ['hook', 'run', 'commit-msg', '--', message]), 0)
    expect(f.env.WEAPP_VITE_GIT_COMMIT_MESSAGE_FILE).toBe(inherited)
  }
  finally { f.cleanup() }
}, 30_000)

it('fixture hooks reject invalid staged content when the parent disables Lefthook', () => {
  const inherited = process.env.LEFTHOOK
  let f: ReturnType<typeof createGitFixture> | undefined
  try {
    process.env.LEFTHOOK = '0'
    f = createGitFixture(true)
    f.assertResult(f.commit(), 0)
    f.enableHooks()
    f.write('.changeset/example.md', invalid)
    f.git(['add', '.changeset/example.md'])
    const before = f.git(['rev-parse', 'HEAD'])
    const rejected = f.commit()
    expect(rejected.status).not.toBe(0)
    expect(`${rejected.stdout}${rejected.stderr}`).toContain('Conventional 类型或非空摘要')
    expect(f.git(['rev-parse', 'HEAD'])).toBe(before)
    expect(process.env.LEFTHOOK).toBe('0')
  }
  finally {
    if (inherited === undefined) {
      delete process.env.LEFTHOOK
    }
    else {
      process.env.LEFTHOOK = inherited
    }
    f?.cleanup()
  }
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
