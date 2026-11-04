import type { CorpusFileIdentity } from './types'
import assert from 'node:assert/strict'
import { lstat, readFile, rm } from 'node:fs/promises'
import path from 'node:path'
import { corpusHash } from './integrity'

function ownedPath(file: unknown): file is string {
  if (typeof file !== 'string') {
    return false
  }
  const shard = /^templates-\d{4,}\.jsonl\.gz$/.test(file)
  const evidence = file.startsWith('evidence/') && file.endsWith('.gz')
    && file.split('/').every(part => part && part !== '.' && part !== '..')
    && !/[\\:]/.test(file)
    && [...file].every(character => character.charCodeAt(0) > 31 && character.charCodeAt(0) !== 127)
  return shard || evidence
}

/** 只采用上一份 manifest 的显式拥有清单，不扫描目录猜测垃圾文件。 */
export async function previousArchiveFiles(directory: string): Promise<CorpusFileIdentity[]> {
  let value: unknown
  try {
    value = JSON.parse(await readFile(path.join(directory, 'manifest.json'), 'utf8'))
  }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return []
    }
    throw error
  }
  assert.ok(value && typeof value === 'object' && 'schemaVersion' in value && value.schemaVersion === 1 && 'shards' in value && Array.isArray(value.shards), 'Cannot determine previous corpus ownership')
  const evidence = 'evidence' in value ? value.evidence : []
  assert.ok(Array.isArray(evidence), 'Invalid previous corpus evidence ownership')
  return [...value.shards, ...evidence].map((identity: CorpusFileIdentity) => {
    assert.ok(identity && ownedPath(identity.file) && /^[\da-f]{64}$/.test(identity.sha256) && Number.isSafeInteger(identity.bytes) && identity.bytes >= 0, 'Unsafe previous corpus ownership identity')
    return identity
  })
}

/** 新 manifest 提交成功后，仅删除已退役且未被符号链接替代的旧拥有文件。 */
export async function cleanPreviousArchiveFiles(directory: string, previous: readonly CorpusFileIdentity[], current: readonly string[]): Promise<void> {
  const retained = new Set(current)
  for (const identity of new Map(previous.map(identity => [identity.file, identity])).values()) {
    const file = identity.file
    assert.ok(ownedPath(file), 'Unsafe previous corpus cleanup path')
    if (retained.has(file)) {
      continue
    }
    let target = directory
    const parts = file.split('/')
    try {
      for (const [index, part] of parts.entries()) {
        target = path.join(target, part)
        const stat = await lstat(target)
        assert.ok(!stat.isSymbolicLink() && (index === parts.length - 1 ? stat.isFile() : stat.isDirectory()), 'Retired corpus resource is no longer an owned regular file')
      }
      const bytes = await readFile(target)
      assert.equal(bytes.length, identity.bytes, 'Retired corpus resource was modified; refusing cleanup')
      assert.equal(corpusHash(bytes), identity.sha256, 'Retired corpus resource was replaced; refusing cleanup')
      await rm(target)
    }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error
      }
    }
  }
}
