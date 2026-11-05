import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { acceptancePaths, assertFrozenIdentity, builtModuleInventory, commandLineOptions, saveAcceptance, sha256 } from './harness'

const directories: string[] = []

async function directory() {
  const result = await mkdtemp(path.join(os.tmpdir(), 'corpus-harness-'))
  directories.push(result)
  return result
}

afterEach(async () => {
  await Promise.all(directories.splice(0).map(directory => rm(directory, { recursive: true, force: true })))
})

describe('independent root and core acceptance evidence', () => {
  it('selects the actual public entry and refuses unknown API variants', () => {
    expect(commandLineOptions(['--api-variant', 'core', '--suite', 'fuzz'])).toEqual({ apiVariant: 'core', suite: 'fuzz' })
    expect(commandLineOptions(['--api-variant', 'root'])).toEqual({ apiVariant: 'root' })
    expect(acceptancePaths({ apiVariant: 'core' }).builtEntry.replaceAll(path.sep, '/')).toMatch(/\/dist\/core\/index\.mjs$/)
    expect(acceptancePaths({ apiVariant: 'root' }).builtEntry.replaceAll(path.sep, '/')).toMatch(/\/dist\/index\.mjs$/)
    expect(() => commandLineOptions(['--api-variant', 'missing'])).toThrow('Unknown')
  })

  it('resolves standalone presets beside alternate distributions and keeps external --entry usable', async () => {
    const root = await directory()
    const alternate = path.join(root, 'dist/core/index.mjs')
    expect(acceptancePaths({ builtEntry: alternate, apiVariant: 'core' }).presetsEntry).toBe(path.join(root, 'dist/presets/index.mjs'))
    const external = path.join(root, 'standalone.mjs')
    const selected = acceptancePaths({ builtEntry: external })
    expect(selected.builtEntry).toBe(external)
    expect(selected.presetsEntry.replaceAll(path.sep, '/')).toMatch(/\/packages\/wxml\/dist\/presets\/index\.mjs$/)
    const custom = path.join(root, 'custom-presets.mjs')
    const options = commandLineOptions(['--entry', external, '--presets-entry', custom])
    expect(acceptancePaths(options)).toMatchObject({ builtEntry: external, presetsEntry: custom })
  })

  it('freezes actual shared chunks and declarations behind a forwarding core entry', async () => {
    const root = await directory()
    const entry = path.join(root, 'dist/core/index.mjs')
    const shared = path.join(root, 'dist/shared.mjs')
    const manifest = path.join(root, 'manifest.json')
    await mkdir(path.dirname(entry), { recursive: true })
    await writeFile(entry, 'export { parse } from "../shared.mjs"')
    await writeFile(shared, 'export const parse = value => value')
    await writeFile(path.join(root, 'dist/core/index.d.mts'), 'export declare function parse(value: string): string')
    await writeFile(manifest, '{}')
    const files = await builtModuleInventory(entry)
    expect(files.map(file => file.file)).toEqual(['core/index.d.mts', 'core/index.mjs', 'shared.mjs'])
    const entryHash = sha256(await readFile(entry))
    await expect(assertFrozenIdentity(manifest, sha256('{}'), entry, entryHash, files)).resolves.toBeUndefined()
    await writeFile(shared, 'export const parse = () => "replaced"')
    await expect(assertFrozenIdentity(manifest, sha256('{}'), entry, entryHash, files)).rejects.toThrow('module inventory changed')
  })

  it('writes each variant separately without replacing earlier reports', async () => {
    const output = await directory()
    for (const apiVariant of ['root', 'core'] as const) {
      await saveAcceptance({ schemaVersion: 1, apiVariant, startedAt: '2026-01-01T00:00:00.000Z', accepted: false, runtime: { kind: 'node', version: 'fixture', platform: 'fixture', arch: 'fixture' }, artifact: { entry: 'fixture.mjs', sha256: sha256('fixture') } }, output)
    }
    const root = JSON.parse(await readFile(path.join(output, 'node-root.json'), 'utf8')) as unknown
    const core = JSON.parse(await readFile(path.join(output, 'node-core.json'), 'utf8')) as unknown
    expect(root).toMatchObject({ apiVariant: 'root' })
    expect(core).toMatchObject({ apiVariant: 'core' })
  })
})
