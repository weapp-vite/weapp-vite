import type { ChangeSet, WorkspacePackage } from './types.ts'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { expect, it } from 'vitest'
import { createVerificationPlan } from './plan.ts'
import { getResourceBudget } from './resources.ts'
import { runVerification } from './run.ts'
import { useIsolatedTopologyTestEnvironment } from './topologyTestFixture.ts'
import { analyzePackageImpact, readWorkspace } from './workspace.ts'

useIsolatedTopologyTestEnvironment()

const resources = getResourceBudget({ cpus: 4, totalMemoryBytes: 16 * 1024 ** 3, freeMemoryBytes: 12 * 1024 ** 3, jobs: 2 })
const changes = (files: string[]): ChangeSet => ({ base: 'base', head: 'head', files, fingerprint: 'fingerprint', fallback: false, warnings: [] })
const consumers = ['app', 'template', 'fixture']

async function createRoot() {
  const root = await mkdtemp(path.join(os.tmpdir(), 'verify-quick-scope-'))
  const { packageManager } = JSON.parse(await readFile(new URL('../../package.json', import.meta.url), 'utf8')) as { packageManager: string }
  await writeFile(path.join(root, 'package.json'), JSON.stringify({ packageManager, scripts: { 'build:pkgs': 'turbo run build --filter=./packages/*', 'build:apps': 'turbo run build --filter=./apps/* --filter=./templates/*' } }))
  await writeFile(path.join(root, 'pnpm-workspace.yaml'), 'packages:\n  - packages/*\n  - apps/*\n  - templates/*\n  - e2e-apps/*\n')
  await writeFile(path.join(root, 'pnpm-lock.yaml'), 'lockfileVersion: "9.0"\nimporters:\n  .: {}\n')
  await writeFile(path.join(root, 'turbo.json'), JSON.stringify({ globalDependencies: ['package.json'], tasks: { build: { dependsOn: ['^build'] } } }))
  const items = [
    { name: 'dist-helper', directory: 'packages/dist-helper', scripts: { build: 'node build.mjs' }, dependencies: [] },
    { name: 'library', directory: 'packages/library', scripts: { build: 'node build.mjs', typecheck: 'tsc --noEmit', test: 'vitest run' }, dependencies: ['dist-helper'] },
    { name: 'weapp-vite', directory: 'packages/weapp-vite', scripts: { build: 'node build.mjs', typecheck: 'tsc --noEmit' }, dependencies: ['dist-helper'] },
    ...consumers.map((name, index) => ({
      name,
      directory: `${['apps', 'templates', 'e2e-apps'][index]}/${name}`,
      scripts: { build: 'vite build', typecheck: 'vue-tsc --noEmit', test: 'vitest run', postinstall: 'wv prepare' },
      dependencies: ['library', 'weapp-vite'],
    })),
  ]
  for (const item of items) {
    await mkdir(path.join(root, item.directory, 'src'), { recursive: true })
    await writeFile(path.join(root, item.directory, 'package.json'), JSON.stringify({ name: item.name, version: '1.0.0', scripts: item.scripts, dependencies: Object.fromEntries(item.dependencies.map(name => [name, 'workspace:*'])) }))
    await writeFile(path.join(root, item.directory, 'src/value.test.ts'), '')
  }
  return root
}

function buildFilters(plan: Awaited<ReturnType<typeof createVerificationPlan>>): string[] {
  return plan.tasks.filter(item => item.kind === 'build').flatMap(item => item.args.filter(arg => arg.startsWith('--filter=')).map(arg => arg.slice('--filter='.length))).sort()
}

it.each(['package.json', 'unknown.config', 'scripts/unmapped.ts'])('retains conservative impact for %s without turning indirect consumers into quick checks', async (file) => {
  const root = await createRoot()
  try {
    const packages = await readWorkspace(root)
    const plan = await createVerificationPlan({ root, packages, resources, changes: changes([file]), mode: 'quick', selection: 'affected' })
    expect(plan.selected).toEqual(packages.map(item => item.name).sort())
    expect(plan.affected).toEqual(plan.selected)
    if (file === 'package.json') {
      expect([...analyzePackageImpact([file], packages).direct].sort()).toEqual(plan.selected)
    }
    expect(buildFilters(plan)).toEqual(['dist-helper', 'library', 'weapp-vite'])
    expect(plan.tasks.filter(item => item.id.startsWith('typecheck:')).map(item => item.id).sort()).toEqual(['typecheck:library', 'typecheck:weapp-vite'])
    expect(plan.tasks.some(item => item.id.startsWith('prepare:') || item.id.startsWith('test:'))).toBe(false)
  }
  finally {
    await rm(root, { recursive: true, force: true })
  }
})

it('keeps shadow selection conservative while preparing only library dist for a library change', async () => {
  const root = await createRoot()
  try {
    const plan = await createVerificationPlan({ root, packages: await readWorkspace(root), resources, changes: changes(['packages/library/src/value.ts']), mode: 'quick', selection: 'shadow' })
    expect(plan.selected).toEqual(['app', 'dist-helper', 'fixture', 'library', 'template', 'weapp-vite'])
    expect(buildFilters(plan)).toEqual(['dist-helper', 'library', 'weapp-vite'])
    expect(plan.tasks.some(item => consumers.some(name => item.id.endsWith(`:${name}`)))).toBe(false)
  }
  finally {
    await rm(root, { recursive: true, force: true })
  }
})

