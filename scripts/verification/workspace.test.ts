import type { WorkspacePackage } from './types.ts'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { expect, it } from 'vitest'
import { analyzePackageImpact, ownerOf, readWorkspace } from './workspace.ts'

function pkg(name: string, directory: string, dependencies: string[] = [], extraInputs: string[] = []): WorkspacePackage {
  return { name, directory, dependencies, extraInputs, scripts: {} }
}

async function fixture(run: (root: string, write: (file: string, content: unknown) => Promise<void>) => Promise<void>) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'verify-workspace-'))
  const write = async (file: string, content: unknown) => {
    await mkdir(path.dirname(path.join(root, file)), { recursive: true })
    await writeFile(path.join(root, file), typeof content === 'string' ? content : JSON.stringify(content))
  }
  try {
    await run(root, write)
  }
  finally {
    await rm(root, { recursive: true, force: true })
  }
}

it('includes dev, peer and explicit cross-root dependencies in the reverse closure', () => {
  const packages = [pkg('source', 'packages/source'), pkg('consumer', 'apps/consumer', ['source']), pkg('other', 'packages/other', [], ['skills/shared/**'])]
  expect([...analyzePackageImpact(['packages/source/src/index.ts'], packages).affected].sort()).toEqual(['consumer', 'source'])
  expect([...analyzePackageImpact(['skills/shared/SKILL.md'], packages).affected]).toEqual(['other'])
  expect(ownerOf('packages/source/src/index.ts', packages)?.name).toBe('source')
  expect(ownerOf('packages/source-copy/index.ts', packages)).toBeUndefined()
})

it('reads workspace negatives, private apps and package Turbo inputs', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'verify-workspace-'))
  const write = async (file: string, content: unknown) => {
    await mkdir(path.dirname(path.join(root, file)), { recursive: true })
    await writeFile(path.join(root, file), typeof content === 'string' ? content : JSON.stringify(content))
  }
  try {
    await write('pnpm-workspace.yaml', 'packages:\n  - packages/*\n  - apps/*\n  - "!packages/ignored"\n')
    await write('packages/source/package.json', { name: 'source', scripts: { build: 'node build.mjs' } })
    await write('packages/ignored/package.json', { name: 'ignored' })
    await write('apps/consumer/package.json', { name: 'consumer', private: true, devDependencies: { source: '^1.0.0' }, peerDependencies: { external: '*' } })
    await write('apps/consumer/turbo.json', { tasks: { build: { dependsOn: ['source#build'], inputs: ['$TURBO_ROOT$/skills/shared/**'] } } })
    const packages = await readWorkspace(root)
    expect(packages.map(item => item.name).sort()).toEqual(['consumer', 'source'])
    expect(packages.find(item => item.name === 'consumer')).toMatchObject({ dependencies: ['source'], extraInputs: ['skills/shared/**'] })
  }
  finally {
    await rm(root, { recursive: true, force: true })
  }
})

it('includes root Turbo global inputs, generic tasks and scoped package task dependencies', async () => {
  await fixture(async (root, write) => {
    await write('pnpm-workspace.yaml', 'packages:\n  - packages/*\n')
    for (const name of ['source', 'consumer', 'other', 'eslint']) {
      await write(`packages/${name}/package.json`, { name })
    }
    await write('turbo.json', {
      globalDependencies: ['e2e/utils/requestClientsRealHostTraceRuntime.ts'],
      tasks: {
        'build': { inputs: ['$TURBO_DEFAULT$', '$TURBO_ROOT$/shared/build/**'] },
        'lint': { inputs: ['$TURBO_ROOT$/packages/eslint/src/**'] },
        'consumer#test': { dependsOn: ['source#build'], inputs: ['$TURBO_ROOT$/skills/consumer/**'] },
      },
    })
    const packages = await readWorkspace(root)
    expect(packages.find(item => item.name === 'consumer')?.dependencies).toEqual(['source'])
    expect(packages.find(item => item.name === 'other')?.dependencies).toEqual([])
    expect([...analyzePackageImpact(['packages/source/index.ts'], packages).affected].sort()).toEqual(['consumer', 'source'])
    expect([...analyzePackageImpact(['skills/consumer/SKILL.md'], packages).affected]).toEqual(['consumer'])
    const all = packages.map(item => item.name).sort()
    for (const file of ['e2e/utils/requestClientsRealHostTraceRuntime.ts', 'shared/build/config.json', 'packages/eslint/src/index.ts']) {
      expect([...analyzePackageImpact([file], packages).affected].sort()).toEqual(all)
    }
  })
})

