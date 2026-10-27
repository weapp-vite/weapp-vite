import type { ChangeSet, WorkspacePackage } from './types.ts'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { setImmediate } from 'node:timers/promises'
import { expect, it } from 'vitest'
import { createVerificationPlan } from './plan.ts'
import { DEFAULT_SELECTION } from './policy.ts'
import { getResourceBudget } from './resources.ts'
import { runVerification } from './run.ts'
import { scriptTestInventory } from './toolTests.ts'
import { useIsolatedTopologyTestEnvironment } from './topologyTestFixture.ts'
import { readWorkspace } from './workspace.ts'

useIsolatedTopologyTestEnvironment()

const packages: WorkspacePackage[] = [
  { name: 'library', directory: 'packages/library', scripts: { 'build': 'tsdown', 'test': 'vitest run', 'typecheck': 'tsc --noEmit', 'test:types:check': 'tsd' }, dependencies: [], extraInputs: [] },
  { name: 'consumer', directory: 'apps/consumer', scripts: { build: 'vite build', test: 'vitest run' }, dependencies: ['library'], extraInputs: [] },
]
const resources = getResourceBudget({ cpus: 4, totalMemoryBytes: 16 * 1024 ** 3, freeMemoryBytes: 12 * 1024 ** 3, jobs: 2 })
const changes = (files: string[]): ChangeSet => ({ base: 'base', head: 'head', files, fingerprint: 'fingerprint', fallback: false, warnings: [] })

async function createPlanRoot() {
  const root = await mkdtemp(path.join(os.tmpdir(), 'verify-plan-'))
  const { packageManager } = JSON.parse(await readFile(new URL('../../package.json', import.meta.url), 'utf8')) as { packageManager: string }
  await writeFile(path.join(root, 'package.json'), JSON.stringify({ packageManager, scripts: { 'test:types': 'turbo run test:types:check --filter=library' } }))
  await writeFile(path.join(root, 'pnpm-workspace.yaml'), 'packages:\n  - packages/*\n  - apps/*\n')
  await writeFile(path.join(root, 'pnpm-lock.yaml'), 'lockfileVersion: "9.0"\nimporters:\n  .: {}\n')
  await writeFile(path.join(root, 'turbo.json'), JSON.stringify({ tasks: { 'build': { dependsOn: ['^build'] }, 'test:types:check': { dependsOn: ['build', '^test:types:check'], cache: false } } }))
  for (const item of packages) {
    await mkdir(path.join(root, item.directory), { recursive: true })
    await writeFile(path.join(root, item.directory, 'package.json'), JSON.stringify({ name: item.name, version: '1.0.0', scripts: item.scripts, dependencies: Object.fromEntries(item.dependencies.map(name => [name, 'workspace:*'])) }))
  }
  return root
}

it.each(['modified', 'deleted'])('runs neighboring tests for %s sources and expands consumers and type contracts only for review', async (status) => {
  const root = await createPlanRoot()
  try {
    await mkdir(path.join(root, 'packages/library/src'), { recursive: true })
    if (status === 'modified') {
      await writeFile(path.join(root, 'packages/library/src/value.ts'), '')
    }
    await writeFile(path.join(root, 'packages/library/src/value.test.ts'), '')
    const input = { root, changes: changes(['packages/library/src/value.ts']), packages, resources, selection: 'affected' as const }
    const quick = await createVerificationPlan({ ...input, mode: 'quick' })
    expect(quick.tasks.find(task => task.id === 'test:library')?.args).toContain('src/value.test.ts')
    expect(quick.tasks.some(task => task.id === 'test:consumer')).toBe(false)
    expect(quick.remaining.length).toBeGreaterThan(0)
    const review = await createVerificationPlan({ ...input, mode: 'review' })
    expect(review.tasks.find(task => task.id === 'test:library')?.args).not.toContain('src/value.test.ts')
    expect(review.tasks.find(task => task.id === 'test:consumer')?.dependencies).toContain('build')
    expect(review.tasks.filter(task => task.id === 'build')).toHaveLength(1)
    expect(review.tasks.find(task => task.id === 'types')?.args).toContain('test:types:check')
    expect(review.tasks.find(task => task.id === 'types')?.args).not.toContain('test:types')
  }
  finally {
    await rm(root, { recursive: true, force: true })
  }
})

