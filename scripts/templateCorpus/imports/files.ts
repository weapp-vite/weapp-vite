import type { CorpusEvidenceKind, CorpusEvidenceResource } from '../evidence'
import type { CorpusFileIdentity } from '../types'
import assert from 'node:assert/strict'
import { lstat, readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { corpusHash, corpusJson } from '../integrity'

function portableSegments(file: string): boolean {
  return Boolean(file) && !file.startsWith('/') && !/[\\:]/.test(file)
    && [...file].every(character => character.charCodeAt(0) > 31 && character.charCodeAt(0) !== 127)
    && file.split('/').every(part => part && part !== '.' && part !== '..')
}

export function portableFile(file: string): boolean {
  return portableSegments(file) && !file.split('/').some(part => part.toLowerCase() === 'node_modules')
}

function portableOutput(file: string, mode: string): boolean {
  return ['development', 'production'].includes(mode) && file.startsWith(`out/${mode}/`) && portableSegments(file)
}

function assertFileIdentity(value: unknown, allowed: (file: string) => boolean, message: string): asserts value is CorpusFileIdentity {
  assert.ok(value && typeof value === 'object', 'Invalid imported file identity')
  const file = value as CorpusFileIdentity
  assert.ok(typeof file.file === 'string' && allowed(file.file), message)
  assert.ok(/^[\da-f]{64}$/.test(file.sha256) && Number.isSafeInteger(file.bytes) && file.bytes >= 0, 'Invalid imported file hash/size')
}

export function assertIdentity(value: unknown): asserts value is CorpusFileIdentity {
  assertFileIdentity(value, portableFile, 'Unsafe imported file path')
}

export function assertOutputIdentity(value: unknown, mode: string): asserts value is CorpusFileIdentity {
  assertFileIdentity(value, file => portableOutput(file, mode), 'Unsafe imported output path')
}

async function regularPath(directory: string, file: string, directoryOnly = false): Promise<string> {
  let target = directory
  const root = await lstat(target)
  assert.ok(root.isDirectory() && !root.isSymbolicLink(), 'Imported evidence root must be an ordinary directory')
  const segments = file.split('/')
  for (const [index, part] of segments.entries()) {
    target = path.join(target, part)
    const stat = await lstat(target)
    assert.ok(!stat.isSymbolicLink(), 'Imported evidence cannot follow symbolic links')
    assert.ok(index === segments.length - 1 && !directoryOnly ? stat.isFile() : stat.isDirectory(), 'Imported evidence must be a regular file or directory')
  }
  return target
}

/** 导入只读取普通受控文件，不跟随工程内符号链接。 */
export async function readOwnedFile(directory: string, file: string): Promise<Uint8Array> {
  assert.ok(portableFile(file), 'Unsafe imported file path')
  return new Uint8Array(await readFile(await regularPath(directory, file)))
}

export async function readVerifiedFile(directory: string, identity: CorpusFileIdentity, physical = identity.file): Promise<Uint8Array> {
  assertIdentity(identity)
  const content = await readOwnedFile(directory, physical)
  assert.equal(content.length, identity.bytes, `Imported evidence size changed: ${identity.file}`)
  assert.equal(corpusHash(content), identity.sha256, `Imported evidence hash changed: ${identity.file}`)
  return content
}

/** 输出依赖文件必须位于已声明的 out/mode 内，工程真实依赖目录仍不可读取。 */
export async function readVerifiedOutput(directory: string, identity: CorpusFileIdentity, mode: string): Promise<Uint8Array> {
  assertOutputIdentity(identity, mode)
  const content = new Uint8Array(await readFile(await regularPath(directory, identity.file)))
  assert.equal(content.length, identity.bytes, `Imported output size changed: ${identity.file}`)
  assert.equal(corpusHash(content), identity.sha256, `Imported output hash changed: ${identity.file}`)
  return content
}

export function parseEvidenceJson(bytes: Uint8Array): unknown {
  const value: unknown = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes))
  return value
}

async function listOwnedFiles(directory: string, prefix: string, allowed: (file: string) => boolean): Promise<string[]> {
  const entries = await readdir(await regularPath(directory, prefix, true), { withFileTypes: true })
  const result: string[] = []
  for (const entry of entries.sort((a, b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0)) {
    const file = `${prefix}/${entry.name}`
    assert.ok(!entry.isSymbolicLink() && allowed(file), 'Unsafe imported directory entry')
    if (entry.isDirectory()) {
      result.push(...await listOwnedFiles(directory, file, allowed))
    }
    else {
      assert.ok(entry.isFile(), 'Imported directory contains a non-file entry')
      result.push(file)
    }
  }
  return result
}

export async function ownedFiles(directory: string, prefix: string): Promise<string[]> {
  assert.ok(portableFile(prefix), 'Unsafe imported directory path')
  return listOwnedFiles(directory, prefix, portableFile)
}

export async function ownedOutputFiles(directory: string, mode: string): Promise<string[]> {
  assert.ok(['development', 'production'].includes(mode), 'Unsafe imported output mode')
  return listOwnedFiles(directory, `out/${mode}`, file => portableOutput(file, mode))
}

/** 内容寻址让共用源码、锁文件和日志只冻结一次。 */
export class CorpusEvidenceStore {
  private readonly entries = new Map<string, CorpusEvidenceResource>()

  object(content: string | Uint8Array): CorpusFileIdentity {
    const bytes = typeof content === 'string' ? new TextEncoder().encode(content) : content
    return this.named(`objects/${corpusHash(bytes)}`, 'input', bytes)
  }

  json(file: string, kind: CorpusEvidenceKind, value: unknown): CorpusFileIdentity {
    return this.named(file, kind, `${corpusJson(value)}\n`)
  }

  named(file: string, kind: CorpusEvidenceKind, content: string | Uint8Array): CorpusFileIdentity {
    assert.ok(portableFile(file), 'Unsafe frozen evidence label')
    const bytes = typeof content === 'string' ? new TextEncoder().encode(content) : new Uint8Array(content)
    const previous = this.entries.get(file)
    if (previous) {
      assert.equal(previous.kind, kind, 'Frozen evidence role changed')
      assert.equal(corpusHash(previous.content), corpusHash(bytes), 'Frozen evidence label changed')
    }
    else {
      this.entries.set(file, { file, kind, content: bytes })
    }
    return { file, sha256: corpusHash(bytes), bytes: bytes.length }
  }

  resources(): CorpusEvidenceResource[] {
    return [...this.entries.values()].sort((a, b) => a.file < b.file ? -1 : a.file > b.file ? 1 : 0)
  }
}

/** 汇合独立导入的 CAS；同名异文拒绝覆盖，相同内容只保存一次。 */
export function mergeFrozenResources(resources: readonly CorpusEvidenceResource[]): CorpusEvidenceResource[] {
  const store = new CorpusEvidenceStore()
  for (const resource of resources) {
    store.named(resource.file, resource.kind, resource.content)
  }
  return store.resources()
}
