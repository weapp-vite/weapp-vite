import { describe, expect, it, vi } from 'vitest'
import { processPullRequest } from '../../.github/auto-changeset/index.mjs'
import { renderChangeset } from '../../.github/auto-changeset/policy.mjs'

const head = 'a'.repeat(40)
const base = 'b'.repeat(40)
const identity = { number: 1, expectedHeadSha: head, expectedBaseSha: base }

function fixture() {
  const pull = { number: 1, state: 'open', title: 'fix(wevu): 修复生命周期', labels: [], head: { sha: head, ref: 'feature', repo: { full_name: 'example/repo' } }, base: { sha: base, repo: { full_name: 'example/repo' } } }
  const client = {
    repository: 'example/repo',
    getPullRequest: vi.fn(async () => pull),
    getPullRequestFiles: vi.fn(async () => [{ filename: 'packages-runtime/wevu/src/index.ts', status: 'modified' }]),
    getTree: vi.fn(async () => ['packages-runtime/wevu/package.json']),
    getContent: vi.fn(async path => path === 'pnpm-workspace.yaml' ? 'packages:\n  - packages-runtime/*\n' : path.endsWith('package.json') ? '{"name":"wevu"}' : undefined),
    getCommit: vi.fn(async () => ({ tree: { sha: 'tree' } })),
    createBlob: vi.fn(async () => ({ sha: 'blob' })),
    createTree: vi.fn(async () => ({ sha: 'new-tree' })),
    createCommit: vi.fn(async () => ({ sha: 'c'.repeat(40) })),
    getRef: vi.fn(async () => ({ object: { sha: head } })),
    updateRef: vi.fn(),
    listComments: vi.fn(async () => []),
    createComment: vi.fn(),
  }
  return { client, pull }
}

describe('trusted changeset automation', () => {
  it('creates only the expected intent on the frozen head', async () => {
    const { client } = fixture()
    expect(await processPullRequest(client, identity)).toMatchObject({ action: 'committed' })
    expect(client.createBlob.mock.calls[0][0]).toContain('"create-weapp-vite": patch')
    expect(client.createCommit).toHaveBeenCalledWith(expect.any(String), 'new-tree', [head])
    expect(client.updateRef).toHaveBeenCalledWith('feature', 'c'.repeat(40))
  })

  it('leaves manual intents intact before reading candidate manifests', async () => {
    const { client } = fixture()
    client.getPullRequestFiles.mockResolvedValue([{ filename: '.changeset/manual.md', status: 'added' }])
    expect(await processPullRequest(client, identity)).toMatchObject({ action: 'manual' })
    expect(client.getTree).not.toHaveBeenCalled()
    expect(client.updateRef).not.toHaveBeenCalled()
  })

  it('only provides guidance for a fork', async () => {
    const { client, pull } = fixture()
    pull.head.repo.full_name = 'contributor/repo'
    expect(await processPullRequest(client, identity)).toMatchObject({ action: 'fork' })
    expect(client.createComment).toHaveBeenCalledOnce()
    expect(client.getTree).not.toHaveBeenCalled()
    expect(client.getContent).not.toHaveBeenCalled()
    expect(client.createCommit).not.toHaveBeenCalled()
  })

  it('preserves manual changes to an automatically named file', async () => {
    const { client } = fixture()
    const generated = renderChangeset({ packages: ['wevu'], number: 1, title: 'fix: 修复生命周期', level: 'patch' })
    const original = client.getContent.getMockImplementation()
    client.getContent.mockImplementation(path => path === '.changeset/auto-pr-1.md'
      ? generated.replace('patch', 'minor')
      : original(path))
    expect(await processPullRequest(client, identity)).toMatchObject({ action: 'manual' })
    expect(client.createBlob).not.toHaveBeenCalled()
    expect(client.updateRef).not.toHaveBeenCalled()
  })

  it('preserves an empty manually created record instead of treating it as missing', async () => {
    const { client } = fixture()
    client.getContent.mockResolvedValue('')
    expect(await processPullRequest(client, identity)).toMatchObject({ action: 'manual' })
    expect(client.getTree).not.toHaveBeenCalled()
    expect(client.updateRef).not.toHaveBeenCalled()
  })

  it('removes only its unchanged generated record when the public change is reverted', async () => {
    const { client } = fixture()
    const generated = renderChangeset({ packages: ['wevu'], number: 1, title: 'fix: 修复生命周期', level: 'patch' })
    const original = client.getContent.getMockImplementation()
    client.getContent.mockImplementation(path => path === '.changeset/auto-pr-1.md' ? generated : original(path))
    client.getPullRequestFiles.mockResolvedValue([{ filename: '.changeset/auto-pr-1.md', status: 'added' }])
    expect(await processPullRequest(client, identity)).toMatchObject({ action: 'removed' })
    expect(client.createBlob).not.toHaveBeenCalled()
    expect(client.createTree).toHaveBeenCalledWith('tree', [{ path: '.changeset/auto-pr-1.md', mode: '100644', type: 'blob', sha: null }])
    expect(client.updateRef).toHaveBeenCalledWith('feature', 'c'.repeat(40))
  })

  it('rejects head/base drift both before preparation and before writing', async () => {
    const { client, pull } = fixture()
    await expect(processPullRequest(client, { ...identity, expectedHeadSha: 'd'.repeat(40) })).rejects.toThrow('已变化')
    client.getPullRequest.mockResolvedValueOnce(pull).mockResolvedValueOnce({ ...pull, base: { ...pull.base, sha: 'd'.repeat(40) } })
    await expect(processPullRequest(client, identity)).rejects.toThrow('已变化')
    expect(client.updateRef).not.toHaveBeenCalled()
  })

  it('does not clobber a concurrent branch commit', async () => {
    const { client } = fixture()
    client.getRef.mockResolvedValue({ object: { sha: 'd'.repeat(40) } })
    await expect(processPullRequest(client, identity)).rejects.toThrow('拒绝覆盖')
    expect(client.updateRef).not.toHaveBeenCalled()
  })
})