it('filters pure package tests in quick and keeps their full package entry in review', async () => {
  const root = await createPlanRoot()
  try {
    await mkdir(path.join(root, 'packages/library/src'), { recursive: true })
    await writeFile(path.join(root, 'packages/library/src/value.test.ts'), '')
    const scoped = packages.map(item => item.name === 'library'
      ? { ...item, scripts: { ...item.scripts, 'test:pure': 'vitest run --coverage.enabled=false' } }
      : item)
    const input = { root, packages: scoped, resources, selection: 'affected' as const, changes: changes(['packages/library/src/value.test.ts']) }
    const quick = await createVerificationPlan({ ...input, mode: 'quick' })
    expect(quick.tasks.find(task => task.id === 'test:library')?.args).toEqual(['--filter', 'library', 'run', 'test:pure', '--maxWorkers=2', 'src/value.test.ts'])
    expect(quick.tasks.some(task => task.id === 'pure')).toBe(false)
    const missing = await createVerificationPlan({ ...input, changes: changes(['packages/library/src/no-neighbor.ts']), mode: 'quick' })
    expect(missing.tasks.some(task => task.id === 'pure' || task.id === 'test:library')).toBe(false)
    expect(missing.tasks.some(task => task.id === 'typecheck:library')).toBe(true)
    const review = await createVerificationPlan({ ...input, mode: 'review' })
    expect(review.tasks.find(task => task.id === 'pure')?.args).toContain('test:pure')
    expect(review.tasks.some(task => task.id === 'test:library')).toBe(false)
  }
  finally {
    await rm(root, { recursive: true, force: true })
  }
})

it('does not silently drop direct tests when a package script cannot accept filters', async () => {
  const root = await createPlanRoot()
  try {
    await mkdir(path.join(root, 'packages/library/src'), { recursive: true })
    await writeFile(path.join(root, 'packages/library/src/value.test.ts'), '')
    const scoped = packages.map(item => item.name === 'library' ? { ...item, scripts: { ...item.scripts, test: 'node test-runner.mjs' } } : item)
    const plan = await createVerificationPlan({ root, packages: scoped, resources, selection: 'affected', changes: changes(['packages/library/src/value.test.ts']), mode: 'quick' })
    expect(plan.tasks.find(task => task.id === 'test:library')?.blockedReason).toContain('安全传入直接回归范围')
  }
  finally {
    await rm(root, { recursive: true, force: true })
  }
})

it.each(['pretest', 'posttest'])('isolates the complete pnpm test command when %s can replace shared artifacts', async (lifecycle) => {
  const root = await createPlanRoot()
  try {
    const manifestFile = path.join(root, 'packages/library/package.json')
    const manifest = JSON.parse(await readFile(manifestFile, 'utf8')) as { scripts: Record<string, string> }
    manifest.scripts[lifecycle] = lifecycle === 'pretest' ? 'pnpm build' : 'node cleanup.mjs'
    await writeFile(manifestFile, JSON.stringify(manifest))
    const plan = await createVerificationPlan({ root, changes: changes(['package.json']), packages: await readWorkspace(root), resources, mode: 'review', selection: 'affected' })
    expect(plan.tasks.find(task => task.id === 'test:library')).toMatchObject({
      resource: 'workspace-write',
      args: ['--filter', 'library', 'run', 'test', '--maxWorkers=1'],
    })
    expect(plan.tasks.find(task => task.id === 'test:consumer')).toMatchObject({ resource: 'cpu', exclusive: false })
    const active = new Set<string>()
    const report = await runVerification(plan, async (task) => {
      if (task.id === 'test:library') {
        expect(active.size).toBe(0)
      }
      else {
        expect(active.has('test:library')).toBe(false)
      }
      active.add(task.id)
      await setImmediate()
      active.delete(task.id)
      return { exitCode: 0, execution: 'actual' }
    })
    expect(report.results.every(result => result.status === 'passed')).toBe(true)
  }
  finally {
    await rm(root, { recursive: true, force: true })
  }
})

