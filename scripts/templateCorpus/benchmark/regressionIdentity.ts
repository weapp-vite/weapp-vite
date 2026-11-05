import type { CorpusFileIdentity } from '../types'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { corpusHash } from '../integrity'

interface FrozenSourceIdentity {
  schemaVersion: 1
  ref: string
  lockSha256: string
  files: CorpusFileIdentity[]
}

/** 身份文件本身先与审阅策略绑定，再核对冻结源码和原始锁文件；不要求当前锁与旧锁相同。 */
export async function verifyRegressionBaseline(sourceRoot: string, identityFile: string, expected: { baselineRef: string, baselineLockSha256: string, baselineSourceIdentitySha256: string }) {
  const bytes = await readFile(identityFile)
  assert.equal(corpusHash(bytes), expected.baselineSourceIdentitySha256, 'Frozen baseline source identity file differs from reviewed policy')
  const parsed: unknown = JSON.parse(bytes.toString('utf8'))
  assert.ok(parsed && typeof parsed === 'object' && 'schemaVersion' in parsed && parsed.schemaVersion === 1, 'Invalid frozen baseline source identity')
  const identity = parsed as FrozenSourceIdentity
  assert.equal(identity.ref, expected.baselineRef, 'Frozen baseline commit differs from reviewed policy')
  assert.equal(identity.lockSha256, expected.baselineLockSha256, 'Frozen baseline original lock identity differs from reviewed policy')
  assert.ok(Array.isArray(identity.files) && identity.files.length, 'Frozen baseline source identity is empty')
  const labels = new Set<string>()
  for (const file of identity.files) {
    assert.ok(file.file && !path.isAbsolute(file.file) && !file.file.includes('\\') && !file.file.split('/').includes('..') && !labels.has(file.file), 'Invalid or duplicate frozen baseline source label')
    labels.add(file.file)
    const content = await readFile(path.join(sourceRoot, file.file))
    assert.equal(content.length, file.bytes, `Frozen baseline source bytes differ: ${file.file}`)
    assert.equal(corpusHash(content), file.sha256, `Frozen baseline source hash differs: ${file.file}`)
  }
  const lock = await readFile(path.join(sourceRoot, 'pnpm-lock.yaml'))
  assert.equal(corpusHash(lock), expected.baselineLockSha256, 'Frozen baseline original lock changed')
  return { ref: identity.ref, lockSha256: identity.lockSha256, sourceIdentitySha256: corpusHash(bytes), sourceFiles: identity.files.length }
}
