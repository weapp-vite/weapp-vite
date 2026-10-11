import type { ArtifactReference, CompactEvidence, PortablePayload, PublicManifest } from './schema.mts'
import assert from 'node:assert/strict'
import { Buffer } from 'node:buffer'
import { lstat, readdir, readFile, realpath } from 'node:fs/promises'
import path from 'node:path'
import { brotliDecompressSync, gunzipSync } from 'node:zlib'
import { canonical, canonicalHash, decodeEvidence, sha256 } from './codec.mts'
import { assertPublicText } from './redact.mts'

function object(value: unknown, description: string): Record<string, unknown> {
  assert(value && typeof value === 'object' && !Array.isArray(value), `Missing ${description}`)
  return value as Record<string, unknown>
}

function relativeFile(value: string) {
  assert(typeof value === 'string' && value.length > 0 && !value.includes('\\') && !path.posix.isAbsolute(value) && !/^[a-z]:/i.test(value) && value.split('/').every(part => part && part !== '.' && part !== '..'), 'Invalid public relative filename')
  return value
}

/** payload 引用只沿公开对象的自有属性或规范数组下标读取，不解析文件路径。 */
function payloadReference(payload: PortablePayload, reference: string): unknown {
  assert(reference.startsWith('payload:/') && reference.length > 'payload:/'.length, 'Invalid payload reference')
  let value: unknown = payload
  for (const encoded of reference.slice('payload:/'.length).split('/')) {
    assert(encoded.length > 0 && !/~(?![01])/u.test(encoded), 'Invalid JSON pointer segment')
    const key = encoded.replaceAll('~1', '/').replaceAll('~0', '~')
    assert(!['__proto__', 'prototype', 'constructor', '.', '..'].includes(key) && [...key].every(character => character.charCodeAt(0) > 31), 'Unsafe JSON pointer segment')
    if (Array.isArray(value)) {
      assert(/^(?:0|[1-9]\d*)$/u.test(key), 'Invalid JSON pointer array index')
      const index = Number(key)
      assert(Number.isSafeInteger(index) && index < value.length && Object.hasOwn(value, index), 'Missing JSON pointer array item')
      value = value[index]
    }
    else {
      const record = object(value, 'JSON pointer parent')
      assert(Object.hasOwn(record, key), 'Missing JSON pointer property')
      value = record[key]
    }
  }
  return value
}

/** 标准压缩只改变容器字节，解压后仍需逐份检查 UTF-8 和隐私。 */
function publicText(file: string, bytes: Buffer) {
  const expanded = file.endsWith('.gz') ? gunzipSync(bytes) : file.endsWith('.br') ? brotliDecompressSync(bytes) : bytes
  const value = expanded.toString('utf8')
  assert.deepEqual(Buffer.from(value), expanded, 'Public evidence is not UTF-8 text')
  assertPublicText(value)
  return value
}