it('falls back conservatively for unclassified files and delegates full tests without duplicate pure execution', async () => {
  const root = await createPlanRoot()
  try {
    const plan = await createVerificationPlan({ root, changes: changes(['unclassified.config']), packages, resources, mode: 'quick' })
    expect(plan.affected).toEqual(['consumer', 'library'])
    expect(plan.warnings.some(warning => warning.includes('保守'))).toBe(true)
    const full = await createVerificationPlan({ root, changes: changes([]), packages, resources, mode: 'full' })
    expect(full.tasks.find(task => task.id === 'tests')?.args).toContain('test')
    expect(full.tasks.some(task => task.id === 'pure')).toBe(false)
  }
  finally {
    await rm(root, { recursive: true, force: true })
  }
})

it('keeps root contribution and local agent documents within applicable static checks', async () => {
  const root = await createPlanRoot()
  try {
    await writeFile(path.join(root, 'CONTRIBUTING.md'), '# Contributing\n')
    await writeFile(path.join(root, 'AGENTS.local.md'), '# Local rules\n')
    const input = { root, changes: changes(['CONTRIBUTING.md', 'AGENTS.local.md']), packages, resources, mode: 'quick' as const }
    const docs = await createVerificationPlan(input)
    expect(docs.selected).toEqual([])
    expect(docs.tasks.map(item => item.id)).toEqual(['lint'])
    expect(docs.warnings.some(warning => warning.includes('未分类'))).toBe(false)
    const mapped = packages.map(item => item.name === 'library' ? { ...item, extraInputs: ['CONTRIBUTING.md'] } : item)
    expect((await createVerificationPlan({ ...input, packages: mapped })).selected).toEqual(['library'])
    expect((await createVerificationPlan({ ...input, changes: changes(['pnpm-lock.yaml']) })).selected).toEqual(['consumer', 'library'])
  }
  finally {
    await rm(root, { recursive: true, force: true })
  }
})

it('preserves generated agent and public skill checks in local quick for modified or deleted rule inputs', async () => {
  const root = await createPlanRoot()
  try {
    const input = { root, packages, resources, mode: 'quick' as const }
    for (const file of ['AGENTS.md', 'scripts/agents/content/root-intro.md', 'skills/example/SKILL.md']) {
      const plan = await createVerificationPlan({ ...input, changes: changes([file]) })
      const policies = plan.tasks.filter(task => task.id.startsWith('policy:'))
      expect(policies.map(task => task.args)).toEqual(file === 'AGENTS.md'
        ? [['run', 'agents:check'], ['run', 'skills:check']]
        : file.startsWith('skills/') ? [['run', 'skills:check']] : [['run', 'agents:check']])
      expect(plan.tasks.some(task => task.kind === 'runtime' || task.id.startsWith('test:'))).toBe(false)
    }
  }
  finally {
    await rm(root, { recursive: true, force: true })
  }
})

it('keeps conservative static ownership without escalating unmapped quick inputs to full package tests', async () => {
  const root = await createPlanRoot()
  try {
    for (const file of ['scripts/unmapped.ts', 'e2e/new-kind/input.json', 'test/fixture-projects/unmapped/input.wxml', 'skills/unmapped/SKILL.md']) {
      const plan = await createVerificationPlan({ root, changes: changes([file]), packages, resources, mode: 'quick', selection: 'affected' })
      expect(plan.affected).toEqual(['consumer', 'library'])
      expect(plan.suggested).toEqual(plan.affected)
      expect(plan.selected).toEqual(plan.affected)
      expect(plan.tasks.some(item => item.kind === 'test' && item.id.startsWith('test:'))).toBe(false)
      expect(plan.tasks.map(item => item.id)).toContain('typecheck:library')
      expect(plan.warnings).toContain(`未映射的跨目录输入触发保守全范围: ${file}`)
      expect(plan.remaining.length).toBeGreaterThan(0)
    }
  }
  finally {
    await rm(root, { recursive: true, force: true })
  }
})

