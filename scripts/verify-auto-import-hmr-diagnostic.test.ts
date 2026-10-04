/* eslint-disable ts/no-use-before-define */
import { execFile } from 'node:child_process'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { promisify } from 'node:util'
import { describe, expect, it } from 'vitest'

const execFileAsync = promisify(execFile)

describe('auto-import HMR diagnostic output verifier', () => {
  it('compares canonical registered session metadata and preserves raw output identity evidence', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'auto-import-hmr-verify-'))
    try {
      await writePhase(root, 'control', 'a'.repeat(32), 'b'.repeat(32))
      await writePhase(root, 'probe', 'c'.repeat(32), 'd'.repeat(32))
      const verifier = path.resolve(import.meta.dirname, 'verify-auto-import-hmr-diagnostic.mjs')
      await expect(execFileAsync(process.execPath, [verifier, root])).resolves.toBeDefined()
      const equivalence = JSON.parse(await readFile(path.join(root, 'equivalence.json'), 'utf8'))
      expect(equivalence.failures).toEqual([])
      expect(equivalence.comparisons.every((item: { allOriginalOutputBytesIdentical: boolean }) => !item.allOriginalOutputBytesIdentical)).toBe(true)

      const probeReportPath = path.join(root, 'candidate', 'probe', 'report.json')
      const probeReport = JSON.parse(await readFile(probeReportPath, 'utf8'))
      probeReport.results[0].raw.manual[0].pairEvidence.initial.files['app.js'].canonicalSha256 = 'f'.repeat(64)
      await writeFile(probeReportPath, JSON.stringify(probeReport))
      await expect(execFileAsync(process.execPath, [verifier, root])).rejects.toThrow()
      const failed = JSON.parse(await readFile(path.join(root, 'equivalence.json'), 'utf8'))
      expect(failed.failures).toContainEqual(expect.objectContaining({ reason: 'deterministic output differs' }))

      probeReport.results[0].raw.manual[0].pairEvidence.initial.files['app.js'].canonicalSha256 = 'a'.repeat(64)
      delete probeReport.results[0].raw.manual[0].pairEvidence.initial.files['app.js'].canonicalSha256
      await writeFile(probeReportPath, JSON.stringify(probeReport))
      await expect(execFileAsync(process.execPath, [verifier, root])).rejects.toThrow()
      const missingCanonicalHashFailure = JSON.parse(await readFile(path.join(root, 'equivalence.json'), 'utf8'))
      expect(missingCanonicalHashFailure.failures).toContainEqual(expect.objectContaining({ reason: 'deterministic output differs' }))

      probeReport.results[0].raw.manual[0].pairEvidence.initial.files['app.js'].canonicalSha256 = 'a'.repeat(64)
      delete probeReport.results[0].raw.manual[0].pairEvidence.initial.files['app.js'].normalized
      await writeFile(probeReportPath, JSON.stringify(probeReport))
      await expect(execFileAsync(process.execPath, [verifier, root])).rejects.toThrow()
      const unnormalizedFailure = JSON.parse(await readFile(path.join(root, 'equivalence.json'), 'utf8'))
      expect(unnormalizedFailure.failures).toContainEqual(expect.objectContaining({ reason: 'deterministic output differs' }))

      probeReport.results[0].raw.manual[0].pairEvidence.initial.files['app.js'].normalized = 'registered-stateful-build-id-first-line'
      probeReport.results[0].raw.manual[0].pairEvidence.initial.controlContract.canonicalSourceSha256 = 'different'
      await writeFile(probeReportPath, JSON.stringify(probeReport))
      await expect(execFileAsync(process.execPath, [verifier, root])).rejects.toThrow()
      const controlFailure = JSON.parse(await readFile(path.join(root, 'equivalence.json'), 'utf8'))
      expect(controlFailure.failures).toContainEqual(expect.objectContaining({ reason: 'session control contract shape differs' }))
    }
    finally {
      await rm(root, { recursive: true, force: true })
    }
  })
})

async function writePhase(root: string, phase: 'control' | 'probe', buildFingerprint: string, tokenFingerprint: string) {
  const directory = path.join(root, 'candidate', phase)
  await mkdir(directory, { recursive: true })
  const checkpoints = () => ({
    files: {
      'app.js': {
        sha256: phase,
        bytes: 4,
        canonicalSha256: 'a'.repeat(64),
        canonicalBytes: 4,
        normalized: 'registered-stateful-build-id-first-line',
      },
      '__weapp_vite_hmr/update.js': {
        sha256: phase,
        bytes: 6,
        canonicalSha256: 'b'.repeat(64),
        canonicalBytes: 6,
        normalized: 'registered-stateful-hmr-batch-nonce-and-build-id',
      },
      '__weapp_vite_hmr/control.js': { sha256: phase, bytes: phase.length },
    },
    controlContract: {
      schemaValid: true,
      registeredSessionMatches: true,
      buildIdShape: '32-hex',
      tokenShape: '32-hex',
      url: { protocol: 'http:', hostname: 'localhost', pathname: '/__weapp_vite_stateful_hmr__', portValid: true },
      references: { appImportsControl: true },
      sessionFieldFingerprints: { buildId: buildFingerprint, token: tokenFingerprint },
      canonicalSourceBytes: 100,
      canonicalSourceSha256: 'canonical',
    },
  })
  const results = [50, 69].map(fixtureKey => ({
    usedCount: fixtureKey,
    raw: {
      manual: [{ pairEvidence: {
        phase,
        fixtureKey,
        initial: checkpoints(),
        cycles: Array.from({ length: 2 }, () => ({ edit: checkpoints(), restore: checkpoints() })),
      } }],
    },
  }))
  await writeFile(path.join(directory, 'report.json'), JSON.stringify({ results }))
}
