import { describe, expect, it, vi } from 'vitest'
import { createGitHubClient } from '../../.github/auto-changeset/github.mjs'

function fixture(responses) {
  const fetchImpl = vi.fn(async () => {
    const [body, status = 200] = responses.shift()
    return new Response(JSON.stringify(body), { status })
  })
  return { fetchImpl, client: createGitHubClient({ repository: 'example/repo', token: 'fixture-token', fetchImpl }) }
}

describe('automatic changeset GitHub boundary', () => {
  it('distinguishes a missing file from unreadable existing content', async () => {
    const { client } = fixture([
      [{ message: 'Not found' }, 404],
      [{ type: 'file', encoding: 'none', content: '' }],
      [[{ type: 'file', name: 'inside.md' }]],
      [{ type: 'file', encoding: 'base64', content: '5Lq65bel6K6w5b2V' }],
    ])
    expect(await client.getContent('.changeset/auto-pr-1.md', 'head')).toBeUndefined()
    await expect(client.getContent('.changeset/auto-pr-1.md', 'head')).rejects.toThrow('complete file content')
    await expect(client.getContent('.changeset/auto-pr-1.md', 'head')).rejects.toThrow('complete file content')
    expect(await client.getContent('.changeset/auto-pr-1.md', 'head')).toBe('人工记录')
  })

  it('reads every page and refuses GitHub truncated file/tree lists', async () => {
    const page = Array.from({ length: 100 }, (_, index) => ({ filename: `packages/demo/${index}.ts` }))
    const { client, fetchImpl } = fixture([[page], [[{ filename: '.changeset/manual.md' }]], [{ truncated: true, tree: [] }]])
    expect(await client.getPullRequestFiles(1)).toHaveLength(101)
    expect(fetchImpl.mock.calls[1][0]).toContain('page=2')
    await expect(client.getTree('a'.repeat(40))).rejects.toThrow('truncated')
    const capped = fixture(Array.from({ length: 30 }, () => [page]))
    await expect(capped.client.getPullRequestFiles(1)).rejects.toThrow('truncated')
  })

  it('encodes special ref characters and never force updates the PR branch', async () => {
    const { client, fetchImpl } = fixture([[{}]])
    await client.updateRef('feature/中文#1', 'b'.repeat(40))
    expect(fetchImpl.mock.calls[0][0]).toContain('/git/refs/heads/feature/%E4%B8%AD%E6%96%87%231')
    expect(JSON.parse(fetchImpl.mock.calls[0][1].body)).toEqual({ sha: 'b'.repeat(40), force: false })
    expect(() => createGitHubClient({ repository: 'example/repo/extra', token: 'fixture-token' })).toThrow('Invalid GitHub repository')
  })
})
