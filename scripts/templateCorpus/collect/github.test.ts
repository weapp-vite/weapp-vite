import type { GitHubTransport } from './github'
import { createHash } from 'node:crypto'
import { mkdtemp, readdir, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, expect, it } from 'vitest'
import { createGitHubClient, readCompleteTree } from './github'

const temporary: string[] = []
const commit = 'a'.repeat(40)
async function unavailable(): Promise<never> {
  throw new Error('Unexpected network request')
}

async function directory() {
  const result = await mkdtemp(path.join(os.tmpdir(), 'template-github-'))
  temporary.push(result)
  return result
}

afterEach(async () => {
  await Promise.all(temporary.splice(0).map(directory => rm(directory, { recursive: true, force: true })))
})

it('expands truncated recursive trees by complete directory traversal', async () => {
  const calls: string[] = []
  const client = createGitHubClient({ cacheDir: await directory(), transport: {
    bytes: unavailable,
    async json(endpoint) {
      calls.push(endpoint)
      if (endpoint.endsWith('?recursive=1')) {
        return { truncated: true, tree: [] }
      }
      return endpoint.endsWith(commit)
        ? { truncated: false, tree: [{ type: 'tree', path: 'pages', sha: 'b'.repeat(40) }, { type: 'blob', path: 'LICENSE', sha: 'c'.repeat(40) }] }
        : { truncated: false, tree: [{ type: 'blob', path: 'home.wxml', sha: 'd'.repeat(40) }] }
    },
  } })
  expect((await readCompleteTree(client, 'example/templates', commit)).map(file => file.path)).toEqual(['LICENSE', 'pages/home.wxml'])
  expect(calls).toHaveLength(3)
})

it('fails if a supposedly complete directory response is itself truncated', async () => {
  const client = createGitHubClient({ cacheDir: await directory(), transport: { bytes: unavailable, json: async () => ({ truncated: true, tree: [] }) } })
  await expect(readCompleteTree(client, 'example/templates', commit)).rejects.toThrow('directory tree is truncated')
})

it('retries transient failures with bounded delay and reuses verified request bytes', async () => {
  let calls = 0
  const delays: number[] = []
  const transport: GitHubTransport = {
    bytes: unavailable,
    async json() {
      if (++calls === 1) {
        throw new Error('HTTP 429 rate limit')
      }
      return { frozen: true }
    },
  }
  const client = createGitHubClient({ cacheDir: await directory(), transport, wait: async (delay) => {
    delays.push(delay)
  } })
  expect(await client.json('frozen')).toEqual({ frozen: true })
  expect(await client.json('frozen')).toEqual({ frozen: true })
  expect(calls).toBe(2)
  expect(delays).toEqual([1_000])
})

it('retries a prematurely closed gh HTTP response and preserves permanent failures', async () => {
  let calls = 0
  const delays: number[] = []
  const client = createGitHubClient({ cacheDir: await directory(), transport: {
    bytes: unavailable,
    async json() {
      if (++calls === 1) {
        throw new Error('Get https://api.github.com/frozen: EOF')
      }
      return { complete: true }
    },
  }, wait: async (delay) => { delays.push(delay) } })
  expect(await client.json('frozen')).toEqual({ complete: true })
  expect(delays).toEqual([1_000])
  const permanent = createGitHubClient({ cacheDir: await directory(), transport: {
    bytes: unavailable,
    json: async () => { throw new Error('HTTP 404 not found') },
  }, wait: async () => { throw new Error('Permanent failures must not retry') } })
  await expect(permanent.json('missing')).rejects.toThrow('404 not found')
})

it('verifies raw Git blob identity including BOM and refuses corrupt cache receipts', async () => {
  const cacheDir = await directory()
  const bytes = new TextEncoder().encode('\uFEFF<view>😀</view>\r\n')
  const sha = createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex')
  const client = createGitHubClient({ cacheDir, transport: { json: unavailable, bytes: async () => bytes } })
  const entry = { path: 'pages/home.wxml', type: 'blob' as const, sha }
  expect(await client.blob('example/templates', commit, entry)).toEqual(bytes)
  await expect(client.blob('example/templates', commit, { ...entry, sha: 'b'.repeat(40) })).rejects.toThrow('Git blob integrity mismatch')
  const receipt = (await readdir(path.join(cacheDir, 'requests'))).find(file => file.endsWith('.sha256'))!
  await writeFile(path.join(cacheDir, 'requests', receipt), 'altered')
  await expect(client.blob('example/templates', commit, entry)).rejects.toThrow('Corrupt GitHub source cache')
})

it('retries every HTTP 5xx finitely and keeps the final status and frozen source identity', async () => {
  for (const status of [500, 501, 599]) {
    let calls = 0
    const delays: number[] = []
    const client = createGitHubClient({
      cacheDir: await directory(),
      attempts: 3,
      wait: async (delay) => {
        delays.push(delay)
      },
      transport: {
        json: unavailable,
        async bytes() {
          calls++
          throw new Error(`HTTP ${status}`)
        },
      },
    })
    const entry = { path: 'pages/home.wxml', type: 'blob' as const, sha: 'b'.repeat(40) }
    await expect(client.blob('example/templates', commit, entry)).rejects.toThrow(`example/templates@${commit}:${entry.path} (HTTP ${status})`)
    expect(calls).toBe(3)
    expect(delays).toEqual([1_000, 2_000])
  }
})