it('resolves all four dependency groups, workspace aliases and local package paths', async () => {
  await fixture(async (root, write) => {
    await write('pnpm-workspace.yaml', 'packages:\n  - packages/*\n')
    for (const name of ['runtime', 'dev', 'peer', 'optional', 'aliased', 'linked']) {
      await write(`packages/${name}/package.json`, { name })
    }
    await write('packages/consumer/package.json', {
      name: 'consumer',
      dependencies: { runtime: 'workspace:*', alias: 'workspace:aliased@*' },
      devDependencies: { dev: '^1.0.0', localAlias: 'link:../linked' },
      peerDependencies: { peer: '*' },
      optionalDependencies: { optional: 'workspace:*', assets: 'file:../../scripts/assets' },
    })
    const packages = await readWorkspace(root)
    expect(packages.find(item => item.name === 'consumer')).toMatchObject({
      dependencies: ['aliased', 'dev', 'linked', 'optional', 'peer', 'runtime'],
      extraInputs: ['scripts/assets', 'scripts/assets/**'],
    })
    for (const name of ['runtime', 'dev', 'peer', 'optional', 'aliased', 'linked']) {
      expect(analyzePackageImpact([`packages/${name}/index.ts`], packages).affected.has('consumer')).toBe(true)
    }
    expect([...analyzePackageImpact(['scripts/assets/token.json'], packages).affected]).toEqual(['consumer'])
  })
})

it('routes shared fixtures back to their test owners and keeps E2E helper dist prerequisites', async () => {
  await fixture(async (root, write) => {
    await write('pnpm-workspace.yaml', 'packages:\n  - packages/*\n  - test/fixture-projects/weapp-vite/*\n  - templates/*\n')
    const names = ['weapp-vite', 'create-weapp-vite', 'weapp-ide-cli', '@weapp-vite/devtools-runtime', '@weapp-vite/miniprogram-automator', '@mpcore/simulator', 'unrelated']
    for (const [index, name] of names.entries()) {
      await write(`packages/package-${index}/package.json`, { name })
    }
    await write('test/fixture-projects/weapp-vite/basic/package.json', { name: 'fixture-basic', devDependencies: { 'weapp-vite': 'workspace:*' } })
    await write('templates/example/package.json', { name: 'template-example' })
    const packages = await readWorkspace(root)
    expect([...analyzePackageImpact(['test/fixture-projects/weapp-vite/basic/src/index.ts'], packages).affected].sort()).toEqual(['fixture-basic', 'weapp-vite'])
    expect([...analyzePackageImpact(['templates/example/src/index.ts'], packages).affected].sort()).toEqual(['create-weapp-vite', 'template-example'])
    for (const file of ['e2e/scripts/suiteRunner.ts', 'e2e/utils/automator.ts']) {
      const { affected } = analyzePackageImpact([file], packages)
      for (const name of names.filter(name => !['create-weapp-vite', 'unrelated'].includes(name))) {
        expect(affected.has(name)).toBe(true)
      }
      expect(affected.has('unrelated')).toBe(false)
    }
    const all = packages.map(item => item.name).sort()
    for (const file of ['scripts/unmapped.ts', 'e2e/new-kind/input.json', 'test/fixture-projects/unmapped/input.wxml', 'skills/unmapped/SKILL.md']) {
      const impact = analyzePackageImpact([file], packages)
      expect([...impact.affected].sort()).toEqual(all)
      expect(impact.fallback).toEqual({ reason: 'unmapped-cross-directory', files: [file] })
    }
    expect([...analyzePackageImpact(['docs/guide.md'], packages).affected]).toEqual([])
  })
})
