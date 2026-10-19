import type { ChangeSet, WorkspacePackage } from './types.ts'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { expect, it } from 'vitest'
import { createVerificationPlan } from './plan.ts'
import { DEFAULT_SELECTION } from './policy.ts'
import { getResourceBudget } from './resources.ts'

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
