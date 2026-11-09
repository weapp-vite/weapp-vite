import { expect, it, vi } from 'vitest'
import { selectSmokeScope } from './smokeScope.mjs'

const target = { prNumber: 7, repository: 'owner/repo', headSha: 'a'.repeat(40), headRef: 'feature', baseSha: 'b'.repeat(40), baseRef: 'release/next', headRepository: 'fork/repo' }
const pull = {
  number: target.prNumber,
  state: 'open',
  head: { sha: target.headSha, ref: target.headRef, repo: { full_name: target.headRepository } },
  base: { sha: 'c'.repeat(40), ref: target.baseRef, repo: { full_name: target.repository } },
}
const baseEndpoint = '/git/ref/heads/release%2Fnext'

it.each([
  [['README.md'], false],
  [['packages/weapp-vite/src/index.ts'], true],
])('selects frozen PR smoke paths while its base snapshot is older than the actual ref: %j', async (filenames, expected) => {
  const get = vi.fn(async (endpoint: string) => endpoint === baseEndpoint ? { object: { sha: target.baseSha } } : endpoint.includes('/files') ? (filenames as string[]).map(filename => ({ filename })) : pull)
  expect(await selectSmokeScope(target, get)).toBe(expected)
})

it.each([
  ['number', { ...pull, number: 8 }],
  ['state', { ...pull, state: 'closed' }],
  ['head commit', { ...pull, head: { ...pull.head, sha: 'd'.repeat(40) } }],
  ['head branch', { ...pull, head: { ...pull.head, ref: 'other' } }],
  ['head repository', { ...pull, head: { ...pull.head, repo: { full_name: 'other/repo' } } }],
  ['base branch', { ...pull, base: { ...pull.base, ref: 'other' } }],
  ['base repository', { ...pull, base: { ...pull.base, repo: { full_name: 'other/repo' } } }],
])('rejects a PR %s change before and while selecting paths', async (_part, changed) => {
  for (const phase of ['before', 'during']) {
    let reads = 0
    const get = vi.fn(async (endpoint: string) => {
      if (endpoint === baseEndpoint) {
        return { object: { sha: target.baseSha } }
      }
      if (endpoint.includes('/files')) {
        return [{ filename: 'README.md' }]
      }
      reads += 1
      return phase === 'before' || reads > 1 ? changed : pull
    })
    await expect(selectSmokeScope(target, get)).rejects.toThrow('PR changed')
    if (phase === 'before') {
      expect(get).toHaveBeenCalledTimes(1)
    }
  }
})

it.each(['before', 'during'])('rejects actual base ref drift %s selecting paths even when the PR snapshot matches', async (phase) => {
  let reads = 0
  const get = vi.fn(async (endpoint: string) => {
    if (endpoint === baseEndpoint) {
      reads += 1
      return { object: { sha: phase === 'before' || reads > 1 ? 'd'.repeat(40) : target.baseSha } }
    }
    if (endpoint.includes('/files')) {
      return [{ filename: 'README.md' }]
    }
    return { ...pull, base: { ...pull.base, sha: target.baseSha } }
  })
  await expect(selectSmokeScope(target, get)).rejects.toThrow('PR changed')
  expect(get.mock.calls.some(([endpoint]) => endpoint.includes('/files'))).toBe(phase === 'during')
})

const nativeSnapshot = {
  ...target,
  schemaVersion: 1,
  event: 'pull_request',
  runId: '123',
  runAttempt: 1,
  isPr: true,
  shouldRun: true,
  driverSha: 'c'.repeat(40),
  checkoutSha: 'c'.repeat(40),
  checkoutMode: 'merge',
  selections: { 'ci-performance': true },
}

it.each([
  [['README.md'], false],
  [['packages/weapp-vite/src/index.ts'], true],
])('uses the fixed native smoke diff after main advances: %j', async (filenames, needed) => {
  const get = vi.fn(async (endpoint: string) => {
    if (endpoint === '/pulls/7') {
      return { ...pull, base: { ...pull.base, sha: 'd'.repeat(40) } }
    }
    if (endpoint === `/compare/${target.baseSha}...${target.headSha}?per_page=100`) {
      return { base_commit: { sha: target.baseSha }, files: (filenames as string[]).map(filename => ({ filename, status: 'modified' })) }
    }
    throw new Error(`Mutable target must not replace the snapshot: ${endpoint}`)
  })
  expect(await selectSmokeScope(nativeSnapshot, get)).toBe(needed)
})

it('keeps the native smoke check when the fixed comparison may be truncated', async () => {
  const get = async (endpoint: string) => endpoint === '/pulls/7'
    ? pull
    : {
        base_commit: { sha: target.baseSha },
        files: Array.from({ length: 300 }, () => ({ filename: 'README.md', status: 'modified' })),
      }
  expect(await selectSmokeScope(nativeSnapshot, get)).toBe(true)
})
