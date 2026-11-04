import { describe, expect, it } from 'vitest'
import { discoverRepositories } from './index'

describe('bounded complete discovery pagination', () => {
  it('retains all requested pages and explicitly records search truncation', async () => {
    const endpoints: string[] = []
    const result = await discoverRepositories([{ query: 'miniapp', pages: 2 }], 'unused', async (endpoint) => {
      endpoints.push(endpoint)
      return { total_count: 500, incomplete_results: false, items: Array.from({ length: 100 }, (_, index) => ({ full_name: `example/repo-${index}`, default_branch: 'main', description: null, fork: false, archived: false, size: 1, license: { spdx_id: 'MIT' } })) }
    })
    expect(endpoints).toHaveLength(2)
    expect(endpoints[1]).toContain('page=2')
    expect(result.discovery.map(page => page.truncated)).toEqual([false, true])
    expect(result.repositories).toHaveLength(100)
  })

  it('retains server incompleteness and stops at an exhausted page', async () => {
    const result = await discoverRepositories([{ query: 'empty', pages: 10 }], 'unused', async () => ({ total_count: 0, incomplete_results: true, items: [] }))
    expect(result.discovery).toHaveLength(1)
    expect(result.discovery[0]?.incompleteResults).toBe(true)
    await expect(discoverRepositories([{ query: 'bad', pages: 11 }], 'unused')).rejects.toThrow('page budget')
  })
})
