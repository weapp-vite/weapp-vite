import type { VerificationPlan, VerificationTask } from './types.ts'
import { setImmediate } from 'node:timers/promises'
import { expect, it } from 'vitest'
import { getResourceBudget } from './resources.ts'
import { runVerification } from './run.ts'
import { resolveVerificationTopology } from './topology.ts'

function task(id: string, dependencies: string[] = [], exclusive = false): VerificationTask {
  return { id, kind: 'test', command: 'node', args: [], directory: '.', dependencies, reason: 'fixture', exclusive }
}
function plan(tasks: VerificationTask[]): VerificationPlan {
  return {
    version: 1,
    fingerprint: 'planned-inputs',
    executionTopology: resolveVerificationTopology(),
    mode: 'review',
    selection: 'affected',
    suggested: [],
    changes: { head: 'head', base: 'base', files: [], fingerprint: 'value', fallback: false, warnings: [] },
    resources: getResourceBudget({ cpus: 4, totalMemoryBytes: 16 * 1024 ** 3, freeMemoryBytes: 12 * 1024 ** 3, jobs: 2 }),
    affected: [],
    selected: [],
    tasks,
    remaining: [],
    warnings: [],
  }
}

it('enforces an exclusive build phase and caps ordinary task concurrency', async () => {
  let active = 0
  let peak = 0
  const completed = new Set<string>()
  const build = { ...task('build', ['a']), resource: 'workspace-write' as const }
  const report = await runVerification(plan([task('a'), task('b'), build, task('c', ['build'])]), async (item) => {
    if (item.resource === 'workspace-write') {
      expect(active).toBe(0)
    }
    for (const dependency of item.dependencies) {
      expect(completed.has(dependency)).toBe(true)
    }
    active++
    peak = Math.max(peak, active)
    await setImmediate()
    active--
    completed.add(item.id)
    return { exitCode: 0 }
  })
  expect(peak).toBe(2)
  expect(report.status).toBe('passed')
})

it('keeps independent failure evidence while blocking dependent tasks', async () => {
  const report = await runVerification(plan([task('broken'), task('dependent', ['broken']), task('independent')]), async item => ({ exitCode: item.id === 'broken' ? 1 : 0 }))
  expect(report.results.map(item => [item.id, item.status])).toEqual([['broken', 'failed'], ['dependent', 'blocked'], ['independent', 'passed']])
  expect(report.status).toBe('failed')
  await expect(runVerification(plan([task('a', ['b']), task('b', ['a'])]), async () => ({ exitCode: 0 }))).rejects.toThrow('循环')
})

it('registers the running slot before an executor can throw synchronously', async () => {
  const launched: string[] = []
  const report = await runVerification(plan([task('broken'), task('dependent', ['broken']), task('independent')]), (item) => {
    launched.push(item.id)
    if (item.id === 'broken') {
      throw new Error('command resolution failed')
    }
    return Promise.resolve({ exitCode: 0 })
  })
  expect(launched).toEqual(['broken', 'independent'])
  expect(report.results.map(item => [item.id, item.status])).toEqual([['broken', 'failed'], ['dependent', 'blocked'], ['independent', 'passed']])
  expect(report.results[0]?.error).toBe('command resolution failed')
})

it('reports partial coverage and cancels work before launching on an aborted signal', async () => {
  const controller = new AbortController()
  controller.abort()
  let launches = 0
  const report = await runVerification(plan([task('cancelled')]), async () => {
    launches++
    return { exitCode: 0 }
  }, { signal: controller.signal })
  expect(launches).toBe(0)
  expect(report.results[0]?.status).toBe('cancelled')
  const partial = plan([task('targeted')])
  partial.remaining.push('真实 IDE 尚未验收')
  expect((await runVerification(partial, async () => ({ exitCode: 0 }))).status).toBe('partial')
})
