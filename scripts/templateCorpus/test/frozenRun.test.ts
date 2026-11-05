import type { AcceptanceOptions, AcceptanceReport } from './harness'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { assertReportFrozenIdentity, captureFrozenRun, runFrozenAcceptance } from './frozenRun'
import { acceptanceArtifact, acceptancePaths, sha256 } from './harness'

const directories: string[] = []

async function fixture() {
  const root = await mkdtemp(path.join(os.tmpdir(), 'corpus-frozen-run-'))
  directories.push(root)
  const files: Record<string, string> = {
    'corpus/manifest.json': JSON.stringify({ id: 'frozen', contentSha256: 'a'.repeat(64) }),
    'dist/index.mjs': 'export { parse } from "./shared.mjs"',
    'dist/core/index.mjs': 'export { parse } from "../shared.mjs"',
    'dist/presets/index.mjs': 'export { presets } from "../presets.mjs"',
    'dist/shared.mjs': 'export const parse = value => value',
    'dist/presets.mjs': 'export const presets = Object.freeze([])',
  }
  for (const [file, source] of Object.entries(files)) {
    await mkdir(path.dirname(path.join(root, file)), { recursive: true })
    await writeFile(path.join(root, file), source)
  }
  const options: AcceptanceOptions[] = (['root', 'core'] as const).map(apiVariant => ({ apiVariant, corpusDirectory: path.join(root, 'corpus'), builtEntry: path.join(root, 'dist', apiVariant === 'core' ? 'core/index.mjs' : 'index.mjs') }))
  return { root, options }
}

async function report(options: AcceptanceOptions, kind: 'node' | 'chromium'): Promise<AcceptanceReport> {
  const selected = acceptancePaths(options)
  const bytes = await readFile(path.join(selected.corpusDirectory, 'manifest.json'))
  const manifest = JSON.parse(bytes.toString('utf8')) as { id: string, contentSha256: string }
  return { schemaVersion: 1, apiVariant: selected.apiVariant, startedAt: '2026-01-01T00:00:00.000Z', accepted: true, runtime: { kind, version: 'fixture', platform: 'fixture', arch: 'fixture' }, frozen: { ...manifest, manifestSha256: sha256(bytes), documents: 1, profiles: ['fixture'] }, artifact: await acceptanceArtifact(selected.builtEntry), presetsArtifact: await acceptanceArtifact(selected.presetsEntry) }
}

afterEach(async () => {
  await Promise.all(directories.splice(0).map(directory => rm(directory, { recursive: true, force: true })))
})

describe('one frozen identity across every public entry and runtime', () => {
  it('accepts all four reports only against the same initial manifest and full build', async () => {
    const { options } = await fixture()
    const identity = await captureFrozenRun(options)
    const visited: string[] = []
    const runner = (kind: 'node' | 'chromium') => async (option: AcceptanceOptions) => {
      visited.push(`${option.apiVariant}:${kind}`)
      return report(option, kind)
    }
    const result = await runFrozenAcceptance(options, identity, { node: runner('node'), chromium: runner('chromium') })
    expect(visited).toEqual(['root:node', 'root:chromium', 'core:node', 'core:chromium'])
    expect(result).toMatchObject({ identityUnchanged: true, variants: { root: { node: true, chromium: true }, core: { node: true, chromium: true } }, errors: [] })
  })

  it.each(['manifest', 'shared-chunk', 'preset-chunk'] as const)('rejects replacing %s between individually successful stages', async (changed) => {
    const { root, options } = await fixture()
    const identity = await captureFrozenRun(options)
    let calls = 0
    const result = await runFrozenAcceptance(options, identity, {
      node: option => report(option, 'node'),
      async chromium(option) {
        calls++
        if (changed === 'manifest') {
          await writeFile(path.join(root, 'corpus/manifest.json'), JSON.stringify({ id: 'replacement', contentSha256: 'b'.repeat(64) }))
        }
        else {
          await writeFile(path.join(root, 'dist', changed === 'shared-chunk' ? 'shared.mjs' : 'presets.mjs'), 'export const replaced = true')
        }
        return report(option, 'chromium')
      },
    })
    expect(calls).toBe(1)
    expect(result.identityUnchanged).toBe(false)
    expect(result.errors).toHaveLength(1)
    expect(result.variants).toEqual({ root: { node: true, chromium: true } })
    expect(result.errors[0]).toContain('common frozen run')
  })

  it('detects a disk change after a runner captured its own old report', async () => {
    const { root, options } = await fixture()
    const identity = await captureFrozenRun(options)
    const result = await runFrozenAcceptance(options, identity, {
      async node(option) {
        const value = await report(option, 'node')
        await writeFile(path.join(root, 'dist/shared.mjs'), 'export const replaced = true')
        return value
      },
      chromium: option => report(option, 'chromium'),
    })
    expect(result.identityUnchanged).toBe(false)
    expect(result.errors[0]).toContain('changed between acceptance stages')
    expect(result.variants).toEqual({ root: { node: true } })
  })

  it('refuses reports missing standalone preset artifact evidence', async () => {
    const { options } = await fixture()
    const identity = await captureFrozenRun(options)
    const value = await report(options[0]!, 'node')
    expect(() => assertReportFrozenIdentity(identity, { ...value, presetsArtifact: undefined })).toThrow('preset build')
    expect(() => assertReportFrozenIdentity(identity, { ...value, frozen: undefined })).toThrow('frozen corpus')
  })
})
