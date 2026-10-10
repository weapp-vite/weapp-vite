import type { NoteCategory } from './repoctl-release/classificationFixture'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { classificationPackage, cleanupClassificationFixtures, createClassificationFixture, noteCategories } from './repoctl-release/classificationFixture'

beforeEach(() => vi.stubEnv('REPOCTL_LANG', 'en'))
afterEach(cleanupClassificationFixtures)

const explicitCases = [
  { type: 'feat', category: 'features', summary: 'feat: 提供新入口；保留修复、性能、依赖与文档边界。', sourceSubject: 'chore(changeset): 整理说明', bump: 'patch' },
  { type: 'fix', category: 'fixes', summary: 'fix: 修正类型推导；保留新增功能的性能边界。', sourceSubject: 'perf(release): 复用构建', bump: 'minor' },
  { type: 'perf', category: 'performance', summary: 'perf: 减少重复解析；保留修复、功能和文档边界。', sourceSubject: 'chore(changeset): 整理说明', bump: 'minor' },
  { type: 'chore', category: 'maintenance', summary: 'chore: 更新工具链依赖；保留新增功能和修复覆盖。', sourceSubject: 'feat(release): 增加发布能力', bump: 'minor' },
  { type: 'feat!', category: 'breaking', summary: 'feat!: 调整最低运行版本；保留新增功能和问题修复。', sourceSubject: 'chore(changeset): 整理说明', bump: 'minor' },
] as const satisfies readonly { type: string, category: NoteCategory, summary: string, sourceSubject: string, bump: 'patch' | 'minor' }[]

