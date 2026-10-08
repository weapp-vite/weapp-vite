import type { Run } from './contract'
import { describe, expect, it } from 'vitest'
import { isArtifactEvidence, sha256 } from './artifacts'
import { INPUTS } from './contract'
import { parseHmrEvidence } from './hmr'

function fixture() {
  const input = INPUTS[3]
  const files = { 'app.js': 'a'.repeat(64), 'app.js.map': 'b'.repeat(64), 'app.json': 'c'.repeat(64) }
  const output = { files, maps: 1, digest: sha256(JSON.stringify(files)) }
  const run: Run = { input: input.id, kind: 'hmr', side: 'on', pair: 0, batch: 'primary', marker: 'native-primary-0', native: { calls: 0, failures: 0, processes: 0 }, samples: [] }
  const sample = (phase: string) => ({ phase, wallMs: 5, rssBytes: 100, inputSha256: 'd'.repeat(64), artifactEvidence: structuredClone(output) })
  const scenarios = input.scenarios.map(id => ({ id, cycles: [0, 1].map(() => ({ edit: sample('edit'), restore: sample('restore') })) }))
  return { input, run, output, report: { iterations: 2, sampleMode: 'edit-only', markerSeed: run.marker, templates: [{ id: input.id, scenarios }] } }
}

describe('native HMR evidence reader', () => {
  it('requires every topology edit and restore phase', () => {
    const { input, run, report } = fixture()
    parseHmrEvidence(report, input, run, 'e'.repeat(64), [])
    expect(run.samples).toHaveLength(8)
    expect(run.samples.map(sample => sample.id)).toContain('hmr:issue-1134-profile:route-topology-json:repeat:restore')
    report.templates[0]!.scenarios.pop()
    expect(() => parseHmrEvidence(report, input, run, 'e'.repeat(64), [])).toThrow('Missing')
  })

  it.each([Number.NaN, Number.POSITIVE_INFINITY, 0])('rejects non-finite or empty memory evidence (%s)', (rssBytes) => {
    const { input, run, report } = fixture()
    report.templates[0]!.scenarios[0]!.cycles[0]!.edit.rssBytes = rssBytes
    expect(() => parseHmrEvidence(report, input, run, 'e'.repeat(64), [])).toThrow('Missing HMR')
  })

  it('recomputes artifact hashes and requires actual map entries', () => {
    const { output } = fixture()
    expect(isArtifactEvidence(output)).toBe(true)
    expect(isArtifactEvidence({ ...output, files: {} })).toBe(false)
    expect(isArtifactEvidence({ ...output, maps: 2 })).toBe(false)
    expect(isArtifactEvidence({ ...output, digest: 'f'.repeat(64) })).toBe(false)
    output.files['app.js'] = 'invalid'
    expect(isArtifactEvidence(output)).toBe(false)
  })
})
