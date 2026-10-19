import { Buffer } from 'node:buffer'
import { createHash } from 'node:crypto'
import { expect, it } from 'vitest'
import { frameworkInputPolicy, frameworkInputs } from './inputs.mjs'

const hash = bytes => createHash('sha1').update(`blob ${Buffer.byteLength(bytes)}\0${bytes}`).digest('hex')
function sources() {
  return {
    'package.json': JSON.stringify({ engines: { node: '24' }, scripts: { 'build': 'build-all', 'verify': 'verify', 'verify:plan': 'plan', 'test:pure': 'pure' } }),
    'pnpm-lock.yaml': 'lockfileVersion: 9',
    'pnpm-workspace.yaml': 'packages: [packages/*]',
    'turbo.json': JSON.stringify({ globalDependencies: ['package.json'], tasks: { 'build': { dependsOn: ['^build'], inputs: ['$TURBO_DEFAULT$'] }, 'test:pure': { cache: true } } }),
    'vitest.coverage.ts': 'export const thresholds = { lines: 100 }',
    'packages/framework/src/index.ts': 'export const value = 1',
    'packages/framework/test/fixtures/native/index.js': 'Page({})',
    'templates/new-app/src/index.ts': 'App({})',
    '@weapp-core/constants/package.json': JSON.stringify({ scripts: { 'build': 'compile', 'test:pure': 'test' } }),
    'packages/hmr/package.json': JSON.stringify({ scripts: { 'build': 'compile', 'test:pure': 'test' } }),
    'scripts/verification/plan.ts': 'verification implementation',
    'scripts/verificationTelemetry/logicalCoverage.mjs': 'additive telemetry implementation',
    'packages/weapp-vite/test/utils.ts': 'test helper',
  }
}

async function collect(files, extra = []) {
  return frameworkInputs([...Object.entries(files).map(([path, bytes]) => ({ path, mode: '100644', type: 'blob', sha: hash(bytes) })), ...extra], async file => ({ bytes: Buffer.from(files[file]) }))
}

it('automatically expands all framework/fixture files and records the versioned policy', async () => {
  const files = sources()
  const initial = await collect(files)
  expect(initial.receipt.inventory.map(entry => entry[0])).toContain('packages/framework/test/fixtures/native/index.js')
  expect(initial.receipt.projectedFields).toEqual(frameworkInputPolicy.jsonProjections)
  expect(initial.receipt.excluded).toContainEqual({ path: 'scripts/verification/plan.ts', rule: 'scripts/verification/' })
  expect(initial.receipt.excluded).toContainEqual({ path: 'scripts/verificationTelemetry/logicalCoverage.mjs', rule: 'scripts/verificationTelemetry/' })
  expect(initial.receipt.policy.version).toBe('framework-tree-v2')
  files['scripts/verificationTelemetry/logicalCoverage.mjs'] += '\nchanged telemetry'
  expect((await collect(files)).inputDigest).toBe(initial.inputDigest)
  files['packages/new-package/src/runtime.ts'] = 'export const runtime = true'
  expect((await collect(files)).inputDigest).not.toBe(initial.inputDigest)
})

it.each(['packages/framework/src/index.ts', 'packages/framework/test/fixtures/native/index.js', 'templates/new-app/src/index.ts', 'pnpm-lock.yaml', 'pnpm-workspace.yaml', 'vitest.coverage.ts'])(
  'binds actual immutable input changes in %s',
  async (file) => {
    const files = sources()
    const initial = await collect(files)
    files[file] += '\nchanged'
    expect((await collect(files)).inputDigest).not.toBe(initial.inputDigest)
  },
)

it('ignores only individually named verification keys while retaining build/dependency/engine fields', async () => {
  const files = sources()
  const initial = await collect(files)
  for (const [file, fields] of Object.entries(frameworkInputPolicy.jsonProjections)) {
    const value = JSON.parse(files[file])
    for (const field of fields) {
      const [key, name] = field.split('.')
      value[key][name] = 'different validation command'
    }
    files[file] = JSON.stringify(value)
  }
  expect((await collect(files)).inputDigest).toBe(initial.inputDigest)
  const value = JSON.parse(files['package.json'])
  value.scripts.build = 'different build command'
  files['package.json'] = JSON.stringify(value)
  expect((await collect(files)).inputDigest).not.toBe(initial.inputDigest)
})

it.each(['turbo.json', 'vitest.coverage.ts'])('rejects an incomplete tree missing %s', async (file) => {
  const files = sources()
  delete files[file]
  await expect(collect(files)).rejects.toThrow(/required/u)
})

it.each([
  value => value.tasks.build.inputs.push('new-build-input'),
  value => value.tasks.build.dependsOn.push('new-build-dependency'),
  value => value.globalDependencies.push('global-build-input'),
])('retains every non-projected turbo build input and dependency', async (mutate) => {
  const files = sources()
  const initial = await collect(files)
  const value = JSON.parse(files['turbo.json'])
  mutate(value)
  files['turbo.json'] = JSON.stringify(value)
  expect((await collect(files)).inputDigest).not.toBe(initial.inputDigest)
})

it('rejects missing dependencies, modified policies, duplicate paths and filesystem escape modes', async () => {
  const files = sources()
  await expect(collect(files, [{ path: 'packages/symlink', type: 'blob', mode: '120000', sha: 'a'.repeat(40) }])).rejects.toThrow(/mode/u)
  await expect(collect(files, [{ path: 'packages/submodule', type: 'commit', mode: '160000', sha: 'a'.repeat(40) }])).rejects.toThrow(/mode/u)
  await expect(collect(files, [{ path: 'packages/../escape', type: 'blob', mode: '100644', sha: 'a'.repeat(40) }])).rejects.toThrow(/relative/u)
  await expect(collect(files, [{ path: 'package.json', type: 'blob', mode: '100644', sha: 'a'.repeat(40) }])).rejects.toThrow(/Duplicated/u)
  await expect(frameworkInputs([], () => {}, { ...frameworkInputPolicy, roots: ['packages/'] })).rejects.toThrow(/policy/u)
  delete files['pnpm-lock.yaml']
  await expect(collect(files)).rejects.toThrow(/required/u)
})
