import { describe, expect, it } from 'vitest'
import { collectPublishableWorkspaceChangesetIssues, isReleaseWorthyWorkspaceFile } from '../check-publishable-workspace-changeset'
import { readWorkflowFixture } from '../workflowFixture.mjs'
import { collectPreparedReleasePackages } from './prepared'

const pkg = { dir: 'packages/demo', name: 'demo', localWorkspaceDependencies: [] }

function fixture() {
  const before = new Map([
    ['.changeset/ledger.yaml', '{}'],
    ['.changeset/change.md', '---\ndemo: minor\n---\n\nfeat: 新能力\n'],
    ['packages/demo/package.json', '{"name":"demo","version":"1.0.0"}'],
    ['packages/demo/CHANGELOG.md', '# demo\n\n## 1.0.0\n\n旧记录\n'],
  ])
  const after = new Map(before)
  after.delete('.changeset/change.md')
  after.set('.changeset/ledger.yaml', 'demo@1.1.0:\n  dir: packages/demo\n  intents: [change]\n')
  after.set('packages/demo/package.json', '{"name":"demo","version":"1.1.0"}')
  after.set('packages/demo/CHANGELOG.md', '# demo\n\n## 1.1.0\n\n新记录\n\n## 1.0.0\n\n旧记录\n')
  const options = {
    headRef: 'release/pnpm-version',
    packages: [pkg],
    changedFiles: ['packages/demo/package.json', 'packages/demo/CHANGELOG.md'],
    isReleaseWorthy: isReleaseWorthyWorkspaceFile,
    project: async () => ({
      versions: [{ name: 'demo', currentVersion: '1.0.0', newVersion: '1.1.0' }],
      manifests: new Map([['packages/demo/package.json', { name: 'demo', version: '1.1.0' }]]),
      ledger: { 'demo@1.1.0': { dir: 'packages/demo', intents: ['change'] } },
      consumed: ['.changeset/change.md'],
    }),
    readBase: async (file: string) => before.get(file),
    readHead: async (file: string) => after.get(file),
  }
  return { before, after, options }
}

describe('release intent completeness', () => {
  it('requires intent for public source changes but excludes colocated tests and emitted files', () => {
    expect(collectPublishableWorkspaceChangesetIssues({
      packages: [pkg],
      changesetPackages: new Set(),
      changedFiles: ['packages/demo/src/index.ts'],
    })).toHaveLength(1)
    expect(collectPublishableWorkspaceChangesetIssues({
      packages: [pkg],
      changesetPackages: new Set(),
      changedFiles: ['packages/demo/src/index.test.ts', 'packages/demo/src/__tests__/helper.ts', 'packages/demo/dist/index.js'],
    })).toEqual([])
    expect(collectPublishableWorkspaceChangesetIssues({
      packages: [pkg],
      changesetPackages: new Set(['demo']),
      changedFiles: ['packages/demo/src/index.ts'],
    })).toEqual([])
  })

  it('recognizes prepared versions through consumed intents, new ledger and append-only changelog', async () => {
    const { options } = fixture()
    const covered = await collectPreparedReleasePackages(options)
    expect([...covered]).toEqual(['demo'])
    expect(collectPublishableWorkspaceChangesetIssues({
      packages: [pkg],
      changesetPackages: covered,
      changedFiles: options.changedFiles,
    })).toEqual([])
  })

  it.each(['feature', 'release/pnpm-version-pretend'])('does not exempt arbitrary branch %s', async (headRef) => {
    const { options } = fixture()
    expect(await collectPreparedReleasePackages({ ...options, headRef })).toEqual(new Set())
  })

  it.each(['source', 'scripts', 'ledger', 'history', 'unconsumed'])('rejects a release-looking branch with invalid %s evidence', async (kind) => {
    const { after, options } = fixture()
    if (kind === 'source') {
      options.changedFiles.push('packages/demo/src/index.ts')
    }
    if (kind === 'scripts') {
      after.set('packages/demo/package.json', '{"name":"demo","version":"1.1.0","scripts":{"postinstall":"arbitrary"}}')
    }
    if (kind === 'ledger') {
      after.set('.changeset/ledger.yaml', '{}')
    }
    if (kind === 'history') {
      after.set('packages/demo/CHANGELOG.md', '# demo\n\n## 1.1.0\n\n新记录\n\n## 1.0.0\n\n被篡改的历史\n')
    }
    if (kind === 'unconsumed') {
      after.set('.changeset/change.md', '---\ndemo: minor\n---\n\nfeat: 新能力\n')
    }
    expect(await collectPreparedReleasePackages(options)).toEqual(new Set())
  })

  it('runs completeness checks inside both existing gated policy jobs', () => {
    const workflow = readWorkflowFixture('validate-ci-policy.yml') as { jobs: Record<string, { with?: { main_command?: string } }> }
    for (const job of ['policy-pr', 'policy-full']) {
      expect(workflow.jobs[job]!.with?.main_command).toContain('pnpm check:publishable-workspace-changeset')
    }
  })
})