it('does not build test-only owned consumers when the change has no applicable quick test', async () => {
  const root = await createRoot()
  try {
    const packages = (await readWorkspace(root)).map(item => item.name === 'app'
      ? { ...item, scripts: { test: 'vitest run', postinstall: 'wv prepare' } }
      : item)
    const plan = await createVerificationPlan({ root, packages, resources, changes: changes(['apps/app/README.md']), mode: 'quick', selection: 'affected' })
    expect(plan.tasks.some(item => item.kind === 'build' || item.id.startsWith('prepare:') || item.id.startsWith('test:'))).toBe(false)
  }
  finally {
    await rm(root, { recursive: true, force: true })
  }
})

it('preserves review consumer builds, package tests and typechecks under global inputs', async () => {
  const root = await createRoot()
  try {
    const plan = await createVerificationPlan({ root, packages: await readWorkspace(root), resources, changes: changes(['package.json']), mode: 'review', selection: 'affected' })
    expect(buildFilters(plan)).toEqual(['app', 'dist-helper', 'library', 'template', 'weapp-vite'])
    for (const name of consumers) {
      expect(plan.tasks.find(item => item.id === `test:${name}`)?.dependencies).toEqual(['build'])
      expect(plan.tasks.find(item => item.id === `typecheck:${name}`)?.dependencies).toEqual(['build'])
    }
    expect(plan.tasks.some(item => item.id.startsWith('prepare:'))).toBe(false)
  }
  finally {
    await rm(root, { recursive: true, force: true })
  }
})

it.each(consumers)('prepares a genuinely owned %s after library dist and before its applicable quick checks', async (name) => {
  const root = await createRoot()
  try {
    const packages = await readWorkspace(root)
    const consumer = packages.find(item => item.name === name)!
    const plan = await createVerificationPlan({ root, packages, resources, changes: changes([`${consumer.directory}/src/value.ts`]), mode: 'quick', selection: 'affected' })
    expect(buildFilters(plan)).toEqual(['dist-helper', 'library', 'weapp-vite'])
    expect(plan.tasks.find(item => item.id === `prepare:${name}`)).toMatchObject({
      dependencies: ['build'],
      resource: 'workspace-write',
      exclusive: true,
      blockedReason: undefined,
      args: ['exec', 'node', '--import', 'tsx', 'scripts/verification/consumerPrepare.ts', '--directory', consumer.directory, '--cli', 'packages/weapp-vite/bin/weapp-vite.js'],
    })
    for (const prefix of ['typecheck', 'test']) {
      expect(plan.tasks.find(item => item.id === `${prefix}:${name}`)?.dependencies).toEqual([`prepare:${name}`])
    }
    const completed = new Set<string>()
    const report = await runVerification(plan, async (task) => {
      for (const dependency of task.dependencies) {
        expect(completed.has(dependency)).toBe(true)
      }
      completed.add(task.id)
      return { exitCode: 0, execution: 'actual' }
    })
    expect(report.results.every(item => item.status === 'passed')).toBe(true)
    const attempted = new Set<string>()
    const failed = await runVerification(plan, async (task) => {
      attempted.add(task.id)
      return { exitCode: task.id === `prepare:${name}` ? 1 : 0, execution: 'actual' }
    })
    expect(failed.results.find(item => item.id === `prepare:${name}`)?.status).toBe('failed')
    expect(attempted.has(`typecheck:${name}`)).toBe(false)
    expect(attempted.has(`test:${name}`)).toBe(false)
  }
  finally {
    await rm(root, { recursive: true, force: true })
  }
})

it('rewrites consumer preparation dependencies after explicit CLI dist sync splitting', async () => {
  const root = await createRoot()
  try {
    const plan = await createVerificationPlan({ root, packages: await readWorkspace(root), resources, changes: changes(['apps/app/src/value.ts', 'packages/weapp-vite/src/index.ts']), mode: 'quick', selection: 'affected' })
    const prepare = plan.tasks.find(item => item.id === 'prepare:app')!
    expect(plan.tasks.some(item => item.id === 'dist-sync:weapp-vite')).toBe(true)
    expect(prepare.dependencies).not.toContain('build')
    expect(prepare.dependencies.length).toBeGreaterThan(0)
    const completed = new Set<string>()
    await runVerification(plan, async (task) => {
      if (task.id === 'prepare:app') {
        expect(completed.has('dist-sync:weapp-vite')).toBe(true)
      }
      completed.add(task.id)
      return { exitCode: 0, execution: 'actual' }
    })
  }
  finally {
    await rm(root, { recursive: true, force: true })
  }
})

it.each(['missing', 'undeclared', 'undeclared-global', 'unbuildable'])('blocks owned consumer checks when its required CLI dependency is %s', async (kind) => {
  const root = await createRoot()
  try {
    let packages = await readWorkspace(root)
    if (kind === 'missing') {
      packages = packages.filter(item => item.name !== 'weapp-vite')
    }
    else {
      packages = packages.map((item): WorkspacePackage => kind.startsWith('undeclared') && item.name === 'app'
        ? { ...item, dependencies: ['library'] }
        : kind === 'unbuildable' && item.name === 'weapp-vite' ? { ...item, scripts: { typecheck: 'tsc --noEmit' } } : item)
    }
    const files = ['apps/app/src/value.ts', ...(kind === 'undeclared-global' ? ['package.json'] : [])]
    const plan = await createVerificationPlan({ root, packages, resources, changes: changes(files), mode: 'quick', selection: 'affected' })
    expect(plan.tasks.find(item => item.id === 'prepare:app')?.blockedReason).toContain('weapp-vite workspace 依赖')
    const attempted = new Set<string>()
    const report = await runVerification(plan, async (task) => {
      attempted.add(task.id)
      return { exitCode: 0, execution: 'actual' }
    })
    expect(report.results.find(item => item.id === 'prepare:app')?.status).toBe('blocked')
    expect(attempted.has('typecheck:app')).toBe(false)
    expect(attempted.has('test:app')).toBe(false)
  }
  finally {
    await rm(root, { recursive: true, force: true })
  }
})
