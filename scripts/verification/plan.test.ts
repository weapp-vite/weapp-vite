import type { ChangeSet, WorkspacePackage } from './types.ts'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { expect, it } from 'vitest'
import { createVerificationPlan } from './plan.ts'
import { DEFAULT_SELECTION } from './policy.ts'
import { getResourceBudget } from './resources.ts'
import { scriptTestInventory } from './toolTests.ts'
import { readWorkspace } from './workspace.ts'

const packages: WorkspacePackage[] = [
  { name: 'library', directory: 'packages/library', scripts: { 'build': 'tsdown', 'test': 'vitest run', 'typecheck': 'tsc --noEmit', 'test:types:check': 'tsd' }, dependencies: [], extraInputs: [] },
  { name: 'consumer', directory: 'apps/consumer', scripts: { build: 'vite build', test: 'vitest run' }, dependencies: ['library'], extraInputs: [] },
]
const resources = getResourceBudget({ cpus: 4, totalMemoryBytes: 16 * 1024 ** 3, freeMemoryBytes: 12 * 1024 ** 3, jobs: 2 })
const changes = (files: string[]): ChangeSet => ({ base: 'base', head: 'head', files, fingerprint: 'fingerprint', fallback: false, warnings: [] })

async function createPlanRoot() {
  const root = await mkdtemp(path.join(os.tmpdir(), 'verify-plan-'))
  await writeFile(path.join(root, 'package.json'), JSON.stringify({ packageManager: 'pnpm@12.11.2', scripts: { 'test:types': 'turbo run test:types:check --filter=library' } }))
  await writeFile(path.join(root, 'pnpm-workspace.yaml'), 'packages:\n  - packages/*\n  - apps/*\n')
  await writeFile(path.join(root, 'pnpm-lock.yaml'), 'lockfileVersion: "9.0"\nimporters:\n  .: {}\n')
  await writeFile(path.join(root, 'turbo.json'), JSON.stringify({ tasks: { 'build': { dependsOn: ['^build'] }, 'test:types:check': { dependsOn: ['build', '^test:types:check'], cache: false } } }))
  for (const item of packages) {
    await mkdir(path.join(root, item.directory), { recursive: true })
    await writeFile(path.join(root, item.directory, 'package.json'), JSON.stringify({ name: item.name, version: '1.0.0', scripts: item.scripts, dependencies: Object.fromEntries(item.dependencies.map(name => [name, 'workspace:*'])) }))
  }
  return root
}

it('runs neighboring tests first and expands consumers and type contracts only for review', async () => {
  const root = await createPlanRoot()
  try {
    await mkdir(path.join(root, 'packages/library/src'), { recursive: true })
    await writeFile(path.join(root, 'packages/library/src/value.ts'), '')
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

it('keeps the full quick scope when cross-directory inputs have no trusted owner mapping', async () => {
  const root = await createPlanRoot()
  try {
    for (const file of ['scripts/unmapped.ts', 'e2e/new-kind/input.json', 'test/fixture-projects/unmapped/input.wxml', 'skills/unmapped/SKILL.md']) {
      const plan = await createVerificationPlan({ root, changes: changes([file]), packages, resources, mode: 'quick', selection: 'affected' })
      expect(plan.affected).toEqual(['consumer', 'library'])
      expect(plan.suggested).toEqual(plan.affected)
      expect(plan.selected).toEqual(plan.affected)
      expect(plan.tasks.map(item => item.id)).toEqual(expect.arrayContaining(['test:library', 'test:consumer']))
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
    expect(quick.tasks.some(item => item.id === 'test:library')).toBe(true)
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
    expect(shadow.tasks.some(task => task.id === 'test:consumer')).toBe(true)
    expect(affected.tasks.some(task => task.id === 'test:consumer')).toBe(false)
    expect(shadow.fingerprint).not.toBe(affected.fingerprint)
  }
  finally {
    await rm(root, { recursive: true, force: true })
  }
})

it('routes E2E helper and runtime changes through their managed verification entries', async () => {
  const root = await createPlanRoot()
  try {
    await mkdir(path.join(root, 'e2e/utils'), { recursive: true })
    await writeFile(path.join(root, 'e2e/utils/helper.test.ts'), '')
    const plan = await createVerificationPlan({ root, changes: changes(['e2e/utils/helper.test.ts', 'e2e/ci/case.test.ts', 'e2e/web-runtime/case.test.ts']), packages, resources, mode: 'quick', selection: 'affected' })
    expect(plan.tasks.find(task => task.id === 'runtime:internal-contracts')).toMatchObject({
      resource: 'machine-exclusive',
      args: expect.arrayContaining(['e2e/vitest.e2e.internal.config.ts', 'e2e/utils/helper.test.ts']),
    })
    expect(plan.tasks.find(task => task.id === 'runtime:ci')?.args).toContain('e2e:ci')
    expect(plan.tasks.find(task => task.id === 'runtime:web')?.args).toContain('e2e:web')
    expect(plan.remaining.length).toBeGreaterThan(0)
  }
  finally {
    await rm(root, { recursive: true, force: true })
  }
})

it('retains internal contracts for deleted E2E inputs and filters only surviving neighboring tests', async () => {
  const root = await createPlanRoot()
  try {
    await mkdir(path.join(root, 'e2e/utils'), { recursive: true })
    await writeFile(path.join(root, 'e2e/utils/helper.test.ts'), '')
    const input = { root, packages, resources, selection: 'affected' as const }
    for (const file of ['e2e/utils/helper.ts', 'e2e/scripts/deleted.test.ts', 'e2e/utils/deleted.test.ts']) {
      for (const mode of ['quick', 'review'] as const) {
        const plan = await createVerificationPlan({ ...input, mode, changes: changes([file]) })
        const task = plan.tasks.find(item => item.id === 'runtime:internal-contracts')
        expect(task).toMatchObject({
          resource: 'machine-exclusive',
          args: expect.arrayContaining(['e2e/vitest.e2e.internal.config.ts']),
        })
        expect(task?.args).not.toContain(file)
        const filters = task!.args.slice(5).filter(arg => !arg.startsWith('-'))
        expect(filters).toEqual(mode === 'quick' && file === 'e2e/utils/helper.ts' ? ['e2e/utils/helper.test.ts'] : [])
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

it('keeps deleted scripts in scope and combines neighboring mjs tests with every workflow contract', async () => {
  const { root, files } = await createToolPlanRoot()
  try {
    const input = { root, packages, resources, selection: 'affected' as const }
    const deleted = await createVerificationPlan({ ...input, mode: 'quick', changes: changes(['scripts/deleted.mjs']) })
    expect(plannedToolFiles(deleted, files)).toEqual([...files].sort())
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
