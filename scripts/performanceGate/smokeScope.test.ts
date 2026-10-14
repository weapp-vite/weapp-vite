import { expect, it, vi } from 'vitest'
import { selectSmokeScope } from './smokeScope.mjs'

const target = { prNumber: 7, headSha: 'a'.repeat(40), baseSha: 'b'.repeat(40) }
const pull = { state: 'open', head: { sha: target.headSha }, base: { sha: target.baseSha } }

it.each([
  [['README.md'], false],
  [['packages/weapp-vite/src/index.ts'], true],
])('selects smoke paths on the frozen manual PR: %j', async (filenames, expected) => {
  const get = vi.fn(async (endpoint: string) => endpoint.includes('/files') ? (filenames as string[]).map(filename => ({ filename })) : pull)
  expect(await selectSmokeScope(target, get)).toBe(expected)
  expect(get.mock.calls.map(([endpoint]) => endpoint)).toEqual(['/pulls/7', '/pulls/7/files?per_page=100&page=1', '/pulls/7'])
})

it.each(['head', 'base'])('rejects a PR %s change while selecting paths', async (part) => {
  const get = vi.fn().mockResolvedValueOnce(pull).mockResolvedValueOnce([{ filename: 'README.md' }]).mockResolvedValueOnce({ ...pull, [part]: { sha: 'c'.repeat(40) } })
  await expect(selectSmokeScope(target, get)).rejects.toThrow('PR changed')
})
