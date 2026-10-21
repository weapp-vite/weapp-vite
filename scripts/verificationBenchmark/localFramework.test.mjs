import { execFileSync } from 'node:child_process'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, expect, it } from 'vitest'
import { frameworkInputPolicy } from './ci/inputs.mjs'
import { LOCAL_FRAMEWORK_INPUT_POLICY, localFrameworkInputs } from './localFramework.mjs'

const roots = []
afterEach(async () => {
  await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })))
})

async function repository() {
  const root = await mkdtemp(path.join(os.tmpdir(), 'local-framework-'))
  roots.push(root)
  const git = args => execFileSync('git', args, { cwd: root, stdio: 'pipe', encoding: 'utf8' }).trim()
  const write = async (file, bytes) => {
    await mkdir(path.dirname(path.join(root, file)), { recursive: true })
    await writeFile(path.join(root, file), bytes)
  }
  const commit = () => {
    git(['add', '.'])
    git(['-c', 'commit.gpgsign=false', '-c', 'user.name=Verification Fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '--quiet', '-m', 'fixture'])
  }
  const files = {
    'package.json': JSON.stringify({ scripts: { 'build': 'compile', 'verify': 'verify', 'test:pure': 'pure' }, engines: { node: '24' } }),
    'pnpm-lock.yaml': 'lockfileVersion: 9\n',
    'pnpm-workspace.yaml': 'packages: [packages/*]\n',
    'turbo.json': JSON.stringify({ globalDependencies: ['package.json'], tasks: { 'build': { dependsOn: ['^build'], inputs: ['$TURBO_DEFAULT$'] }, 'test:pure': { cache: true } } }),
    'vitest.coverage.ts': 'export const thresholds = { lines: 100 }\n',
    'packages/framework/src/index.ts': 'export const value = 1\n',
    'e2e-apps/fixture/pages/index.ts': 'Page({})\n',
    'templates/app/src/app.ts': 'App({})\n',
    'scripts/verification/plan.ts': 'validation implementation\n',
  }
  git(['init', '--quiet', '--initial-branch=main', '--template='])
  git(['config', 'core.hooksPath', path.join(root, '.git/fixture-hooks')])
  await Promise.all(Object.entries(files).map(([file, bytes]) => write(file, bytes)))
  commit()
  return { root, files, git, write, commit }
}

it('automatically freezes the complete CI input policy and immutable file/mode inventory', async () => {
  const { root, git } = await repository()
  const snapshot = await localFrameworkInputs(root)
  expect(LOCAL_FRAMEWORK_INPUT_POLICY).toBe('framework-tree-v2')
  expect(snapshot).toMatchObject({ commitSha: git(['rev-parse', 'HEAD']), treeSha: git(['rev-parse', 'HEAD^{tree}']) })
  expect(snapshot.receipt.policy).toEqual(frameworkInputPolicy)
  expect(snapshot.receipt.inventory).toContainEqual(['packages/framework/src/index.ts', '100644', 'git-blob-sha1', git(['rev-parse', 'HEAD:packages/framework/src/index.ts'])])
  expect(snapshot.receipt.inventory.map(entry => entry[0])).toEqual(expect.arrayContaining(['e2e-apps/fixture/pages/index.ts', 'templates/app/src/app.ts']))
  expect(snapshot.receipt.excluded).toContainEqual({ path: 'scripts/verification/plan.ts', rule: 'scripts/verification/' })
})

it('projects only known validation fields while changes in build/dependency inputs remain visible', async () => {
  const { root, files, write, commit } = await repository()
  const before = await localFrameworkInputs(root)
  const manifest = JSON.parse(files['package.json'])
  manifest.scripts.verify = 'different verify'
  manifest.scripts['test:pure'] = 'different pure'
  const turbo = JSON.parse(files['turbo.json'])
  turbo.tasks['test:pure'] = { cache: false }
  await write('package.json', JSON.stringify(manifest))
  await write('turbo.json', JSON.stringify(turbo))
  await write('scripts/verification/plan.ts', 'changed validation implementation\n')
  commit()
  const projected = await localFrameworkInputs(root)
  expect(projected.inputDigest).toBe(before.inputDigest)
  expect(projected.sourceFingerprint).not.toBe(before.sourceFingerprint)
  manifest.scripts.build = 'changed build'
  await write('package.json', JSON.stringify(manifest))
  commit()
  expect((await localFrameworkInputs(root)).inputDigest).not.toBe(before.inputDigest)
})

it.each(['packages/framework/src/index.ts', 'e2e-apps/fixture/pages/index.ts', 'templates/app/src/app.ts', 'pnpm-lock.yaml', 'vitest.coverage.ts'])(
  'automatically includes committed changes in %s',
  async (file) => {
    const { root, files, write, commit } = await repository()
    const before = await localFrameworkInputs(root)
    await write(file, `${files[file]}\nchanged\n`)
    commit()
    expect((await localFrameworkInputs(root)).inputDigest).not.toBe(before.inputDigest)
  },
)

it('includes new framework files and rejects dirty sources even with generated evidence present', async () => {
  const { root, write, commit } = await repository()
  const before = await localFrameworkInputs(root)
  await write('packages/new-framework/src/runtime.ts', 'export const ready = true\n')
  await expect(localFrameworkInputs(root)).rejects.toThrow('clean known checkout')
  commit()
  const added = await localFrameworkInputs(root)
  expect(added.inputDigest).not.toBe(before.inputDigest)
  await write('docs/reports/dom-acceptance/run/invocation.json', '{}\n')
  expect((await localFrameworkInputs(root)).inputDigest).toBe(added.inputDigest)
  await write('packages/framework/src/index.ts', 'changed\n')
  await expect(localFrameworkInputs(root)).rejects.toThrow('clean known checkout')
})

it('rejects an incomplete committed framework tree', async () => {
  const { root, git, commit } = await repository()
  git(['rm', '--quiet', 'vitest.coverage.ts'])
  commit()
  await expect(localFrameworkInputs(root)).rejects.toThrow('Missing required framework input')
})