describe('repoctl release note classification', () => {
  it.each([
    ...explicitCases,
    { type: 'docs', category: 'docs', summary: 'docs: 补充发布说明；保留新增功能和修复边界。', sourceSubject: 'feat(release): 增加发布能力', bump: 'minor' },
    { type: 'fix(runtime)!', category: 'breaking', summary: 'fix(runtime)!: 更新调用约定；保留文档与性能边界。', sourceSubject: 'fix(release): 整理说明', bump: 'minor' },
  ] as const)('preserves explicit $type in the PR and final release despite source and prose conflicts', async (entry) => {
    const fixture = await createClassificationFixture(entry)
    const pullRequest = await fixture.pullRequestBody()
    const release = await fixture.releaseBody()

    expect(noteCategories(pullRequest)).toEqual([entry.category])
    expect(noteCategories(release)).toEqual([entry.category])
    expect(pullRequest).toContain('保留')
    expect(release).toContain('保留')
  })

  it('recognizes scoped prefixes and preserves complete paragraphs and nested details', async () => {
    const fixture = await createClassificationFixture({
      summary: 'perf(runtime): 降低重复处理。\n\n保留新增功能和修复语义。\n\n- 中文边界明细。\n  - 嵌套明细稳定。',
      sourceSubject: 'chore(changeset): 整理说明',
    })
    const bodies = [await fixture.pullRequestBody(), await fixture.releaseBody()]

    for (const body of bodies) {
      expect(noteCategories(body)).toEqual(['performance'])
      for (const detail of ['降低重复处理。', '保留新增功能和修复语义。', '中文边界明细。', '嵌套明细稳定。']) {
        expect(body).toContain(detail)
      }
    }
  })

  it('round-trips every explicit type through real pnpm version without source links', async () => {
    const fixture = await createClassificationFixture({
      summary: explicitCases.map(entry => entry.summary),
      sourceSubject: 'chore(changeset): 整理全部说明',
      realVersion: true,
    })
    const pullRequest = await fixture.pullRequestBody()
    const changelog = await fixture.changelog()
    const release = await fixture.releaseBody()
    const expected = ['breaking', 'features', 'fixes', 'performance', 'maintenance']

    // pnpm 首次发布保留清单中的初始版本，同时消费 changeset 生成完整说明。
    expect(await fixture.manifest()).toEqual({ name: classificationPackage, version: '1.0.0' })
    expect(fixture.versionCalls).toEqual([['version', '-r', '--no-git-checks', '--json']])
    expect(changelog).toContain('### Minor Changes')
    expect(changelog).not.toContain('/commit/')
    for (const entry of explicitCases) {
      expect(changelog).toContain(entry.summary)
    }
    expect(noteCategories(pullRequest)).toEqual(expected)
    expect(noteCategories(release)).toEqual(expected)
    expect(fixture.gitCommands).toContainEqual(['show', `${classificationPackage}@1.0.0:packages/library/CHANGELOG.md`])
  }, 30_000)

  it('uses the same explicit classification at the public publish entry and ensureRelease boundary', async () => {
    const fixture = await createClassificationFixture({
      summary: 'fix: 修正发布分类；保留新增功能和性能边界。',
      sourceSubject: 'chore(changeset): 整理说明',
      realVersion: true,
    })
    const pullRequest = await fixture.pullRequestBody()
    const release = await fixture.publishedReleaseBody()

    expect(fixture.publishCalls).toEqual([['publish', '-r', '--report-summary', '--provenance', '--no-git-checks']])
    expect(fixture.github.ensureTag).toHaveBeenCalledWith({ tag: `${classificationPackage}@1.0.0`, target: 'a'.repeat(40) })
    expect(noteCategories(pullRequest)).toEqual(['fixes'])
    expect(noteCategories(release)).toEqual(['fixes'])
    expect(release).toContain('保留新增功能和性能边界。')
  }, 30_000)

  it('keeps native dependency propagation in maintenance despite an explicit feature and source commit', async () => {
    const fixture = await createClassificationFixture({
      summary: 'feat: Native pnpm propagation: dependency.',
      heading: 'Dependencies',
      sourceSubject: 'feat(runtime): 新增能力',
    })
    expect(noteCategories(await fixture.pullRequestBody())).toEqual(['maintenance'])
    expect(noteCategories(await fixture.releaseBody())).toEqual(['maintenance'])
  })

  it.each([
    'fix: 修复 react@1.2.3 下的行为。',
    'fix: 修复 react@1.2.3 → react@1.2.4 的升级行为。',
    'fix: Dependencies: react@1.2.3，修复调用边界。',
  ])('preserves the declared type and prose around dependency references: %s', async (summary) => {
    const fixture = await createClassificationFixture({ summary, realVersion: true })
    const bodies = [await fixture.pullRequestBody(), await fixture.releaseBody()]
    for (const body of bodies) {
      expect(noteCategories(body)).toEqual(['fixes'])
      expect(body).toContain(summary)
    }
  }, 30_000)

  it('preserves native dependency normalization for legacy entries without a declared type', async () => {
    const fixture = await createClassificationFixture({ summary: 'react@1.2.3', sourceSubject: 'feat(runtime): 新增能力' })
    const bodies = [await fixture.pullRequestBody(), await fixture.releaseBody()]
    for (const body of bodies) {
      expect(noteCategories(body)).toEqual(['maintenance'])
      expect(body).toContain('react@1.2.3')
    }
  })

  it('keeps version-only changelog sections in maintenance without inventing intent prose', async () => {
    const fixture = await createClassificationFixture({ summary: 'feat: 提供独立能力。', emptyNotes: true })
    const bodies = [await fixture.pullRequestBody(), await fixture.releaseBody()]
    for (const body of bodies) {
      expect(noteCategories(body)).toEqual(['maintenance'])
      expect(body).toContain('Version-only release; no package-specific changelog entries.')
      expect(body).not.toContain('提供独立能力。')
    }
  })

  it('preserves legacy source precedence and keyword fallback when no explicit prefix exists', async () => {
    const fixture = await createClassificationFixture({
      summary: '修复旧版类型读取。',
      bump: 'patch',
      sourceSubject: 'perf(release): 复用构建',
    })
    expect(noteCategories(await fixture.pullRequestBody())).toEqual(['performance'])
    expect(noteCategories(await fixture.releaseBody())).toEqual(['fixes'])
  })

  it('does not classify an embedded conventional prefix as an explicit declaration', async () => {
    const fixture = await createClassificationFixture({
      summary: '旧条目提及 perf: 示例，保留修复行为。',
      bump: 'patch',
      sourceSubject: 'fix(runtime): 修复旧契约',
    })
    expect(noteCategories(await fixture.pullRequestBody())).toEqual(['fixes'])
    expect(noteCategories(await fixture.releaseBody())).toEqual(['fixes'])
  })
})
