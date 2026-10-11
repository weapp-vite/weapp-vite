import type { ArtifactReference, CollectionReport, Entry, PortablePayload } from './schema.mts'
import assert from 'node:assert/strict'
import { expectedSamples, INPUTS } from '../../../../scripts/benchmarkNativeAnalysis/contract.ts'
import { parseHmrEvidence } from '../../../../scripts/benchmarkNativeAnalysis/hmr.ts'
import { sha256 } from './codec.mts'

type Side = 'primary' | 'confirmation'
interface ExpectedArtifact { id: string, relative: string, mapSha256?: string }

/** 从运行与完整产物清单推导必需留存项，不能以当前磁盘目录作为完整性的依据。 */
export function expectedRetainedArtifacts(entry: Entry, side: Side): ExpectedArtifact[] {
  const { run } = entry
  const input = INPUTS.find(input => input.id === run.input)
  assert(input, 'Unknown retained input')
  assert.equal(run.batch, side, 'Retained batch differs from report side')
  assert(['baseline-off', 'candidate-off'].includes(entry.variant), 'Unknown retained variant')
  assert(Number.isSafeInteger(run.pair) && run.pair >= 0, 'Invalid retained pair')
  assert(['build', 'hmr'].includes(run.kind), 'Unknown retained measurement kind')
  assert.deepEqual(run.samples.map(sample => sample.id).sort(), expectedSamples(input, run.kind).sort(), 'Retained sample set is incomplete')
  const prefix = `${side}/${run.kind}/${run.input}/${run.pair}/${entry.variant}`
  const files = ['sample.json', 'input-manifest.json', 'collector.log', ...run.kind === 'build'
    ? ['prepare.log', 'first.log', 'repeat.log']
    : ['report.json', `logs/${run.input}.dev.log`]]
  const result: ExpectedArtifact[] = files.map(relative => ({ relative, id: `${prefix}/${relative}` }))
  for (const sample of run.samples) {
    const parts = sample.id.split(':')
    const directory = run.kind === 'build'
      ? `sourcemaps/${parts[2]}`
      : `sourcemaps/${run.input}/${parts[2]}/${parts[3] === 'first' ? '0' : '1'}/${parts[4]}`
    for (const [file, mapSha256] of Object.entries(sample.output.files).filter(([file]) => file.endsWith('.map'))) {
      assert(file && !file.startsWith('/') && !file.includes('\\') && !/^[a-z]:/i.test(file) && file.split('/').every(part => part && part !== '.' && part !== '..'), 'Invalid retained output path')
      assert.match(mapSha256, /^[a-f\d]{64}$/)
      const relative = `${directory}/${file}`
      result.push({ relative, id: `${prefix}/${relative}`, mapSha256 })
    }
  }
  for (const extension of ['task.json', 'result.json', 'cache.json', 'log']) {
    const relative = `orchestration.${extension}`
    result.push({ relative, id: `${prefix}/${relative}` })
  }
  assert.equal(new Set(result.map(item => item.id)).size, result.length, 'Duplicate expected retained artifact')
  return result
}

/** 允许额外诊断材料，但地图集合必须与每个样本的完整地图清单完全一致。 */
export function assertRetainedInventory(expected: ExpectedArtifact[], actualIds: Iterable<string>) {
  const actual = new Set(actualIds)
  for (const item of expected) {
    assert(actual.has(item.id), `Missing required retained evidence: ${item.id}`)
  }
  const prefix = expected[0]!.id.slice(0, -expected[0]!.relative.length)
  const maps = [...actual].filter(id => id.startsWith(`${prefix}sourcemaps/`)).sort()
  assert.deepEqual(maps, expected.filter(item => item.mapSha256).map(item => item.id).sort(), 'Retained sourcemap set differs from complete output manifests')
}

