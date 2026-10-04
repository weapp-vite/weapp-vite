import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { scriptDigest, scriptSourceIdentity } from '../identity'
import { scriptBaselineSources } from '../installHelpers/source'
import { scriptScenarios } from '../scenarios'
import { collectScriptTimings } from './collect'
import { correctnessReport } from './testUtils/correctness'
import { timingSources } from './testUtils/reports'

const directories: string[] = []
afterEach(async () => {
  await Promise.all(directories.splice(0).map(directory => rm(directory, { recursive: true, force: true })))
})

async function outputDirectory() {
  const directory = await mkdtemp(path.join(tmpdir(), 'script-timings-'))
  directories.push(directory)
  return path.join(directory, 'new-result')
}

describe('serial script timing collector', () => {
  it.each(['exit', 'missing', 'invalid'] as const)('stops before timing on %s correctness evidence and preserves logs', async (failure) => {
    const output = await outputDirectory()
    const invocations: string[] = []
    const result = await collectScriptTimings({ output, iterations: 14 }, async (request) => {
      invocations.push(request.id)
      await mkdir(request.output)
      if (failure !== 'missing') {
        await writeFile(path.join(request.output, 'report.json'), failure === 'exit' ? '{}' : 'not-json')
      }
      return { exitCode: failure === 'exit' ? 1 : 0, stdout: request.output, stderr: 'preserved diagnostic' }
    })
    expect(result.passed).toBe(false)
    expect(result.failedRun).toBe('correctness')
    expect(invocations).toEqual(['correctness'])
    const log = await readFile(path.join(output, 'correctness.log'), 'utf8')
    expect(log).toContain('preserved diagnostic')
    expect(log).not.toContain(output)
    expect(JSON.parse(await readFile(path.join(output, 'summary.json'), 'utf8'))).toMatchObject({ passed: false })
  })

  it('starts the first timing run only after a complete correctness oracle and then stops on its failure', async () => {
    const output = await outputDirectory()
    const invocations: string[] = []
    const result = await collectScriptTimings({ output, iterations: 14 }, async (request) => {
      invocations.push(request.id)
      await mkdir(request.output)
      const report = request.id === 'correctness' ? correctnessReport(await scriptScenarios(), await scriptSourceIdentity()) : {}
      await writeFile(path.join(request.output, 'report.json'), JSON.stringify(report))
      return { exitCode: request.id === 'correctness' ? 0 : 1, stdout: '', stderr: '' }
    })
    expect(invocations).toEqual(['correctness', 'batch-1-sfc-pressure'])
    expect(result).toMatchObject({ passed: false, failedRun: 'batch-1-sfc-pressure' })
  })

  it('refuses an existing output directory without invoking children', async () => {
    const output = await outputDirectory()
    await mkdir(output)
    await expect(collectScriptTimings({ output, iterations: 14 }, async () => {
      throw new Error('Must not execute')
    })).rejects.toThrow()
  })

  it.each([false, true])('collects six serial groups and enforces the earlier correctness oracle (mismatch: %s)', async (mismatch) => {
    const output = await outputDirectory()
    const scenarios = await scriptScenarios()
    const hashes = await scriptSourceIdentity()
    const fixtures = timingSources()
    for (const { report } of fixtures) {
      report.sourceHashes = hashes
      const scenario = scenarios.find(item => item.id === report.scenario.id)!
      report.scenario.inputSha256 = scriptDigest(JSON.stringify(scenario))
      report.scenario.sourceSha256 = scriptDigest(scenario.source)
      const outputSha256 = scriptDigest(mismatch ? 'other-consistent-output' : scenario.id)
      for (const [variant, startup] of Object.entries(report.startup)) {
        startup.sourceHashes = variant === 'baseline' ? {} : Object.fromEntries(scriptBaselineSources.map(file => [file, hashes[file]]))
      }
      const observations = [...Object.values(report.checks), ...report.samples.flatMap(sample => Object.values(sample.variants))]
      for (const observation of observations) {
        observation.inputSha256 = report.scenario.inputSha256
        observation.outputSha256 = outputSha256
      }
    }
    const invocations: string[] = []
    let active = 0
    const result = await collectScriptTimings({ output, iterations: 14 }, async (request) => {
      expect(active++).toBe(0)
      invocations.push(request.id)
      await mkdir(request.output)
      const report = request.id === 'correctness' ? correctnessReport(scenarios, hashes) : fixtures.find(item => item.id === request.id)!.report
      await writeFile(path.join(request.output, 'report.json'), JSON.stringify(report))
      active--
      return { exitCode: 0, stdout: '', stderr: '' }
    })
    expect(result.passed).toBe(!mismatch)
    expect(invocations).toEqual(mismatch ? ['correctness', fixtures[0]!.id] : ['correctness', ...fixtures.map(item => item.id)])
    if (mismatch) {
      expect(result.failure).toContain('differ from full correctness')
    }
  })
})
