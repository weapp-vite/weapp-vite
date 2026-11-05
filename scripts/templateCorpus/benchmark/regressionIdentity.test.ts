import { Buffer } from 'node:buffer'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { corpusHash } from '../integrity'
import { repositoryRoot } from '../paths'
import { assertConsumerClosure, consumerAliases } from './regressionConsumers'
import { verifyRegressionBaseline } from './regressionIdentity'

const roots: string[] = []
afterEach(async () => {
  await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })))
})

async function sourceFixture() {
  const root = await mkdtemp(path.join(os.tmpdir(), 'wxml-regression-'))
  roots.push(root)
  const source = path.join(root, 'source')
  await mkdir(source)
  const files = [{ file: 'pnpm-lock.yaml', content: 'original lock\n' }, { file: 'parser.ts', content: 'export const parser = true\n' }]
  for (const file of files) {
    await writeFile(path.join(source, file.file), file.content)
  }
  const expected = { baselineRef: '1'.repeat(40), baselineLockSha256: corpusHash(files[0]!.content), baselineSourceIdentitySha256: '' }
  const identity = path.join(root, 'identity.json')
  const text = JSON.stringify({ schemaVersion: 1, ref: expected.baselineRef, lockSha256: expected.baselineLockSha256, files: files.map(file => ({ file: file.file, bytes: Buffer.byteLength(file.content), sha256: corpusHash(file.content) })) })
  await writeFile(identity, text)
  expected.baselineSourceIdentitySha256 = corpusHash(text)
  return { source, expected, identity, root }
}

describe('frozen regression source identity', () => {
  it('verifies original source and lock without equating it to the current lock', async () => {
    const fixture = await sourceFixture()
    await writeFile(path.join(fixture.root, 'current-lock.yaml'), 'new dependency edge\n')
    expect(await verifyRegressionBaseline(fixture.source, fixture.identity, fixture.expected)).toEqual(expect.objectContaining({ ref: fixture.expected.baselineRef, lockSha256: fixture.expected.baselineLockSha256, sourceFiles: 2 }))
  })

  it('rejects replaced source and replaced identity manifests', async () => {
    const fixture = await sourceFixture()
    await writeFile(path.join(fixture.source, 'parser.ts'), 'replacement')
    await expect(verifyRegressionBaseline(fixture.source, fixture.identity, fixture.expected)).rejects.toThrow('source bytes differ')
    await writeFile(fixture.identity, `${await readFile(fixture.identity, 'utf8')} `)
    await expect(verifyRegressionBaseline(fixture.source, fixture.identity, fixture.expected)).rejects.toThrow('identity file differs')
  })

  it('maps both workspace dependencies and parser subpaths into the selected tree', () => {
    const sourceRoot = path.join(repositoryRoot, '.tmp', 'frozen-source')
    const builtEntry = path.join(sourceRoot, 'packages/wxml/dist/index.mjs')
    const aliases = consumerAliases({ sourceRoot, builtEntry })
    expect(aliases['@weapp-core/shared']).toBe(path.join(sourceRoot, '@weapp-core/shared/src/index.ts'))
    expect(aliases['@weapp-vite/wxml/core']).toBe(path.join(path.dirname(builtEntry), 'core/index.mjs'))
    expect(() => assertConsumerClosure({ inputs: { 'packages/language-service/src/script/scanner.ts': { bytes: 1, imports: [] } } }, { sourceRoot, builtEntry })).toThrow('current workspace implementation')
    expect(() => assertConsumerClosure({ inputs: { [path.join(sourceRoot, 'packages/language-service/src/script/scanner.ts')]: { bytes: 1, imports: [] }, 'node_modules/third-party/index.js': { bytes: 1, imports: [] } } }, { sourceRoot, builtEntry })).not.toThrow()
  })
})