/** 失败冒烟只作为基础设施历史留存，核对来源和全集但不加入正式配对或门禁。 */
export async function replayInfrastructureHistory(payload: PortablePayload, artifacts: Map<string, ArtifactReference>, readArtifactJson: (id: string) => Promise<unknown>) {
  const ids = [...artifacts.keys()].filter(id => id.startsWith('history/'))
  const record = payload.provenance.infrastructureHistory as Record<string, unknown> | null | undefined
  if (!record) {
    assert.equal(ids.length, 0, 'Historical artifacts lack provenance')
    return null
  }
  assert.equal(record.role, 'failed-smoke-excluded-from-formal-gates')
  assert.equal(record.reportArtifact, 'history/failed-smoke/report')
  assert.equal(record.pointerArtifact, 'history/failed-smoke/pointer')
  for (const id of ['history/failed-smoke/report', 'history/failed-smoke/pointer']) {
    assert(artifacts.has(id), 'Missing infrastructure history source')
  }
  const report = await readArtifactJson('history/failed-smoke/report') as CollectionReport
  const pointer = await readArtifactJson('history/failed-smoke/pointer') as { report: string, output: string, error: string }
  assert.equal(report.contract, 'isolated-artifact-comparison-v1')
  assert.equal(report.comparison, 'architecture')
  assert(report.mode === undefined || report.mode === 'smoke', 'Infrastructure history must remain smoke')
  assert(typeof report.error === 'string' && report.error.length > 0, 'Infrastructure history must retain its failure')
  assert.equal(pointer.error, report.error, 'Infrastructure pointer failure differs')
  assert.equal(pointer.output, report.output, 'Infrastructure pointer output differs')
  assert(typeof pointer.report === 'string' && pointer.report.length > 0, 'Infrastructure report pointer is missing')
  assert.equal(report.identitySha256, payload.reports.primary.identitySha256, 'Infrastructure history identity differs')
  assert.equal(record.runs, report.runs.length, 'Infrastructure history run count differs')
  assert.equal(record.samples, report.runs.reduce((sum, item) => sum + item.run.samples.length, 0), 'Infrastructure history sample count differs')
  const byRun = new Map<string, string[]>()
  for (const id of ids) {
    const prefix = id.split('/').slice(0, 6).join('/')
    const group = byRun.get(prefix) ?? []
    group.push(id)
    byRun.set(prefix, group)
  }
  for (const entry of report.runs) {
    const expected = expectedRetainedArtifacts(entry, 'primary').map(item => ({ ...item, id: item.id.replace(/^primary\//u, 'history/failed-smoke/') }))
    const prefix = expected[0]!.id.slice(0, -'/sample.json'.length)
    assertRetainedInventory(expected, byRun.get(prefix) ?? [])
    for (const item of expected) {
      if (item.mapSha256) {
        assert.equal(artifacts.get(item.id)!.normalizedMapSha256, item.mapSha256, 'Historical map normalized digest differs')
        assert.equal(artifacts.get(item.id)!.sampleOutputSha256, item.mapSha256, 'Historical map sample digest differs')
      }
    }
    for (const file of ['sample.json', 'orchestration.result.json']) {
      assert.deepEqual(await readArtifactJson(`${prefix}/${file}`), entry.run, 'Historical result differs from report')
    }
  }
  return { verified: true, runs: report.runs.length, samples: record.samples }
}

/** 公开复验同样反推主批次和确认批次全集，并绑定样本、输入、缓存及 HMR 原始报告。 */
export async function replayRetainedEvidence(payload: PortablePayload, artifacts: Map<string, ArtifactReference>, readArtifactJson: (id: string) => Promise<unknown>) {
  let runs = 0
  let maps = 0
  const byRun = new Map<string, string[]>()
  for (const id of artifacts.keys()) {
    const prefix = id.split('/').slice(0, 5).join('/')
    const ids = byRun.get(prefix) ?? []
    ids.push(id)
    byRun.set(prefix, ids)
  }
  for (const side of ['primary', 'confirmation'] as const) {
    const report: CollectionReport | null = payload.reports[side]
    if (!report) {
      continue
    }
    const cacheObservations = report.cacheObservations as Array<{ file: string, sha256: string, observedStatus: unknown }> | undefined
    assert(Array.isArray(cacheObservations) && cacheObservations.length === report.runs.length, 'Missing retained cache observations')
    const byCacheFile = new Map(cacheObservations.map(item => [item.file, item]))
    assert.equal(byCacheFile.size, cacheObservations.length, 'Duplicate retained cache observation')
    for (const [index, entry] of report.runs.entries()) {
      const { run } = entry
      const expected = expectedRetainedArtifacts(entry, side)
      const prefix = `${side}/${run.kind}/${run.input}/${run.pair}/${entry.variant}`
      assertRetainedInventory(expected, byRun.get(prefix) ?? [])
      for (const item of expected) {
        if (item.mapSha256) {
          const artifact = artifacts.get(item.id)!
          assert.equal(artifact.kind, 'sourcemap')
          assert(!artifact.publicFile.startsWith('payload:'), 'Sourcemap must retain public bytes')
          assert.equal(artifact.normalizedMapSha256, item.mapSha256, 'Retained map normalized digest differs')
          assert.equal(artifact.sampleOutputSha256, item.mapSha256, 'Retained map sample digest differs')
          maps++
        }
      }
      for (const relative of ['sample.json', 'orchestration.result.json']) {
        assert.equal(artifacts.get(`${prefix}/${relative}`)!.publicFile, `payload:/reports/${side}/runs/${index}/run`, 'Retained result references another run')
        assert.deepEqual(await readArtifactJson(`${prefix}/${relative}`), run, 'Retained result differs from report')
      }
      const input = await readArtifactJson(`${prefix}/input-manifest.json`)
      assert.equal(sha256(JSON.stringify(input)), run.inputDigest, 'Retained input manifest digest differs')
      const label = `${run.pair}-${run.kind}-${run.input}-${entry.variant}`
      const cache = byCacheFile.get(`${report.output}/orchestration/${label}.cache.json`)
      assert(cache, 'Missing owned retained cache evidence')
      assert.equal(artifacts.get(`${prefix}/orchestration.cache.json`)!.originalSha256, cache.sha256, 'Retained cache original commitment differs')
      assert.deepEqual(await readArtifactJson(`${prefix}/orchestration.cache.json`), cache.observedStatus, 'Retained cache observation differs from report')
      if (run.kind === 'hmr') {
        assert(typeof run.inputDigest === 'string', 'Missing retained HMR input digest')
        const reconstructed = { ...run, samples: [] }
        parseHmrEvidence(await readArtifactJson(`${prefix}/report.json`), INPUTS.find(input => input.id === run.input)!, reconstructed, run.inputDigest, run.samples[0]!.warnings)
        assert.deepEqual(reconstructed.samples, run.samples, 'Retained HMR report does not reproduce all samples')
      }
      runs++
    }
  }
  const infrastructureHistory = await replayInfrastructureHistory(payload, artifacts, readArtifactJson)
  return { verified: true, runs, maps, infrastructureHistory }
}
