import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { assertCoverageIdentity, assertSourceCoverageEvidence, captureCoverageIdentity, coverageFileIdentity } from './receipt'

const directories: string[] = []

async function repository() {
  const root = await mkdtemp(path.join(os.tmpdir(), 'coverage-receipt-'))
  directories.push(root)
  const files: Record<string, string> = {
    'packages/wxml/test/corpus/manifest.json': JSON.stringify({ schemaVersion: 1, id: 'frozen-corpus', contentSha256: 'a'.repeat(64) }),
    'packages/wxml/src/index.ts': 'export const value = 1',
    'packages/wxml/src/index.test.ts': 'test("value", () => {})',
    'packages/wxml/src/types.d.ts': 'export interface PureDeclaration {}',
    'packages/wxml/dist/index.mjs': 'export const value = 1;',
    'packages/wxml/dist/core/index.mjs': 'export { value } from "../shared.mjs";',
    'packages/wxml/dist/shared.mjs': 'export const value = 1;',
    'packages/wxml/test-d/core.test-d.ts': 'expectType<number>(value)',
    'packages/wxml/vitest.coverage.config.ts': 'export default { thresholds: { statements: 100, functions: 100, lines: 100, branches: 99 } }',
    'packages/wxml/tsconfig.json': '{}',
    'packages/wxml/tsdown.config.ts': 'export default {}',
    'packages/wxml/package.json': '{"type":"module"}',
    'scripts/templateCorpus/assertions/index.ts': 'export const sharedAssertion = true',
    'scripts/templateCorpus/frameworks.json': '[]',
    'package.json': '{"private":true}',
    'pnpm-lock.yaml': 'lockfileVersion: 9',
  }
  for (const [file, source] of Object.entries(files)) {
    await mkdir(path.dirname(path.join(root, file)), { recursive: true })
    await writeFile(path.join(root, file), source)
  }
  return root
}

afterEach(async () => {
  await Promise.all(directories.splice(0).map(directory => rm(directory, { recursive: true, force: true })))
})

describe('formal source coverage evidence receipt', () => {
  it('binds production denominator separately from tests, configuration, built entry and lock', async () => {
    const root = await repository()
    const identity = await captureCoverageIdentity(root)
    expect(identity.production.files.map(file => file.file)).toEqual(['packages/wxml/src/index.ts'])
    expect(identity.tests.files.map(file => file.file)).toEqual([
      'packages/wxml/src/index.test.ts',
      'packages/wxml/src/types.d.ts',
      'packages/wxml/test-d/core.test-d.ts',
      'scripts/templateCorpus/assertions/index.ts',
      'scripts/templateCorpus/frameworks.json',
    ])
    expect(identity.frozen).toMatchObject({ id: 'frozen-corpus', contentSha256: 'a'.repeat(64), manifest: { file: 'packages/wxml/test/corpus/manifest.json' } })
    expect(identity.built.file).toBe('packages/wxml/dist/index.mjs')
    expect(identity.builtModules.files.map(file => file.file)).toEqual(['packages/wxml/dist/core/index.mjs', 'packages/wxml/dist/index.mjs', 'packages/wxml/dist/shared.mjs'])
    expect(identity.lock.file).toBe('pnpm-lock.yaml')
    await expect(assertCoverageIdentity(identity, root)).resolves.toBeUndefined()
    expect(JSON.stringify(identity)).not.toContain(root)
    await expect(coverageFileIdentity('../outside.json', root)).rejects.toThrow('must stay within the repository')
  })

  it('rejects changes to every frozen input category without changing coverage thresholds', async () => {
    for (const file of [
      'packages/wxml/src/index.ts',
      'packages/wxml/dist/index.mjs',
      'packages/wxml/dist/shared.mjs',
      'packages/wxml/test-d/core.test-d.ts',
      'packages/wxml/test/corpus/manifest.json',
      'packages/wxml/vitest.coverage.config.ts',
      'scripts/templateCorpus/assertions/index.ts',
      'pnpm-lock.yaml',
    ]) {
      const root = await repository()
      const identity = await captureCoverageIdentity(root)
      await writeFile(path.join(root, file), file.endsWith('/manifest.json') ? JSON.stringify({ schemaVersion: 1, id: 'changed-corpus', contentSha256: 'b'.repeat(64) }) : 'changed')
      await expect(assertCoverageIdentity(identity, root)).rejects.toThrow('changed during execution')
    }
  })

  it('requires source acceptance to belong to the same invocation and exact final identity', async () => {
    const identity = await captureCoverageIdentity(await repository())
    const report = { runId: 'current-run', identity, accepted: true, apiVariant: 'root', entryContract: { accepted: true, checks: ['public-surface'], failures: [] }, presetContract: { accepted: true, checks: ['presets-public-surface'], failures: [] } }
    expect(() => assertSourceCoverageEvidence(report, 'current-run', identity)).not.toThrow()
    expect(() => assertSourceCoverageEvidence(report, 'other-run', identity)).toThrow('another execution')
    expect(() => assertSourceCoverageEvidence({ ...report, identity: { ...identity, built: { ...identity.built, sha256: 'b'.repeat(64) } } }, 'current-run', identity)).toThrow('identity differs')
    expect(() => assertSourceCoverageEvidence({ ...report, accepted: false }, 'current-run', identity)).toThrow('did not pass')
    expect(() => assertSourceCoverageEvidence(report, 'current-run', identity, 'core')).toThrow('variant')
    expect(() => assertSourceCoverageEvidence({ ...report, apiVariant: undefined }, 'current-run', identity)).toThrow('variant')
    expect(() => assertSourceCoverageEvidence({ ...report, entryContract: undefined }, 'current-run', identity)).toThrow('direct entry')
    expect(() => assertSourceCoverageEvidence({ ...report, entryContract: { ...report.entryContract, accepted: false } }, 'current-run', identity)).toThrow('direct entry')
    expect(() => assertSourceCoverageEvidence({ ...report, presetContract: undefined }, 'current-run', identity)).toThrow('standalone preset')
    expect(() => assertSourceCoverageEvidence({ ...report, presetContract: { ...report.presetContract, accepted: false } }, 'current-run', identity)).toThrow('standalone preset')
  })
})