it('narrows mapped Turbo cross-directory inputs in quick and expands their consumers in review', async () => {
  const root = await createPlanRoot()
  try {
    await writeFile(path.join(root, 'packages/library/turbo.json'), JSON.stringify({
      extends: ['//'],
      tasks: { build: { inputs: ['$TURBO_ROOT$/scripts/shared/**'] } },
    }))
    const input = { root, changes: changes(['scripts/shared/config.ts']), packages: await readWorkspace(root), resources, selection: 'affected' as const }
    const quick = await createVerificationPlan({ ...input, mode: 'quick' })
    expect(quick.affected).toEqual(['consumer', 'library'])
    expect(quick.suggested).toEqual(['library'])
    expect(quick.selected).toEqual(['library'])
    expect(quick.tasks.some(item => item.id === 'test:library')).toBe(false)
    expect(quick.tasks.some(item => item.id === 'typecheck:library')).toBe(true)
    expect(quick.tasks.some(item => item.id === 'test:consumer')).toBe(false)
    expect(quick.warnings.some(warning => warning.includes('未映射'))).toBe(false)
    const review = await createVerificationPlan({ ...input, mode: 'review' })
    expect(review.selected).toEqual(['consumer', 'library'])
    expect(review.tasks.some(item => item.id === 'test:consumer')).toBe(true)
  }
  finally {
    await rm(root, { recursive: true, force: true })
  }
})

it('honors the rollout policy and preserves explicit shadow and affected selection', async () => {
  const root = await createPlanRoot()
  try {
    const input = { root, changes: changes(['packages/library/src/value.ts']), packages, resources, mode: 'quick' as const }
    expect((await createVerificationPlan(input)).selection).toBe(DEFAULT_SELECTION)
    const shadow = await createVerificationPlan({ ...input, selection: 'shadow' })
    const affected = await createVerificationPlan({ ...input, selection: 'affected' })
    expect(shadow.selection).toBe('shadow')
    expect(shadow.suggested).toEqual(['library'])
    expect(shadow.selected).toContain('consumer')
    expect(shadow.tasks.some(task => task.id === 'test:consumer')).toBe(false)
    expect(affected.tasks.some(task => task.id === 'test:consumer')).toBe(false)
    expect(shadow.fingerprint).not.toBe(affected.fingerprint)
  }
  finally {
    await rm(root, { recursive: true, force: true })
  }
})

it('delegates E2E helper and runtime cases from quick to managed review entries', async () => {
  const root = await createPlanRoot()
  try {
    await mkdir(path.join(root, 'e2e/utils'), { recursive: true })
    await writeFile(path.join(root, 'e2e/utils/helper.test.ts'), '')
    const input = { root, changes: changes(['e2e/utils/helper.test.ts', 'e2e/ci/case.test.ts', 'e2e/web-runtime/case.test.ts']), packages, resources, selection: 'affected' as const }
    const quick = await createVerificationPlan({ ...input, mode: 'quick' })
    expect(quick.tasks.some(task => task.kind === 'runtime')).toBe(false)
    expect(quick.tasks.some(task => task.id.startsWith('test:'))).toBe(false)
    expect(quick.remaining.some(item => item.includes('E2E 用例及工具单测'))).toBe(true)
    const plan = await createVerificationPlan({ ...input, mode: 'review' })
    expect(plan.tasks.find(task => task.id === 'runtime:internal-contracts')).toMatchObject({
      resource: 'machine-exclusive',
      args: expect.arrayContaining(['e2e/vitest.e2e.internal.config.ts']),
    })
    expect(plan.tasks.find(task => task.id === 'runtime:ci')?.args).toContain('e2e:ci')
    expect(plan.tasks.find(task => task.id === 'runtime:web')?.args).toContain('e2e:web')
    expect(plan.remaining.length).toBeGreaterThan(0)
  }
  finally {
    await rm(root, { recursive: true, force: true })
  }
})

