import type { CorpusMetadata } from '../types'
import { mkdtemp, rm, symlink, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, expect, it } from 'vitest'
import { corpusHash, corpusJson } from '../integrity'
import { importAdditionalEvidence, validateAdditionalEvidence } from './additional'
import { assertIdentity } from './files'
import { nativeMetadata } from './testFixtures'

const temporary: string[] = []

async function directory() {
  const output = await mkdtemp(path.join(os.tmpdir(), 'corpus-additional-'))
  temporary.push(output)
  return output
}

afterEach(async () => {
  await Promise.all(temporary.splice(0).map(directory => rm(directory, { recursive: true, force: true })))
})

it('freezes only declared records, deduplicates content and validates every CAS mapping offline', async () => {
  const output = await directory()
  await writeFile(path.join(output, 'discovery.json'), '{"pages":[1,2]}\n')
  await writeFile(path.join(output, 'unowned-secret.txt'), 'not selected')
  await writeFile(path.join(output, 'evidence.json'), corpusJson([
    { file: 'maintenance/discovery.json', kind: 'discovery', path: 'discovery.json' },
    { file: 'maintenance/classification.json', kind: 'report', path: 'discovery.json' },
  ]))
  const imported = await importAdditionalEvidence([path.join(output, 'evidence.json')])
  expect(imported.resources.filter(resource => resource.file.startsWith('objects/'))).toHaveLength(1)
  const { metadata } = nativeMetadata()
  metadata.additionalEvidence = imported.evidence
  const read = (identity: Parameters<typeof assertIdentity>[0]) => {
    assertIdentity(identity)
    const resource = imported.resources.find(resource => resource.file === identity.file)
    if (!resource) {
      throw new Error('Missing resource')
    }
    expect(corpusHash(resource.content)).toBe(identity.sha256)
    return resource.content as Uint8Array
  }
  expect(() => validateAdditionalEvidence(metadata, read)).not.toThrow()
  expect(imported.resources.some(resource => (typeof resource.content === 'string' ? resource.content : new TextDecoder().decode(resource.content)).includes('not selected'))).toBe(false)
  const object = imported.resources.find(resource => resource.file.startsWith('objects/'))!
  imported.resources.splice(imported.resources.indexOf(object), 1)
  expect(() => validateAdditionalEvidence(metadata, read)).toThrow('Missing resource')
})

it('rejects executable paths, traversal, reserved protocol labels and case-folded or role conflicts', async () => {
  const output = await directory()
  await writeFile(path.join(output, 'record.json'), '{}')
  const manifest = path.join(output, 'evidence.json')
  for (const entry of [
    { file: 'record.json', kind: 'report', path: '../record.json' },
    { file: 'record.json', kind: 'report', path: 'node_modules/record.json' },
    { file: 'record.txt', kind: 'report', path: 'compiler.js' },
    { file: 'sources/record.json', kind: 'report', path: 'record.json' },
    { file: 'record.json', kind: 'execute', path: 'record.json' },
  ]) {
    await writeFile(manifest, corpusJson([entry]))
    await expect(importAdditionalEvidence([manifest])).rejects.toThrow()
  }
  const entry = { file: 'record.json', kind: 'report', path: 'record.json' }
  for (const conflicting of [{ ...entry, file: 'Record.json' }, { ...entry, kind: 'discovery' }]) {
    await writeFile(manifest, corpusJson([entry, conflicting]))
    await expect(importAdditionalEvidence([manifest])).rejects.toThrow('conflicts with an earlier entry')
  }
})

it('does not follow declared evidence symlinks and rejects changed additional index identities', async () => {
  const output = await directory()
  await writeFile(path.join(output, 'original.json'), '{}')
  await symlink('original.json', path.join(output, 'linked.json'))
  await writeFile(path.join(output, 'evidence.json'), corpusJson([{ file: 'host/evidence.json', kind: 'report', path: 'linked.json' }]))
  await expect(importAdditionalEvidence([path.join(output, 'evidence.json')])).rejects.toThrow('cannot follow symbolic links')
  const metadata = { additionalEvidence: [{ file: '../replaced.json', sha256: 'a'.repeat(64), bytes: 2 }] } as CorpusMetadata
  expect(() => validateAdditionalEvidence(metadata, () => new Uint8Array())).toThrow('Unstable additional evidence index label')
})
