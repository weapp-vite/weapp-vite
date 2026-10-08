import type { ScriptScenario } from '../../scriptAnalysisBaseline/types'
import type { TransformScriptCaptureRecord } from '../captureTypes'
import type { IntegratedRecord } from '../integratedTypes'
import { Buffer } from 'node:buffer'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { createCaptureBridgeMetrics, serializeCaptureValue } from '../captureSerialize'
import { digest } from '../identity'
import { compilerArtifacts } from './artifacts'
import { semanticPair } from './evidence'

function fixture() {
  const source = 'export default { setup() { return { value: 1 } } }'
  const expectedCode = 'import { register } from "host"; const options = {}; register(options); export default options;'
  const nativeCode = 'import{register}from"host";const options={};register(options);export default options;'
  const scenario: ScriptScenario = { id: 'sfc-wevu', kind: 'sfc', filename: 'page.vue', source: `<script>${source}</script>`, options: {} }
  const captured: TransformScriptCaptureRecord = {
    schemaVersion: 1,
    scenarioId: scenario.id,
    callIndex: 0,
    source: { code: source, sha256: digest(source), utf16Length: source.length, utf8Bytes: Buffer.byteLength(source) },
    fastSetup: 'miss',
    status: 'returned',
    result: serializeCaptureValue({ code: expectedCode, transformed: true }),
    warnings: [],
    bridge: createCaptureBridgeMetrics(),
    captureFailures: [],
  }
  const record: IntegratedRecord = {
    schemaVersion: 1,
    scenarioId: scenario.id,
    callIndex: 0,
    source: captured.source,
    request: '{}',
    nativeCalls: 1,
    fallbackCalls: 0,
    used: 'native',
    status: 'returned',
    result: serializeCaptureValue({ code: nativeCode, transformed: true }),
    warnings: [],
    bridge: createCaptureBridgeMetrics(),
    evidenceErrors: [],
  }
  const expected = JSON.stringify({ value: { script: expectedCode }, warnings: [], consoleWarnings: [] })
  const check = { scenario: scenario.id, iteration: 0, inputSha256: digest(JSON.stringify(scenario)), integratedCallIndexes: [0], output: JSON.stringify({ value: { script: nativeCode }, warnings: [], consoleWarnings: [] }) }
  return { scenario, check, records: [record], captured: [captured], expected, expectedCode, nativeCode }
}

describe('executable complete compiler evidence', () => {
  it('delivers both complete unmodified module strings with their actual stage owner', () => {
    const f = fixture()
    expect(semanticPair(f.scenario, f.check, f.records, f.captured, f.expected)).toMatchObject({
      expectedCode: f.expectedCode,
      nativeCode: f.nativeCode,
      expectedCodeSha256: digest(f.expectedCode),
      nativeCodeSha256: digest(f.nativeCode),
      callIndex: 0,
    })
  })

  it('rejects a native candidate that was replaced before final delivery', () => {
    const f = fixture()
    f.check.output = JSON.stringify({ value: { script: `${f.nativeCode}\n` } })
    expect(() => semanticPair(f.scenario, f.check, f.records, f.captured, f.expected)).toThrow('actual final compiler script')
    f.check.output = JSON.stringify({ value: { script: f.expectedCode } })
    expect(() => semanticPair(f.scenario, f.check, f.records, f.captured, f.expected)).toThrow('actual final compiler script')
  })

  it('rejects executing a stage-only JS baseline in place of the complete control output', () => {
    const f = fixture()
    const expected = JSON.stringify({ value: { script: `void 0;${f.expectedCode}` } })
    expect(() => semanticPair(f.scenario, f.check, f.records, f.captured, expected)).toThrow('actual final compiler script')
  })

  it('rejects fallback, wrong owners, missing stage calls and changed input', () => {
    for (const mutate of [
      (f: ReturnType<typeof fixture>) => { f.records[0]!.used = 'fallback' },
      (f: ReturnType<typeof fixture>) => { f.records[0]!.scenarioId = 'sfc-retail' },
      (f: ReturnType<typeof fixture>) => { f.check.integratedCallIndexes = [] },
      (f: ReturnType<typeof fixture>) => { f.check.integratedCallIndexes = [0, 0] },
      (f: ReturnType<typeof fixture>) => { f.check.inputSha256 = digest('different') },
    ]) {
      const f = fixture()
      mutate(f)
      expect(() => semanticPair(f.scenario, f.check, f.records, f.captured, f.expected)).toThrow()
    }
  })

  it('rejects evidence changes both on reread and after the execution window', async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), 'script-semantic-evidence-'))
    try {
      const filename = path.join(directory, 'record.json')
      await writeFile(filename, '{"value":1}\n')
      const artifacts = compilerArtifacts(directory)
      expect(await artifacts.read('record.json')).toEqual({ value: 1 })
      expect(await artifacts.verify()).toEqual({ 'record.json': digest('{"value":1}\n') })
      await writeFile(filename, '{"value":2}\n')
      await expect(artifacts.read('record.json')).rejects.toThrow('changed during reading')
      await expect(artifacts.verify()).rejects.toThrow('changed during semantic execution')
      await expect(artifacts.read('../record.json')).rejects.toThrow('escapes its directory')
    }
    finally {
      await rm(directory, { recursive: true, force: true })
    }
  })
})
