import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { it } from 'vitest'
import { createGitFixture, invalid, valid } from './fixture'

export function registerStagedChangesetTests() {
  it('staged gate reads index blobs in both partial-staging directions, including unborn HEAD', () => {
    const f = createGitFixture()
    try {
      f.write('.changeset/example.md', invalid)
      f.git(['add', '.changeset/example.md'])
      f.write('.changeset/example.md', valid())
      f.assertResult(f.check(), 1)
      f.assertResult(f.check(false), 0)
      f.git(['add', '.changeset/example.md'])
      f.write('.changeset/example.md', invalid)
      f.assertResult(f.check(), 0)
      f.assertResult(f.check(false), 1)
    }
    finally { f.cleanup() }
  })

  it('staged gate preserves frontmatter/package rules and reads workspace identity from the index', () => {
    const f = createGitFixture()
    try {
      f.write('pnpm-workspace.yaml', 'packages:\n  - staged-packages/*\n')
      f.write('staged-packages/new/package.json', '{"name":"@scope/staged"}\n')
      f.write('.changeset/example.md', valid('feat(scope)!: 更新接口', '@scope/staged'))
      f.git(['add', '.'])
      f.write('pnpm-workspace.yaml', 'packages:\n  - packages/*\n')
      f.write('staged-packages/new/package.json', '{"name":"@scope/unstaged"}\n')
      f.assertResult(f.check(), 0)
      f.assertResult(f.check(false), 1)
      f.write('.changeset/example.md', valid('fix: 更新接口', '@scope/unstaged'))
      f.git(['add', '.changeset/example.md'])
      f.assertResult(f.check(), 1)
      f.write('.changeset/example.md', 'fix: 缺少 frontmatter\n')
      f.git(['add', '.changeset/example.md'])
      assert.match(f.check().stderr, /frontmatter 格式无效/)
    }
    finally { f.cleanup() }
  })

  it('staged gate selects additions/modifications and rename destinations while ignoring deletions and unrelated summaries', () => {
    const f = createGitFixture()
    try {
      f.write('.changeset/unchanged.md', invalid)
      f.write('.changeset/deleted.md', invalid)
      f.write('.changeset/modified.md', valid())
      f.write('incoming.md', invalid)
      f.git(['add', '.'])
      f.assertResult(f.commit(), 0)
      f.write('.changeset/untracked.md', invalid)
      f.write('.changeset/README.md', '说明无需 Conventional 摘要。\n')
      f.git(['rm', '.changeset/deleted.md'])
      f.git(['add', '.changeset/README.md'])
      f.assertResult(f.check(), 0)
      f.write('.changeset/modified.md', invalid)
      f.git(['add', '.changeset/modified.md'])
      assert.match(f.check().stderr, /modified\.md/)
      f.write('.changeset/modified.md', valid('perf: 减少重复分析'))
      f.git(['add', '.changeset/modified.md'])
      f.git(['mv', 'incoming.md', '.changeset/renamed destination.md'])
      assert.match(f.check().stderr, /renamed destination\.md/)
      f.git(['mv', '.changeset/renamed destination.md', 'outgoing.md'])
      f.git(['mv', '.changeset/unchanged.md', 'former changeset.md'])
      f.assertResult(f.check(), 0)
    }
    finally { f.cleanup() }
  })

  it('staged and full-tree gates accept CRLF, spaces and blank lines before the first summary', () => {
    const f = createGitFixture()
    try {
      f.write('.changeset/a space.md', valid('\n \nfix(runtime): 修复首次挂载').replaceAll('\n', '\r\n'))
      f.git(['add', '.'])
      f.assertResult(f.check(), 0)
      f.assertResult(f.check(false), 0)
      f.write('.changeset/a space.md', invalid.replaceAll('\n', '\r\n'))
      f.git(['add', '.changeset/a space.md'])
      f.assertResult(f.check(), 1)
      f.assertResult(f.check(false), 1)
    }
    finally { f.cleanup() }
  })

  it('staged gate honors an alternate Git index instead of hardcoding .git/index', () => {
    const f = createGitFixture()
    try {
      f.assertResult(f.commit(), 0)
      f.write('.changeset/example.md', invalid)
      f.git(['add', '.changeset/example.md'])
      const alternateIndex = path.join(f.directory, 'alternate index')
      fs.copyFileSync(path.join(f.root, f.git(['rev-parse', '--git-path', 'index']).trim()), alternateIndex)
      f.env.GIT_INDEX_FILE = alternateIndex
      f.write('.changeset/example.md', valid())
      f.git(['add', '.changeset/example.md'])
      f.assertResult(f.check(), 0)
      delete f.env.GIT_INDEX_FILE
      f.assertResult(f.check(), 1)
    }
    finally { f.cleanup() }
  })

  it('actual Lefthook rejects a bad staged summary and restores the unstaged repair', () => {
    const f = createGitFixture(true)
    try {
      f.assertResult(f.commit(), 0)
      f.write('.changeset/example.md', invalid)
      f.git(['add', '.changeset/example.md'])
      f.write('.changeset/example.md', valid())
      const result = f.lefthook(['run', 'pre-commit'])
      assert.notEqual(result.status, 0)
      assert.match(`${result.stdout}${result.stderr}`, /Conventional 类型或非空摘要/)
      assert.equal(f.git(['show', ':.changeset/example.md']), invalid)
      assert.equal(fs.readFileSync(path.join(f.root, '.changeset/example.md'), 'utf8'), valid())
    }
    finally { f.cleanup() }
  }, 60_000)

  it('actual Lefthook validates the index when the changeset directory was deleted only in the worktree', () => {
    const f = createGitFixture(true)
    try {
      f.assertResult(f.commit(), 0)
      f.write('.changeset/example.md', valid())
      f.git(['add', '.changeset/example.md'])
      fs.rmSync(path.join(f.root, '.changeset'), { recursive: true })
      const before = f.git(['status', '--porcelain'])
      f.assertResult(f.lefthook(['run', 'pre-commit']), 0)
      assert.equal(f.git(['show', ':.changeset/example.md']), valid())
      assert.equal(f.git(['status', '--porcelain']), before)
      assert.equal(fs.existsSync(path.join(f.root, '.changeset/example.md')), false)
    }
    finally { f.cleanup() }
  }, 60_000)

  it.each([false, true])('actual pre-commit guards partial staging and resolves linked worktrees: %s', (linked) => {
    const f = createGitFixture(true)
    try {
      f.assertResult(f.commit(), 0)
      let cwd = f.root
      if (linked) {
        cwd = path.join(f.directory, 'linked worktree with space\'s 中文')
        f.git(['worktree', 'add', '--quiet', '--detach', cwd, 'HEAD'])
        assert.equal(fs.statSync(path.join(cwd, '.git')).isFile(), true)
        f.installDependencies(cwd)
      }
      f.enableHooks()
      const before = f.git(['rev-parse', 'HEAD'], cwd)
      const file = '.changeset/hook space\'s 中文.md'
      f.write(file, invalid, cwd)
      f.git(['add', file], cwd)
      f.write(file, valid(), cwd)
      const rejected = f.commit(cwd)
      assert.notEqual(rejected.status, 0)
      assert.match(`${rejected.stdout}${rejected.stderr}`, /Conventional 类型或非空摘要/)
      assert.equal(f.git(['rev-parse', 'HEAD'], cwd), before)
      f.git(['add', file], cwd)
      f.write(file, invalid, cwd)
      const accepted = f.commit(cwd)
      f.assertResult(accepted, 0)
      assert.equal(f.git(['show', `HEAD:${file}`], cwd), valid())
      assert.equal(fs.readFileSync(path.join(cwd, file), 'utf8'), invalid)
      assert.ok(`${accepted.stdout}${accepted.stderr}`.match(/check passed \(\.changeset staged index\)/g)!.length >= 2)
    }
    finally { f.cleanup() }
  }, 60_000)

  it('post-format Lefthook gate rejects invalid final index content produced by autofix', () => {
    const f = createGitFixture(true)
    try {
      f.assertResult(f.commit(), 0)
      f.enableHooks()
      f.write('eslint.config.mjs', `let text = ''
      const processor = {
        supportsAutofix: true,
        preprocess: (content) => { text = content; return [''] },
        postprocess: () => {
          const start = text.indexOf('fix: 自动修复检查')
          return start < 0 ? [] : [{ message: 'fixture autofix', severity: 2, line: 1, column: 1, fix: { range: [start, start + 'fix: '.length], text: '' } }]
        },
      }
      export default [{ files: ['**/*.md'], plugins: { fixture: { processors: { summary: processor } } }, processor: 'fixture/summary' }]
      `)
      f.write('.changeset/example.md', valid('fix: 自动修复检查'))
      f.git(['add', 'eslint.config.mjs', '.changeset/example.md'])
      const before = f.git(['rev-parse', 'HEAD'])
      const result = f.commit()
      assert.notEqual(result.status, 0)
      assert.match(`${result.stdout}${result.stderr}`, /Conventional 类型或非空摘要/)
      assert.equal(f.git(['rev-parse', 'HEAD']), before)
      assert.equal(f.git(['show', ':.changeset/example.md']), valid('自动修复检查'))
    }
    finally { f.cleanup() }
  }, 60_000)
}
