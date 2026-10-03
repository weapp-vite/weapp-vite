import { expect, it, vi } from 'vitest'
import { createMatrix, policy, statusContext, targetKey } from './contract.mjs'
import { selectTargets } from './schedule.mjs'

it('selects main and the oldest unevaluated labelled PR, preserving failures and cancellations', async () => {
  const sha = (n: number) => n.toString(16).repeat(40)
  const get = async (endpoint: string) => {
    if (endpoint === '') {
      return { default_branch: 'main' }
    }
    if (endpoint.startsWith('/git/ref/')) {
      return { object: { sha: sha(1) } }
    }
    if (endpoint.startsWith('/pulls?')) {
      return [2, 3, 4].map(n => ({ number: n, labels: [{ name: policy.label }], created_at: `2026-01-0${n}` }))
    }
    if (endpoint.includes('/events')) {
      return []
    }
    if (/^\/pulls\/\d+$/.test(endpoint)) {
      const n = Number(endpoint.split('/').at(-1))
      return { number: n, state: 'open', head: { sha: sha(n), repo: { full_name: 'owner/repo' } } }
    }
    if (endpoint.includes('/statuses')) {
      return endpoint.includes(sha(2)) ? [{ context: statusContext({ headSha: sha(2), baselineSha: policy.baselineSha }), state: 'failure', target_url: 'https://example.test/run/1' }] : []
    }
    throw new Error(endpoint)
  }
  const result = await selectTargets({ get })
  expect(result.targets.map((t: { id: string }) => t.id)).toEqual(['main', 'pr-3'])
  expect(result.reused[0].previous.state).toBe('failure')
})

it('rejects manual targets that are not open', async () => {
  await expect(selectTargets({ prNumber: 9, get: async (endpoint: string) => endpoint === '' ? { default_branch: 'main' } : endpoint.startsWith('/git/ref/') ? { object: { sha: 'a'.repeat(40) } } : endpoint.includes('/statuses') ? [] : { state: 'closed' } })).rejects.toThrow('open')
})

it('freezes main and a manual PR once, reusing an existing pending attempt without resetting it', async () => {
  const mainSha = 'a'.repeat(40)
  const prSha = 'b'.repeat(40)
  const get = async (endpoint: string) => {
    if (endpoint === '') {
      return { default_branch: 'main' }
    }
    if (endpoint.startsWith('/git/ref/')) {
      return { object: { sha: mainSha } }
    }
    if (endpoint === '/pulls/7') {
      return { state: 'open', number: 7, head: { sha: prSha, repo: { full_name: 'owner/repo' } } }
    }
    if (endpoint.includes('/statuses')) {
      return endpoint.includes(prSha) ? [{ context: statusContext({ headSha: prSha, baselineSha: policy.baselineSha }), state: 'pending', target_url: 'https://example.test/run/1' }] : []
    }
    throw new Error(endpoint)
  }
  const result = await selectTargets({ prNumber: 7, get })
  expect(result.targets.map((t: { id: string }) => t.id)).toEqual(['main'])
  expect(result.reused).toMatchObject([{ id: 'pr-7', previous: { state: 'pending' } }])
})

it.each([undefined, 'pending', 'failure', 'success'])('selects only immutable main with an existing %s attempt without querying the PR queue', async (state) => {
  const mainSha = 'a'.repeat(40)
  const main = { id: 'main', prNumber: null, headSha: mainSha, baselineSha: policy.baselineSha }
  const get = vi.fn(async (endpoint: string) => {
    if (endpoint === '') {
      return { default_branch: 'main' }
    }
    if (endpoint === '/git/ref/heads/main') {
      return { object: { sha: mainSha } }
    }
    if (endpoint === `/commits/${mainSha}/statuses?per_page=100&page=1`) {
      return state ? [{ context: statusContext(main), state, target_url: 'https://example.test/run/1' }] : []
    }
    throw new Error(`Unexpected main-only query: ${endpoint}`)
  })
  const result = await selectTargets({ mainOnly: true, get })
  if (state) {
    expect(result.targets).toEqual([])
    expect(result.reused).toMatchObject([{ ...main, previous: { state } }])
  }
  else {
    expect(result.targets).toMatchObject([{ ...main, key: targetKey(main) }])
    const matrix = createMatrix(result.targets)
    expect(matrix).toHaveLength(27)
    expect(matrix.every(row => row.target === 'main' && row.headSha === mainSha && row.baselineSha === policy.baselineSha)).toBe(true)
    expect(result.reused).toEqual([])
  }
  expect(get).toHaveBeenCalledTimes(3)
})

it('rejects main-only with an explicit PR before any GitHub request', async () => {
  const get = vi.fn()
  await expect(selectTargets({ mainOnly: true, prNumber: 7, get })).rejects.toThrow('main-only cannot be combined with pr-number')
  expect(get).not.toHaveBeenCalled()
})
