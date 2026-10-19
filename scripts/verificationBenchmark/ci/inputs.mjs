import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { relativeFile } from './tree.mjs'

const hash = value => createHash('sha256').update(value).digest('hex')

// 此策略只排除验证实现；框架、应用、模板与 fixture 均按树自动展开。
export const frameworkInputPolicy = {
  version: 'framework-tree-v2',
  algorithm: 'sha256-of-git-blob-sha1-and-explicit-json-projections-v1',
  roots: ['@weapp-core/', 'packages/', 'packages-runtime/', 'packages-private/', 'apps/', 'templates/', 'e2e-apps/', 'test/fixture-projects/', 'mpcore/packages/', 'mpcore/demos/', 'extensions/', 'patches/', 'scripts/'],
  rootFiles: ['package.json', 'pnpm-lock.yaml', 'pnpm-workspace.yaml', '.npmrc', 'turbo.json', 'vitest.coverage.ts'],
  rootPatterns: ['tsconfig*.json'],
  excludedDirectories: ['scripts/verification/', 'scripts/verificationBenchmark/', 'scripts/verificationE2E/', 'scripts/verificationTelemetry/', 'scripts/coverageShards/', 'scripts/consumerArtifacts/', 'scripts/turboCacheContract/'],
  excludedFiles: [
    'scripts/ciTypes.mjs',
    'scripts/vitest.config.mjs',
    'scripts/workflowFixture.mjs',
    'packages/weapp-vite/test/utils.ts',
    'packages/weapp-vite/test/utils/fixtureIsolation.test.ts',
    'packages/weapp-vite/vitest.config.ts',
    'packages/weapp-vite/vitest/partition.ts',
  ],
  excludedPatterns: ['scripts/**/*.test.*'],
  jsonProjections: {
    'package.json': ['scripts.verify', 'scripts.verify:plan', 'scripts.test:pure'],
    'turbo.json': ['tasks.test:pure'],
    '@weapp-core/constants/package.json': ['scripts.test:pure'],
    'packages/hmr/package.json': ['scripts.test:pure'],
  },
}

function canonical(value) {
  if (Array.isArray(value)) {
    return value.map(canonical)
  }
  return value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])])) : value
}

/** 策略本身进入摘要，不能通过手写不完整 inputFiles 选择性隐藏变更。 */
export async function frameworkInputs(entries, read, policy = frameworkInputPolicy) {
  assert.deepEqual(policy, frameworkInputPolicy, 'Unknown or modified framework input policy')
  const selected = []
  const excluded = []
  const seen = new Set()
  for (const entry of entries) {
    const file = relativeFile(entry.path)
    if (seen.has(file)) {
      throw new Error('Duplicated framework input path')
    }
    seen.add(file)
    const included = policy.roots.some(root => file.startsWith(root)) || policy.rootFiles.includes(file) || /^tsconfig[^/]*\.json$/u.test(file)
    if (!included || entry.type === 'tree') {
      continue
    }
    const reason = policy.excludedDirectories.find(directory => file.startsWith(directory))
      ?? policy.excludedFiles.find(value => value === file)
      ?? (/^scripts\/.*\.test\.[^/]+$/u.test(file) ? policy.excludedPatterns[0] : null)
    if (reason) {
      excluded.push({ path: file, rule: reason })
      continue
    }
    if (entry.type !== 'blob' || !['100644', '100755'].includes(entry.mode) || !/^[a-f\d]{40}$/u.test(entry.sha ?? '')) {
      throw new Error(`Unsupported framework input type or mode: ${file}`)
    }
    selected.push({ path: file, mode: entry.mode, blobSha: entry.sha })
  }
  for (const required of ['package.json', 'pnpm-lock.yaml', 'pnpm-workspace.yaml', 'turbo.json', 'vitest.coverage.ts']) {
    assert(selected.some(entry => entry.path === required), `Missing required framework input: ${required}`)
  }
  assert(selected.some(entry => entry.path.startsWith('packages/')), 'Missing framework package inputs')
  selected.sort((left, right) => left.path.localeCompare(right.path))
  const inventory = []
  for (const entry of selected) {
    const fields = policy.jsonProjections[entry.path]
    if (!fields) {
      inventory.push([entry.path, entry.mode, 'git-blob-sha1', entry.blobSha])
      continue
    }
    const value = JSON.parse((await read(entry.path)).bytes.toString('utf8'))
    assert(value && typeof value === 'object' && !Array.isArray(value), 'Invalid framework package manifest')
    for (const field of fields) {
      const [key, name] = field.split('.')
      if (value[key] && typeof value[key] === 'object') {
        delete value[key][name]
      }
    }
    inventory.push([entry.path, entry.mode, 'projected-json-sha256', hash(JSON.stringify(canonical(value)))])
  }
  return {
    inputDigest: hash(JSON.stringify({ policy, inventory })),
    receipt: { policy, inventory, excluded: excluded.sort((left, right) => left.path.localeCompare(right.path)), projectedFields: policy.jsonProjections },
  }
}