it('retains managed review internal contracts for deleted E2E inputs without a quick runtime fallback', async () => {
  const root = await createPlanRoot()
  try {
    await mkdir(path.join(root, 'e2e/utils'), { recursive: true })
    await writeFile(path.join(root, 'e2e/utils/helper.test.ts'), '')
    const input = { root, packages, resources, selection: 'affected' as const }
    for (const file of ['e2e/utils/helper.ts', 'e2e/scripts/deleted.test.ts', 'e2e/utils/deleted.test.ts']) {
      for (const mode of ['quick', 'review'] as const) {
        const plan = await createVerificationPlan({ ...input, mode, changes: changes([file]) })
        const task = plan.tasks.find(item => item.id === 'runtime:internal-contracts')
        if (mode === 'quick') {
          expect(task).toBeUndefined()
          expect(plan.tasks.some(item => item.kind === 'runtime')).toBe(false)
          continue
        }
        expect(task).toMatchObject({
          resource: 'machine-exclusive',
          args: expect.arrayContaining(['e2e/vitest.e2e.internal.config.ts']),
        })
        expect(task?.args).not.toContain(file)
        const filters = task!.args.slice(5).filter(arg => !arg.startsWith('-'))
        expect(filters).toEqual([])
      }
    }
  }
  finally {
    await rm(root, { recursive: true, force: true })
  }
})

async function createToolPlanRoot() {
  const root = await createPlanRoot()
  const files = ['scripts/helper.test.ts', 'scripts/helper.test.mjs', 'scripts/pr-context.test.mjs', 'scripts/workflow.test.ts', 'scripts/prAdmission/context.test.mjs']
  for (const file of files) {
    await mkdir(path.dirname(path.join(root, file)), { recursive: true })
    await writeFile(path.join(root, file), '')
  }
  const manifestFile = path.join(root, 'package.json')
  const manifest = JSON.parse(await readFile(manifestFile, 'utf8')) as { scripts: Record<string, string> }
  manifest.scripts['test:pr-actions'] = 'vitest run --config scripts/vitest.config.mjs scripts/pr-context.test.mjs scripts/workflow.test.ts scripts/prAdmission'
  await writeFile(manifestFile, JSON.stringify(manifest))
  return { root, files }
}

function plannedToolFiles(plan: Awaited<ReturnType<typeof createVerificationPlan>>, files: string[]): string[] {
  const task = plan.tasks.find(item => item.id === 'repo-scripts')
  if (!task) {
    return []
  }
  const filters: string[] = []
  const excludes: string[] = []
  const args = task.args.slice(5)
  for (let index = 0; index < args.length; index++) {
    if (args[index] === '--exclude') {
      excludes.push(args[++index]!)
    }
    else if (!args[index]!.startsWith('-')) {
      filters.push(args[index]!)
    }
  }
  return files.filter(file => filters.some(filter => file === filter || file.startsWith(`${filter}/`))
    && !excludes.some(pattern => path.posix.matchesGlob(file, pattern))).sort()
}

it('unions script and workflow contracts once, and gives full the exact complement of root tests', async () => {
  const { root, files } = await createToolPlanRoot()
  try {
    const input = { root, changes: changes(['scripts/helper.mjs', '.github/workflows/ci.yml']), packages, resources, selection: 'affected' as const }
    const review = await createVerificationPlan({ ...input, mode: 'review' })
    expect(plannedToolFiles(review, files)).toEqual([...files].sort())
    expect(review.tasks.filter(item => item.id === 'repo-scripts')).toHaveLength(1)
    expect(review.tasks.some(item => item.id === 'workflow-contracts')).toBe(false)

    const full = await createVerificationPlan({ ...input, mode: 'full' })
    const rootFiles = [...(await scriptTestInventory(root)).root]
    const extraFiles = plannedToolFiles(full, files)
    expect(extraFiles.filter(file => rootFiles.includes(file))).toEqual([])
    expect([...rootFiles, ...extraFiles].sort()).toEqual([...files].sort())
    expect(full.tasks.find(item => item.id === 'repo-scripts')?.dependencies).toEqual(['tests'])
  }
  finally {
    await rm(root, { recursive: true, force: true })
  }
})

