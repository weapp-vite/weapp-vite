import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanupPreparationFixtures, publicName } from './repoctl-release/preparation'
import { bodyLimit, createPullRequestBodyFixture, repository, serverUrl, versionCommit } from './repoctl-release/pullRequestBodyFixture'

beforeEach(() => {
  vi.stubEnv('REPOCTL_LANG', 'zh-CN')
  vi.stubEnv('GITHUB_REPOSITORY', repository)
  vi.stubEnv('GITHUB_SERVER_URL', serverUrl)
})
afterEach(async () => {
  await cleanupPreparationFixtures()
  vi.unstubAllEnvs()
})

function normalBody(summary: string) {
  return `# 发布说明\n\n> 1 个包更新 · 1 项变更\n\n## 🐞 问题修复\n\n- **${publicName}@1.0.1**: ${summary}\n\n## 包\n\n| 包 | 原版本 | 新版本 |\n| --- | --- | --- |\n| \`${publicName}\` | [\`1.0.0\`](https://www.npmjs.com/package/${publicName}/v/1.0.0) | \`1.0.1\` |`
}

function expectCompleteMarkdown(body: string) {
  expect(body).not.toContain('\uFFFD')
  expect(body).not.toMatch(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/)
  expect(body.match(/<details>/g)?.length ?? 0).toBe(body.match(/<\/details>/g)?.length ?? 0)
  expect(body.match(/\[/g)?.length ?? 0).toBe(body.match(/\]/g)?.length ?? 0)
}

describe('repoctl release PR body budget at the real prepare and GitHub boundaries', () => {
  it('preserves an ordinary release body byte for byte', async () => {
    const summary = 'fix: 普通说明。'
    const fixture = await createPullRequestBodyFixture(summary)

    await expect(fixture.runPullRequest()).resolves.toBe(true)

    expect(fixture.body()).toBe(normalBody(summary))
    expect(fixture.requests.map(entry => entry.method)).toEqual(['GET', 'POST'])
  })

  it.each([false, true])('bounds a long Chinese and emoji release body when existing=%s without losing package versions or full notes', async (existing) => {
    const summary = `fix: [中文说明](https://example.test/full-notes) ${'完整边界🧩。'.repeat(15_000)}\n\n保留末尾说明。`
    const fixture = await createPullRequestBodyFixture(summary, { extraPackages: true, existing })

    await expect(fixture.runPullRequest()).resolves.toBe(true)

    const body = fixture.body()
    expect(body.length).toBeLessThanOrEqual(bodyLimit)
    expect(body).toContain('摘要')
    expect(body).toContain('完整')
    for (const pkg of fixture.packages) {
      expect(body).toContain(`\`${pkg.name}\``)
      expect(body).toContain('1.0.0')
      expect(body).toContain('1.0.1')
      const encodedPath = pkg.directory.split('/').map(encodeURIComponent).join('/')
      expect(body).toContain(`${serverUrl}/${repository}/blob/${versionCommit}/${encodedPath}/CHANGELOG.md`)
      expect(await fixture.changelog(pkg.directory)).toContain(summary)
    }
    expect(body).not.toContain('完整边界🧩。'.repeat(100))
    expectCompleteMarkdown(body)
    expect(fixture.requests.map(entry => entry.method)).toEqual(['GET', existing ? 'PATCH' : 'POST'])
  })

  it.each([0, 1])('keeps the limit boundary explicit with %s extra character', async (extra) => {
    const summary = `fix: ${'界'.repeat(bodyLimit - normalBody('fix: ').length + extra)}`
    const fixture = await createPullRequestBodyFixture(summary)

    await expect(fixture.runPullRequest()).resolves.toBe(true)

    const body = fixture.body()
    expect(body.length).toBeLessThanOrEqual(bodyLimit)
    if (extra === 0) {
      expect(body).toBe(normalBody(summary))
      expect(body).toHaveLength(bodyLimit)
    }
    else {
      expect(body).toContain('摘要')
      expect(body).toContain(`${serverUrl}/${repository}/blob/${versionCommit}/packages/library/CHANGELOG.md`)
    }
    expectCompleteMarkdown(body)
  })

  it('keeps whole entries in category order while omitting an entry that cannot fit', async () => {
    const omitted = `fix: ${'超长条目🧩。'.repeat(15_000)} by @fixture-author`
    const fixture = await createPullRequestBodyFixture(`${omitted}\n- feat: 完整保留的功能。\n- fix: 完整保留的修复。\n- docs: 完整保留的文档。`)

    await expect(fixture.runPullRequest()).resolves.toBe(true)

    const body = fixture.body()
    expect(body).toContain('已展示 3 / 4 项变更')
    expect(body).toContain('感谢 @fixture-author')
    expect(body).not.toContain('超长条目')
    const entries = ['feat: 完整保留的功能。', 'fix: 完整保留的修复。', 'docs: 完整保留的文档。']
    const positions = entries.map(entry => body.indexOf(entry))
    expect(positions.every(position => position >= 0)).toBe(true)
    expect(positions).toEqual([...positions].sort((a, b) => a - b))
    expect(await fixture.changelog('packages/library')).toContain(omitted)
    expectCompleteMarkdown(body)
  })

  it('fails before pushing or calling GitHub when the complete package summary cannot fit', async () => {
    const summary = 'fix: 保留全部包的完整说明。'
    const fixture = await createPullRequestBodyFixture(summary, { packageCount: 220 })

    await expect(fixture.runPullRequest()).rejects.toThrow('Complete package/version/changelog summary exceeds')

    expect(fixture.gitCommands.some(command => command[0] === 'commit')).toBe(true)
    expect(fixture.gitCommands.some(command => command[0] === 'push')).toBe(false)
    expect(fixture.requests).toEqual([])
    expect(await fixture.changelog('packages/library')).toContain(summary)
  }, 15_000)
})
