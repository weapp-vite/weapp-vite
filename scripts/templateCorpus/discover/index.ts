import type { CorpusDiscoveryPage } from '../types'
import assert from 'node:assert/strict'
import { githubJson } from './github'

export interface DiscoveredRepository {
  full_name: string
  default_branch: string
  description: string | null
  fork: boolean
  archived: boolean
  size: number
  license: { spdx_id: string } | null
}

interface SearchPage {
  total_count: number
  incomplete_results: boolean
  items: DiscoveredRepository[]
}

export interface DiscoveryQuery {
  query: string
  pages: number
}

/** 搜索只发现候选，选定来源随后由固定提交的完整树决定。 */
export async function discoverRepositories(queries: readonly DiscoveryQuery[], cacheDir: string, request = githubJson<SearchPage>) {
  const repositories = new Map<string, DiscoveredRepository>()
  const discovery: CorpusDiscoveryPage[] = []
  for (const { query, pages } of queries) {
    assert.ok(query.trim(), 'Discovery query must be explicit')
    assert.ok(Number.isSafeInteger(pages) && pages >= 1 && pages <= 10, 'GitHub search page budget must be between 1 and 10')
    for (let page = 1; page <= pages; page++) {
      const endpoint = `search/repositories?q=${encodeURIComponent(query)}&sort=stars&per_page=100&page=${page}`
      const result = await request(endpoint, cacheDir)
      assert.ok(Array.isArray(result.items) && Number.isSafeInteger(result.total_count) && result.total_count >= 0 && typeof result.incomplete_results === 'boolean', 'Invalid GitHub search response')
      discovery.push({ query, page, totalCount: result.total_count, incompleteResults: result.incomplete_results, repositories: result.items.map(item => item.full_name), truncated: page === pages && result.total_count > page * 100 })
      for (const repository of result.items) {
        repositories.set(repository.full_name.toLowerCase(), repository)
      }
      if (result.items.length < 100) {
        break
      }
    }
  }
  return { discovery, repositories: [...repositories.values()].sort((a, b) => a.full_name.localeCompare(b.full_name, 'en')) }
}
