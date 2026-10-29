import type { ChangeSet } from './types.ts'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, expect, it } from 'vitest'
import { createVerificationPlan } from './plan.ts'
import { getResourceBudget } from './resources.ts'
import { isRootToolingInput, rootToolingContractTests } from './rootTooling.ts'
import { useIsolatedTopologyTestEnvironment } from './topologyTestFixture.ts'
import { analyzePackageImpact, readWorkspace } from './workspace.ts'

useIsolatedTopologyTestEnvironment()

const roots = new Set<string>()
const contracts = ['scripts/check-changeset-frontmatter.test.ts', 'scripts/gitHooks.test.ts']
const hookInputs = [
  'lefthook.yml',
  'scripts/gitHooks/rc.sh',
  'scripts/gitHooks/commitMsg.mjs',
  'scripts/gitHooks/README.md',
  'scripts/gitHooks.test.ts',
  'scripts/changesetFrontmatter/test/fixture.ts',
]
const resources = getResourceBudget({ cpus: 4, totalMemoryBytes: 16 * 1024 ** 3, freeMemoryBytes: 12 * 1024 ** 3, jobs: 2 })
const changes = (files: string[]): ChangeSet => ({ base: 'base', head: 'head', files, fingerprint: 'fingerprint', fallback: false, warnings: [] })

afterEach(async () => {
  await Promise.all([...roots].map(async (root) => {
    await rm(root, { recursive: true, force: true })
    roots.delete(root)
  }))
})

async function fixture() {
  const root = await mkdtemp(path.join(os.tmpdir(), 'verify-root-hooks-'))
  roots.add(root)
  const { packageManager } = JSON.parse(await readFile(new URL('../../package.json', import.meta.url), 'utf8')) as { packageManager: string }
  await writeFile(path.join(root, 'package.json'), JSON.stringify({ packageManager }))
  await writeFile(path.join(root, 'pnpm-workspace.yaml'), 'packages:\n  - packages/*\n')
  await writeFile(path.join(root, 'pnpm-lock.yaml'), 'lockfileVersion: "9.0"\nimporters:\n  .: {}\n')
  for (const name of ['first', 'second']) {
    const directory = path.join(root, 'packages', name)
    await mkdir(path.join(directory, 'src'), { recursive: true })
    await writeFile(path.join(directory, 'package.json'), JSON.stringify({ name, scripts: { typecheck: 'tsc --noEmit', test: 'vitest run' } }))
    await writeFile(path.join(directory, 'src/value.ts'), 'export const value = 1\n')
    await writeFile(path.join(directory, 'src/value.test.ts'), '')
  }
  for (const file of new Set([...hookInputs, ...contracts, 'scripts/unrelated.test.ts'])) {
    await mkdir(path.dirname(path.join(root, file)), { recursive: true })
    await writeFile(path.join(root, file), '')
  }
  const packages = await readWorkspace(root)
  return {
    root,
    packages,
    plan: (files: string[]) => createVerificationPlan({ root, packages, resources, changes: changes(files), mode: 'quick', selection: 'affected' }),
  }
}

function selectedContracts(plan: Awaited<ReturnType<typeof createVerificationPlan>>): string[] {
  return plan.tasks.find(task => task.id === 'repo-scripts')?.args.filter(file => contracts.includes(file)) ?? []
}

it.each([
  { files: hookInputs },
  { files: ['lefthook.yml'] },
  { files: ['scripts/changesetFrontmatter/test/fixture.ts'] },
])('keeps known hook inputs in their real root contracts: $files', async ({ files }) => {
  const context = await fixture()
  const impact = analyzePackageImpact(files, context.packages)
  expect(impact.fallback).toBeUndefined()
  expect([...impact.affected]).toEqual([])
  const plan = await context.plan(files)
  expect(plan.selected).toEqual([])
  expect(plan.tasks.map(task => task.id)).toEqual(['lint', 'repo-scripts'])
  expect(selectedContracts(plan)).toEqual(contracts)
  expect(plan.warnings).toEqual([])
})

it('retains direct package checks when a hook input is changed alongside library source', async () => {
  const context = await fixture()
  const plan = await context.plan(['lefthook.yml', 'packages/first/src/value.ts'])
  expect(plan.selected).toEqual(['first'])
  expect(plan.tasks.some(task => task.id === 'typecheck:first')).toBe(true)
  expect(plan.tasks.some(task => task.id === 'test:first' && task.args.includes('src/value.test.ts'))).toBe(true)
  expect(plan.tasks.some(task => task.id.endsWith(':second'))).toBe(false)
  expect(selectedContracts(plan)).toEqual(contracts)
})

it.each(['unknown.config', 'scripts/unmapped.ts', 'scripts/gitHooks/newHook.mjs', 'pnpm-lock.yaml', 'tsconfig.base.json', 'patches/backend.patch'])('keeps unknown and global inputs conservative: %s', async (file) => {
  const context = await fixture()
  const plan = await context.plan(['lefthook.yml', file])
  expect(plan.selected).toEqual(['first', 'second'])
  expect(plan.tasks.filter(task => task.id.startsWith('typecheck:')).map(task => task.id).sort()).toEqual(['typecheck:first', 'typecheck:second'])
  expect(selectedContracts(plan)).toEqual(contracts)
  expect(isRootToolingInput(file)).toBe(false)
})

it('retains shared-fixture contracts after deletion and expands an unknown rename destination', async () => {
  const context = await fixture()
  const oldFile = 'scripts/changesetFrontmatter/test/fixture.ts'
  await rm(path.join(context.root, oldFile))
  const deleted = await context.plan([oldFile])
  expect(deleted.selected).toEqual([])
  expect(selectedContracts(deleted)).toEqual(contracts)
  const renamed = await context.plan([oldFile, 'scripts/newFixture.ts'])
  expect(renamed.selected).toEqual(['first', 'second'])
  expect(selectedContracts(renamed)).toEqual(contracts)
})

it.each(contracts)('rejects a missing required hook contract instead of dropping it: %s', async (file) => {
  const context = await fixture()
  await rm(path.join(context.root, file))
  await expect(context.plan(['lefthook.yml', file])).rejects.toThrow(`根工具输入缺少必需契约测试: ${file}`)
})

it('deduplicates shared hook contracts and does not classify nearby unknown files', () => {
  expect(rootToolingContractTests([...hookInputs, ...hookInputs])).toEqual(contracts)
  for (const file of ['scripts/gitHooks/extra.ts', 'lefthook.local.yml', 'scripts/changesetFrontmatter/test/unmapped.ts']) {
    expect(isRootToolingInput(file)).toBe(false)
    expect(rootToolingContractTests([file])).toEqual([])
  }
})
