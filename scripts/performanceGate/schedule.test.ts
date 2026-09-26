import { expect, it } from 'vitest'
import { policy, statusContext } from './contract.mjs'
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