/** 核对公开目录完整文件集合与独立字节摘要后才展开；全程只读，不评估性能门禁。 */
export async function readPublicEvidence(directory: string) {
  const root = await realpath(directory)
  assert((await lstat(directory)).isDirectory() && !(await lstat(directory)).isSymbolicLink(), 'Public directory must not be a symlink')
  const files: string[] = []
  async function walk(current: string) {
    for (const entry of await readdir(current, { withFileTypes: true })) {
      const file = path.join(current, entry.name)
      const stat = await lstat(file)
      assert(!stat.isSymbolicLink(), 'Public evidence must not contain symlinks')
      if (stat.isDirectory()) {
        await walk(file)
      }
      else {
        assert(stat.isFile(), 'Unexpected public evidence file type')
        files.push(path.relative(root, file).split(path.sep).join('/'))
      }
    }
  }
  await walk(root)
  const manifestNames = ['manifest.json.gz', 'manifest.json']
  const present = manifestNames.filter(file => files.includes(file))
  assert.equal(present.length, 1, 'Public evidence requires exactly one manifest')
  const manifestFile = present[0]!
  const manifest = JSON.parse(publicText(manifestFile, await readFile(path.join(root, manifestFile)))) as PublicManifest
  assert.equal(manifest.contract, 'architecture-portable-files-v1')
  assert(manifestNames.every(file => !Object.hasOwn(manifest.files, file)), 'Manifest must not hash either manifest filename')
  assert.deepEqual(files.filter(file => file !== manifestFile).sort(), Object.keys(manifest.files).sort(), 'Public file set differs from manifest')
  for (const [file, expected] of Object.entries(manifest.files)) {
    const bytes = await readFile(path.join(root, relativeFile(file)))
    assert(Number.isSafeInteger(expected.bytes) && expected.bytes >= 0)
    assert.match(expected.sha256, /^[a-f\d]{64}$/)
    assert.equal(bytes.byteLength, expected.bytes, `Public byte count differs: ${file}`)
    assert.equal(sha256(bytes), expected.sha256, `Public byte hash differs: ${file}`)
    publicText(file, bytes)
  }
  for (const original of Object.values(manifest.originals)) {
    assert.match(original.sha256, /^[a-f\d]{64}$/)
    assert(Number.isSafeInteger(original.bytes) && original.bytes >= 0)
    if (!original.publicReference.startsWith('payload:')) {
      assert(Object.hasOwn(manifest.files, relativeFile(original.publicReference)), 'Original reference lacks a public file')
    }
  }
  assert(Object.hasOwn(manifest.files, relativeFile(manifest.payloadFile)), 'Missing public payload')
  const compact = JSON.parse(publicText(manifest.payloadFile, await readFile(path.join(root, manifest.payloadFile)))) as CompactEvidence
  const payload = decodeEvidence(compact)
  for (const original of Object.values(manifest.originals)) {
    if (original.publicReference.startsWith('payload:')) {
      payloadReference(payload, original.publicReference)
    }
  }
  const artifactIds = new Set<string>()
  const artifacts = new Map<string, ArtifactReference>()
  for (const artifact of payload.artifacts) {
    assert(!artifactIds.has(artifact.id), 'Duplicate artifact identity')
    artifactIds.add(artifact.id)
    artifacts.set(artifact.id, artifact)
    assert.deepEqual(manifest.originals[artifact.id], { sha256: artifact.originalSha256, bytes: artifact.originalBytes, publicReference: artifact.publicFile }, 'Original commitment differs from artifact index')
    if (artifact.publicFile.startsWith('payload:')) {
      const value = payloadReference(payload, artifact.publicFile)
      const serialized = JSON.stringify(canonical(value))
      assert.equal(typeof serialized, 'string', 'Payload reference cannot be serialized')
      assert.equal(artifact.publicSha256, canonicalHash(value), 'Payload reference public hash differs')
      assert.equal(artifact.publicBytes, Buffer.byteLength(serialized), 'Payload reference public bytes differ')
    }
    else {
      const file = relativeFile(artifact.publicFile)
      const expected = manifest.files[file]
      assert(expected, 'Artifact is absent from public manifest')
      assert.equal(artifact.publicSha256, expected.sha256)
      assert.equal(artifact.publicBytes, expected.bytes)
    }
    assert.match(artifact.originalSha256, /^[a-f\d]{64}$/)
    assert(Number.isSafeInteger(artifact.originalBytes) && artifact.originalBytes >= 0)
    assert(typeof artifact.transformation === 'string' && artifact.transformation.length > 0)
    assert(Number.isSafeInteger(artifact.replacementCount) && artifact.replacementCount >= 0)
  }
  assert.deepEqual([...artifactIds].sort(), Object.keys(manifest.originals).sort(), 'Original commitment set differs from artifact set')
  async function readArtifactJson(id: string): Promise<unknown> {
    const artifact = artifacts.get(id)
    assert(artifact, `Missing JSON artifact: ${id}`)
    if (artifact.publicFile.startsWith('payload:')) {
      return payloadReference(payload, artifact.publicFile)
    }
    const bytes = await readFile(path.join(root, relativeFile(artifact.publicFile)))
    return JSON.parse(publicText(artifact.publicFile, bytes)) as unknown
  }
  return { payload, artifacts, readArtifactJson, manifestFile, publicFiles: files.length, originalCommitments: Object.keys(manifest.originals).length }
}
