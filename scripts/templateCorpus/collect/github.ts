import { createHash, randomUUID } from 'node:crypto'
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { setTimeout } from 'node:timers/promises'
import { execa } from 'execa'
import { corpusHash } from '../archive'

export interface GitTreeEntry {
  path: string
  type: 'blob' | 'tree' | 'commit'
  sha: string
  size?: number
  mode?: string
}

interface GitTree {
  tree: GitTreeEntry[]
  truncated: boolean
}

export interface GitHubTransport {
  json: (endpoint: string) => Promise<unknown>
  bytes: (url: string) => Promise<Uint8Array>
}

export interface GitHubClientOptions {
  cacheDir: string
  transport?: GitHubTransport
  attempts?: number
  wait?: (milliseconds: number) => Promise<void>
}

function retryDelay(error: unknown, attempt: number): number | undefined {
  if (error instanceof Error && /\b(?:429|403|5\d{2}|EOF)\b|rate limit|ECONNRESET|ETIMEDOUT|EAI_AGAIN|fetch failed/i.test(error.message)) {
    return Math.min(60_000, 1_000 * 2 ** attempt)
  }
  return undefined
}

/** 使用正常 gh 登录态；凭据不会进入命令、缓存或语料清单。 */
export function createGitHubClient(options: GitHubClientOptions) {
  const transport: GitHubTransport = options.transport ?? {
    async json(endpoint) {
      const result = await execa('gh', ['api', endpoint], { maxBuffer: 64 * 1024 * 1024 })
      const parsed: unknown = JSON.parse(result.stdout)
      return parsed
    },
    async bytes(url) {
      const response = await fetch(url, { signal: AbortSignal.timeout(60_000) })
      if (!response.ok) {
        throw new Error(`GitHub source download returned HTTP ${response.status}`)
      }
      return new Uint8Array(await response.arrayBuffer())
    },
  }
  const wait = options.wait ?? (async (milliseconds) => {
    await setTimeout(milliseconds)
  })
  async function request<T>(operation: () => Promise<T>): Promise<T> {
    const attempts = options.attempts ?? 4
    for (let attempt = 0; ; attempt++) {
      try {
        return await operation()
      }
      catch (error) {
        const delay = retryDelay(error, attempt)
        if (attempt + 1 >= attempts || delay === undefined) {
          throw error
        }
        await wait(delay)
      }
    }
  }
  async function cache(key: string, operation: () => Promise<Uint8Array>): Promise<Uint8Array> {
    const directory = path.join(options.cacheDir, 'requests')
    const file = path.join(directory, corpusHash(key))
    try {
      const [bytes, receipt] = await Promise.all([readFile(file), readFile(`${file}.sha256`, 'utf8')])
      if (corpusHash(bytes) !== receipt) {
        throw new Error('Corrupt GitHub source cache')
      }
      return bytes
    }
    catch (error) {
      if (!(error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT')) {
        throw error
      }
    }
    const bytes = await request(operation)
    await mkdir(directory, { recursive: true })
    const temporary = `${file}.${randomUUID()}.partial`
    await writeFile(temporary, bytes)
    await rename(temporary, file)
    await writeFile(`${file}.sha256`, corpusHash(bytes))
    return bytes
  }
  return {
    async json(endpoint: string): Promise<unknown> {
      const bytes = await cache(`api:${endpoint}`, async () => new TextEncoder().encode(JSON.stringify(await transport.json(endpoint))))
      const result: unknown = JSON.parse(new TextDecoder().decode(bytes))
      return result
    },
    async blob(repository: string, commit: string, entry: GitTreeEntry): Promise<Uint8Array> {
      const suffix = entry.path.split('/').map(encodeURIComponent).join('/')
      const url = `https://raw.githubusercontent.com/${repository}/${commit}/${suffix}`
      let bytes: Uint8Array
      try {
        bytes = await cache(url, () => transport.bytes(url))
      }
      catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        throw new Error(`GitHub source download failed: ${repository}@${commit}:${entry.path} (${message})`, { cause: error })
      }
      const objectHash = createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex')
      if (objectHash !== entry.sha) {
        throw new Error(`Git blob integrity mismatch: ${repository}@${commit}:${entry.path}`)
      }
      return bytes
    },
  }
}

export type GitHubClient = ReturnType<typeof createGitHubClient>

function readTree(value: unknown): GitTree {
  if (!value || typeof value !== 'object' || !('tree' in value) || !Array.isArray(value.tree) || !('truncated' in value) || typeof value.truncated !== 'boolean') {
    throw new Error('Invalid GitHub tree response')
  }
  for (const entry of value.tree as unknown[]) {
    if (!entry || typeof entry !== 'object' || !('path' in entry) || typeof entry.path !== 'string' || !('sha' in entry) || typeof entry.sha !== 'string' || !('type' in entry) || !['blob', 'tree', 'commit'].includes(String(entry.type))) {
      throw new Error('Invalid GitHub tree entry')
    }
  }
  return value as GitTree
}

/** 递归结果截断时按目录重新遍历，不把缺失文件当成已采集完成。 */
export async function readCompleteTree(client: GitHubClient, repository: string, commit: string): Promise<GitTreeEntry[]> {
  const endpoint = `repos/${repository}/git/trees/${commit}`
  const recursive = readTree(await client.json(`${endpoint}?recursive=1`))
  if (!recursive.truncated) {
    return recursive.tree.filter(entry => entry.type === 'blob').sort((a, b) => a.path.localeCompare(b.path, 'en'))
  }
  const queue = [{ sha: commit, prefix: '' }]
  const result: GitTreeEntry[] = []
  for (let index = 0; index < queue.length; index++) {
    const current = queue[index]!
    const tree = readTree(await client.json(`repos/${repository}/git/trees/${current.sha}`))
    if (tree.truncated) {
      throw new Error(`GitHub directory tree is truncated: ${repository}@${commit}:${current.prefix}`)
    }
    for (const entry of tree.tree) {
      const relative = `${current.prefix}${entry.path}`
      if (entry.type === 'tree') {
        queue.push({ sha: entry.sha, prefix: `${relative}/` })
      }
      else if (entry.type === 'blob') {
        result.push({ ...entry, path: relative })
      }
    }
  }
  return result.sort((a, b) => a.path.localeCompare(b.path, 'en'))
}
