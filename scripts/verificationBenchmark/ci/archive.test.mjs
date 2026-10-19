import { Buffer } from 'node:buffer'
import { createHash } from 'node:crypto'
import { existsSync } from 'node:fs'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import AdmZip from 'adm-zip'
import { expect, it } from 'vitest'
import { extractArtifactArchive, validateArchiveEntries } from '../../../.github/scripts/verification-artifacts.mjs'

const metadata = bytes => ({ size_in_bytes: bytes.length, digest: `sha256:${createHash('sha256').update(bytes).digest('hex')}` })
const entry = (entryName, attr = 0, size = 1) => ({ entryName, isDirectory: entryName.endsWith('/'), attr, header: { size } })

async function archiveOperation(bytes, operation) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'verification-archive-'))
  const archive = path.join(root, 'input.zip')
  const output = path.join(root, 'output')
  try {
    await writeFile(archive, bytes)
    await operation(archive, output)
  }
  finally {
    await rm(root, { recursive: true, force: true })
  }
}

it('preserves real ZIP binary and Unicode file contents', async () => {
  const zip = new AdmZip()
  const bytes = Buffer.from([0, 255, 128, 10, 13])
  zip.addFile('reports/报告.bin', bytes)
  const archive = zip.toBuffer()
  await archiveOperation(archive, async (filename, output) => {
    await extractArtifactArchive(filename, output, metadata(archive))
    expect(await readFile(path.join(output, 'reports/报告.bin'))).toEqual(bytes)
  })
})

it.each(['size', 'digest', 'missing-digest'])('rejects REST %s mismatch before extraction', async (kind) => {
  const zip = new AdmZip()
  zip.addFile('report.json', Buffer.from('{}'))
  const bytes = zip.toBuffer()
  const artifact = metadata(bytes)
  if (kind === 'size') {
    artifact.size_in_bytes++
  }
  if (kind === 'digest') {
    artifact.digest = `sha256:${'0'.repeat(64)}`
  }
  if (kind === 'missing-digest') {
    delete artifact.digest
  }
  await archiveOperation(bytes, async (filename, output) => {
    await expect(extractArtifactArchive(filename, output, artifact)).rejects.toThrow(/size|digest/u)
    expect(existsSync(output)).toBe(false)
  })
})

it.each(['../outside', '/absolute', 'C:/drive', 'a\\b', 'a//b', './file', 'a/../file', 'a\0b', 'a\u007Fb', 'a:b', 'CON.txt', 'con', 'LPT¹.json', 'a./file', 'a /file'])('rejects cross-platform unsafe path %j', (name) => {
  expect(() => validateArchiveEntries([entry(name)])).toThrow(/path/u)
})

it.each([
  ['same path', ['a', 'a']],
  ['case alias', ['Reports/a', 'reports/A']],
  ['Unicode alias', ['é', 'e\u0301']],
  ['file ancestor', ['report', 'report/index.json']],
  ['ancestor case alias', ['Reports', 'reports/index.json']],
])('rejects %s before writing any entries', (_, names) => {
  expect(() => validateArchiveEntries(names.map(name => entry(name)))).toThrow(/alias|conflict/u)
})

it.each([0o120000, 0o010000, 0o060000])('rejects nonregular Unix file type %s', (type) => {
  expect(() => validateArchiveEntries([entry('link', type << 16)])).toThrow(/type/u)
})

it('accepts explicit directories and refuses file/directory type confusion or decompression budgets', () => {
  expect(validateArchiveEntries([entry('a/', 0o040000 << 16, 0), entry('a/index.json', 0o100000 << 16)])).toHaveLength(2)
  expect(() => validateArchiveEntries([entry('file', 0o040000 << 16)])).toThrow(/type/u)
  expect(() => validateArchiveEntries([entry('huge', 0, 512 * 1024 ** 2 + 1)])).toThrow(/budget/u)
  expect(() => validateArchiveEntries(Array.from({ length: 17 }, (_, index) => entry(`part-${index}`, 0, 512 * 1024 ** 2)))).toThrow(/budget/u)
})

it('checks entry CRC even when the raw archive matches the REST digest', async () => {
  const zip = new AdmZip()
  zip.addFile('report.json', Buffer.from('{"valid":true}'))
  const bytes = zip.toBuffer()
  const central = bytes.indexOf(Buffer.from([0x50, 0x4B, 0x01, 0x02]))
  bytes.writeUInt32LE((bytes.readUInt32LE(central + 16) + 1) >>> 0, central + 16)
  await archiveOperation(bytes, async (filename, output) => {
    await expect(extractArtifactArchive(filename, output, metadata(bytes))).rejects.toThrow(/CRC/u)
  })
})
