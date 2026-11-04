import type { CorpusLicense, CorpusSource } from '../types'
import type { GitHubClient, GitTreeEntry } from './github'
import assert from 'node:assert/strict'
import { corpusHash, corpusJson } from '../archive'
import { isAttributionFile } from '../attributionFiles'
import { encodeLicenseFile } from '../license'
import { validateSourceIdentity } from './selection'

export { isAttributionFile } from '../attributionFiles'

export function decodeCorpusSource(bytes: Uint8Array, identity?: string): string {
  try {
    return new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes)
  }
  catch (error) {
    throw new Error(`Invalid UTF-8 corpus source${identity ? `: ${identity}` : ''}`, { cause: error })
  }
}

/** 按文件槽位并发，不按网络完成顺序改变冻结清单。 */
export async function mapCorpusFiles<T, U>(items: readonly T[], limit: number, operation: (item: T) => Promise<U>): Promise<U[]> {
  assert.ok(Number.isSafeInteger(limit) && limit > 0, 'Invalid collector concurrency')
  const result: U[] = []
  let cursor = 0
  await Promise.all(Array.from({ length: Math.min(items.length, limit) }, async () => {
    while (cursor < items.length) {
      const index = cursor++
      result[index] = await operation(items[index]!)
    }
  }))
  return result
}

/** 原生与受控构建输入共用完整许可归档及稳定身份算法。 */
export async function collectSourceAttribution(source: Pick<CorpusSource, 'repository' | 'commit' | 'license'>, files: readonly GitTreeEntry[], client: GitHubClient, concurrency = 8): Promise<CorpusLicense> {
  validateSourceIdentity(source, files)
  const byPath = new Map(files.map(file => [file.path, file]))
  const attributionPaths = new Set([
    ...source.license.files,
    ...files.filter(file => file.type === 'blob' && file.mode !== '120000' && isAttributionFile(file.path)).map(file => file.path),
  ])
  const licenseFiles = await mapCorpusFiles([...attributionPaths].sort(), concurrency, async (file) => {
    const bytes = await client.blob(source.repository, source.commit, byPath.get(file)!)
    return encodeLicenseFile(file, bytes, source.license.encodings?.[file])
  })
  const id = `license-${corpusHash(corpusJson({ repository: source.repository, commit: source.commit, files: licenseFiles })).slice(0, 24)}`
  return { id, repository: source.repository, commit: source.commit, spdx: source.license.spdx, files: licenseFiles }
}
