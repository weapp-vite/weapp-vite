import type { Profiler } from 'node:inspector'
import type { OptimizedScenario } from './scenarios'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { summarizeCpuProfile } from '../astMigrationProfile/cpuSummary'
import { mergeCpuProfiles } from './cpu'
import { digest, optimizedSourceIdentity, repository } from './identity'
import { verifyCpuObservation, verifyCpuWorker } from './profileCheck'

const entry: OptimizedScenario = {
  scenario: { id: 'sfc-example', kind: 'sfc', source: '<template>hello</template>', filename: 'src/example.vue', options: {} },
}
const output = JSON.stringify({ value: { template: '<view>hello</view>', script: '' }, warnings: [], consoleWarnings: [] })
function observation(iteration = 0) {
  return {
    scenario: entry.scenario.id,
    iteration,
    inputSha256: digest(JSON.stringify(entry.scenario)),
    outputSha256: digest(output),
    failed: false,
    warnings: [],
    metrics: {},
    bindingMetrics: {},
  }
}
const directories: string[] = []
afterEach(async () => {
  for (const directory of directories.splice(0)) {
    await rm(directory, { recursive: true, force: true })
  }
})

async function fixture() {
  const directory = await mkdtemp(path.join(tmpdir(), 'compiler-cpu-'))
  directories.push(directory)
  const sourceHashes = await optimizedSourceIdentity()
  const bindingSha256 = 'a'.repeat(64)
  const profile: Profiler.Profile = {
    nodes: [{ id: 1, callFrame: { functionName: '(root)', scriptId: '0', url: '', lineNumber: -1, columnNumber: -1 } }],
    samples: [1],
    startTime: 100,
    endTime: 200,
  }
  const profiles: Profiler.Profile[] = []
  const samples = []
  for (let index = 0; index < 20; index++) {
    const current = { ...profile, startTime: index * 300 + 100, endTime: index * 300 + 200 }
    profiles.push(current)
    const bytes = JSON.stringify(current)
    const profileFile = `profile-${index}.json`
    await writeFile(path.join(directory, profileFile), bytes)
    samples.push({
      ...observation(index),
      profileFile,
      profileSha256: digest(bytes),
      profileStartTime: current.startTime,
      profileEndTime: current.endTime,
      profileDurationMicroseconds: 100,
      profileSamples: 1,
    })
  }
  const report = {
    schemaVersion: 1,
    variant: 'baseline',
    passed: true,
    cleanupErrors: [],
    sourceHashes,
    hookSources: {},
    sourcesUnchanged: true,
    bindingSha256,
    bindingUnchanged: true,
    initialOutput: output,
    initial: observation(),
    warmups: Array.from({ length: 14 }, (_, index) => observation(index)),
    samples,
    cpuSummary: summarizeCpuProfile(mergeCpuProfiles(profiles), repository),
  }
  return {
    report,
    async replaceInterval(index: number, startTime: number, endTime: number) {
      const current = { ...profile, startTime, endTime }
      const bytes = JSON.stringify(current)
      const sample = report.samples[index]!
      await writeFile(path.join(directory, sample.profileFile), bytes)
      Object.assign(sample, { profileSha256: digest(bytes), profileStartTime: startTime, profileEndTime: endTime, profileDurationMicroseconds: endTime - startTime })
    },
    verify: () => verifyCpuWorker(JSON.stringify(report), directory, entry, 'baseline', sourceHashes, bindingSha256, output),
  }
}

describe('compiler CPU evidence verification', () => {
  it('recomputes attribution from separate original profile trees', async () => {
    const { verify } = await fixture()
    const result = await verify()
    expect(result.aggregateKind).toBe('counts-only')
    expect(result.cpuSummary.totalSamples).toBe(20)
    expect(result.sourceProfileCount).toBe(20)
  })

  it.each(['profileSha256', 'profileFile', 'profileDurationMicroseconds', 'profileSamples'] as const)('rejects changed raw profile evidence: %s', async (field) => {
    const { report, verify } = await fixture()
    Object.assign(report.samples[0]!, { [field]: 'changed' })
    await expect(verify()).rejects.toThrow()
  })

  it('rejects a summary that does not account for the raw samples', async () => {
    const { report, verify } = await fixture()
    report.cpuSummary.totalSamples++
    await expect(verify()).rejects.toThrow('summary differs')
  })

  it.each([[100, 200], [150, 250], [0, 50]])('rejects duplicate, overlapping or out-of-order windows: %s..%s', async (start, end) => {
    const { verify, replaceInterval } = await fixture()
    await replaceInterval(1, start, end)
    await expect(verify()).rejects.toThrow('overlap or are out of order')
  })

  it('rejects missing warmups and output that differs from the original compiler', async () => {
    const { report, verify } = await fixture()
    report.warmups.pop()
    await expect(verify()).rejects.toThrow('all fixed observations')
    report.warmups.push(observation(13))
    report.initialOutput = '{}'
    await expect(verify()).rejects.toThrow('original compiler output')
  })

  it('rejects output hash and input drift before accepting a profile', () => {
    expect(() => verifyCpuObservation({ ...observation(), outputSha256: '0'.repeat(64) }, entry, 'baseline', 0, output)).toThrow('digest')
    expect(() => verifyCpuObservation({ ...observation(), inputSha256: '0'.repeat(64) }, entry, 'baseline', 0, output)).toThrow('input identity')
  })
})