it('delegates unfilterable deleted scripts and retains neighboring and workflow contracts in quick', async () => {
  const { root, files } = await createToolPlanRoot()
  try {
    const input = { root, packages, resources, selection: 'affected' as const }
    const deleted = await createVerificationPlan({ ...input, mode: 'quick', changes: changes(['scripts/deleted.mjs']) })
    expect(plannedToolFiles(deleted, files)).toEqual([])
    expect(deleted.remaining.some(item => item.includes('完整工具测试'))).toBe(true)
    const quick = await createVerificationPlan({ ...input, mode: 'quick', changes: changes(['scripts/helper.mjs', '.github/workflows/ci.yml']) })
    expect(plannedToolFiles(quick, files)).toEqual([...files].sort())
    const workflow = await createVerificationPlan({ ...input, mode: 'review', changes: changes(['.github/workflows/deleted.yml']) })
    expect(plannedToolFiles(workflow, files)).toEqual(files.filter(file => !file.includes('helper')).sort())
    const full = await createVerificationPlan({ ...input, mode: 'full', changes: changes([]) })
    expect(plannedToolFiles(full, files)).toEqual(files.filter(file => file.endsWith('.mjs')).sort())
  }
  finally {
    await rm(root, { recursive: true, force: true })
  }
})

it('rejects workflow commands or filters that cannot be represented by the shared tool inventory', async () => {
  const { root } = await createToolPlanRoot()
  try {
    const manifestFile = path.join(root, 'package.json')
    const manifest = JSON.parse(await readFile(manifestFile, 'utf8')) as { scripts: Record<string, string> }
    for (const script of [
      'vitest run --config scripts/vitest.config.mjs scripts/missing.test.mjs',
      'vitest run --config scripts/vitest.config.mjs scripts/pr-context.test.mjs && node additional-check.mjs',
    ]) {
      manifest.scripts['test:pr-actions'] = script
      await writeFile(manifestFile, JSON.stringify(manifest))
      await expect(createVerificationPlan({ root, packages, resources, mode: 'full', changes: changes(['.github/workflows/ci.yml']) })).rejects.toThrow('test:pr-actions')
    }
  }
  finally {
    await rm(root, { recursive: true, force: true })
  }
})

it('freezes topology separately while preserving all original full commands, scope and resources', async () => {
  const root = await createPlanRoot()
  try {
    const input = { root, changes: changes([]), packages, resources, mode: 'full' as const }
    const legacy = await createVerificationPlan({ ...input, topology: 'legacy-v1' })
    const optimized = await createVerificationPlan({ ...input, topology: 'optimized-v1' })
    expect(legacy.fingerprint).not.toBe(optimized.fingerprint)
    expect(legacy.executionTopology.policyDigest).toBe(optimized.executionTopology.policyDigest)
    const commands = (plan: typeof legacy) => plan.tasks.map(({ env: _env, ...task }) => task)
    expect(commands(legacy)).toEqual(commands(optimized))
    expect(legacy.resources).toEqual(optimized.resources)
    expect(legacy.selected).toEqual(optimized.selected)
    expect(legacy.tasks.every(task => task.env?.WEAPP_VITE_VERIFICATION_TOPOLOGY === 'legacy-v1')).toBe(true)
    expect(optimized.tasks.every(task => task.env?.WEAPP_VITE_VERIFICATION_TOPOLOGY === 'optimized-v1')).toBe(true)
  }
  finally {
    await rm(root, { recursive: true, force: true })
  }
})
