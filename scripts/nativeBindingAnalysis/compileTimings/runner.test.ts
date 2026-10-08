import type { CompilerReport } from './types'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, expect, it } from 'vitest'
import { collectCompileTimings } from './runner'
import { hash, reportSources } from './testUtils/reports'

const owned: string[] = []

async function fixture() {
  const root = await mkdtemp(path.join(tmpdir(), 'compile-timings-'))
  owned.push(root)
  const bindingDirectory = path.join(root, 'binding')
  await mkdir(bindingDirectory)
  await writeFile(path.join(bindingDirectory, 'experimental.node'), 'fixture binding')
  return { bindingDirectory, output: path.join(root, 'output'), iterations: 10 }
}

afterEach(async () => {
  for (const directory of owned.splice(0)) {
    await rm(directory, { recursive: true, force: true })
  }
})

it('runs correctness before six strictly serial measurements and refuses to overwrite the completed evidence', async () => {
  const options = await fixture()
  const sources = reportSources()
  const calls: Array<{ id: string, scenario: string, iterations: number }> = []
  let active = 0
  const execute: NonNullable<Parameters<typeof collectCompileTimings>[1]> = async ({ plan, binding, output }) => {
    active++
    expect(active).toBe(1)
    expect(path.basename(binding)).toBe('experimental.node')
    calls.push({ id: plan.id, scenario: plan.scenario, iterations: plan.iterations })
    await Promise.resolve()
    await mkdir(output)
    await writeFile(path.join(output, 'report.json'), JSON.stringify(sources[calls.length - 1]!.report))
    active--
    return { exitCode: 0, stdout: 'worker finished', stderr: '' }
  }
  const summary = await collectCompileTimings(options, execute)
  expect(summary.passed).toBe(true)
  expect(calls).toEqual([
    { id: 'correctness', scenario: 'all', iterations: 0 },
    { id: 'batch-1-pressure', scenario: 'pressure', iterations: 10 },
    { id: 'batch-1-retail', scenario: 'retail', iterations: 10 },
    { id: 'batch-1-wevu', scenario: 'wevu', iterations: 10 },
    { id: 'batch-2-pressure', scenario: 'pressure', iterations: 10 },
    { id: 'batch-2-retail', scenario: 'retail', iterations: 10 },
    { id: 'batch-2-wevu', scenario: 'wevu', iterations: 10 },
  ])
  for (const source of summary.sources) {
    expect(source.sha256).toBe(hash(await readFile(path.join(options.output, source.reportPath), 'utf8')))
  }
  const original = await readFile(path.join(options.output, 'summary.json'), 'utf8')
  await expect(collectCompileTimings(options, execute)).rejects.toMatchObject({ code: 'EEXIST' })
  expect(calls).toHaveLength(7)
  expect(await readFile(path.join(options.output, 'summary.json'), 'utf8')).toBe(original)
})

it.each(['exit', 'report'] as const)('stops on a failed %s and retains earlier and failed source reports without retry', async (failure) => {
  const options = await fixture()
  const sources = reportSources()
  const calls: string[] = []
  const summary = await collectCompileTimings(options, async ({ plan, output }) => {
    calls.push(plan.id)
    const report = sources[calls.length - 1]!.report as CompilerReport
    if (calls.length === 3 && failure === 'report') {
      report.passed = false
    }
    await mkdir(output)
    await writeFile(path.join(output, 'report.json'), JSON.stringify(report))
    return { exitCode: calls.length === 3 && failure === 'exit' ? 1 : 0, stdout: 'retained diagnostics', stderr: '' }
  })
  expect(summary.passed).toBe(false)
  expect(summary.failedRun).toBe('batch-1-retail')
  expect(summary).not.toHaveProperty('groups')
  expect(calls).toEqual(['correctness', 'batch-1-pressure', 'batch-1-retail'])
  expect(summary.sources).toHaveLength(3)
  for (const source of summary.sources) {
    expect(source.sha256).toBe(hash(await readFile(path.join(options.output, source.reportPath), 'utf8')))
  }
  expect(await readFile(path.join(options.output, 'correctness/report.json'), 'utf8')).toBe(JSON.stringify(sources[0]!.report))
  expect(await readFile(path.join(options.output, 'batch-1-retail.log'), 'utf8')).toContain('retained diagnostics')
  await expect(readFile(path.join(options.output, 'batch-1-wevu/report.json'))).rejects.toMatchObject({ code: 'ENOENT' })
})

it('retains the exact hash of malformed report bytes without publishing timing statistics', async () => {
  const options = await fixture()
  const raw = '{ incomplete compiler report'
  const summary = await collectCompileTimings(options, async ({ output }) => {
    await mkdir(output)
    await writeFile(path.join(output, 'report.json'), raw)
    return { exitCode: 0, stdout: '', stderr: '' }
  })
  expect(summary.passed).toBe(false)
  expect(summary.failure).toMatch(/not valid JSON/)
  expect(summary.sources).toEqual([{ id: 'correctness', reportPath: 'correctness/report.json', sha256: hash(raw) }])
  expect(await readFile(path.join(options.output, 'correctness/report.json'), 'utf8')).toBe(raw)
})

it('rejects ambiguous bindings and invalid cycles before launching any subprocess', async () => {
  const options = await fixture()
  await writeFile(path.join(options.bindingDirectory, 'other.node'), 'another binding')
  let invoked = false
  const execute = async () => {
    invoked = true
    return { exitCode: 0, stdout: '', stderr: '' }
  }
  await expect(collectCompileTimings(options, execute)).rejects.toThrow(/exactly one/)
  await expect(collectCompileTimings({ ...options, iterations: 9 }, execute)).rejects.toThrow(/positive multiple of 10/)
  expect(invoked).toBe(false)
  await expect(readFile(path.join(options.output, 'summary.json'))).rejects.toMatchObject({ code: 'ENOENT' })
})
