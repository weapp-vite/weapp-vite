import type { AcceptanceReport } from '../../e2e/scripts/domAcceptanceReport/types'
import type { VerificationPlan } from '../../e2e/scripts/verification/types'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
// eslint-disable-next-line e18e/ban-dependencies -- 使用真实独立 Node 进程证明没有 workspace 依赖。
import { execa } from 'execa'
import { afterEach, expect, it } from 'vitest'
import { runVerificationAggregate } from '../../.github/scripts/run-verification-aggregate.mjs'
import { buildAggregateBundle } from '../../e2e/scripts/verification/aggregateBundle'
import { useIsolatedTopologyTestEnvironment } from '../verification/topologyTestFixture'
import { freeze, profile, shardReports } from './fixtures'
import { createStrictEvidenceFixture } from './strictFixture'

useIsolatedTopologyTestEnvironment()
const roots: string[] = []
afterEach(async () => {
  await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })))
})

async function prepare(strict = false) {
  const fixture = strict ? await createStrictEvidenceFixture() : undefined
  const root = fixture?.root ?? await mkdtemp(path.join(os.tmpdir(), 'aggregate-bundle-'))
  roots.push(root)
  const plan: VerificationPlan = fixture?.plan ?? await freeze({ profile: { ...profile, os: process.platform as typeof profile.os, arch: process.arch, nodeMajor: Number(process.versions.node.split('.')[0]) } })
  // 严格 fixture 的冻结 profile 也绑定当前实际运行平台。
  if (fixture) {
    const { rehash } = await import('./fixtures')
    Object.assign(plan, rehash({ ...plan, profile: { ...plan.profile, os: process.platform as typeof profile.os, arch: process.arch, nodeMajor: Number(process.versions.node.split('.')[0]) } }))
  }
  const reports = fixture ? fixture.reports.map(report => ({ ...report, execution: { ...report.execution, profile: plan.profile, planHash: plan.planHash } })) : shardReports(plan)
  const input = path.join(root, 'plan.json')
  const bundle = path.join(root, 'runner')
  const output = path.join(root, 'aggregate.json')
  const reportsRoot = path.join(root, 'reports')
  await mkdir(reportsRoot)
  if (fixture) {
    // 保持 DOM 相对路径，不把本机临时根写进冻结报告。
    const { cp } = await import('node:fs/promises')
    await cp(path.join(root, 'dom-acceptance'), path.join(reportsRoot, 'dom-acceptance'), { recursive: true })
  }
  await writeFile(input, JSON.stringify(plan))
  await Promise.all(reports.map((report, index) => writeFile(path.join(reportsRoot, `shard-${index}.json`), JSON.stringify(report))))
  await buildAggregateBundle(input, bundle)
  return { root, plan, reports, bundle, input, output, reportsRoot, options: { bundle, plan: input, reports: reportsRoot, output, sha: plan.commitSha } }
}

it.each([false, true])('executes the original strict=%s aggregation in a dependency-free Node process', async (strict) => {
  const fixture = await prepare(strict)
  const loader = path.resolve('.github/scripts/run-verification-aggregate.mjs')
  await execa(process.execPath, [loader, ...Object.entries(fixture.options).map(([key, value]) => `--${key}=${value}`)], { cwd: fixture.root })
  expect(JSON.parse(await readFile(fixture.output, 'utf8'))).toMatchObject({ coverage: 'complete', acceptance: 'passed' })
  const code = await readFile(path.join(fixture.bundle, 'aggregate.mjs'), 'utf8')
  expect(code).not.toMatch(/from ["'](?:zod|typescript|@babel|vitest|rolldown)["']/)
})

it.each(['digest', 'sha', 'profile', 'plan', 'missing-shard', 'duplicate-shard', 'failed-task', 'provider', 'cleanup'])('rejects %s execution evidence', async (fault) => {
  const fixture = await prepare()
  const manifestFile = path.join(fixture.bundle, 'manifest.json')
  const manifest = JSON.parse(await readFile(manifestFile, 'utf8')) as { profile: { os: string }, planHash: string }
  if (fault === 'digest') {
    await writeFile(path.join(fixture.bundle, 'aggregate.mjs'), 'throw new Error("tampered")')
  }
  if (fault === 'sha') {
    fixture.options.sha = 'b'.repeat(40)
  }
  if (fault === 'profile') {
    manifest.profile.os = 'other'
  }
  if (fault === 'plan') {
    manifest.planHash = 'b'.repeat(64)
  }
  await writeFile(manifestFile, JSON.stringify(manifest))
  if (fault === 'missing-shard') {
    await rm(path.join(fixture.reportsRoot, 'shard-1.json'))
  }
  if (fault === 'duplicate-shard') {
    fixture.reports[1] = structuredClone(fixture.reports[0]!)
  }
  if (fault === 'failed-task') {
    fixture.reports[0]!.execution.status = 'failed'
  }
  if (fault === 'cleanup') {
    const task = fixture.reports[0]!.tasks[0]!
    task.status = 'blocked'
    task.exitCode = 1
  }
  if (fault === 'provider') {
    fixture.reports[0]!.execution.profile = { ...fixture.plan.profile, provider: 'headless' }
  }
  if (['duplicate-shard', 'failed-task', 'provider', 'cleanup'].includes(fault)) {
    await Promise.all(fixture.reports.map((report, index) => writeFile(path.join(fixture.reportsRoot, `shard-${index}.json`), JSON.stringify(report))))
  }
  await expect(runVerificationAggregate(fixture.options)).rejects.toThrow()
})

it.each(['provider', 'checkpoint'])('retains strict DOM %s validation inside the standalone bundle', async (fault) => {
  const fixture = await prepare(true)
  const task = fixture.reports[0]!.tasks[0]!
  const artifact = task.artifacts.find(item => item.kind === 'dom-acceptance-report')!
  const file = path.join(fixture.reportsRoot, artifact.indexPath!.replace(/^docs\/reports\//, ''))
  const report = JSON.parse(await readFile(file, 'utf8')) as AcceptanceReport
  if (fault === 'provider') {
    report.provider = 'devtools'
  }
  else {
    report.cases[0]!.acceptance!.evidence = []
  }
  await writeFile(file, JSON.stringify(report))
  const loader = path.resolve('.github/scripts/run-verification-aggregate.mjs')
  await expect(execa(process.execPath, [loader, ...Object.entries(fixture.options).map(([key, value]) => `--${key}=${value}`)], { cwd: fixture.root })).rejects.toThrow()
})
