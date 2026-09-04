import { describe, expect, it, vi } from 'vitest'
import { resolvePullRequest } from '../.github/scripts/resolve-performance-runs.mjs'

describe('resolve performance pull request', () => {
  it('resolves a pull request from a fork head repository and branch', async () => {
    const request = vi.fn().mockResolvedValueOnce([{
      base: { sha: 'base-sha' },
      head: { sha: 'head-sha' },
      number: 824,
      state: 'open',
    }])

    const pullRequest = await resolvePullRequest({
      apiUrl: 'https://api.example.test',
      headBranch: 'refactor/blazediff-image-compare',
      headRepository: 'teimurjan/weapp-vite',
      headSha: 'head-sha',
      repository: 'weapp-vite/weapp-vite',
      token: 'token',
      request,
    })

    expect(pullRequest.number).toBe(824)
    expect(request).toHaveBeenCalledWith(
      'https://api.example.test',
      'token',
      '/repos/weapp-vite/weapp-vite/pulls?state=all&head=teimurjan%3Arefactor%2Fblazediff-image-compare&per_page=100',
    )
    expect(request).toHaveBeenCalledTimes(1)
  })

  it('falls back to the commit association endpoint when branch metadata is unavailable', async () => {
    const request = vi.fn().mockResolvedValueOnce([{
      head: { sha: 'head-sha' },
      number: 824,
      state: 'open',
    }])

    const pullRequest = await resolvePullRequest({
      apiUrl: 'https://api.example.test',
      headSha: 'head-sha',
      repository: 'weapp-vite/weapp-vite',
      token: 'token',
      request,
    })

    expect(pullRequest.number).toBe(824)
    expect(request).toHaveBeenCalledWith(
      'https://api.example.test',
      'token',
      '/repos/weapp-vite/weapp-vite/commits/head-sha/pulls',
    )
  })
})
